import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@pop/shared-types';
import { ConsumptionService } from './consumption.service';

@Controller('me')
export class MeConsumptionsController {
  constructor(private readonly consumption: ConsumptionService) {}

  @Get('consumptions')
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.consumption.listForUser(user.id) };
  }
}
