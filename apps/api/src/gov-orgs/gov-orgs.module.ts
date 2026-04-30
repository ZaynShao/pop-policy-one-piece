import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovOrgEntity } from './entities/gov-org.entity';
import { GovOrgsController } from './gov-orgs.controller';
import { GovOrgsService } from './gov-orgs.service';
import { GovOrgsSeederService } from '../seeds/gov-orgs-seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovOrgEntity])],
  controllers: [GovOrgsController],
  providers: [GovOrgsService, GovOrgsSeederService],
  exports: [GovOrgsService, TypeOrmModule],
})
export class GovOrgsModule {}
