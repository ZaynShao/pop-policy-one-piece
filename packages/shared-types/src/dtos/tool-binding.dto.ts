import type { BindingTarget } from '../enums/binding-target';
import type { RegionScope } from '../enums/region-scope';

export interface ToolBinding {
  id: string;
  toolId: string;
  targetType: BindingTarget;
  pinId: string | null;
  visitId: string | null;
  regionCode: string | null;
  regionScopeTag: RegionScope | null;
  createdAt: string;
}

export type CreateBindingRequestDto =
  | { targetType: 'pin'; pinId: string }
  | { targetType: 'visit'; visitId: string }
  | { targetType: 'region'; regionCode: string | null; regionScopeTag: RegionScope };
