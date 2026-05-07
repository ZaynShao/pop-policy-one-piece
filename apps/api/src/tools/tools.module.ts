import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { ToolsService } from './tools.service';
import { BindingsService } from './bindings.service';
import { CascadingMatchService } from './cascading-match.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity,
      VisitEntity, PinEntity,
    ]),
  ],
  providers: [ToolsService, BindingsService, CascadingMatchService],
  controllers: [ToolsController],
  exports: [ToolsService, BindingsService, CascadingMatchService],
})
export class ToolsModule {}
