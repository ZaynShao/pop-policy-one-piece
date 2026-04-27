import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed 3 条 demo Pin(SPEC-V0.6-beta2-pin §4)
 *
 * 成都(in_progress / high) / 广州(completed / medium) / 上海(aborted / low)
 * - 3 态各 1 条 → 状态机 demo 完整(紫 / 暗灰 / 浅灰)
 * - 3 档 priority 各 1 条 → 工作台 Table sort by priority demo 力度足
 * - created_by 都填 sysadmin user id(β.2 全 sys_admin)
 *
 * Idempotent:跑前清空 pins 表(MVP 简化,生产 migration 不可清表)
 */
export class SeedDemoPins1745500000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const userRows = await queryRunner.query(
      `SELECT "id" FROM "users" WHERE "username" = 'sysadmin' LIMIT 1;`,
    );
    if (userRows.length === 0) {
      throw new Error('SeedDemoPins 依赖 SeedDemoUsers,先跑前面的 migration');
    }
    const sysadminId = userRows[0].id;

    await queryRunner.query(`DELETE FROM "pins";`);

    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const seeds: Array<{
      title: string;
      description: string;
      status: 'in_progress' | 'completed' | 'aborted';
      abortedReason: string | null;
      closedAt: Date | null;
      priority: 'high' | 'medium' | 'low';
      provinceCode: string;
      cityName: string;
      lng: number;
      lat: number;
    }> = [
      {
        title: '成都新能源汽车产业链对接',
        description: '与成都市经发局对接成都新能源汽车产业,涉及 V2G 试点合作意向初步沟通',
        status: 'in_progress',
        abortedReason: null,
        closedAt: null,
        priority: 'high',
        provinceCode: '510000',
        cityName: '成都市',
        lng: 104.065735,
        lat: 30.659462,
      },
      {
        title: '广州 V2G 试点推进',
        description: '广州市发改委 V2G 示范应用试点合作意向已落地',
        status: 'completed',
        abortedReason: null,
        closedAt: days30Ago,
        priority: 'medium',
        provinceCode: '440000',
        cityName: '广州市',
        lng: 113.280637,
        lat: 23.125178,
      },
      {
        title: '上海数据要素市场化试点',
        description: '上海经信委对接数据要素流通市场化探索',
        status: 'aborted',
        abortedReason: '政策窗口关闭,等下一轮政策周期重启',
        closedAt: days60Ago,
        priority: 'low',
        provinceCode: '310000',
        cityName: '上海市',
        lng: 121.438737,
        lat: 31.072559,
      },
    ];

    for (const s of seeds) {
      const closedBy = s.status === 'in_progress' ? null : sysadminId;
      await queryRunner.query(
        `INSERT INTO "pins"
         ("title", "description", "status", "aborted_reason",
          "closed_by", "closed_at", "priority",
          "province_code", "city_name", "lng", "lat", "created_by")
         VALUES ($1, $2, $3::pin_status, $4, $5, $6, $7::pin_priority,
                 $8, $9, $10, $11, $12);`,
        [
          s.title,
          s.description,
          s.status,
          s.abortedReason,
          closedBy,
          s.closedAt,
          s.priority,
          s.provinceCode,
          s.cityName,
          s.lng,
          s.lat,
          sysadminId,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "pins";`);
  }
}
