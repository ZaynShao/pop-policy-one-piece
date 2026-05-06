import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { AliyunTokenManager } from './aliyun-token-manager';

@Module({
  imports: [TypeOrmModule.forFeature([GovOrgEntity])],
  controllers: [VoiceController],
  providers: [VoiceService, AliyunTokenManager],
})
export class VoiceModule {}
