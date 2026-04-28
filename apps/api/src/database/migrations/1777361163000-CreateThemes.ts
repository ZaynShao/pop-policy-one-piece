import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateThemes1777361163000 implements MigrationInterface {
  name = 'CreateThemes1777361163000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."theme_template" AS ENUM ('main', 'risk')`);
    await queryRunner.query(`CREATE TYPE "public"."theme_status" AS ENUM ('draft', 'published', 'archived')`);
    await queryRunner.query(`CREATE TYPE "public"."theme_region_level" AS ENUM ('province', 'city', 'district')`);

    await queryRunner.query(`
      CREATE TABLE "themes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(100) NOT NULL,
        "template" "public"."theme_template" NOT NULL,
        "keywords" text[] NOT NULL DEFAULT '{}',
        "region_scope" text,
        "status" "public"."theme_status" NOT NULL DEFAULT 'draft',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_themes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_themes_status" ON "themes" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_themes_created_by" ON "themes" ("created_by")`);
    await queryRunner.query(`ALTER TABLE "themes" ADD CONSTRAINT "FK_themes_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE "theme_coverage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "theme_id" uuid NOT NULL,
        "region_code" varchar(6) NOT NULL,
        "region_level" "public"."theme_region_level" NOT NULL,
        "main_value" double precision NOT NULL,
        "extra_data" jsonb,
        "last_fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_theme_coverage" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_theme" ON "theme_coverage" ("theme_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_region" ON "theme_coverage" ("region_code")`);
    await queryRunner.query(`ALTER TABLE "theme_coverage" ADD CONSTRAINT "FK_theme_coverage_theme" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "theme_coverage" DROP CONSTRAINT "FK_theme_coverage_theme"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_region"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_theme"`);
    await queryRunner.query(`DROP TABLE "theme_coverage"`);

    await queryRunner.query(`ALTER TABLE "themes" DROP CONSTRAINT "FK_themes_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_themes_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_themes_status"`);
    await queryRunner.query(`DROP TABLE "themes"`);

    await queryRunner.query(`DROP TYPE "public"."theme_region_level"`);
    await queryRunner.query(`DROP TYPE "public"."theme_status"`);
    await queryRunner.query(`DROP TYPE "public"."theme_template"`);
  }
}
