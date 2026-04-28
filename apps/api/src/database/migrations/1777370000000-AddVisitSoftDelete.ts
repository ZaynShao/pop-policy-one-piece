import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visit 软删除字段(对称 Pin V0.6 patch)
 * - 加 deleted_at TIMESTAMPTZ NULL
 * - 加索引 IDX_visits_deleted_at(回收站查询用)
 *
 * 32 条 seed visits 的 deleted_at = NULL,默认全部活跃。
 */
export class AddVisitSoftDelete1777370000000 implements MigrationInterface {
  name = 'AddVisitSoftDelete1777370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "visits" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_visits_deleted_at" ON "visits" ("deleted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_visits_deleted_at"`);
    await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "deleted_at"`);
  }
}
