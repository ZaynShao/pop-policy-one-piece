import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyEntity } from './entities/policy.entity';
import { PolicyTopicEntity } from './entities/policy-topic.entity';
import type { Policy, PolicyDistribution } from '@pop/shared-types';
import type { ListPoliciesQueryDto } from './dtos/list-policies-query.dto';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(PolicyEntity) private readonly policies: Repository<PolicyEntity>,
    @InjectRepository(PolicyTopicEntity) private readonly topics: Repository<PolicyTopicEntity>,
  ) {}

  /** 全部主题去重列表(下拉用) */
  async listTopics(): Promise<string[]> {
    const rows = await this.topics
      .createQueryBuilder('pt')
      .select('DISTINCT pt.topic', 'topic')
      .orderBy('pt.topic', 'ASC')
      .getRawMany<{ topic: string }>();
    return rows.map((r) => r.topic);
  }

  /**
   * 染色聚合:
   * - national: 该主题国家级 count
   * - byProvince: 省级染色 count = provincial + 该省下属 municipal/district 之和
   * - byCity: 城市级 count(municipal + district 落到具体市)
   */
  async getDistribution(topic: string): Promise<PolicyDistribution> {
    const qb = this.policies
      .createQueryBuilder('p')
      .innerJoin(PolicyTopicEntity, 'pt', 'pt.policy_id = p.id')
      .where('pt.topic = :topic', { topic });

    // national
    const nationalRow = await qb.clone()
      .andWhere('p.level = :lv', { lv: 'national' })
      .select('COUNT(p.id)', 'cnt')
      .getRawOne<{ cnt: string }>();
    const national = Number(nationalRow?.cnt ?? 0);

    // byProvince:按省 code 聚合 provincial+municipal+district(任何带 province_code 的)
    const provRows = await qb.clone()
      .andWhere('p.province_code IS NOT NULL')
      .select('p.province_code', 'provinceCode')
      .addSelect('COUNT(p.id)', 'cnt')
      .groupBy('p.province_code')
      .orderBy('p.province_code', 'ASC')
      .getRawMany<{ provinceCode: string; cnt: string }>();
    const byProvince = provRows.map((r) => ({
      provinceCode: r.provinceCode,
      count: Number(r.cnt),
    }));

    // byCity:只算 municipal + district
    const cityRows = await qb.clone()
      .andWhere('p.level IN (:...lvs)', { lvs: ['municipal', 'district'] })
      .andWhere('p.province_code IS NOT NULL')
      .andWhere('p.city_name IS NOT NULL')
      .select('p.province_code', 'provinceCode')
      .addSelect('p.city_name', 'cityName')
      .addSelect('COUNT(p.id)', 'cnt')
      .groupBy('p.province_code')
      .addGroupBy('p.city_name')
      .orderBy('p.province_code', 'ASC')
      .addOrderBy('p.city_name', 'ASC')
      .getRawMany<{ provinceCode: string; cityName: string; cnt: string }>();
    const byCity = cityRows.map((r) => ({
      provinceCode: r.provinceCode,
      cityName: r.cityName,
      count: Number(r.cnt),
    }));

    return { topic, national, byProvince, byCity };
  }

  /**
   * Drawer 列表查询。
   * - provinceCode 给定:按 spec,该省 drawer 应包含 provincial + 该省下属 municipal/district
   * - cityName 给定:精确到市
   * - 国家级 badge 单独取(level=national,无 provinceCode 过滤)
   */
  async listForDrawer(q: ListPoliciesQueryDto): Promise<Policy[]> {
    const qb = this.policies
      .createQueryBuilder('p')
      .innerJoin(PolicyTopicEntity, 'pt', 'pt.policy_id = p.id')
      .leftJoinAndMapMany('p.topics', PolicyTopicEntity, 'tall', 'tall.policy_id = p.id')
      .where('pt.topic = :topic', { topic: q.topic });

    if (q.level) {
      qb.andWhere('p.level = :lv', { lv: q.level });
    } else if (q.cityName) {
      qb.andWhere('p.province_code = :pc', { pc: q.provinceCode });
      qb.andWhere('p.city_name = :cn', { cn: q.cityName });
    } else if (q.provinceCode) {
      qb.andWhere('p.province_code = :pc', { pc: q.provinceCode });
    }

    qb.orderBy('p.issue_date', 'DESC').addOrderBy('p.id', 'ASC');

    const rows = await qb.getMany();
    return rows.map((p) => this.toDto(p));
  }

  private toDto(p: PolicyEntity): Policy {
    return {
      id: p.id,
      title: p.title,
      issuingOrg: p.issuingOrg,
      issueDate: typeof p.issueDate === 'string' ? p.issueDate : String(p.issueDate),
      level: p.level,
      provinceCode: p.provinceCode,
      cityName: p.cityName,
      summary: p.summary,
      topics: (p.topics ?? []).map((t) => t.topic),
    };
  }
}
