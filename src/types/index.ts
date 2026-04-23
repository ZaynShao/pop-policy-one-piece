export type Role = 'ga' | 'pmo' | 'lead' | 'central_ga' | 'exec';

export const ROLE_LABEL: Record<Role, string> = {
  ga: '属地 GA',
  pmo: 'PMO',
  lead: '负责人',
  central_ga: '中台 GA',
  exec: '决策层',
};

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  email?: string;
  role: Role;
}

export type VisitStatus = 'planned' | 'completed';
export type VisitColor = 'blue' | 'green' | 'yellow' | 'red';

export const VISIT_COLOR_HEX: Record<VisitColor, string> = {
  blue: '#1677ff',
  green: '#52c41a',
  yellow: '#faad14',
  red: '#ff4d4f',
};

export const VISIT_COLOR_LABEL: Record<VisitColor, string> = {
  blue: '计划（蓝）',
  green: '常规维护（绿）',
  yellow: '层级提升/有价值政策（黄）',
  red: '风险/立即执行（红）',
};

export interface VisitRecord {
  id: string;
  userId: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  districtCode?: string;
  districtName?: string;
  department: string;
  contactPerson?: string;
  status: VisitStatus;
  color: VisitColor;
  policyIds: string[];
  content: string;
  audioUrl?: string;
  plannedAt?: string;
  visitedAt?: string;
  createdAt: string;
}

export interface Policy {
  id: string;
  name: string;
  level: 'main' | 'sub';
  color: string;
  description?: string;
  coverage: PolicyCoverage[];
}

export interface PolicyCoverage {
  provinceCode: string;
  cityCode?: string;
  districtCode?: string;
}

export type PinStatus = 'active' | 'done' | 'cancelled';

export const PIN_STATUS_LABEL: Record<PinStatus, string> = {
  active: '进行中',
  done: '已完成',
  cancelled: '已中止',
};

export interface PinComment {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export interface Pin {
  id: string;
  creatorId: string;
  creatorName: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  title: string;
  goal: string;
  status: PinStatus;
  comments: PinComment[];
  createdAt: string;
}

export type MapMode = 'region' | 'policy';
