import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed regions:国家 + 34 省级(PRD §4.2.3 MVP 默认版本 2023)
 *
 * 数据来源:apps/web/public/geojson/china.json(ECharts GeoJSON)的 properties.centroid
 * 国家 code 约定:100000(ECharts + GB/T 2260 非正式用法)
 *
 * district / city 级数据按需后续 migration 补(PRD 未要求 MVP 全量装)。
 */
const VERSION = '2023';
const COUNTRY: [string, string, number, number] = [
  '100000',
  '中国',
  104.1954, // 近似经度中心
  36.5617,  // 近似纬度中心
];
const PROVINCES: Array<[string, string, number, number]> = [
  ['110000', '北京市', 116.41995, 40.18994],
  ['120000', '天津市', 117.347043, 39.288036],
  ['130000', '河北省', 114.502461, 38.045474],
  ['140000', '山西省', 112.304436, 37.618179],
  ['150000', '内蒙古自治区', 114.077429, 44.331087],
  ['210000', '辽宁省', 122.604994, 41.299712],
  ['220000', '吉林省', 126.171208, 43.703954],
  ['230000', '黑龙江省', 127.693027, 48.040465],
  ['310000', '上海市', 121.438737, 31.072559],
  ['320000', '江苏省', 119.486506, 32.983991],
  ['330000', '浙江省', 120.109913, 29.181466],
  ['340000', '安徽省', 117.226884, 31.849254],
  ['350000', '福建省', 118.006468, 26.069925],
  ['360000', '江西省', 115.732975, 27.636112],
  ['370000', '山东省', 118.187759, 36.376092],
  ['410000', '河南省', 113.619717, 33.902648],
  ['420000', '湖北省', 112.271301, 30.987527],
  ['430000', '湖南省', 111.711649, 27.629216],
  ['440000', '广东省', 113.429919, 23.334643],
  ['450000', '广西壮族自治区', 108.7944, 23.833381],
  ['460000', '海南省', 109.754859, 19.189767],
  ['500000', '重庆市', 107.8839, 30.067297],
  ['510000', '四川省', 102.693453, 30.674545],
  ['520000', '贵州省', 106.880455, 26.826368],
  ['530000', '云南省', 101.485106, 25.008643],
  ['540000', '西藏自治区', 88.388277, 31.56375],
  ['610000', '陕西省', 108.887114, 35.263661],
  ['620000', '甘肃省', 103.823557, 36.058039],
  ['630000', '青海省', 96.043533, 35.726403],
  ['640000', '宁夏回族自治区', 106.169866, 37.291332],
  ['650000', '新疆维吾尔自治区', 85.294711, 41.371801],
  ['710000', '台湾省', 120.971485, 23.749452],
  ['810000', '香港特别行政区', 114.134357, 22.377366],
  ['820000', '澳门特别行政区', 113.566988, 22.159307],
];

export class SeedRegions1745500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 国家
    const [code, name, lng, lat] = COUNTRY;
    await queryRunner.query(
      `INSERT INTO "regions" ("code", "name", "level", "parent_code", "version", "geo_centroid")
       VALUES ($1, $2, 'country', NULL, $3, $4::jsonb)
       ON CONFLICT ("code") DO NOTHING;`,
      [code, name, VERSION, JSON.stringify({ lng, lat })],
    );

    // 2) 34 省级
    for (const [pcode, pname, plng, plat] of PROVINCES) {
      await queryRunner.query(
        `INSERT INTO "regions" ("code", "name", "level", "parent_code", "version", "geo_centroid")
         VALUES ($1, $2, 'province', $3, $4, $5::jsonb)
         ON CONFLICT ("code") DO NOTHING;`,
        [pcode, pname, code, VERSION, JSON.stringify({ lng: plng, lat: plat })],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "regions" WHERE "level" IN ('country', 'province');`,
    );
  }
}
