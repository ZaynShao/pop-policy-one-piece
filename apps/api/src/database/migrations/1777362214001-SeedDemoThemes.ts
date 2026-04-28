import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDemoThemes1777362214001 implements MigrationInterface {
  name = 'SeedDemoThemes1777362214001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const userRows = await queryRunner.query(
      `SELECT id FROM users WHERE username = 'central_ga' LIMIT 1`,
    );
    if (userRows.length === 0) {
      console.warn('[seed] central_ga 用户不存在,跳过 themes seed');
      return;
    }
    const cgId: string = userRows[0].id;

    // Theme 1: 智能网联汽车 主线政策
    const t1Result = await queryRunner.query(
      `INSERT INTO themes (title, template, keywords, region_scope, status, created_by, published_at)
       VALUES ('智能网联汽车主线政策', 'main', ARRAY['智能网联','自动驾驶','车路协同'], '全国 + 重点示范区',
               'published', $1, NOW())
       RETURNING id`,
      [cgId],
    );
    const t1Id: string = t1Result[0].id;

    // Theme 1 coverage: 5 省 + 8 市
    const t1Coverage: Array<[string, string, number]> = [
      ['110000', 'province', 12], ['310000', 'province', 18], ['440000', 'province', 25],
      ['510000', 'province', 22], ['320000', 'province', 15],
      ['110100', 'city', 8], ['310100', 'city', 14], ['440100', 'city', 18],
      ['440300', 'city', 16], ['510100', 'city', 20], ['510700', 'city', 9],
      ['320100', 'city', 11], ['320500', 'city', 7],
    ];
    for (const [code, level, value] of t1Coverage) {
      await queryRunner.query(
        `INSERT INTO theme_coverage (theme_id, region_code, region_level, main_value)
         VALUES ($1, $2, $3, $4)`,
        [t1Id, code, level, value],
      );
    }

    // Theme 2: 数据安全 核心风险
    const t2Result = await queryRunner.query(
      `INSERT INTO themes (title, template, keywords, region_scope, status, created_by, published_at)
       VALUES ('数据安全核心风险', 'risk', ARRAY['数据出境','个人信息保护','跨境流通'], '全国',
               'published', $1, NOW())
       RETURNING id`,
      [cgId],
    );
    const t2Id: string = t2Result[0].id;

    // Theme 2 coverage: 6 省 + 10 市(含 1 区级)
    const t2Coverage: Array<[string, string, number, object]> = [
      ['110000', 'province', 85, { complaintCount: 170 }],
      ['310000', 'province', 120, { complaintCount: 240 }],
      ['440000', 'province', 95, { complaintCount: 190 }],
      ['510000', 'province', 60, { complaintCount: 120 }],
      ['320000', 'province', 75, { complaintCount: 150 }],
      ['330000', 'province', 50, { complaintCount: 100 }],
      ['110100', 'city', 65, { complaintCount: 130 }],
      ['310100', 'city', 90, { complaintCount: 180 }],
      ['310101', 'district', 30, { complaintCount: 60 }],
      ['440100', 'city', 70, { complaintCount: 140 }],
      ['440300', 'city', 55, { complaintCount: 110 }],
      ['510100', 'city', 45, { complaintCount: 90 }],
      ['320100', 'city', 60, { complaintCount: 120 }],
      ['330100', 'city', 40, { complaintCount: 80 }],
      ['350100', 'city', 35, { complaintCount: 70 }],
      ['420100', 'city', 30, { complaintCount: 60 }],
    ];
    for (const [code, level, value, extra] of t2Coverage) {
      await queryRunner.query(
        `INSERT INTO theme_coverage (theme_id, region_code, region_level, main_value, extra_data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [t2Id, code, level, value, JSON.stringify(extra)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM themes WHERE title IN ('智能网联汽车主线政策', '数据安全核心风险')`);
    // theme_coverage 自动 CASCADE
  }
}
