import type { ThemeTemplate } from '../enums/theme-template';
import type { ThemeStatus } from '../enums/theme-status';
import type { ThemeRegionLevel } from '../enums/theme-region-level';

export interface Theme {
  id: string;
  title: string;
  template: ThemeTemplate;
  keywords: string[];
  regionScope: string | null;
  status: ThemeStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ThemeCoverage {
  id: string;
  themeId: string;
  regionCode: string;
  regionLevel: ThemeRegionLevel;
  mainValue: number;
  extraData: Record<string, unknown> | null;
  lastFetchedAt: string;
}

export interface ThemeWithCoverage extends Theme {
  coverage: ThemeCoverage[];
}

export interface CreateThemeInput {
  title: string;
  template: ThemeTemplate;
  keywords?: string[];
  regionScope?: string;
}

export interface UpdateThemeInput {
  title?: string;
  keywords?: string[];
  regionScope?: string | null;
  // 不接受 status / template / publishedAt(状态切走专用 endpoint;模板创建后不可改)
}

/**
 * B7-B9 反查 — GET /themes/by-region 单条结果
 * theme + 该 region 在主题下的 coverage 摘要
 */
export interface ThemeByRegionResult {
  theme: Theme;
  coverage: {
    regionCode: string;
    regionLevel: ThemeRegionLevel;
    mainValue: number;
  };
}
