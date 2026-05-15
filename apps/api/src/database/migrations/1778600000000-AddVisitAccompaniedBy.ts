import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visit 随行人字段(2026-05-12)
 * - 加 accompanied_by TEXT[] DEFAULT '{}'
 * - 字符串数组:既可装 user.displayName(挑系统用户)又可装自定义名字
 * - 既存 visits 默认 = 空数组,前端 fallback「—」展示
 */
export class AddVisitAccompaniedBy1778600000000 implements MigrationInterface {
  name = 'AddVisitAccompaniedBy1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "visits" ADD COLUMN "accompanied_by" TEXT[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "visits" DROP COLUMN "accompanied_by"`);
  }
}
