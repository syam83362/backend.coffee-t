import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentAttemptExpiry1761160000000 implements MigrationInterface {
  name = 'PaymentAttemptExpiry1761160000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_attempts" ADD "expires_at" timestamptz NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes')`);
    await queryRunner.query(`CREATE INDEX "ix_payment_attempt_expiry" ON "payment_attempts" ("status", "expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_payment_attempt_expiry"`);
    await queryRunner.query(`ALTER TABLE "payment_attempts" DROP COLUMN "expires_at"`);
  }
}