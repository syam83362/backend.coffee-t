import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  ProductAvailabilityEntity,
  ProductChannel,
} from '../database/entities/product-availability.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { ProductCategoryEntity } from '../database/entities/product-category.entity';
import { ProductEntity } from '../database/entities/product.entity';
import { ProductDiscoveryStatus } from '../database/entities/product.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { ListProductsDto } from './dto/list-products.dto';

type CatalogueChannel = Pick<ListProductsDto, 'channel' | 'cafeId'>;

@Injectable()
export class CatalogueService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductCategoryEntity)
    private readonly categories: Repository<ProductCategoryEntity>,
  ) {}

  async listCategories(): Promise<ProductCategoryEntity[]> {
    return this.categories.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async listProducts(query: ListProductsDto) {
    this.validateChannel(query);
    const builder = this.productQuery(query)
      .orderBy('product.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.category) {
      builder.andWhere('category.slug = :category', { category: query.category });
    }
    if (query.search?.trim()) {
      builder.andWhere('(product.name ILIKE :search OR product.description ILIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.availableOnly) {
      builder.andWhere('product.discoveryStatus <> :upcoming', { upcoming: ProductDiscoveryStatus.UPCOMING });
      builder.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants available_variant
          JOIN product_availability requested_availability
            ON requested_availability.variant_id = available_variant.id
          WHERE available_variant.product_id = product.id
            AND available_variant.is_active = true
            AND requested_availability.channel = :channel
            AND requested_availability.is_available = true
            AND requested_availability.cafe_id IS NOT DISTINCT FROM :cafeId
            AND (
              :channel <> 'cafe' OR EXISTS (
                SELECT 1 FROM cafe_inventory available_inventory
                WHERE available_inventory.variant_id = available_variant.id
                  AND available_inventory.cafe_id = :cafeId
                  AND available_inventory.quantity > available_inventory.reserved_quantity
              )
            )
        )`,
        { channel: query.channel, cafeId: query.cafeId ?? null },
      );
    }

    const [products, total] = await builder.getManyAndCount();
    return {
      data: products.map((product) => this.toProductResponse(product, query)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getProduct(slug: string, channel: CatalogueChannel) {
    this.validateChannel(channel);
    const product = await this.productQuery(channel)
      .andWhere('product.slug = :slug', { slug })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.toProductResponse(product, channel);
  }

  private productQuery(channel: CatalogueChannel): SelectQueryBuilder<ProductEntity> {
    return this.products
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.category', 'category', 'category.isActive = true')
      .leftJoinAndSelect('product.variants', 'variant', 'variant.isActive = true')
      .leftJoinAndSelect(
        'variant.availabilities',
        'availability',
        'availability.channel = :channel AND availability.cafeId IS NOT DISTINCT FROM :cafeId',
        { channel: channel.channel, cafeId: channel.cafeId ?? null },
      )
      .leftJoinAndMapOne(
        'variant.cafeInventory',
        CafeInventoryEntity,
        'cafeInventory',
        'cafeInventory.variantId = variant.id AND cafeInventory.cafeId = :cafeId',
        { cafeId: channel.cafeId ?? null },
      )
      .where('product.isActive = true');
  }

  private validateChannel(channel: CatalogueChannel): void {
    if (channel.channel === ProductChannel.CAFE && !channel.cafeId) {
      throw new BadRequestException('cafeId is required for café availability');
    }
  }

  private toProductResponse(
    product: ProductEntity,
    channel: CatalogueChannel,
  ) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      imageUrl: product.imageUrl,
      discoveryStatus: product.discoveryStatus,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        name: variant.name,
        pricePaise: this.priceForChannel(variant, channel),
        available:
          product.discoveryStatus !== ProductDiscoveryStatus.UPCOMING &&
          this.isAvailable(variant, channel),
      })),
    };
  }

  private isAvailable(variant: ProductVariantEntity, channel: CatalogueChannel): boolean {
    const available = (variant.availabilities ?? []).some(
      (availability: ProductAvailabilityEntity) =>
        availability.channel === channel.channel &&
        (channel.channel !== ProductChannel.CAFE || availability.cafeId === channel.cafeId) &&
        availability.isAvailable,
    );
    if (!available) return false;
    if (channel.channel === ProductChannel.CAFE) {
      const inventory = (variant as ProductVariantEntity & { cafeInventory?: CafeInventoryEntity | null }).cafeInventory;
      return Boolean(inventory && inventory.quantity > inventory.reservedQuantity);
    }
    return true;
  }

  private priceForChannel(variant: ProductVariantEntity, channel: CatalogueChannel): number {
    if (channel.channel === ProductChannel.CAFE) {
      const override = variant.availabilities?.find(
        (availability) => availability.channel === ProductChannel.CAFE && availability.cafeId === channel.cafeId,
      )?.priceOverridePaise;
      if (override !== null && override !== undefined) return override;
    }
    return variant.pricePaise;
  }
}