/**
 * 拜访点视觉算法(2026-05-18 新增 / 2026-05-19 调参 — 间距更紧 + 衰减更陡)
 *
 * 两个独立纯函数:
 * 1. decayLightnessByAge(hex, daysAgo) — 按时间衰减 HSL.L
 *    - 0-14d:  原色(×1.0)
 *    - 14-60d: 线性插值 ×1.0 → ×0.45(原 ×0.6,衰减更陡)
 *    - 60-120d: 线性插值 ×0.45 → ×0.22
 *    - 120d+:  ×0.22
 *    - L 下限 12% 防变黑(原 20%)
 *
 * 2. layoutCluster(n, baseSize, opts) — 同坐标多点蜂窝堆叠
 *    - 圆心距 = size × 0.9(原 1.18,2026-05-19 owner 决定更紧)
 *      → 任意两两重叠面积 ≈ 45% πr²(d/2r=0.45 几何反推)
 *    - 六边形紧密堆积:第 0 层 1 个 + 第 k 层 6k 个
 *    - 密集时按比例缩小 size,触底 minSize 兜底
 *    - 输出像素 [offsetX, offsetY],配合 echarts data-item 级 symbolOffset(zoom 无关)
 */

// ============ 颜色衰减 ============

const PADDING_FACTOR = 0.9;  // 圆心距 / size,使两两重叠 ≈45%(owner 2026-05-19 拍板更紧)
const MIN_LIGHTNESS = 12;    // L 下限(0-100,原 20)

/** hex(#rrggbb)→ HSL(h:0-360, s/l:0-100) */
function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [0, 0, 50];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100, lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60)       { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else              { r1 = c; b1 = x; }
  const to2 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(r1)}${to2(g1)}${to2(b1)}`;
}

/**
 * 按天数衰减 hex 颜色的 lightness。
 * daysAgo < 0(未来日期,planned)按 0 处理 — 计划点保持原色。
 */
export function decayLightnessByAge(hex: string, daysAgo: number): string {
  const d = Math.max(0, daysAgo);
  let factor: number;
  if (d <= 14)      factor = 1;
  else if (d <= 60) factor = 1 - (0.55 * (d - 14)) / 46; // 14→60 线性到 0.45
  else              factor = 0.45 - 0.23 * Math.min(1, (d - 60) / 60); // 60→120 线性到 0.22 再固定

  const [h, s, l] = hexToHsl(hex);
  const newL = Math.max(MIN_LIGHTNESS, l * factor);
  return hslToHex(h, s, newL);
}

/** YYYY-MM-DD → 距离 now 的天数(now 默认今天)。无效输入返 0。 */
export function daysAgoFromISO(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(t)) return 0;
  const ms = now.getTime() - t;
  return Math.floor(ms / 86_400_000);
}

// ============ 蜂窝布局 ============

export interface ClusterOpts {
  /** 默认尺寸(直径,px) */
  baseSize: number;
  /** 兜底最小尺寸(直径,px) */
  minSize: number;
  /** 整组(中心→外环最远圆心)允许的最大半径(px),超出则缩小 size */
  maxClusterRadius: number;
}

export interface ClusterPoint {
  offsetX: number;
  offsetY: number;
  size: number;
}

/**
 * 生成 n 个圆的六边形堆积偏移(基于单位距离 1 的几何位置)。
 *
 * 输出按"先中心→第1环→第2环"顺序,共 n 个 [dx, dy] 单位向量。
 * 单位距离 = 1,实际像素 = unit × (size × PADDING_FACTOR)。
 */
function hexUnitOffsets(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[0, 0]];
  if (n <= 1) return out.slice(0, n);
  // 第 k 环 6k 个点,起始角 30° 偏(让首点在右上不挡正右文字)
  let k = 1;
  while (out.length < n) {
    const count = 6 * k;
    for (let i = 0; i < count && out.length < n; i++) {
      const angle = (Math.PI / 6) + (i * 2 * Math.PI) / count;
      out.push([k * Math.cos(angle), k * Math.sin(angle)]);
    }
    k++;
  }
  return out;
}

/**
 * 给定 n 个同坐标点,算出每个的像素偏移 + 自适应尺寸。
 *
 * 流程:
 * 1. n=1 → 中心,size=baseSize
 * 2. n≥2 → 蜂窝单位偏移 × (size × PADDING_FACTOR)
 *    若整组半径(最远圆心 + 半径)> maxClusterRadius
 *    → size 等比缩小,触底 minSize 后接受溢出
 *
 * 调用方负责"同坐标分组"。
 */
export function layoutCluster(n: number, opts: ClusterOpts): ClusterPoint[] {
  if (n <= 0) return [];
  const { baseSize, minSize, maxClusterRadius } = opts;
  if (n === 1) return [{ offsetX: 0, offsetY: 0, size: baseSize }];

  const units = hexUnitOffsets(n);
  // 最远圆心距(单位) = 最外环编号 k
  let maxRingK = 0;
  for (const [dx, dy] of units) {
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > maxRingK) maxRingK = r;
  }

  // 期望 size:让 (maxRingK × size × PADDING) + size/2 ≤ maxClusterRadius
  // → size × (maxRingK × PADDING + 0.5) ≤ maxClusterRadius
  let size = baseSize;
  const denom = maxRingK * PADDING_FACTOR + 0.5;
  const fitSize = maxClusterRadius / denom;
  if (fitSize < baseSize) size = Math.max(minSize, fitSize);

  const stride = size * PADDING_FACTOR;
  return units.map(([dx, dy]) => ({
    offsetX: dx * stride,
    offsetY: dy * stride,
    size,
  }));
}

// ============ 同坐标分组工具 ============

/**
 * 把任意带 (lng, lat) 的列表按坐标分组(toFixed(4) ≈ 11m 量化)。
 * 返回 Map: key → 原列表里的索引数组。
 */
export function groupByCoord<T extends { lng: number; lat: number }>(
  items: T[],
): Map<string, number[]> {
  const m = new Map<string, number[]>();
  items.forEach((it, idx) => {
    const k = `${it.lng.toFixed(4)}_${it.lat.toFixed(4)}`;
    const arr = m.get(k);
    if (arr) arr.push(idx);
    else m.set(k, [idx]);
  });
  return m;
}
