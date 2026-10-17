import { MigrationInterface, QueryRunner } from 'typeorm';

export class CafeReservations1761050000000 implements MigrationInterface {
  name = 'CafeReservations1761050000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cafes" ADD "opening_time" time NOT NULL DEFAULT '08:00'`);
    await queryRunner.query(`ALTER TABLE "cafes" ADD "closing_time" time NOT NULL DEFAULT '20:00'`);
    await queryRunner.query(`CREATE TYPE "reservation_status" AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show')`);
    await queryRunner.query(`
      CREATE TABLE "cafe_reservations" (
        "id" uuid PRIMARY KEY,
        "cafe_id" uuid NOT NULL REFERENCES "cafes"("id") ON DELETE RESTRICT,
        "cafe_table_id" uuid NOT NULL REFERENCES "cafe_tables"("id") ON DELETE RESTRICT,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "party_size" smallint NOT NULL CHECK ("party_size" BETWEEN 1 AND 12),
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "status" "reservation_status" NOT NULL DEFAULT 'confirmed',
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ck_cafe_reservations_time" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "ck_cafe_reservations_party_size" CHECK ("party_size" BETWEEN 1 AND 12)
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "prevent_cafe_reservation_overlap"() RETURNS trigger AS $$
      BEGIN
        IF NEW."status" = 'confirmed' THEN
          PERFORM 1 FROM "cafe_tables" WHERE "id" = NEW."cafe_table_id" FOR UPDATE;
          IF EXISTS (
            SELECT 1 FROM "cafe_reservations" existing
            WHERE existing."cafe_table_id" = NEW."cafe_table_id"
              AND existing."status" = 'confirmed'
              AND existing."id" <> NEW."id"
              AND existing."starts_at" < NEW."ends_at"
              AND existing."ends_at" > NEW."starts_at"
          ) THEN
            RAISE EXCEPTION 'Reservation overlaps an existing booking' USING ERRCODE = '23P01';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_cafe_reservations_no_overlap"
      BEFORE INSERT OR UPDATE ON "cafe_reservations"
      FOR EACH ROW EXECUTE FUNCTION "prevent_cafe_reservation_overlap"()
    `);
    await queryRunner.query(`CREATE INDEX "ix_cafe_reservations_cafe_starts" ON "cafe_reservations" ("cafe_id", "starts_at")`);
    await queryRunner.query(`CREATE INDEX "ix_cafe_reservations_user_starts" ON "cafe_reservations" ("user_id", "starts_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "trg_cafe_reservations_no_overlap" ON "cafe_reservations"`);
    await queryRunner.query(`DROP FUNCTION "prevent_cafe_reservation_overlap"()`);
    await queryRunner.query(`DROP TABLE "cafe_reservations"`);
    await queryRunner.query(`DROP TYPE "reservation_status"`);
    await queryRunner.query(`ALTER TABLE "cafes" DROP COLUMN "closing_time"`);
    await queryRunner.query(`ALTER TABLE "cafes" DROP COLUMN "opening_time"`);
  }
}