import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { VisitsController, CitiesController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitEntity, PinEntity, CommentEntity])],
  controllers: [VisitsController, CitiesController],
  providers: [VisitsService],
})
export class VisitsModule {}
