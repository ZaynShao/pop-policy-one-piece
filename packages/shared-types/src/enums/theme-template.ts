/**
 * 政策主题模板(PRD §2.4 场景 3 拍板)
 * - main 主线政策:main_value 语义=区覆盖数(1-50 范围)
 * - risk 核心风险:main_value 语义=政诉数(10-200 范围)
 */
export type ThemeTemplate = 'main' | 'risk';

export const THEME_TEMPLATE_LABEL: Record<ThemeTemplate, string> = {
  main: '主线政策',
  risk: '核心风险',
};
