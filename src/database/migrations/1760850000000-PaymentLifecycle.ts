import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentLifecycle1760850000000 implements MigrationInterface {
  name = 'PaymentLifecycle1760850000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "stock_reserved" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`CREATE TYPE "payment_provider" AS ENUM ('development')`);
    await queryRunner.query(`CREATE TYPE "payment_attempt_status" AS ENUM ('pending', 'succeeded', 'failed', 'refunded')`);
    await queryRunner.query(`
      CREATE TABLE "payment_attempts" (
        "id" uuid PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
        "provider" "payment_provider" NOT NULL,
        "status" "payment_attempt_status" NOT NULL,
        "amount_paise" integer NOT NULL CHECK ("amount_paise" >= 0),
        "idempotency_key" varchar(100) NOT NULL,
        "provider_reference" varchar(160),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_payment_attempt_idempotency" UNIQUE ("order_id", "idempotency_key")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_payment_attempt_order_created" ON "payment_attempts" ("order_id", "created_at")`);
    await queryRunner.query(`
      CREATE TABLE "payment_events" (
        "id" uuid PRIMARY KEY,
        "attempt_id" uuid NOT NULL REFERENCES "payment_attempts"("id") ON DELETE RESTRICT,
        "provider_event_id" varchar(180) NOT NULL,
        "event_type" varchar(80) NOT NULL,
        "details" jsonb NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_payment_event_provider_id" UNIQUE ("provider_event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_payment_event_attempt_received" ON "payment_events" ("attempt_id", "received_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_events"`);
    await queryRunner.query(`DROP TABLE "payment_attempts"`);
    await queryRunner.query(`DROP TYPE "payment_attempt_status"`);
    await queryRunner.query(`DROP TYPE "payment_provider"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "stock_reserved"`);
  }
}