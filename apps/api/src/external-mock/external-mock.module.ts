import { Module } from '@nestjs/common';
import { ExternalMockController } from './external-mock.controller';
import { ExternalMockService } from './external-mock.service';

@Module({
  controllers: [ExternalMockController],
  providers: [ExternalMockService],
  exports: [ExternalMockService],
})
export class ExternalMockModule {}
