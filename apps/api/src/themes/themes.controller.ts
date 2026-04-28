import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser, type ThemeStatus } from '@pop/shared-types';
import { ThemesService } from './themes.service';
import { CoverageService } from './coverage.service';
import { CreateThemeDto } from './dtos/create-theme.dto';
import { UpdateThemeDto } from './dtos/update-theme.dto';

@Controller('themes')
export class ThemesController {
  constructor(
    private readonly service: ThemesService,
    private readonly coverage: CoverageService,
  ) {}

  @Get()
  async list(@Query('status') status?: ThemeStatus | 'all') {
    const data = await this.service.list({ status });
    return { data };
  }

  /**
   * B7-B9 反查 — 给 region 返回所有 cover 该 region 的已发布主题
   * 必须放在 @Get(':id') 之前(NestJS 路由顺序敏感)
   */
  @Get('by-region')
  async findByRegion(
    @Query('regionCode') regionCode: string,
    @Query('selectedIds') selectedIdsCsv?: string,
  ) {
    if (!regionCode) {
      throw new BadRequestException('regionCode 必填');
    }
    const selectedIds = selectedIdsCsv
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const data = await this.service.findByRegion(regionCode, selectedIds);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOneWithCoverage(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateThemeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user) };
  }

  @Post(':id/fetch-coverage')
  async fetchCoverage(@Param('id') id: string) {
    const coverage = await this.coverage.fetchCoverage(id);
    return { data: coverage };
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.publish(id, user) };
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.archive(id, user) };
  }

  @Post(':id/unarchive')
  async unarchive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.unarchive(id, user) };
  }
}
