import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed 32 条 demo Visit(SPEC-V0.6-beta1-visit §4)
 *
 * 优先 8 城市 × 3 条 = 24:广州/深圳/北京/成都/南京/苏州/青岛/杭州
 * 其他 8 城市 × 1 条 = 8:西安/武汉/天津/重庆/沈阳/济南/合肥/福州
 * 总 32 条
 *
 * - color hash 切档:50% green / 30% yellow / 20% red
 * - visitor_id 分散在 5 个 demo 用户(V0.2 已 seed)
 * - visit_date 随机近 90 天内
 *
 * Idempotent:跑前清空 visits 表(MVP 简化;生产 migration 不可清表)
 */

interface CitySeed {
  province_code: string;
  city_name: string;
  lng: number;
  lat: number;
  count: number;
}

const CITY_SEEDS: CitySeed[] = [
  // 优先 8 × 3 = 24
  { province_code: '440000', city_name: '广州市', lng: 113.280637, lat: 23.125178, count: 3 },
  { province_code: '440000', city_name: '深圳市', lng: 114.085947, lat: 22.547, count: 3 },
  { province_code: '110000', city_name: '北京市', lng: 116.41995, lat: 40.18994, count: 3 },
  { province_code: '510000', city_name: '成都市', lng: 104.065735, lat: 30.659462, count: 3 },
  { province_code: '320000', city_name: '南京市', lng: 118.767413, lat: 32.041544, count: 3 },
  { province_code: '320000', city_name: '苏州市', lng: 120.619585, lat: 31.299379, count: 3 },
  { province_code: '370000', city_name: '青岛市', lng: 120.355173, lat: 36.082982, count: 3 },
  { province_code: '330000', city_name: '杭州市', lng: 120.15507, lat: 30.274085, count: 3 },
  // 其他 8 × 1 = 8
  { province_code: '610000', city_name: '西安市', lng: 108.948024, lat: 34.263161, count: 1 },
  { province_code: '420000', city_name: '武汉市', lng: 114.305393, lat: 30.593099, count: 1 },
  { province_code: '120000', city_name: '天津市', lng: 117.347043, lat: 39.288036, count: 1 },
  { province_code: '500000', city_name: '重庆市', lng: 107.8839, lat: 30.067297, count: 1 },
  { province_code: '210000', city_name: '沈阳市', lng: 123.429096, lat: 41.796767, count: 1 },
  { province_code: '370000', city_name: '济南市', lng: 117.000923, lat: 36.675807, count: 1 },
  { province_code: '340000', city_name: '合肥市', lng: 117.283042, lat: 31.86119, count: 1 },
  { province_code: '350000', city_name: '福州市', lng: 119.306239, lat: 26.075302, count: 1 },
];

const DEPARTMENTS = ['经发局', '商务局', '工信局', '科技局', '发改委', '招商局', '人社局', '行政审批局'];
const THEMES = ['专精特新培育', '数字经济促进', '外贸稳增长', '人才安居补贴', '绿色低碳转型', '双招双引专项'];
const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '周'];

function hashStr(s: string, salt: number): number {
  let h = salt >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) >>> 0) + s.charCodeAt(i);
  return h >>> 0;
}

function pickColor(seed: number): 'red' | 'yellow' | 'green' {
  const v = seed % 100;
  if (v < 50) return 'green';
  if (v < 80) return 'yellow';
  return 'red';
}

function randomDateWithin90Days(seed: number): string {
  const offsetDays = seed % 90;
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export class SeedDemoVisits1745500000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 拿 5 demo 用户 id(V0.2 SeedDemoUsers 已 seed)
    const userRows = await queryRunner.query(
      `SELECT "id" FROM "users" WHERE "username" IN ('sysadmin', 'lead', 'pmo', 'local_ga', 'central_ga') ORDER BY "username";`,
    );
    if (userRows.length === 0) {
      throw new Error('SeedDemoVisits 依赖 SeedDemoUsers,先跑前面的 migration');
    }
    const userIds: string[] = userRows.map((r: { id: string }) => r.id);

    // 清空 visits(idempotent)
    await queryRunner.query(`DELETE FROM "visits";`);

    let globalIdx = 0;
    for (const c of CITY_SEEDS) {
      for (let i = 0; i < c.count; i++) {
        const seed = `${c.city_name}_${i}`;
        const colorSeed = hashStr(seed, 23);
        const dateSeed = hashStr(seed, 41);
        const deptSeed = hashStr(seed, 53);
        const themeSeed = hashStr(seed, 67);
        const userSeed = hashStr(seed, 79);

        const department = DEPARTMENTS[deptSeed % DEPARTMENTS.length];
        const theme = THEMES[themeSeed % THEMES.length];
        const color = pickColor(colorSeed);
        const visitDate = randomDateWithin90Days(dateSeed);
        const visitorId = userIds[userSeed % userIds.length];
        const followUp = (hashStr(seed, 89) % 100) < 30;
        const surname = SURNAMES[globalIdx % SURNAMES.length];

        await queryRunner.query(
          `INSERT INTO "visits"
           ("visit_date", "department", "contact_person", "contact_title",
            "outcome_summary", "color", "follow_up",
            "province_code", "city_name", "lng", "lat", "visitor_id")
           VALUES ($1, $2, $3, $4, $5, $6::visit_color, $7, $8, $9, $10, $11, $12);`,
          [
            visitDate,
            department,
            `${surname}处长`,
            '部门负责人',
            `与${c.city_name}${department}对接「${theme}」主题落地情况`,
            color,
            followUp,
            c.province_code,
            c.city_name,
            c.lng,
            c.lat,
            visitorId,
          ],
        );
        globalIdx++;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "visits";`);
  }
}
