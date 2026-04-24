import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { HealthDto } from '@pop/shared-types';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthDto & { db: 'ok' | 'down' }> {
    let db: 'ok' | 'down' = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      service: 'pop-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      db,
    };
  }
}
