import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVisitStatusAndPin1777290603052 implements MigrationInterface {
    name = 'AddVisitStatusAndPin1777290603052'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "fk_users_created_by"`);
        await queryRunner.query(`ALTER TABLE "pins" DROP CONSTRAINT "fk_pins_creator"`);
        await queryRunner.query(`ALTER TABLE "pins" DROP CONSTRAINT "fk_pins_closed_by"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT "fk_visits_visitor"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_assigner"`);
        await queryRunner.query(`ALTER TABLE "regions" DROP CONSTRAINT "fk_regions_parent"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_username"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pins_created_by"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pins_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pins_province_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_visits_visitor_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_visits_province_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_visits_visit_date"`);
        await queryRunner.query(`DROP INDEX "public"."uq_user_roles_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_roles_role_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_regions_parent_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_regions_level"`);
        await queryRunner.query(`CREATE TYPE "public"."visit_status" AS ENUM('planned', 'completed', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "status" "public"."visit_status" NOT NULL DEFAULT 'completed'`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "parent_pin_id" uuid`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "title" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "visits" ADD "planned_date" date`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "visit_date" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "department" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "contact_person" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "outcome_summary" DROP NOT NULL`);
        // Hand-tuned: use ADD VALUE instead of RENAME+CREATE to avoid any data-cast risk
        await queryRunner.query(`ALTER TYPE "public"."visit_color" ADD VALUE IF NOT EXISTS 'blue'`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "color" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_55d9fdb7487c0dd2d114b540e3" ON "pins" ("province_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_52adae6cca65bef6fb62443801" ON "pins" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_06c2dd3fd7b17d5ddcf381aa0e" ON "pins" ("created_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b8126a0917fcddb0055edb0fb" ON "visits" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_9cf44e4a304e9d78ae9a9fabff" ON "visits" ("parent_pin_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc10053317ee5e372325c57976" ON "visits" ("visit_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_32e363a9cf6d6549d403c028a7" ON "visits" ("province_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_21c7fdcd0584490aa60ca67fd2" ON "visits" ("visitor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2654762ea6e6bfd6b726c4a7a" ON "user_roles" ("role_code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0eec6eb572149c35fcb05ad4ca" ON "regions" ("level") `);
        await queryRunner.query(`CREATE INDEX "IDX_7241ca7859f4288fb12567dd95" ON "regions" ("parent_code") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_f32b1cb14a9920477bcfd63df2c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pins" ADD CONSTRAINT "FK_cdc31cc0fb902f4b3e9f03504e9" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pins" ADD CONSTRAINT "FK_06c2dd3fd7b17d5ddcf381aa0ef" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visits" ADD CONSTRAINT "FK_9cf44e4a304e9d78ae9a9fabff8" FOREIGN KEY ("parent_pin_id") REFERENCES "pins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visits" ADD CONSTRAINT "FK_21c7fdcd0584490aa60ca67fd2d" FOREIGN KEY ("visitor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_6de6fefffe4a6d17de747bf8b9d" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "regions" ADD CONSTRAINT "FK_7241ca7859f4288fb12567dd959" FOREIGN KEY ("parent_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "regions" DROP CONSTRAINT "FK_7241ca7859f4288fb12567dd959"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_6de6fefffe4a6d17de747bf8b9d"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT "FK_21c7fdcd0584490aa60ca67fd2d"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT "FK_9cf44e4a304e9d78ae9a9fabff8"`);
        await queryRunner.query(`ALTER TABLE "pins" DROP CONSTRAINT "FK_06c2dd3fd7b17d5ddcf381aa0ef"`);
        await queryRunner.query(`ALTER TABLE "pins" DROP CONSTRAINT "FK_cdc31cc0fb902f4b3e9f03504e9"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_f32b1cb14a9920477bcfd63df2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7241ca7859f4288fb12567dd95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0eec6eb572149c35fcb05ad4ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2654762ea6e6bfd6b726c4a7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21c7fdcd0584490aa60ca67fd2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32e363a9cf6d6549d403c028a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc10053317ee5e372325c57976"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cf44e4a304e9d78ae9a9fabff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b8126a0917fcddb0055edb0fb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06c2dd3fd7b17d5ddcf381aa0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52adae6cca65bef6fb62443801"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55d9fdb7487c0dd2d114b540e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "color" SET NOT NULL`);
        // PG enum value removal not directly supported; down() leaves 'blue' in place
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "outcome_summary" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "contact_person" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "department" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" ALTER COLUMN "visit_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "planned_date"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "parent_pin_id"`);
        await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."visit_status"`);
        await queryRunner.query(`CREATE INDEX "idx_regions_level" ON "regions" ("level") `);
        await queryRunner.query(`CREATE INDEX "idx_regions_parent_code" ON "regions" ("parent_code") `);
        await queryRunner.query(`CREATE INDEX "idx_user_roles_role_code" ON "user_roles" ("role_code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_roles_user_id" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_visits_visit_date" ON "visits" ("visit_date") `);
        await queryRunner.query(`CREATE INDEX "idx_visits_province_code" ON "visits" ("province_code") `);
        await queryRunner.query(`CREATE INDEX "idx_visits_visitor_id" ON "visits" ("visitor_id") `);
        await queryRunner.query(`CREATE INDEX "idx_pins_province_code" ON "pins" ("province_code") `);
        await queryRunner.query(`CREATE INDEX "idx_pins_status" ON "pins" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_pins_created_by" ON "pins" ("created_by") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_username" ON "users" ("username") `);
        await queryRunner.query(`ALTER TABLE "regions" ADD CONSTRAINT "fk_regions_parent" FOREIGN KEY ("parent_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_assigner" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visits" ADD CONSTRAINT "fk_visits_visitor" FOREIGN KEY ("visitor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pins" ADD CONSTRAINT "fk_pins_closed_by" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pins" ADD CONSTRAINT "fk_pins_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "fk_users_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
