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
 *
 * β.2.5/β.3: 加 4 新字段(status/parentPinId/title/plannedDate),业务字段改 nullable
 */

import type { VisitStatus } from '../enums/visit-status';

export type VisitStatusColor = 'red' | 'yellow' | 'green' | 'blue';
// 'blue' 仅 status='planned' 时使用,前端按 status 推导,不依赖 visitColor 字段

export interface Visit {
  id: string;
  // β.2.5/β.3 新增 4 字段
  status: VisitStatus;
  parentPinId: string | null;
  title: string | null;
  plannedDate: string | null;        // YYYY-MM-DD
  // 业务字段(β.1 — planned 时全部可空)
  visitDate: string | null;          // 改为 nullable
  department: string | null;         // 改为 nullable
  contactPerson: string | null;      // 改为 nullable
  contactTitle: string | null;
  outcomeSummary: string | null;     // 改为 nullable
  color: VisitStatusColor | null;    // 改为 nullable
  followUp: boolean;
  // 地理 4 字段(全可空 false)
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
  status?: VisitStatus;              // 默认 'completed'
  parentPinId?: string;
  title?: string;
  plannedDate?: string;
  visitDate?: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp?: boolean;
  // 地理(必填,用于 city center lookup)
  provinceCode: string;
  cityName: string;
}

/**
 * Visit 状态机(后端 visits.service.update 强制):
 *   planned    → completed(必须填 visitDate / contactPerson / color),不可逆
 *   planned    ↔ cancelled
 *   completed  → *  全禁(白名单只允许改 color)
 *
 * 边界场景:
 *   - planned 时改业务字段(department / outcomeSummary 等)允许
 *   - completed 时只改 color OK,改其他字段抛 400「已完成拜访只允许改 color」
 *   - cancelled 时可重启回 planned,数据保留
 */
export interface UpdateVisitInput {
  status?: VisitStatus;
  parentPinId?: string | null;
  title?: string | null;
  plannedDate?: string | null;
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
