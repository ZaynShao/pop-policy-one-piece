import type { PolicyLevel } from '../enums/policy-level';

// ---- 入参:LLM 输出的 T2 JSON ----

export interface PolicyItemInput {
  title: string;
  issuingOrg: string;
  issueDate: string; // YYYY-MM-DD
  level: PolicyLevel;
  summary: string;
}

export interface ProvinceGroupInput {
  provinceCode: string;
  provinceName: string;
  policies: PolicyItemInput[];
}

export interface CityGroupInput {
  provinceCode: string;
  cityName: string;
  policies: PolicyItemInput[];
}

export interface TopicInput {
  topic: string;
  national: PolicyItemInput[];
  byProvince: ProvinceGroupInput[];
  byCity: CityGroupInput[];
}

export interface TopicDistributionInput {
  fetchedAt: string;
  topics: TopicInput[];
}

// ---- 出参:大盘渲染用 ----

export interface PolicyDistribution {
  topic: string;
  national: number;
  byProvince: Array<{ provinceCode: string; count: number }>;
  byCity: Array<{ provinceCode: string; cityName: string; count: number }>;
}

export interface Policy {
  id: string;
  title: string;
  issuingOrg: string;
  issueDate: string;
  level: PolicyLevel;
  provinceCode: string | null;
  cityName: string | null;
  summary: string;
  topics: string[];
}
