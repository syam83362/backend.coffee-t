import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerOrders1760750000000 implements MigrationInterface {
  name = 'CustomerOrders1760750000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_variants" ADD "reserved_quantity" integer NOT NULL DEFAULT 0 CHECK ("reserved_quantity" >= 0)`);
    await queryRunner.query(`CREATE TYPE "order_fulfillment_type" AS ENUM ('delivery', 'dine_in', 'assisted_dine_in')`);
    await queryRunner.query(`CREATE TYPE "order_status" AS ENUM ('pending_payment', 'paid', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'refunded')`);
    await queryRunner.query(`
      CREATE TABLE "delivery_addresses" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "recipient_name" varchar(120) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "line1" varchar(160) NOT NULL,
        "line2" varchar(160),
        "city" varchar(100) NOT NULL,
        "state" varchar(100) NOT NULL,
        "pincode" varchar(10) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_delivery_addresses_user" ON "delivery_addresses" ("user_id")`);
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_carts_user_id" UNIQUE ("user_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "cart_items" (
        "id" uuid PRIMARY KEY,
        "cart_id" uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        "quantity" smallint NOT NULL CHECK ("quantity" BETWEEN 1 AND 100),
        CONSTRAINT "uq_cart_items_cart_variant" UNIQUE ("cart_id", "variant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "fulfillment_type" "order_fulfillment_type" NOT NULL,
        "status" "order_status" NOT NULL DEFAULT 'pending_payment',
        "total_paise" integer NOT NULL CHECK ("total_paise" >= 0),
        "delivery_address_snapshot" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_orders_user_created" ON "orders" ("user_id", "created_at" DESC)`);
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
        "variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
        "product_name" varchar(160) NOT NULL,
        "variant_name" varchar(100) NOT NULL,
        "sku" varchar(64) NOT NULL,
        "quantity" smallint NOT NULL CHECK ("quantity" BETWEEN 1 AND 100),
        "unit_price_paise" integer NOT NULL CHECK ("unit_price_paise" >= 0),
        "line_total_paise" integer NOT NULL CHECK ("line_total_paise" >= 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "carts"`);
    await queryRunner.query(`DROP TABLE "delivery_addresses"`);
    await queryRunner.query(`DROP TYPE "order_status"`);
    await queryRunner.query(`DROP TYPE "order_fulfillment_type"`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN "reserved_quantity"`);
  }
}