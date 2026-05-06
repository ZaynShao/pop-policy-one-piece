import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 政策大盘 P0 — 染色图层
 *
 * - policy_level enum:national / provincial / municipal / district
 * - policies 表:政策本体(title, issuing_org, issue_date, level, province_code, city_name, summary)
 * - policy_topics 表:多对多关联(同一政策可关联多个主题)
 * - UNIQUE (title, issuing_org, issue_date) — 跨主题去重的天然键
 * - 索引覆盖染色聚合(province_code)+ drawer 查询(province_code+city_name)
 *   + 主题反查(topic)
 */
export class CreatePolicies1777500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "policy_level" AS ENUM ('national', 'provincial', 'municipal', 'district');`,
    );

    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(500) NOT NULL,
        "issuing_org" VARCHAR(500) NOT NULL,
        "issue_date" DATE NOT NULL,
        "level" "policy_level" NOT NULL,
        "province_code" VARCHAR(6) NULL,
        "city_name" VARCHAR(50) NULL,
        "summary" TEXT NOT NULL,
        "source_batch_id" UUID NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_policies_natural_key"
          UNIQUE ("title", "issuing_org", "issue_date")
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_policies_level" ON "policies"("level");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_policies_province" ON "policies"("province_code");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_policies_city" ON "policies"("province_code", "city_name");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_policies_issue_date" ON "policies"("issue_date" DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE "policy_topics" (
        "policy_id" UUID NOT NULL,
        "topic" VARCHAR(100) NOT NULL,
        PRIMARY KEY ("policy_id", "topic"),
        CONSTRAINT "fk_policy_topics_policy"
          FOREIGN KEY ("policy_id") REFERENCES "policies"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_policy_topics_topic" ON "policy_topics"("topic");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_topics";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_level";`);
  }
}
