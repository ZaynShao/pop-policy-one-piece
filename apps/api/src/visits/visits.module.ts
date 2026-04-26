import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { VisitsController, CitiesController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitEntity])],
  controllers: [VisitsController, CitiesController],
  providers: [VisitsService],
})
export class VisitsModule {}
