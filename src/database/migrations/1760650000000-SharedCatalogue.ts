import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharedCatalogue1760650000000 implements MigrationInterface {
  name = 'SharedCatalogue1760650000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "cafe_status" AS ENUM ('upcoming', 'active', 'inactive')`);
    await queryRunner.query(`CREATE TYPE "product_channel" AS ENUM ('online', 'cafe')`);
    await queryRunner.query(`
      CREATE TABLE "cafes" (
        "id" uuid PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "status" "cafe_status" NOT NULL DEFAULT 'upcoming',
        "timezone" varchar(80) NOT NULL,
        "address" varchar(240),
        "city" varchar(80),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_cafes_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "description" text,
        "display_order" smallint NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_product_categories_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY,
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "description" text NOT NULL,
        "image_url" varchar(500),
        "category_id" uuid NOT NULL REFERENCES "product_categories"("id") ON DELETE RESTRICT,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_products_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_products_category_active" ON "products" ("category_id", "is_active")`);
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid PRIMARY KEY,
        "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "sku" varchar(64) NOT NULL,
        "name" varchar(100) NOT NULL,
        "price_paise" integer NOT NULL CHECK ("price_paise" >= 0),
        "stock_quantity" integer NOT NULL DEFAULT 0 CHECK ("stock_quantity" >= 0),
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_product_variants_sku" UNIQUE ("sku")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_product_variants_product_active" ON "product_variants" ("product_id", "is_active")`);
    await queryRunner.query(`
      CREATE TABLE "product_availability" (
        "id" uuid PRIMARY KEY,
        "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "channel" "product_channel" NOT NULL,
        "cafe_id" uuid REFERENCES "cafes"("id") ON DELETE CASCADE,
        "is_available" boolean NOT NULL DEFAULT true,
        CONSTRAINT "ck_product_availability_channel_cafe"
          CHECK (("channel" = 'online' AND "cafe_id" IS NULL) OR ("channel" = 'cafe' AND "cafe_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_product_availability_online" ON "product_availability" ("variant_id") WHERE "channel" = 'online'`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_product_availability_cafe" ON "product_availability" ("variant_id", "cafe_id") WHERE "channel" = 'cafe'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_availability"`);
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "product_categories"`);
    await queryRunner.query(`DROP TABLE "cafes"`);
    await queryRunner.query(`DROP TYPE "product_channel"`);
    await queryRunner.query(`DROP TYPE "cafe_status"`);
  }
}