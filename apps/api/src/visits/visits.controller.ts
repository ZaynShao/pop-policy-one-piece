import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { listAllProvincesCities } from '../lib/geojson-cities';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

/**
 * Visit API(SPEC-V0.6-beta1-visit §3)
 * 全部走 sys_admin 全权(JWT auth + CASL `sys_admin manage all`)
 */
@Controller('visits')
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  async list(
    @Query('status') status?: 'planned' | 'completed' | 'cancelled',
    @Query('parentPinId') parentPinId?: string,
  ) {
    const data = await this.service.list({ status, parentPinId });
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user.id) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user.id) };
  }
}

/** 单独 controller:GET /api/v1/cities 列出所有省+市(前端 cascading 下拉用) */
@Controller('cities')
export class CitiesController {
  @Get()
  list() {
    return { data: listAllProvincesCities() };
  }
}
