import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPinSoftDelete1777310000000 implements MigrationInterface {
  name = 'AddPinSoftDelete1777310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pins" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pins_deleted_at" ON "pins" ("deleted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_pins_deleted_at"`);
    await queryRunner.query(`ALTER TABLE "pins" DROP COLUMN "deleted_at"`);
  }
}
