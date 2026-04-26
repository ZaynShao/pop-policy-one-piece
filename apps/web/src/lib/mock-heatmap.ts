/**
 * V0.5 c2 v3 · 假拜访散点生成器
 * 对齐 PRD §3.3 B1「按拜访点密度渲染」+ B2「拜访点红/黄/绿展示」
 *      + B3「蓝点(计划点)展示」
 *
 * v1 错形态(已 revert · 175a38a):region 整块染色 (choropleth) ❌
 * v2 错粒度(已修正 · 541e0a6 / b193759):heatmap blob 糊成一片 ❌
 *   blob 模糊扩散无法表达「单个拜访点的状态颜色」(红/黄/绿/蓝)
 * v3(本文件)= scatter 离散散点,每点 itemStyle.color 按状态
 *   = B1(密度通过点的散布表达)+ B2(红/黄/绿状态色)+ B3(蓝色计划点)
 *
 * V0.6 β 落地后:generateScatterPoints 换成「从 Visit/PlanPoint 读真坐标
 * 与状态」即可,ScatterDatum / caller signature 不变。
 */

import { palette } from '@/tokens';

export type VisitStatus = 'red' | 'yellow' | 'green' | 'blue';

export interface ScatterDatum {
  value: [number, number, number];
  itemStyle: { color: string };
  name: string;
}

export interface RegionSeed {
  adcode: string;
  /** GeoJSON properties.center 或 centroid,[lng, lat] */
  center: [number, number];
  /** 该 region 所属省级 adcode;用于 maxBluePerProvince cap */
  provinceCode?: string;
}

export interface ScatterOptions {
  pointsPerRegion?: number;
  /** 抖动半径,经纬度 °;0 = 贴 center */
  radius?: number;
  /** 0-1,< 1 时按 hash 跑 dropout(模拟初期数据稀疏)*/
  keepRate?: number;
  /** 每省最大蓝点(计划未执行)数;超出强制改 green */
  maxBluePerProvince?: number;
}

const STATUS_LABEL: Record<VisitStatus, string> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
  blue: '计划未执行',
};

const STATUS_COLOR: Record<VisitStatus, string> = {
  red: palette.visit.red,
  yellow: palette.visit.yellow,
  green: palette.visit.green,
  blue: palette.visit.blue,
};

/** 基于 0-99 的 hash 切档:贴合业务直觉 — 红最少最显眼,绿+蓝占大头 */
function pickStatus(seed: number): VisitStatus {
  if (seed < 40) return 'green';
  if (seed < 70) return 'blue';
  if (seed < 90) return 'yellow';
  return 'red';
}

function strHashInt(s: string, salt = 0, mod = 100): number {
  let h = salt >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) >>> 0) + s.charCodeAt(i);
  return (h >>> 0) % mod;
}

/**
 * 在每个 region.center 周围按极坐标抖动 N 个散点,各点状态由 hash 切档。
 * - keepRate < 1 时按 hash 跑 dropout(初期数据稀疏感)
 * - maxBluePerProvince:每省蓝点 cap,超出强制改 green
 *   (业务直觉:计划未执行的不应一片蓝)
 */
export function generateScatterPoints(
  regions: RegionSeed[],
  opts: ScatterOptions = {},
): ScatterDatum[] {
  const {
    pointsPerRegion = 5,
    radius = 0.4,
    keepRate = 1,
    maxBluePerProvince = Infinity,
  } = opts;
  const provinceBlueCount = new Map<string, number>();
  const out: ScatterDatum[] = [];
  for (const r of regions) {
    for (let i = 0; i < pointsPerRegion; i++) {
      const seed = `${r.adcode}_${i}`;
      // dropout — 用 salt 53 与状态/位置 hash 不冲突,稳定可重现
      if (keepRate < 1 && strHashInt(seed, 53, 100) >= keepRate * 100) continue;
      const angle = (strHashInt(seed, 7, 10000) / 10000) * 2 * Math.PI;
      const dist = (strHashInt(seed, 13, 10000) / 10000) * radius;
      const lng = r.center[0] + Math.cos(angle) * dist;
      const lat = r.center[1] + Math.sin(angle) * dist;
      let status = pickStatus(strHashInt(seed, 23, 100));
      // 蓝点每省 cap:超出改 green(下钻级整省都属同一 provinceCode,
      // 全国级 provinceCode 来自 feature.parent.adcode)
      if (status === 'blue') {
        const pCode = r.provinceCode ?? r.adcode;
        const cur = provinceBlueCount.get(pCode) ?? 0;
        if (cur >= maxBluePerProvince) {
          status = 'green';
        } else {
          provinceBlueCount.set(pCode, cur + 1);
        }
      }
      const weight = strHashInt(seed, 41, 100) + 1;
      out.push({
        value: [lng, lat, weight],
        itemStyle: { color: STATUS_COLOR[status] },
        name: STATUS_LABEL[status],
      });
    }
  }
  return out;
}

export const STATUS_LEGEND: Array<{ status: VisitStatus; color: string; label: string }> = (
  ['red', 'yellow', 'green', 'blue'] as VisitStatus[]
).map((s) => ({ status: s, color: STATUS_COLOR[s], label: STATUS_LABEL[s] }));
