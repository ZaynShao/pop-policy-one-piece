export type GovOrgLevel = 'national' | 'provincial' | 'municipal' | 'district';

export interface GovOrg {
  id: string;
  name: string;
  shortName: string | null;
  provinceCode: string;
  cityName: string;
  districtName: string | null;
  level: GovOrgLevel;
  parentOrgId: string | null;
  functionTags: string[];
  address: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateGovOrgInput {
  name: string;
  shortName?: string;
  provinceCode: string;
  cityName: string;
  districtName?: string;
  level: GovOrgLevel;
  parentOrgId?: string;
  functionTags?: string[];
  address?: string;
}

export interface UpdateGovOrgInput {
  name?: string;
  shortName?: string | null;
  districtName?: string | null;
  level?: GovOrgLevel;
  parentOrgId?: string | null;
  functionTags?: string[];
  address?: string | null;
  // 不允许改 provinceCode / cityName(影响 unique 约束 + 数据归属)
}

export interface GovOrgListQuery {
  provinceCode?: string;
  cityName?: string;
  level?: GovOrgLevel;
  search?: string;
  withDeleted?: boolean;
  limit?: number;
}
