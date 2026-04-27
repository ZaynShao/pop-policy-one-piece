import * as echarts from 'echarts';

/**
 * 中国地图 GeoJSON 加载 + ECharts 注册工具(V0.4 c1)
 *
 * 资产位置:`apps/web/public/geojson/`
 * - `china.json`            全国底图(35 features = 34 省级 + 1 合并占位)
 * - `provinces/<adcode>.json` 单省下钻图(34 个,含港澳台)
 *
 * 注册 key 规则:
 * - 全国:`'china'`
 * - 单省:`'province_<adcode>'`(避免跟全国冲突)
 *
 * 设计要点:
 * - 单例缓存:同一 key 只 registerMap 一次(echarts.registerMap 重复调用安全,
 *   但避免重复 fetch + parse)
 * - 全国加载后建立 `name → adcode` 映射,供 click 事件下钻用(ECharts geo
 *   click params.name 是中文省名,需要转 adcode)
 */

export interface RegionFeatureProps {
  adcode: number;
  name: string;
  center: [number, number];
  centroid?: [number, number];
  level: string;
  parent?: { adcode: number };
}

export type GeoJsonFC = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: RegionFeatureProps;
    geometry: unknown;
  }>;
};

const cache = new Map<string, GeoJsonFC>();
const registered = new Set<string>();
let provinceNameToCodeCache: Map<string, string> | null = null;

async function loadAndRegister(key: string, url: string): Promise<GeoJsonFC> {
  const cached = cache.get(key);
  if (cached) {
    if (!registered.has(key)) {
      echarts.registerMap(key, cached as unknown as Parameters<typeof echarts.registerMap>[1]);
      registered.add(key);
    }
    return cached;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeoJSON 加载失败: ${url} (${res.status})`);
  const geo = (await res.json()) as GeoJsonFC;
  cache.set(key, geo);
  echarts.registerMap(key, geo as unknown as Parameters<typeof echarts.registerMap>[1]);
  registered.add(key);
  return geo;
}

export async function loadChinaMap(): Promise<GeoJsonFC> {
  const geo = await loadAndRegister('china', '/geojson/china.json');
  if (!provinceNameToCodeCache) {
    provinceNameToCodeCache = new Map();
    for (const f of geo.features) {
      provinceNameToCodeCache.set(f.properties.name, String(f.properties.adcode));
    }
  }
  return geo;
}

export async function loadProvinceMap(adcode: string): Promise<GeoJsonFC> {
  return loadAndRegister(`province_${adcode}`, `/geojson/provinces/${adcode}.json`);
}

/** 把 ECharts geo click 事件的中文省名转成 adcode(全国地图加载后才可用) */
export function provinceNameToCode(name: string): string | null {
  return provinceNameToCodeCache?.get(name) ?? null;
}

let allCitiesCache: GeoJsonFC['features'] | null = null;

/**
 * 全国级散点用 — Promise.all fetch 所有 34 省 GeoJSON,合并 features
 * 返回所有市级 (province features 的内容)。
 *
 * 单次首次加载 ~6MB(34 × ~200K),浏览器后续缓存;模块内 in-memory 缓存
 * 同 session 复用。供 c2 全国级散点用「每市 1 点」粒度。
 *
 * 复用 loadAndRegister 的 echarts.registerMap + cache.set,所以下钻到任何
 * 省份都已注册好(后续 loadProvinceMap 直接命中模块 cache)。
 */
export async function loadAllCities(): Promise<GeoJsonFC['features']> {
  if (allCitiesCache) return allCitiesCache;
  // china.json 加载后 provinceNameToCodeCache 内有所有省级 adcode
  const china = await loadChinaMap();
  const provinceCodes = china.features
    .map((f) => String(f.properties.adcode))
    // 港澳台 + 南海诸岛在 china.json 里有,但 provinces/*.json 不一定有,过滤异常
    .filter((c) => /^\d{6}$/.test(c));
  const results = await Promise.all(
    provinceCodes.map((code) =>
      loadAndRegister(`province_${code}`, `/geojson/provinces/${code}.json`)
        .then((geo) => geo.features)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[loadAllCities] 省级 GeoJSON 加载失败,跳过', code, err);
          return [] as GeoJsonFC['features'];
        }),
    ),
  );
  allCitiesCache = results.flat();
  return allCitiesCache;
}
