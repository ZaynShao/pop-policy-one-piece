import { Controller, Get } from '@nestjs/common';
import type { HealthDto } from '@pop/shared-types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthDto {
    return {
      status: 'ok',
      service: 'pop-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
