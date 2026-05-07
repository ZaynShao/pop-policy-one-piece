import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * G1 工具池 demo 闭环
 *
 * - tool_type / tool_status / tool_taxonomy / binding_target / region_scope 5 个 enum
 * - tools 表(STI:type discriminator)
 * - tool_bindings 表(双模式:具体点 OR 泛地域)
 * - tool_consumption_logs 表
 *
 * 约束:
 * - tools.file_url 仅 type='document' 可有
 * - tool_bindings target_type 决定 pin_id/visit_id/region_code 哪个非空
 */
export class CreateToolPool1777600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== Enums =====
    await queryRunner.query(`CREATE TYPE "tool_type" AS ENUM ('document', 'interface');`);
    await queryRunner.query(`CREATE TYPE "tool_status" AS ENUM ('draft', 'published', 'archived');`);
    await queryRunner.query(
      `CREATE TYPE "tool_taxonomy" AS ENUM ('ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other');`,
    );
    await queryRunner.query(`CREATE TYPE "binding_target" AS ENUM ('pin', 'visit', 'region');`);
    await queryRunner.query(
      `CREATE TYPE "region_scope" AS ENUM ('nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific');`,
    );

    // ===== tools =====
    await queryRunner.query(`
      CREATE TABLE "tools" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "tool_type" NOT NULL,
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT NULL,
        "taxonomy_tag" "tool_taxonomy" NOT NULL,
        "status" "tool_status" NOT NULL DEFAULT 'draft',
        "creator_id" UUID NOT NULL REFERENCES "users"("id"),
        "file_url" VARCHAR(500) NULL,
        "param_template" JSONB NULL,
        "response_mapping" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "ck_tools_type_fields" CHECK (
          (type = 'document' AND file_url IS NOT NULL AND param_template IS NULL)
          OR (type = 'interface' AND param_template IS NOT NULL AND file_url IS NULL)
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tools_creator" ON "tools"("creator_id");`);
    await queryRunner.query(`CREATE INDEX "idx_tools_status_type" ON "tools"("status", "type");`);

    // ===== tool_bindings =====
    await queryRunner.query(`
      CREATE TABLE "tool_bindings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tool_id" UUID NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
        "target_type" "binding_target" NOT NULL,
        "pin_id" UUID NULL REFERENCES "pins"("id") ON DELETE CASCADE,
        "visit_id" UUID NULL REFERENCES "visits"("id") ON DELETE CASCADE,
        "region_code" VARCHAR(8) NULL,
        "region_scope_tag" "region_scope" NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "ck_tool_bindings_target" CHECK (
          (target_type = 'pin' AND pin_id IS NOT NULL AND visit_id IS NULL AND region_code IS NULL)
          OR (target_type = 'visit' AND visit_id IS NOT NULL AND pin_id IS NULL AND region_code IS NULL)
          OR (target_type = 'region' AND region_scope_tag IS NOT NULL AND pin_id IS NULL AND visit_id IS NULL)
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_tool" ON "tool_bindings"("tool_id");`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_pin" ON "tool_bindings"("pin_id") WHERE pin_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_visit" ON "tool_bindings"("visit_id") WHERE visit_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_region" ON "tool_bindings"("region_code") WHERE region_code IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_scope" ON "tool_bindings"("region_scope_tag") WHERE region_scope_tag IS NOT NULL;`);

    // ===== tool_consumption_logs =====
    await queryRunner.query(`
      CREATE TABLE "tool_consumption_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tool_id" UUID NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
        "consumer_id" UUID NOT NULL REFERENCES "users"("id"),
        "consumed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "context_pin_id" UUID NULL REFERENCES "pins"("id") ON DELETE SET NULL,
        "context_visit_id" UUID NULL REFERENCES "visits"("id") ON DELETE SET NULL,
        "context_region_code" VARCHAR(8) NULL,
        "interface_response" JSONB NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tcl_consumer_time" ON "tool_consumption_logs"("consumer_id", "consumed_at" DESC);`);
    await queryRunner.query(`CREATE INDEX "idx_tcl_tool" ON "tool_consumption_logs"("tool_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tool_consumption_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tool_bindings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tools";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "region_scope";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "binding_target";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_taxonomy";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_type";`);
  }
}
