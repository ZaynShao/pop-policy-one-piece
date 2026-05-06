import type { ThemeConfig } from 'antd';

/**
 * POP 视觉 token(承接一期)
 * - 深色底 #0a1929
 * - 青色主色 #00d4ff
 * - 玻璃拟态面板
 *
 * 业务语义色(绿黄红蓝对应 PRD §6.3 走访颜色)在 palette.visit 中定义。
 */
export const palette = {
  bgBase: '#0a1929',
  bgPanel: 'rgba(13, 31, 50, 0.6)',
  border: 'rgba(0, 212, 255, 0.2)',
  primary: '#00d4ff',
  textBase: '#e6f4ff',
  textMuted: 'rgba(230, 244, 255, 0.6)',
  visit: {
    green: '#52c41a',
    yellow: '#faad14',
    red: '#fa8c16',  // 橙色(原深红 #c0392b)— 避开 Pin 红色冲突;Tag 同步 'orange'
    blue: '#1677ff',
  },
  // 政策染色色阶池 — 10 个色相,主题按 hash 稳定分配;新主题进来自动获得色相
  // 5 档语义:[s0=数据少最暗] → [s4=数据多最亮]
  // 避开 visit 绿黄红蓝橙 + pin 红灰 + theme 主线绿/风险红
  // 5 档基于 tailwind 700/600/500/400/200(深→亮),跨度大保证可识别
  policyColoring: {
    none: 'rgba(13, 31, 50, 0.85)',
    scales: [
      ['#0e7490', '#0891b2', '#06b6d4', '#22d3ee', '#a5f3fc'], // cyan
      ['#7c3aed', '#9333ea', '#a855f7', '#c084fc', '#e9d5ff'], // purple
      ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4'], // teal
      ['#a21caf', '#c026d3', '#d946ef', '#e879f9', '#f5d0fe'], // fuchsia
      ['#4338ca', '#4f46e5', '#6366f1', '#818cf8', '#c7d2fe'], // indigo
      ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fecdd3'], // rose
      ['#047857', '#059669', '#10b981', '#34d399', '#a7f3d0'], // emerald
      ['#be185d', '#db2777', '#ec4899', '#f472b6', '#fbcfe8'], // pink
      ['#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#ddd6fe'], // violet
      ['#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#bae6fd'], // sky
    ] as ReadonlyArray<readonly [string, string, string, string, string]>,
  },
} as const;

/**
 * 主题色阶分配 — 按主题字典序 index 稳定映射到 palette 色相池
 *
 * - 优先用 allTopics:字典序 sorted 后,topic 在列表里的 index → pool[index % 10]
 *   保证 ≤ 10 个主题完全不撞色
 * - fallback(无 allTopics 时):hash mod,可能撞色
 * - 新主题进来:列表里多一项,该列表的字典序 index 重新分配(色相会 reshuffle)
 *
 * 返回 5 档色阶:[s0 数据少最暗] → [s4 数据多最亮]
 */
export function getTopicColorScale(
  topic: string,
  allTopics?: readonly string[],
): readonly [string, string, string, string, string] {
  const pool = palette.policyColoring.scales;
  if (allTopics && allTopics.length > 0) {
    const idx = [...allTopics].sort().indexOf(topic);
    if (idx >= 0) return pool[idx % pool.length];
  }
  let h = 0;
  for (let i = 0; i < topic.length; i++) {
    h = (h * 31 + topic.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(h) % pool.length];
}

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const glass = {
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  background: palette.bgPanel,
  border: `1px solid ${palette.border}`,
  borderRadius: 12,
} as const;

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorBgBase: palette.bgBase,
    colorText: palette.textBase,
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
  },
  components: {
    Card: {
      colorBgContainer: palette.bgPanel,
      colorBorderSecondary: palette.border,
    },
  },
};
