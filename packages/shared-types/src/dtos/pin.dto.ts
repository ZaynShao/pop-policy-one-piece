/**
 * Pin · 图钉(PRD §3.3 B7 + §4.3.1)
 *
 * 字段命名:camelCase(对齐 V0.2 user.dto / β.1 visit.dto + NestJS 默认序列化)
 *
 * MVP β.2 范围(SPEC-V0.6-beta2-pin §1):
 * - 9 业务 + 2 地理(lng/lat 后端从 GeoJSON 查 city center 自动填)
 * - status 仅 in_progress/completed/aborted(B9)
 * - 不挂 related_theme_ids(c3 政策主题模块)
 * - 不做 Comment 留言板(B8 → β.2.5)
 */

export type PinStatus = 'in_progress' | 'completed' | 'aborted';
export type PinPriority = 'high' | 'medium' | 'low';

export interface Pin {
  id: string;
  // 业务 9 字段
  title: string;
  description: string | null;
  status: PinStatus;
  abortedReason: string | null;
  closedBy: string | null;
  closedAt: string | null;
  priority: PinPriority;
  // 地理 4 字段(lng/lat 后端自动填)
  provinceCode: string;
  cityName: string;
  lng: number;
  lat: number;
  // 系统
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePinInput {
  title: string;
  description?: string;
  priority?: PinPriority;             // 默认 medium
  provinceCode: string;
  cityName: string;
  // status 创建时强制 in_progress,不接受外部值
  // closed_* / abortedReason 创建时必为空
  // lng/lat 后端自动从 lookupCityCenter 填
}

export interface UpdatePinInput {
  title?: string;
  description?: string | null;
  status?: PinStatus;
  abortedReason?: string | null;
  priority?: PinPriority;
  // 不允许改 provinceCode / cityName(改了会动 lng/lat 影响散点位置)
}
