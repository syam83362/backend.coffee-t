import 'dotenv/config';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { CafeInventoryEntity } from './entities/cafe-inventory.entity';
import { CafeEntity, CafeStatus } from './entities/cafe.entity';
import { CafeTableEntity } from './entities/cafe-table.entity';
import {
  ProductAvailabilityEntity,
  ProductChannel,
} from './entities/product-availability.entity';
import { ProductCategoryEntity } from './entities/product-category.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { UserEntity } from './entities/user.entity';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development catalogue seed data cannot run in production');
}

const seedCafeId = '10000000-0000-4000-8000-000000000001';
const seedCafeTableId = '11000000-0000-4000-8000-000000000001';
const seedCafeTableCode = 'bengaluru-demo-t1';
const seedCafeTableToken = 'coffee-t-demo-table-token';
const categories = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Coffee',
    slug: 'coffee',
    description: 'Single-origin and carefully crafted Indian coffee.',
    displayOrder: 1,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Tea',
    slug: 'tea',
    description: 'Distinctive teas from growing regions across India.',
    displayOrder: 2,
  },
];

const products = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    categoryId: categories[0].id,
    name: 'Monsoon Malabar',
    slug: 'monsoon-malabar',
    description: 'A rounded, low-acidity coffee with cocoa depth and a soft spice finish.',
    imageUrl: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=1000&q=80',
    variantId: '40000000-0000-4000-8000-000000000001',
    sku: 'CT-COF-MAL-250',
    variantName: 'Whole bean, 250 g',
    pricePaise: 64900,
    stockQuantity: 80,
    cafeAvailable: true,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    categoryId: categories[0].id,
    name: 'Chikmagalur Filter Roast',
    slug: 'chikmagalur-filter-roast',
    description: 'A sweet, nutty medium roast made for South Indian filter coffee.',
    imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1000&q=80',
    variantId: '40000000-0000-4000-8000-000000000002',
    sku: 'CT-COF-CHI-250',
    variantName: 'Ground, 250 g',
    pricePaise: 54900,
    stockQuantity: 65,
    cafeAvailable: false,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    categoryId: categories[1].id,
    name: 'Nilgiri Frost Tea',
    slug: 'nilgiri-frost-tea',
    description: 'Fragrant high-grown black tea with a bright, clean finish.',
    imageUrl: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=1000&q=80',
    variantId: '40000000-0000-4000-8000-000000000003',
    sku: 'CT-TEA-NIL-100',
    variantName: 'Loose leaf, 100 g',
    pricePaise: 42500,
    stockQuantity: 100,
    cafeAvailable: true,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    categoryId: categories[1].id,
    name: 'Kangra Green',
    slug: 'kangra-green',
    description: 'A gentle green tea with a fresh vegetal aroma and mellow sweetness.',
    imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=1000&q=80',
    variantId: '40000000-0000-4000-8000-000000000004',
    sku: 'CT-TEA-KAN-100',
    variantName: 'Loose leaf, 100 g',
    pricePaise: 49500,
    stockQuantity: 0,
    cafeAvailable: false,
  },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    UserEntity,
    RefreshSessionEntity,
    CafeEntity,
    CafeTableEntity,
    CafeInventoryEntity,
    ProductAvailabilityEntity,
    ProductCategoryEntity,
    ProductEntity,
    ProductVariantEntity,
  ],
  synchronize: false,
});

async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.getRepository(CafeEntity).upsert(
      {
        id: seedCafeId,
        name: 'Coffee-T Bengaluru Demo',
        slug: 'bengaluru-demo',
        status: CafeStatus.ACTIVE,
        timezone: 'Asia/Kolkata',
        city: 'Bengaluru',
        address: 'Development seed location',
      },
      ['id'],
    );
    await dataSource.getRepository(ProductCategoryEntity).upsert(categories, ['id']);
    await dataSource.getRepository(CafeTableEntity).upsert({
      id: seedCafeTableId,
      cafeId: seedCafeId,
      tableNumber: '1',
      capacity: 4,
      tableCode: seedCafeTableCode,
      tokenHash: createHash('sha256').update(seedCafeTableToken).digest('hex'),
      isActive: true,
    }, ['id']);

    for (const product of products) {
      const { variantId, sku, variantName, pricePaise, stockQuantity, cafeAvailable, ...productData } = product;
      await dataSource.getRepository(ProductEntity).upsert(productData, ['id']);
      await dataSource.getRepository(ProductVariantEntity).upsert(
        {
          id: variantId,
          productId: product.id,
          sku,
          name: variantName,
          pricePaise,
          stockQuantity,
          isActive: true,
        },
        ['id'],
      );
      await dataSource.getRepository(ProductAvailabilityEntity).upsert(
        [
          {
            id: `50000000-0000-4000-8000-${variantId.slice(-12)}`,
            variantId,
            channel: ProductChannel.ONLINE,
            cafeId: null,
            isAvailable: stockQuantity > 0,
          },
          {
            id: `60000000-0000-4000-8000-${variantId.slice(-12)}`,
            variantId,
            channel: ProductChannel.CAFE,
            cafeId: seedCafeId,
            isAvailable: cafeAvailable,
          },
        ],
        ['id'],
      );
      await dataSource.getRepository(CafeInventoryEntity).upsert({
        id: `70000000-0000-4000-8000-${variantId.slice(-12)}`,
        cafeId: seedCafeId,
        variantId,
        quantity: cafeAvailable ? 25 : 0,
        reservedQuantity: 0,
        updatedAt: new Date(),
      }, ['id']);
    }
  } finally {
    await dataSource.destroy();
  }
  console.log(`Seeded ${categories.length} categories and ${products.length} products for development.`);
}

void seed().catch((error: unknown) => {
  console.error('Development catalogue seed failed.', error);
  process.exitCode = 1;
});