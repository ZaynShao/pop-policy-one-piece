import { Controller, Get, Param, Query } from '@nestjs/common';
import { RegionLevel } from './entities/region.entity';
import { RegionsService } from './regions.service';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  /**
   * GET /api/v1/regions
   *   - ?parent=100000 → 该父区划下的直接子级
   *   - ?level=province → 所有省级
   *   - 不带参数 → 顶级(国家)
   */
  @Get()
  async list(
    @Query('parent') parent?: string,
    @Query('level') level?: RegionLevel,
  ) {
    if (level) {
      const data = await this.regions.listByLevel(level);
      return { data, meta: { count: data.length, level } };
    }
    const data = await this.regions.listByParent(parent);
    return {
      data,
      meta: { count: data.length, parent: parent ?? null },
    };
  }

  @Get(':code')
  async getOne(@Param('code') code: string) {
    return { data: await this.regions.findByCode(code) };
  }
}
