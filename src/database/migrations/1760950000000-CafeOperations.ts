import { MigrationInterface, QueryRunner } from 'typeorm';

export class CafeOperations1760950000000 implements MigrationInterface {
  name = 'CafeOperations1760950000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "user_role" ADD VALUE 'cafe_manager'`);
    await queryRunner.query(`ALTER TYPE "user_role" ADD VALUE 'waiter'`);
    await queryRunner.query(`CREATE TYPE "waiter_call_status" AS ENUM ('open', 'acknowledged', 'resolved')`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "cafe_id" uuid REFERENCES "cafes"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "cafe_table_id" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "order_number" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "client_request_id" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_orders_order_number" ON "orders" ("order_number") WHERE "order_number" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_orders_table_request" ON "orders" ("cafe_table_id", "client_request_id") WHERE "client_request_id" IS NOT NULL`);
    await queryRunner.query(`CREATE SEQUENCE "cafe_order_number_seq" START WITH 1001`);
    await queryRunner.query(`
      CREATE TABLE "cafe_tables" (
        "id" uuid PRIMARY KEY,
        "cafe_id" uuid NOT NULL REFERENCES "cafes"("id") ON DELETE CASCADE,
        "table_number" varchar(20) NOT NULL,
        "capacity" smallint NOT NULL DEFAULT 2 CHECK ("capacity" > 0),
        "table_code" varchar(64) NOT NULL UNIQUE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_cafe_tables_cafe_number" UNIQUE ("cafe_id", "table_number")
      )
    `);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_cafe_table" FOREIGN KEY ("cafe_table_id") REFERENCES "cafe_tables"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`
      CREATE TABLE "cafe_staff_assignments" (
        "id" uuid PRIMARY KEY,
        "cafe_id" uuid NOT NULL REFERENCES "cafes"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_cafe_staff_assignment" UNIQUE ("cafe_id", "user_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "waiter_calls" (
        "id" uuid PRIMARY KEY,
        "cafe_id" uuid NOT NULL REFERENCES "cafes"("id") ON DELETE CASCADE,
        "cafe_table_id" uuid NOT NULL REFERENCES "cafe_tables"("id") ON DELETE CASCADE,
        "status" "waiter_call_status" NOT NULL DEFAULT 'open',
        "resolved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "resolved_at" timestamptz
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_waiter_calls_cafe_status_created" ON "waiter_calls" ("cafe_id", "status", "created_at")`);
    await queryRunner.query(`
      CREATE TABLE "cash_collections" (
        "id" uuid PRIMARY KEY,
        "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE RESTRICT,
        "collected_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "amount_paise" integer NOT NULL CHECK ("amount_paise" > 0),
        "collected_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cash_collections"`);
    await queryRunner.query(`DROP TABLE "waiter_calls"`);
    await queryRunner.query(`DROP TABLE "cafe_staff_assignments"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_cafe_table"`);
    await queryRunner.query(`DROP TABLE "cafe_tables"`);
    await queryRunner.query(`DROP SEQUENCE "cafe_order_number_seq"`);
    await queryRunner.query(`DROP INDEX "uq_orders_order_number"`);
    await queryRunner.query(`DROP INDEX "uq_orders_table_request"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "client_request_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "order_number"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cafe_table_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cafe_id"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL`);
    await queryRunner.query(`DROP TYPE "waiter_call_status"`);
  }
}