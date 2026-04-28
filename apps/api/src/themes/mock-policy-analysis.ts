import type { ThemeTemplate, ThemeRegionLevel } from '@pop/shared-types';

/** 简单确定性 hash(djb2) — 同 themeId 跨 process 输出一致 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** 用 hash 派生伪随机但确定的 mulberry32 PRNG */
function rngFromSeed(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一些常见省 / 市 region_code 池(简化,demo 够用) */
const PROVINCE_CODES = ['110000', '310000', '440000', '510000', '320000', '330000', '370000', '420000', '430000', '500000', '610000', '350000'];
const CITY_CODES = ['110100', '310100', '440100', '440300', '510100', '510700', '320100', '320500', '330100', '330200', '370100', '420100', '430100', '500100', '610100', '350100'];

export interface MockCoverage {
  regionCode: string;
  regionLevel: ThemeRegionLevel;
  mainValue: number;
  extraData: Record<string, unknown> | null;
}

/**
 * 确定性 mock:同 themeId + template 多次调用结果一致
 * 主线政策(main):main_value 1-50(区覆盖数语义)
 * 核心风险(risk):main_value 10-200(政诉数语义)
 */
export function mockPolicyAnalysis(themeId: string, template: ThemeTemplate): MockCoverage[] {
  const seed = djb2(`${themeId}:${template}`);
  const rng = rngFromSeed(seed);

  const provinceCount = 5 + Math.floor(rng() * 4);  // 5-8
  const cityCount = 8 + Math.floor(rng() * 4);       // 8-11

  const valueRange = template === 'main' ? [1, 50] : [10, 200];
  const valueRand = () => valueRange[0] + Math.floor(rng() * (valueRange[1] - valueRange[0] + 1));

  // 取 provinceCount 个省(确定性洗牌前 N)
  const provinces = [...PROVINCE_CODES]
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, provinceCount)
    .map(({ c }) => c);

  // 取 cityCount 个市
  const cities = [...CITY_CODES]
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, cityCount)
    .map(({ c }) => c);

  const out: MockCoverage[] = [];
  for (const code of provinces) {
    out.push({
      regionCode: code,
      regionLevel: 'province',
      mainValue: valueRand(),
      extraData: template === 'risk' ? { complaintCount: valueRand() * 2 } : null,
    });
  }
  for (const code of cities) {
    out.push({
      regionCode: code,
      regionLevel: 'city',
      mainValue: valueRand(),
      extraData: template === 'risk' ? { complaintCount: valueRand() * 2 } : null,
    });
  }
  return out;
}
