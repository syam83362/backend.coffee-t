import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { CafeEntity, CafeStatus } from '../database/entities/cafe.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { CafeStaffAssignmentEntity } from '../database/entities/cafe-staff-assignment.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { ProductAvailabilityEntity, ProductChannel } from '../database/entities/product-availability.entity';
import { ProductCategoryEntity } from '../database/entities/product-category.entity';
import { ProductDiscoveryStatus, ProductEntity } from '../database/entities/product.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { UserEntity, UserRole } from '../database/entities/user.entity';
import {
  AssignCafeStaffDto,
  CafeVariantConfigDto,
  CreateCafeDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateTableDto,
  CreateVariantDto,
  GlobalVariantConfigDto,
  UpdateCafeDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CafeEntity) private readonly cafes: Repository<CafeEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
  ) {}

  async listCafes(user: AuthenticatedRequestUser) {
    if (user.role === UserRole.ADMIN) return this.cafes.find({ order: { city: 'ASC', name: 'ASC' } });
    const assignments = await this.dataSource.getRepository(CafeStaffAssignmentEntity).find({
      where: { userId: user.id }, relations: { cafe: true }, order: { cafeId: 'ASC' },
    });
    return assignments.map((assignment) => assignment.cafe);
  }

  async listCafeVariants(user: AuthenticatedRequestUser, cafeId: string) {
    await this.assertCafeAccess(user, cafeId);
    const variants = await this.dataSource.getRepository(ProductVariantEntity).find({
      relations: { product: { category: true } },
      order: { product: { name: 'ASC' }, name: 'ASC' },
    });
    const availability = this.dataSource.getRepository(ProductAvailabilityEntity);
    const inventory = this.dataSource.getRepository(CafeInventoryEntity);
    return Promise.all(variants.map(async (variant) => ({
      ...variant,
      cafeAvailability: await availability.findOne({ where: { variantId: variant.id, cafeId, channel: ProductChannel.CAFE } }),
      cafeInventory: await inventory.findOne({ where: { variantId: variant.id, cafeId } }),
    })));
  }

  async createCafe(user: AuthenticatedRequestUser, dto: CreateCafeDto) {
    try { new Intl.DateTimeFormat('en', { timeZone: dto.timezone }); }
    catch { throw new BadRequestException('Café timezone must be a valid IANA timezone'); }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CafeEntity);
      const cafe = await repository.save(repository.create({
        id: randomUUID(), name: dto.name.trim(), slug: dto.slug, timezone: dto.timezone,
        address: dto.address?.trim() ?? null, city: dto.city?.trim() ?? null,
        status: CafeStatus.UPCOMING, openingTime: '08:00', closingTime: '20:00',
      }));
      await this.auditIn(manager, user.id, cafe.id, 'cafe.created', 'cafe', cafe.id, { slug: cafe.slug });
      return cafe;
    });
  }

  async updateCafe(user: AuthenticatedRequestUser, cafeId: string, dto: UpdateCafeDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CafeEntity);
      const cafe = await repository.findOne({ where: { id: cafeId } });
      if (!cafe) throw new NotFoundException('Café not found');
      const before = { status: cafe.status, openingTime: cafe.openingTime, closingTime: cafe.closingTime };
      Object.assign(cafe, dto);
      if (cafe.closingTime <= cafe.openingTime) throw new ForbiddenException('Closing time must be after opening time');
      await repository.save(cafe);
      await this.auditIn(manager, user.id, cafeId, 'cafe.updated', 'cafe', cafeId, {
        before: JSON.stringify(before), after: JSON.stringify(dto),
      });
      return cafe;
    });
  }

  async createTable(user: AuthenticatedRequestUser, cafeId: string, dto: CreateTableDto) {
    return this.dataSource.transaction(async (manager) => {
      const cafe = await manager.getRepository(CafeEntity).findOne({ where: { id: cafeId } });
      if (!cafe) throw new NotFoundException('Café not found');
      const token = randomBytes(32).toString('base64url');
      const tableCode = `${cafe.slug.slice(0, 12)}-${dto.tableNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const table = await manager.getRepository(CafeTableEntity).save(manager.getRepository(CafeTableEntity).create({
        id: randomUUID(), cafeId, tableNumber: dto.tableNumber.trim(), tableCode,
        capacity: dto.capacity, tokenHash: createHash('sha256').update(token).digest('hex'), isActive: true,
      }));
      await this.auditIn(manager, user.id, cafeId, 'cafe_table.created', 'cafe_table', table.id, { tableNumber: table.tableNumber });
      return { table, tableToken: token };
    });
  }

  async assignStaff(user: AuthenticatedRequestUser, cafeId: string, dto: AssignCafeStaffDto) {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const target = await users.findOne({ where: { id: dto.userId, isActive: true } });
      if (!target) throw new NotFoundException('Active user not found');
      if (target.role === UserRole.ADMIN) throw new ForbiddenException('Platform administrators cannot be assigned as café staff');
      if (target.role !== dto.role) {
        target.role = dto.role;
        await users.save(target);
      }
      const assignments = manager.getRepository(CafeStaffAssignmentEntity);
      const existing = await assignments.findOne({ where: { cafeId, userId: target.id } });
      if (!existing) await assignments.save(assignments.create({ id: randomUUID(), cafeId, userId: target.id }));
      await this.auditIn(manager, user.id, cafeId, 'cafe_staff.assigned', 'user', target.id, { role: dto.role });
      return { userId: target.id, role: target.role, cafeId };
    });
  }

  async createCategory(user: AuthenticatedRequestUser, dto: CreateCategoryDto) {
    const repository = this.dataSource.getRepository(ProductCategoryEntity);
    const category = await repository.save(repository.create({
      id: randomUUID(), name: dto.name.trim(), slug: dto.slug,
      description: dto.description?.trim() ?? null, displayOrder: 0, isActive: true,
    }));
    await this.audit(user.id, null, 'product_category.created', 'product_category', category.id, { slug: category.slug });
    return category;
  }

  async createProduct(user: AuthenticatedRequestUser, dto: CreateProductDto) {
    const product = await this.products.save(this.products.create({
      id: randomUUID(), name: dto.name.trim(), slug: dto.slug, description: dto.description.trim(),
      categoryId: dto.categoryId, imageUrl: dto.imageUrl ?? null, isActive: true,
      discoveryStatus: dto.discoveryStatus ?? ProductDiscoveryStatus.CURRENT,
    }));
    await this.audit(user.id, null, 'product.created', 'product', product.id, { slug: product.slug });
    return product;
  }

  async createVariant(user: AuthenticatedRequestUser, productId: string, dto: CreateVariantDto) {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const repository = this.dataSource.getRepository(ProductVariantEntity);
    const variant = await repository.save(repository.create({
      id: randomUUID(), productId, sku: dto.sku.trim(), name: dto.name.trim(),
      pricePaise: dto.pricePaise, stockQuantity: dto.stockQuantity, reservedQuantity: 0, isActive: true,
    }));
    await this.audit(user.id, null, 'product_variant.created', 'product_variant', variant.id, { sku: variant.sku, pricePaise: variant.pricePaise });
    return variant;
  }

  async setCafeVariant(user: AuthenticatedRequestUser, cafeId: string, variantId: string, dto: CafeVariantConfigDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertCafeAccess(user, cafeId, manager);
      const cafe = await manager.getRepository(CafeEntity).findOne({ where: { id: cafeId } });
      const variant = await manager.getRepository(ProductVariantEntity).findOne({ where: { id: variantId, isActive: true } });
      if (!cafe || !variant) throw new NotFoundException('Café or active product variant not found');
      const availabilities = manager.getRepository(ProductAvailabilityEntity);
      let availability = await availabilities.findOne({ where: { variantId, channel: ProductChannel.CAFE, cafeId } });
      const before = availability ? { isAvailable: availability.isAvailable, priceOverridePaise: availability.priceOverridePaise } : null;
      if (!availability) availability = availabilities.create({ id: randomUUID(), variantId, channel: ProductChannel.CAFE, cafeId, isAvailable: dto.isAvailable, priceOverridePaise: dto.priceOverridePaise ?? null });
      else { availability.isAvailable = dto.isAvailable; availability.priceOverridePaise = dto.priceOverridePaise ?? null; }
      await availabilities.save(availability);

      const inventoryRepository = manager.getRepository(CafeInventoryEntity);
      let inventory = await inventoryRepository.findOne({ where: { cafeId, variantId } });
      const oldQuantity = inventory?.quantity ?? 0;
      if (!inventory) inventory = inventoryRepository.create({ id: randomUUID(), cafeId, variantId, quantity: dto.quantity, reservedQuantity: 0 });
      else {
        if (dto.quantity < inventory.reservedQuantity) throw new ForbiddenException('Stock cannot be reduced below the reserved quantity');
        inventory.quantity = dto.quantity;
      }
      inventory.updatedAt = new Date();
      await inventoryRepository.save(inventory);
      await this.auditIn(manager, user.id, cafeId, 'cafe_menu.updated', 'product_variant', variantId, {
        before: JSON.stringify(before), isAvailable: dto.isAvailable, oldQuantity, quantity: dto.quantity,
        priceOverridePaise: dto.priceOverridePaise ?? null,
      });
      return { availability, inventory };
    });
  }

  async setGlobalVariant(user: AuthenticatedRequestUser, variantId: string, dto: GlobalVariantConfigDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProductVariantEntity);
      const variant = await repository.findOne({ where: { id: variantId } });
      if (!variant) throw new NotFoundException('Product variant not found');
      if (dto.stockQuantity < variant.reservedQuantity) throw new ForbiddenException('Stock cannot be reduced below the reserved quantity');
      const before = { pricePaise: variant.pricePaise, stockQuantity: variant.stockQuantity, isActive: variant.isActive };
      variant.pricePaise = dto.pricePaise;
      variant.stockQuantity = dto.stockQuantity;
      variant.isActive = dto.isActive;
      await repository.save(variant);
      await this.auditIn(manager, user.id, null, 'product_variant.updated', 'product_variant', variantId, {
        before: JSON.stringify(before), pricePaise: dto.pricePaise, stockQuantity: dto.stockQuantity, isActive: dto.isActive,
      });
      return variant;
    });
  }

  async listProducts() {
    return this.products.find({ relations: { category: true, variants: { availabilities: true } }, order: { name: 'ASC' } });
  }

  async auditLogs(user: AuthenticatedRequestUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Platform administrator access required');
    return this.dataSource.getRepository(AuditLogEntity).find({ relations: { actor: true, cafe: true }, order: { createdAt: 'DESC' }, take: 200 });
  }

  private audit(actorUserId: string, cafeId: string | null, action: string, targetType: string, targetId: string, changes: Record<string, string | number | boolean | null>) {
    return this.dataSource.getRepository(AuditLogEntity).save({ id: randomUUID(), actorUserId, cafeId, action, targetType, targetId, changes });
  }

  private auditIn(manager: import('typeorm').EntityManager, actorUserId: string, cafeId: string | null, action: string, targetType: string, targetId: string, changes: Record<string, string | number | boolean | null>) {
    return manager.getRepository(AuditLogEntity).save({ id: randomUUID(), actorUserId, cafeId, action, targetType, targetId, changes });
  }

  private async assertCafeAccess(user: AuthenticatedRequestUser, cafeId: string, manager?: import('typeorm').EntityManager) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role !== UserRole.CAFE_MANAGER) throw new ForbiddenException('Café manager access required');
    const assignment = await (manager ?? this.dataSource.manager).getRepository(CafeStaffAssignmentEntity)
      .findOne({ where: { cafeId, userId: user.id } });
    if (!assignment) throw new ForbiddenException('You are not assigned to this café');
  }
}