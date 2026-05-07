import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity]),
  ],
  providers: [],
  controllers: [],
  exports: [],
})
export class ToolsModule {}
