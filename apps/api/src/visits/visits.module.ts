import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { GovContactsModule } from '../gov-contacts/gov-contacts.module';
import { VisitsController, CitiesController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitEntity, PinEntity, CommentEntity, UserEntity, GovOrgEntity]),
    GovContactsModule,
  ],
  controllers: [VisitsController, CitiesController],
  providers: [VisitsService],
})
export class VisitsModule {}
