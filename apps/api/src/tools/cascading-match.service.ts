import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import type { ToolTaxonomy } from '@pop/shared-types';

interface RegionContext {
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
}

export interface MatchResult {
  groups: Record<ToolTaxonomy, ToolEntity[]>;
}

const SCOPE_PRECISION: Record<string, number> = {
  district_specific: 4,
  city_specific: 3,
  province_specific: 2,
  all_districts_in_city: 3,
  all_cities_in_province: 2,
  all_provinces: 1,
  nationwide: 0,
};

@Injectable()
export class CascadingMatchService {
  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolBindingEntity) private readonly bindingsRepo: Repository<ToolBindingEntity>,
    @InjectRepository(VisitEntity) private readonly visitsRepo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
  ) {}

  async matchByVisit(visitId: string): Promise<MatchResult> {
    const visit = await this.visitsRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException(`Visit ${visitId} not found`);
    const ctx: RegionContext = {
      provinceCode: visit.provinceCode ?? null,
      cityCode: (visit as any).cityCode ?? null,
      districtCode: (visit as any).districtCode ?? null,
    };
    return this.match(ctx, { visitId });
  }

  async matchByPin(pinId: string): Promise<MatchResult> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);
    const ctx: RegionContext = {
      provinceCode: (pin as any).provinceCode ?? null,
      cityCode: (pin as any).cityCode ?? null,
      districtCode: (pin as any).districtCode ?? null,
    };
    return this.match(ctx, { pinId });
  }

  private async match(
    ctx: RegionContext,
    targetIds: { visitId?: string; pinId?: string },
  ): Promise<MatchResult> {
    const bindings = await this.bindingsRepo.find({
      where: this.buildBindingFilters(ctx, targetIds),
    });
    const toolIdSet = new Set(bindings.map((b) => b.toolId));
    if (toolIdSet.size === 0) return { groups: {} as any };

    const tools = await this.toolsRepo.find({
      where: { id: In([...toolIdSet]), status: 'published', deletedAt: IsNull() },
    });

    const toolToBestPrecision = new Map<string, number>();
    for (const b of bindings) {
      const p = this.precisionOf(b);
      const cur = toolToBestPrecision.get(b.toolId) ?? -1;
      if (p > cur) toolToBestPrecision.set(b.toolId, p);
    }

    const groups: Record<string, ToolEntity[]> = {};
    for (const t of tools) {
      (groups[t.taxonomyTag] ??= []).push(t);
    }
    for (const tag of Object.keys(groups)) {
      groups[tag].sort((a, b) => {
        const pa = toolToBestPrecision.get(a.id) ?? 0;
        const pb = toolToBestPrecision.get(b.id) ?? 0;
        if (pa !== pb) return pb - pa;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return { groups: groups as any };
  }

  private buildBindingFilters(ctx: RegionContext, ids: { visitId?: string; pinId?: string }): any[] {
    const filters: any[] = [];
    if (ids.visitId) filters.push({ visitId: ids.visitId });
    if (ids.pinId) filters.push({ pinId: ids.pinId });
    filters.push({ targetType: 'region', regionScopeTag: 'nationwide' });
    if (ctx.provinceCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'all_provinces', regionCode: ctx.provinceCode });
      filters.push({ targetType: 'region', regionScopeTag: 'all_cities_in_province', regionCode: ctx.provinceCode });
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.provinceCode });
    }
    if (ctx.cityCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'all_districts_in_city', regionCode: ctx.cityCode });
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.cityCode });
    }
    if (ctx.districtCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.districtCode });
    }
    return filters;
  }

  private precisionOf(b: ToolBindingEntity): number {
    if (b.targetType !== 'region') return SCOPE_PRECISION.district_specific;
    const tag = b.regionScopeTag!;
    return SCOPE_PRECISION[tag] ?? 0;
  }
}
