import { Controller, Get, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { DistributionQueryDto } from './dtos/distribution-query.dto';
import { ListPoliciesQueryDto } from './dtos/list-policies-query.dto';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly service: PoliciesService) {}

  @Get('topics')
  async listTopics() {
    return { data: await this.service.listTopics() };
  }

  @Get('distribution')
  async distribution(@Query() q: DistributionQueryDto) {
    return { data: await this.service.getDistribution(q.topic) };
  }

  @Get()
  async list(@Query() q: ListPoliciesQueryDto) {
    return { data: await this.service.listForDrawer(q) };
  }
}
