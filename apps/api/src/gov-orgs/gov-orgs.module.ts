import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovOrgEntity } from './entities/gov-org.entity';
import { GovOrgsController } from './gov-orgs.controller';
import { GovOrgsService } from './gov-orgs.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovOrgEntity])],
  controllers: [GovOrgsController],
  providers: [GovOrgsService],
  exports: [GovOrgsService, TypeOrmModule],  // 让 visits/voice 复用 repo
})
export class GovOrgsModule {}
