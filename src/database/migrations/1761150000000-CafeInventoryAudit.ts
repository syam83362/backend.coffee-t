import { MigrationInterface, QueryRunner } from 'typeorm';

export class CafeInventoryAudit1761150000000 implements MigrationInterface {
  name = 'CafeInventoryAudit1761150000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "product_discovery_status" AS ENUM ('current', 'new', 'upcoming')`);
    await queryRunner.query(`ALTER TABLE "products" ADD "discovery_status" "product_discovery_status" NOT NULL DEFAULT 'current'`);
    await queryRunner.query(`ALTER TABLE "product_availability" ADD "price_override_paise" integer CHECK ("price_override_paise" IS NULL OR "price_override_paise" >= 0)`);
    await queryRunner.query(`
      CREATE TABLE "cafe_inventory" (
        "id" uuid PRIMARY KEY,
        "cafe_id" uuid NOT NULL REFERENCES "cafes"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
        "reserved_quantity" integer NOT NULL DEFAULT 0 CHECK ("reserved_quantity" >= 0 AND "reserved_quantity" <= "quantity"),
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_cafe_inventory_cafe_variant" UNIQUE ("cafe_id", "variant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY,
        "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "cafe_id" uuid REFERENCES "cafes"("id") ON DELETE SET NULL,
        "action" varchar(80) NOT NULL,
        "target_type" varchar(80) NOT NULL,
        "target_id" varchar(100) NOT NULL,
        "changes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_audit_logs_cafe_created" ON "audit_logs" ("cafe_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "ix_audit_logs_actor_created" ON "audit_logs" ("actor_user_id", "created_at" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "cafe_inventory"`);
    await queryRunner.query(`ALTER TABLE "product_availability" DROP COLUMN "price_override_paise"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "discovery_status"`);
    await queryRunner.query(`DROP TYPE "product_discovery_status"`);
  }
}