export type ContactTier = 'core' | 'important' | 'normal';

export interface GovContact {
  id: string;
  name: string;
  gender: string | null;
  orgId: string;
  title: string;
  tier: ContactTier;
  phone: string | null;
  wechat: string | null;
  preferenceNotes: string | null;
  ownerUserId: string;
  lastEngagedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateGovContactInput {
  name: string;
  gender?: string;
  orgId: string;
  title: string;
  tier?: ContactTier;
  phone?: string;
  wechat?: string;
  preferenceNotes?: string;
  ownerUserId?: string;  // 默认当前 user
}

export interface UpdateGovContactInput {
  name?: string;
  gender?: string | null;
  title?: string;
  tier?: ContactTier;
  phone?: string | null;
  wechat?: string | null;
  preferenceNotes?: string | null;
  ownerUserId?: string;
  // 不允许改 orgId(转移联系人 V0.8 再做)
}

export interface GovContactListQuery {
  orgId?: string;
  ownerUserId?: string;
  tier?: ContactTier;
  search?: string;
  limit?: number;
}
