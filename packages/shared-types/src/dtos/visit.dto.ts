/**
 * Visit · 拜访记录(PRD §3.3 B2 + §4.3.4)
 *
 * 字段命名:camelCase(对齐 V0.2 user.dto 风格 + NestJS/TypeORM 默认序列化惯例)
 *
 * MVP β.1 范围(SPEC-V0.6-beta1-visit §1):
 * - 7 业务 + 4 地理(lng/lat 后端从 GeoJSON 查 city center 自动填)
 * - color 仅 red/yellow/green(blue 是 PlanPoint 蓝点,留 β.3)
 * - 不挂 contactId(K3 双轨,留 γ K 模块)/ relatedThemes(c3 政策主题)/
 *   planPointId(蓝点 β.3)
 */

export type VisitStatusColor = 'red' | 'yellow' | 'green';

export interface Visit {
  id: string;
  // 业务 7 字段
  visitDate: string;                  // YYYY-MM-DD
  department: string;
  contactPerson: string;
  contactTitle: string | null;
  outcomeSummary: string;
  color: VisitStatusColor;
  followUp: boolean;
  // 地理 4 字段
  provinceCode: string;
  cityName: string;
  lng: number;
  lat: number;
  // 系统
  visitorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitInput {
  visitDate: string;
  department: string;
  contactPerson: string;
  contactTitle?: string;
  outcomeSummary: string;
  color: VisitStatusColor;
  followUp: boolean;
  provinceCode: string;
  cityName: string;
}

export interface UpdateVisitInput {
  visitDate?: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string | null;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp?: boolean;
  // 不允许改 provinceCode / cityName —— 改了会动 lng/lat 影响散点位置
}

export interface CityListResponse {
  data: Array<{
    provinceCode: string;
    provinceName: string;
    cities: Array<{ name: string }>;
  }>;
}
