import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Init schema(PRD §4.2.1-4.2.3)
 *
 * - pg enums: user_status / role_code / region_level
 * - tables: regions / users / user_roles
 * - unique(user_roles.user_id) — MVP 严格单角色(PRD §4.2.2)
 *
 * TECH-ARCH §5.5:migration 正向前进,down 仅开发调试用,生产不回滚。
 */
export class InitSchema1745500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- pg enums ---
    await queryRunner.query(
      `CREATE TYPE "user_status" AS ENUM ('active', 'disabled', 'pending');`,
    );
    await queryRunner.query(
      `CREATE TYPE "role_code" AS ENUM ('lead', 'pmo', 'local_ga', 'central_ga', 'sys_admin');`,
    );
    await queryRunner.query(
      `CREATE TYPE "region_level" AS ENUM ('country', 'province', 'city', 'district');`,
    );

    // --- regions(PRD §4.2.3)---
    await queryRunner.query(`
      CREATE TABLE "regions" (
        "code" VARCHAR(6) PRIMARY KEY,
        "name" VARCHAR(64) NOT NULL,
        "level" "region_level" NOT NULL,
        "parent_code" VARCHAR(6) NULL,
        "version" VARCHAR(16) NOT NULL,
        "geo_centroid" JSONB NULL,
        "geojson_ref" VARCHAR(128) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "fk_regions_parent"
          FOREIGN KEY ("parent_code") REFERENCES "regions"("code")
          ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_regions_parent_code" ON "regions"("parent_code");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_regions_level" ON "regions"("level");`,
    );

    // --- users(PRD §4.2.1)---
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" VARCHAR(32) NOT NULL,
        "display_name" VARCHAR(32) NOT NULL,
        "email" VARCHAR(128) NOT NULL,
        "avatar_url" VARCHAR(256) NULL,
        "mobile" VARCHAR(16) NULL,
        "status" "user_status" NOT NULL DEFAULT 'pending',
        "joined_at" DATE NULL,
        "note" TEXT NULL,
        "created_by" UUID NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "fk_users_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_username" ON "users"("username");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");`,
    );

    // --- user_roles(PRD §4.2.2)---
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "role_code" "role_code" NOT NULL,
        "assigned_by" UUID NOT NULL,
        "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_user_roles_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_assigner"
          FOREIGN KEY ("assigned_by") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_roles_user_id" ON "user_roles"("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_roles_role_code" ON "user_roles"("role_code");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "regions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "region_level";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_code";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status";`);
  }
}
