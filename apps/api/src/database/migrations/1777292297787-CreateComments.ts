import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateComments1777292297787 implements MigrationInterface {
    name = 'CreateComments1777292297787'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."comment_source" AS ENUM('manual', 'auto_from_visit')`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parent_pin_id" uuid NOT NULL, "source_type" "public"."comment_source" NOT NULL, "body" text NOT NULL, "linked_visit_id" uuid, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_515640defd3b1be4509d7ebd17" ON "comments" ("parent_pin_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_9969589867802503110b1a244d4" FOREIGN KEY ("parent_pin_id") REFERENCES "pins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_88d2c055ba8c8cef998997e2cd4" FOREIGN KEY ("linked_visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_980bfefe00ed11685f325d0bd4c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_980bfefe00ed11685f325d0bd4c"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_88d2c055ba8c8cef998997e2cd4"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_9969589867802503110b1a244d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_515640defd3b1be4509d7ebd17"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TYPE "public"."comment_source"`);
    }

}
