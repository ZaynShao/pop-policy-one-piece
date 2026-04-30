import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovContactEntity } from './entities/gov-contact.entity';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { GovContactsController } from './gov-contacts.controller';
import { GovContactsService } from './gov-contacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovContactEntity, GovOrgEntity])],
  controllers: [GovContactsController],
  providers: [GovContactsService],
  exports: [GovContactsService, TypeOrmModule],  // 让 visits.service 调 upsertByOrgAndName
})
export class GovContactsModule {}
