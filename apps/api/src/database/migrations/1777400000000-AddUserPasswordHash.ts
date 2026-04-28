import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * 真登录第一步 — users 表加 password_hash 列 + 给 sysadmin 设默认密码
 *
 * - sysadmin 默认密码:pop2026(bcrypt 10 rounds)
 * - 其他 4 demo 用户 password_hash=NULL,login 时拒绝「未启用」
 *   → sysadmin 登录后通过 /admin/users「重置密码」给他们设
 */
export class AddUserPasswordHash1777400000000 implements MigrationInterface {
  name = 'AddUserPasswordHash1777400000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" ADD COLUMN "password_hash" varchar(256) NULL`);
    const hash = await bcrypt.hash('pop2026', 10);
    await qr.query(
      `UPDATE "users" SET "password_hash" = $1 WHERE "username" = $2`,
      [hash, 'sysadmin'],
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}
