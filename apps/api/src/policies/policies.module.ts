import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyEntity } from './entities/policy.entity';
import { PolicyTopicEntity } from './entities/policy-topic.entity';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [TypeOrmModule.forFeature([PolicyEntity, PolicyTopicEntity])],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService, TypeOrmModule],
})
export class PoliciesModule {}
