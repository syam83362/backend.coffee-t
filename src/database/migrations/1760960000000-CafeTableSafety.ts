import { MigrationInterface, QueryRunner } from 'typeorm';

export class CafeTableSafety1760960000000 implements MigrationInterface {
  name = 'CafeTableSafety1760960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cafe_tables" ADD "capacity" smallint NOT NULL DEFAULT 2 CHECK ("capacity" > 0)`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "client_request_id" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_orders_table_request" ON "orders" ("cafe_table_id", "client_request_id") WHERE "client_request_id" IS NOT NULL`);
    await queryRunner.query(`CREATE SEQUENCE "cafe_order_number_seq" START WITH 1001`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE "cafe_order_number_seq"`);
    await queryRunner.query(`DROP INDEX "uq_orders_table_request"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "client_request_id"`);
    await queryRunner.query(`ALTER TABLE "cafe_tables" DROP COLUMN "capacity"`);
  }
}