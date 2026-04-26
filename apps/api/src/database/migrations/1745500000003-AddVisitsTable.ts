import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 加 visits 表(PRD §3.3 B2,SPEC-V0.6-beta1-visit §2)
 *
 * - visit_color enum:仅 red/yellow/green(blue 是 PlanPoint 蓝点,β.3)
 * - visits 表:7 业务 + 4 地理 + visitor_id FK + 时间戳
 * - 索引:visitor_id / province_code / visit_date(常用查询)
 */
export class AddVisitsTable1745500000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // visit_color enum
    await queryRunner.query(
      `CREATE TYPE "visit_color" AS ENUM ('red', 'yellow', 'green');`,
    );

    // visits 表
    await queryRunner.query(`
      CREATE TABLE "visits" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "visit_date" DATE NOT NULL,
        "department" VARCHAR(128) NOT NULL,
        "contact_person" VARCHAR(64) NOT NULL,
        "contact_title" VARCHAR(64) NULL,
        "outcome_summary" TEXT NOT NULL,
        "color" "visit_color" NOT NULL,
        "follow_up" BOOLEAN NOT NULL DEFAULT FALSE,
        "province_code" VARCHAR(6) NOT NULL,
        "city_name" VARCHAR(64) NOT NULL,
        "lng" DOUBLE PRECISION NOT NULL,
        "lat" DOUBLE PRECISION NOT NULL,
        "visitor_id" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_visits_visitor"
          FOREIGN KEY ("visitor_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_visits_visitor_id" ON "visits"("visitor_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_visits_province_code" ON "visits"("province_code");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_visits_visit_date" ON "visits"("visit_date");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "visits";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "visit_color";`);
  }
}
