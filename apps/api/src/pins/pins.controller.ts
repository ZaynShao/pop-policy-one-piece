import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { PinsService } from './pins.service';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';

/**
 * Pin API(SPEC-V0.6-beta2-pin §3)
 * 全部走 sys_admin 全权(JWT auth + CASL `sys_admin manage all`)
 * 状态机校验在 service.update,UpdatePinDto 不接受 provinceCode/cityName 改
 */
@Controller('pins')
export class PinsController {
  constructor(private readonly service: PinsService) {}

  @Get()
  async list() {
    const data = await this.service.list();
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(
    @Body() dto: CreatePinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user.id) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.softDelete(id, user);
  }
}
