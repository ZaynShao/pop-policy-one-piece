import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * GeoJSON cities 内存查表(SPEC-V0.6-beta1-visit §3 + §10)
 *
 * 启动时一次性加载 30 普通省的 GeoJSON 提取地级市 center,
 * 4 直辖市(北京/上海/天津/重庆)hardcode(直辖市 GeoJSON 是区级而非市级)。
 *
 * 资产位置:apps/web/public/geojson/provinces/<adcode>.json
 *   monorepo 跨包访问,从 apps/api/src/lib 走 ../../../web/public/geojson/
 */

const GEOJSON_DIR = join(__dirname, '../../../web/public/geojson/provinces');

interface CityCenter {
  lng: number;
  lat: number;
  province_name: string;
}

interface CityFeature {
  properties: {
    name: string;
    center?: [number, number];
    centroid?: [number, number];
    parent?: { adcode: number };
  };
}

interface CityGeoJsonFC {
  features: CityFeature[];
}

const cityCenterMap = new Map<string, CityCenter>();
const provinceCityListMap = new Map<string, { province_name: string; cities: string[] }>();

/** 直辖市 hardcode(province GeoJSON 是区级,不含「北京市」整体 entry) */
const MUNICIPALITIES: Array<{ code: string; name: string; lng: number; lat: number }> = [
  { code: '110000', name: '北京市', lng: 116.41995, lat: 40.18994 },
  { code: '120000', name: '天津市', lng: 117.347043, lat: 39.288036 },
  { code: '310000', name: '上海市', lng: 121.438737, lat: 31.072559 },
  { code: '500000', name: '重庆市', lng: 107.8839, lat: 30.067297 },
];

const MUNICIPALITY_CODES = new Set(MUNICIPALITIES.map((m) => m.code));

/** province_code → province_name(从 SeedRegions PROVINCES 数组提取的 hardcoded 表) */
const PROVINCE_NAMES: Record<string, string> = {
  '110000': '北京市', '120000': '天津市', '130000': '河北省', '140000': '山西省',
  '150000': '内蒙古自治区', '210000': '辽宁省', '220000': '吉林省', '230000': '黑龙江省',
  '310000': '上海市', '320000': '江苏省', '330000': '浙江省', '340000': '安徽省',
  '350000': '福建省', '360000': '江西省', '370000': '山东省', '410000': '河南省',
  '420000': '湖北省', '430000': '湖南省', '440000': '广东省', '450000': '广西壮族自治区',
  '460000': '海南省', '500000': '重庆市', '510000': '四川省', '520000': '贵州省',
  '530000': '云南省', '540000': '西藏自治区', '610000': '陕西省', '620000': '甘肃省',
  '630000': '青海省', '640000': '宁夏回族自治区', '650000': '新疆维吾尔自治区',
  '710000': '台湾省', '810000': '香港特别行政区', '820000': '澳门特别行政区',
};

function lookupProvinceName(code: string): string {
  return PROVINCE_NAMES[code] ?? code;
}

/** 启动时调用,加载所有省的市 center */
export async function loadGeoJsonCities(): Promise<void> {
  if (cityCenterMap.size > 0) return; // idempotent

  // 1) 直辖市 hardcode
  for (const m of MUNICIPALITIES) {
    cityCenterMap.set(`${m.code}_${m.name}`, {
      lng: m.lng,
      lat: m.lat,
      province_name: m.name,
    });
    provinceCityListMap.set(m.code, {
      province_name: m.name,
      cities: [m.name],
    });
  }

  // 2) 普通省:从 GeoJSON 提取
  const files = await readdir(GEOJSON_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const code = file.replace('.json', '');
    if (MUNICIPALITY_CODES.has(code)) continue;
    if (!/^\d{6}$/.test(code)) continue;

    try {
      const raw = await readFile(join(GEOJSON_DIR, file), 'utf-8');
      const geo = JSON.parse(raw) as CityGeoJsonFC;
      const cities: string[] = [];
      const provinceName = lookupProvinceName(code);

      for (const f of geo.features) {
        const center = f.properties.center ?? f.properties.centroid;
        if (!center) continue;
        const cityName = f.properties.name;
        cityCenterMap.set(`${code}_${cityName}`, {
          lng: center[0],
          lat: center[1],
          province_name: provinceName,
        });
        cities.push(cityName);
      }

      provinceCityListMap.set(code, { province_name: provinceName, cities });
    } catch (err) {
      console.warn(`[geojson-cities] 加载 ${file} 失败,跳过`, err);
    }
  }
}

/** POST/PUT/seed 用:province_code + city_name → lng/lat */
export function lookupCityCenter(
  provinceCode: string,
  cityName: string,
): { lng: number; lat: number } | null {
  const entry = cityCenterMap.get(`${provinceCode}_${cityName}`);
  if (!entry) return null;
  return { lng: entry.lng, lat: entry.lat };
}

/**
 * GET /api/v1/regions/reverse 用:lng/lat → 最近 city center
 *
 * 简化算法:遍历所有 city centers,欧式距离最小的胜出。demo 范围 cn 大陆,
 * 经纬度差异不大,不用 haversine。
 *
 * 城市级(provinceCode + cityName 6 位 adcode 在 demo 里,直辖市直接返 110000 等)。
 * 移动端 GPS 拿到位置后,后端反查最近 city,prefill 表单。
 */
export function reverseGeocode(
  lng: number,
  lat: number,
): { provinceCode: string; provinceName: string; cityName: string } | null {
  let best: { key: string; entry: CityCenter; dist: number } | null = null;
  for (const [key, entry] of cityCenterMap.entries()) {
    const dx = entry.lng - lng;
    const dy = entry.lat - lat;
    const dist = dx * dx + dy * dy;
    if (!best || dist < best.dist) {
      best = { key, entry, dist };
    }
  }
  if (!best) return null;
  // key 是 `${provinceCode}_${cityName}`,直辖市 cityName=省名
  const sep = best.key.indexOf('_');
  const provinceCode = best.key.slice(0, sep);
  const cityName = best.key.slice(sep + 1);
  return {
    provinceCode,
    provinceName: best.entry.province_name,
    cityName,
  };
}

/** GET /api/v1/cities 用:列出所有省 + 市(camelCase 对齐 shared-types) */
export function listAllProvincesCities(): Array<{
  provinceCode: string;
  provinceName: string;
  cities: Array<{ name: string }>;
}> {
  const out: Array<{
    provinceCode: string;
    provinceName: string;
    cities: Array<{ name: string }>;
  }> = [];
  for (const [code, info] of provinceCityListMap.entries()) {
    out.push({
      provinceCode: code,
      provinceName: info.province_name,
      cities: info.cities.map((name) => ({ name })),
    });
  }
  out.sort((a, b) => a.provinceCode.localeCompare(b.provinceCode));
  return out;
}
