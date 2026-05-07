import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser, ToolStatus, ToolType } from '@pop/shared-types';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';
import { BindingsService } from './bindings.service';
import { CreateBindingDto } from './dtos/create-binding.dto';

@Controller('tools')
export class ToolsController {
  constructor(
    private readonly service: ToolsService,
    private readonly bindings: BindingsService,
  ) {}

  @Get()
  async list(
    @Query('status') status?: ToolStatus,
    @Query('type') type?: ToolType,
    @Query('creatorId') creatorId?: string,
  ) {
    return { data: await this.service.list({ status, type, creatorId }) };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateToolDto, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.create(dto, user) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateToolDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user) };
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.publish(id, user) };
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.archive(id, user) };
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.restore(id, user) };
  }

  @Get(':id/bindings')
  async listBindings(@Param('id') id: string) {
    return { data: await this.bindings.listByTool(id) };
  }

  @Post(':id/bindings')
  async addBinding(@Param('id') id: string, @Body() dto: CreateBindingDto) {
    return { data: await this.bindings.create(id, dto) };
  }

  @Delete(':id/bindings/:bid')
  async deleteBinding(@Param('bid') bid: string) {
    await this.bindings.delete(bid);
    return { ok: true };
  }
}
