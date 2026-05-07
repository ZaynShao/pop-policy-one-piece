import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { ToolsService } from './tools.service';
import { BindingsService } from './bindings.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity]),
  ],
  providers: [ToolsService, BindingsService],
  controllers: [ToolsController],
  exports: [ToolsService, BindingsService],
})
export class ToolsModule {}
