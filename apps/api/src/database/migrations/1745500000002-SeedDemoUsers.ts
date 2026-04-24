import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed 5 demo users + user_roles(V0.1 假 SSO 登录候选)
 *
 * MVP 无密码 fake SSO(PRD §8.1):直接按 username 匹配即登录。
 * V0.5 换真 OIDC 时,username 会被 SSO 返回的 `sub / email` 替换,demo 用户废弃。
 *
 * 依赖关系(FK):
 *   1. sysadmin 先建(created_by = null,self-assign)
 *   2. 其他 4 个用户:created_by = sysadmin.id
 *   3. user_roles:sysadmin assigned_by self;其他 assigned_by sysadmin
 *
 * 5 角色 1:1 对齐 PRD §1.1-1.5 + §4.2.2 role_code。
 */
const DEMO_USERS: Array<{
  username: string;
  displayName: string;
  email: string;
  roleCode: 'sys_admin' | 'lead' | 'pmo' | 'local_ga' | 'central_ga';
}> = [
  {
    username: 'sysadmin',
    displayName: '系统管理员',
    email: 'sysadmin@pop.local',
    roleCode: 'sys_admin',
  },
  {
    username: 'lead',
    displayName: '王负责',
    email: 'lead@pop.local',
    roleCode: 'lead',
  },
  {
    username: 'pmo',
    displayName: '钱 PMO',
    email: 'pmo@pop.local',
    roleCode: 'pmo',
  },
  {
    username: 'local_ga',
    displayName: '赵属地',
    email: 'local_ga@pop.local',
    roleCode: 'local_ga',
  },
  {
    username: 'central_ga',
    displayName: '孙中台',
    email: 'central_ga@pop.local',
    roleCode: 'central_ga',
  },
];

export class SeedDemoUsers1745500000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) sysadmin 先建(created_by 留空 —— 系统初始用户)
    const sysadmin = DEMO_USERS[0];
    const adminRows = await queryRunner.query(
      `INSERT INTO "users" ("username", "display_name", "email", "status", "created_by")
       VALUES ($1, $2, $3, 'active', NULL)
       ON CONFLICT ("username") DO NOTHING
       RETURNING "id";`,
      [sysadmin.username, sysadmin.displayName, sysadmin.email],
    );

    // 幂等性:如果 sysadmin 已存在,RETURNING 为空 —— 重新查一次
    const adminId: string = adminRows[0]?.id
      ?? (
        await queryRunner.query(
          `SELECT "id" FROM "users" WHERE "username" = $1 LIMIT 1;`,
          [sysadmin.username],
        )
      )[0]?.id;

    if (!adminId) {
      throw new Error('无法获取 sysadmin.id,seed 中断');
    }

    // 2) sysadmin 自己的 user_roles
    await queryRunner.query(
      `INSERT INTO "user_roles" ("user_id", "role_code", "assigned_by")
       VALUES ($1, 'sys_admin', $1)
       ON CONFLICT ("user_id") DO NOTHING;`,
      [adminId],
    );

    // 3) 其他 4 个用户 + 角色(created_by = assigned_by = sysadmin)
    for (const u of DEMO_USERS.slice(1)) {
      const rows = await queryRunner.query(
        `INSERT INTO "users" ("username", "display_name", "email", "status", "created_by")
         VALUES ($1, $2, $3, 'active', $4)
         ON CONFLICT ("username") DO NOTHING
         RETURNING "id";`,
        [u.username, u.displayName, u.email, adminId],
      );
      const userId: string = rows[0]?.id
        ?? (
          await queryRunner.query(
            `SELECT "id" FROM "users" WHERE "username" = $1 LIMIT 1;`,
            [u.username],
          )
        )[0]?.id;

      if (!userId) continue;

      await queryRunner.query(
        `INSERT INTO "user_roles" ("user_id", "role_code", "assigned_by")
         VALUES ($1, $2::role_code, $3)
         ON CONFLICT ("user_id") DO NOTHING;`,
        [userId, u.roleCode, adminId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "user_roles" WHERE "user_id" IN (
         SELECT "id" FROM "users" WHERE "username" = ANY($1)
       );`,
      [DEMO_USERS.map((u) => u.username)],
    );
    await queryRunner.query(`DELETE FROM "users" WHERE "username" = ANY($1);`, [
      DEMO_USERS.map((u) => u.username),
    ]);
  }
}
