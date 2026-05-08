import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { UserEntity } from '../users/entities/user.entity';
import { ToolsService } from './tools.service';
import { BindingsService } from './bindings.service';
import { CascadingMatchService } from './cascading-match.service';
import { ConsumptionService } from './consumption.service';
import { OssService } from './oss.service';
import { ToolPoolSeederService } from '../seeds/tool-pool-seeder.service';
import { ToolsController } from './tools.controller';
import { MeConsumptionsController } from './me-consumptions.controller';
import { ExternalMockModule } from '../external-mock/external-mock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity,
      VisitEntity, PinEntity,
      UserEntity,
    ]),
    ExternalMockModule,
  ],
  providers: [ToolsService, BindingsService, CascadingMatchService, ConsumptionService, OssService, ToolPoolSeederService],
  controllers: [ToolsController, MeConsumptionsController],
  exports: [ToolsService, BindingsService, CascadingMatchService, ConsumptionService, OssService],
})
export class ToolsModule {}
