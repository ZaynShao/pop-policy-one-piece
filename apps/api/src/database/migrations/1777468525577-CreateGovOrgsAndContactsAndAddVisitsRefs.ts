import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGovOrgsAndContactsAndAddVisitsRefs1777468525577 implements MigrationInterface {
    name = 'CreateGovOrgsAndContactsAndAddVisitsRefs1777468525577'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "theme_coverage" DROP CONSTRAINT "FK_theme_coverage_theme"`);
        await queryRunner.query(`ALTER TABLE "themes" DROP CONSTRAINT "FK_themes_created_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pins_deleted_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_visits_deleted_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_region"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_theme"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_themes_created_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_themes_status"`);
        await queryRunner.query(`CREATE TYPE "public"."gov_org_level" AS ENUM('national', 'provincial', 'municipal', 'district')`);
        await queryRunner.query(`CREATE TABLE "gov_orgs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "short_name" character varying(30), "province_code" character varying(6) NOT NULL, "city_name" character varying(50) NOT NULL, "district_name" character varying(50), "level" "public"."gov_org_level" NOT NULL, "parent_org_id" uuid, "function_tags" text array NOT NULL DEFAULT '{}', "address" character varying(200), "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b914ff7155e0236104d9d6a4e8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f7c2803ce63791887597821573" ON "gov_orgs" ("short_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc19cd68e709f9149dc00b03de" ON "gov_orgs" ("province_code", "city_name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_gov_orgs_province_city_name" ON "gov_orgs" ("province_code", "city_name", "name") WHERE deleted_at IS NULL`);
        await queryRunner.query(`CREATE TYPE "public"."contact_tier" AS ENUM('core', 'important', 'normal')`);
        await queryRunner.query(`CREATE TABLE "gov_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "gender" character varying(10), "org_id" uuid NOT NULL, "title" character varying(50) NOT NULL, "tier" "public"."contact_tier" NOT NULL DEFAULT 'normal', "phone" character varying(30), "wechat" character varying(50), "preference_notes" text, "owner_user_id" uuid NOT NULL, "last_engaged_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_565d5119daf4920b15cb70b0dbd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f151b546861d4d516c5ea1a28" ON "gov_contacts" ("owner_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0104711b76156c0ab52f989871" ON "gov_contacts" ("org_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_gov_contacts_org_name" ON "gov_contacts" ("org_id", "name") WHERE deleted_at IS NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "org_id" uuid`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "contact_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_8fc1219cdbb4198dcd95ca8b49" ON "visits" ("contact_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_21ec2079cd17825d1df52356f3" ON "visits" ("org_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e874546bc0badfeddccff146f8" ON "theme_coverage" ("region_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_246e49a4f53d8950dd9d7f47ae" ON "theme_coverage" ("theme_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8971ccf66827713954493c07ee" ON "themes" ("created_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_268842a44683f1a1d28bea2866" ON "themes" ("status") `);
        await queryRunner.query(`ALTER TABLE "gov_orgs" ADD CONSTRAINT "FK_c0ca812b9a1b28636fc0661d269" FOREIGN KEY ("parent_org_id") REFERENCES "gov_orgs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gov_orgs" ADD CONSTRAINT "FK_c00659c9ed59385e73dbc247271" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" ADD CONSTRAINT "FK_0104711b76156c0ab52f9898717" FOREIGN KEY ("org_id") REFERENCES "gov_orgs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" ADD CONSTRAINT "FK_4f151b546861d4d516c5ea1a28b" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" ADD CONSTRAINT "FK_8031b1f7b73edfb046099adf87a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visits" ADD CONSTRAINT "FK_21ec2079cd17825d1df52356f34" FOREIGN KEY ("org_id") REFERENCES "gov_orgs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visits" ADD CONSTRAINT "FK_8fc1219cdbb4198dcd95ca8b491" FOREIGN KEY ("contact_id") REFERENCES "gov_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "theme_coverage" ADD CONSTRAINT "FK_246e49a4f53d8950dd9d7f47ae2" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "themes" ADD CONSTRAINT "FK_8971ccf66827713954493c07eef" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "themes" DROP CONSTRAINT "FK_8971ccf66827713954493c07eef"`);
        await queryRunner.query(`ALTER TABLE "theme_coverage" DROP CONSTRAINT "FK_246e49a4f53d8950dd9d7f47ae2"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT "FK_8fc1219cdbb4198dcd95ca8b491"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT "FK_21ec2079cd17825d1df52356f34"`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" DROP CONSTRAINT "FK_8031b1f7b73edfb046099adf87a"`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" DROP CONSTRAINT "FK_4f151b546861d4d516c5ea1a28b"`);
        await queryRunner.query(`ALTER TABLE "gov_contacts" DROP CONSTRAINT "FK_0104711b76156c0ab52f9898717"`);
        await queryRunner.query(`ALTER TABLE "gov_orgs" DROP CONSTRAINT "FK_c00659c9ed59385e73dbc247271"`);
        await queryRunner.query(`ALTER TABLE "gov_orgs" DROP CONSTRAINT "FK_c0ca812b9a1b28636fc0661d269"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_268842a44683f1a1d28bea2866"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8971ccf66827713954493c07ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_246e49a4f53d8950dd9d7f47ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e874546bc0badfeddccff146f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21ec2079cd17825d1df52356f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8fc1219cdbb4198dcd95ca8b49"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "contact_id"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "org_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0104711b76156c0ab52f989871"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f151b546861d4d516c5ea1a28"`);
        await queryRunner.query(`DROP INDEX "public"."uq_gov_contacts_org_name"`);
        await queryRunner.query(`DROP TABLE "gov_contacts"`);
        await queryRunner.query(`DROP TYPE "public"."contact_tier"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc19cd68e709f9149dc00b03de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7c2803ce63791887597821573"`);
        await queryRunner.query(`DROP INDEX "public"."uq_gov_orgs_province_city_name"`);
        await queryRunner.query(`DROP TABLE "gov_orgs"`);
        await queryRunner.query(`DROP TYPE "public"."gov_org_level"`);
        await queryRunner.query(`CREATE INDEX "IDX_themes_status" ON "themes" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_themes_created_by" ON "themes" ("created_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_theme" ON "theme_coverage" ("theme_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_region" ON "theme_coverage" ("region_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_visits_deleted_at" ON "visits" ("deleted_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_pins_deleted_at" ON "pins" ("deleted_at") `);
        await queryRunner.query(`ALTER TABLE "themes" ADD CONSTRAINT "FK_themes_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "theme_coverage" ADD CONSTRAINT "FK_theme_coverage_theme" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
