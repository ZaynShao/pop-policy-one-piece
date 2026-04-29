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
import { GovContactsService } from './gov-contacts.service';
import { CreateGovContactDto } from './dtos/create-gov-contact.dto';
import { UpdateGovContactDto } from './dtos/update-gov-contact.dto';
import { ListGovContactDto } from './dtos/list-gov-contact.dto';

@Controller('gov-contacts')
export class GovContactsController {
  constructor(private readonly service: GovContactsService) {}

  @Get()
  async list(@Query() query: ListGovContactDto) {
    return { data: await this.service.list(query) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateGovContactDto, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.create(dto, user) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGovContactDto,
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
