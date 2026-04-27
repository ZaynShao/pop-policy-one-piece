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
} as const;

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
