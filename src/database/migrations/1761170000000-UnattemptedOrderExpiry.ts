import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnattemptedOrderExpiry1761170000000 implements MigrationInterface {
  name = 'UnattemptedOrderExpiry1761170000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "payment_expires_at" timestamptz NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes')`);
    await queryRunner.query(`CREATE INDEX "ix_orders_pending_expiry" ON "orders" ("payment_expires_at") WHERE "status" = 'pending_payment' AND "stock_reserved" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_orders_pending_expiry"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "payment_expires_at"`);
  }
}