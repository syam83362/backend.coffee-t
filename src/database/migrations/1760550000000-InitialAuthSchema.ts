import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialAuthSchema1760550000000 implements MigrationInterface {
  name = 'InitialAuthSchema1760550000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('customer', 'admin')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" "user_role" NOT NULL DEFAULT 'customer',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL,
        "family_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "family_expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_session_id" uuid REFERENCES "refresh_sessions"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_refresh_sessions_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_sessions_family_id" ON "refresh_sessions" ("family_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}