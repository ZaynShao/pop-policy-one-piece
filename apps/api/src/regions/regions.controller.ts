import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { RegionLevel } from './entities/region.entity';
import { RegionsService } from './regions.service';
import { reverseGeocode } from '../lib/geojson-cities';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  /**
   * GET /api/v1/regions/reverse?lng=121.47&lat=31.23
   * 移动端 GPS 反查 → 最近 city center(欧式距离)
   *
   * 注意:这条要在 :code 之前定义,否则会被 @Get(':code') 截胡
   */
  @Get('reverse')
  reverse(@Query('lng') lng?: string, @Query('lat') lat?: string) {
    const lngNum = Number(lng);
    const latNum = Number(lat);
    if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) {
      throw new BadRequestException('lng / lat 必填且为合法数字');
    }
    if (lngNum < -180 || lngNum > 180 || latNum < -90 || latNum > 90) {
      throw new BadRequestException('lng / lat 超出合法范围');
    }
    const data = reverseGeocode(lngNum, latNum);
    if (!data) throw new BadRequestException('未匹配到任何区划(GeoJSON 数据未加载?)');
    return { data };
  }

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
