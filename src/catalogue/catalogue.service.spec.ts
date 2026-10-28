import { BadRequestException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProductCategoryEntity } from '../database/entities/product-category.entity';
import { ProductEntity } from '../database/entities/product.entity';
import { ProductChannel } from '../database/entities/product-availability.entity';
import { CatalogueService } from './catalogue.service';
import { ListProductsDto } from './dto/list-products.dto';

describe('CatalogueService', () => {
  let service: CatalogueService;
  let builder: Record<string, jest.Mock>;

  beforeEach(() => {
    builder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const productRepository = {
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<ProductEntity>;
    const categoryRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<ProductCategoryEntity>;
    service = new CatalogueService(productRepository, categoryRepository);
  });

  it('filters by category and search and returns pagination metadata', async () => {
    const result = await service.listProducts({
      category: 'coffee',
      search: 'malabar',
      page: 2,
      limit: 5,
      channel: ProductChannel.ONLINE,
      availableOnly: false,
    } as ListProductsDto);

    expect(builder.andWhere).toHaveBeenCalledWith('category.slug = :category', {
      category: 'coffee',
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      '(product.name ILIKE :search OR product.description ILIKE :search)',
      { search: '%malabar%' },
    );
    expect(builder.skip).toHaveBeenCalledWith(5);
    expect(result).toMatchObject({ page: 2, limit: 5, total: 0, totalPages: 0, data: [] });
  });

  it('scopes café availability to the requested café', async () => {
    await service.listProducts({
      page: 1,
      limit: 12,
      channel: ProductChannel.CAFE,
      cafeId: '10000000-0000-4000-8000-000000000001',
      availableOnly: true,
    } as ListProductsDto);

    expect(builder.leftJoinAndSelect).toHaveBeenCalledWith(
      'variant.availabilities',
      'availability',
      expect.stringContaining('availability.cafeId IS NOT DISTINCT FROM :cafeId'),
      { channel: ProductChannel.CAFE, cafeId: '10000000-0000-4000-8000-000000000001' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('requested_availability.cafe_id IS NOT DISTINCT FROM :cafeId'),
      { channel: ProductChannel.CAFE, cafeId: '10000000-0000-4000-8000-000000000001' },
    );
  });

  it('rejects café availability queries without a café ID', async () => {
    await expect(
      service.listProducts({
        page: 1,
        limit: 12,
        channel: ProductChannel.CAFE,
        availableOnly: true,
      } as ListProductsDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(builder.getManyAndCount).not.toHaveBeenCalled();
  });
});