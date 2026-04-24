import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RegionEntity, RegionLevel } from './entities/region.entity';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly repo: Repository<RegionEntity>,
  ) {}

  /**
   * 列出某父区划下的直接子区划。
   * parentCode 省略时返回顶级(国家)。
   */
  listByParent(parentCode?: string): Promise<RegionEntity[]> {
    return this.repo.find({
      where: { parentCode: parentCode ?? IsNull() },
      order: { code: 'ASC' },
    });
  }

  listByLevel(level: RegionLevel): Promise<RegionEntity[]> {
    return this.repo.find({
      where: { level },
      order: { code: 'ASC' },
    });
  }

  findByCode(code: string): Promise<RegionEntity | null> {
    return this.repo.findOne({ where: { code } });
  }
}
