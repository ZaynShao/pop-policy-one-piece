import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { GovOrgsService } from './gov-orgs.service';
import { CreateGovOrgDto } from './dtos/create-gov-org.dto';
import { UpdateGovOrgDto } from './dtos/update-gov-org.dto';
import { ListGovOrgDto } from './dtos/list-gov-org.dto';

@Controller('gov-orgs')
export class GovOrgsController {
  constructor(private readonly service: GovOrgsService) {}

  @Get()
  async list(@Query() query: ListGovOrgDto) {
    return { data: await this.service.list(query) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateGovOrgDto, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.create(dto, user) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGovOrgDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user) };
  }

  @Delete(':id')
  @HttpCode(204)
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.softDelete(id, user);
  }
}
