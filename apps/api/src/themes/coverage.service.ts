import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { mockPolicyAnalysis } from './mock-policy-analysis';

@Injectable()
export class CoverageService {
  constructor(
    @InjectRepository(ThemeEntity) private readonly themesRepo: Repository<ThemeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 重新拉取覆盖清单 — 事务内 DELETE existing + INSERT new(覆盖语义)
   * archived 状态主题禁止拉取
   */
  async fetchCoverage(themeId: string): Promise<ThemeCoverageEntity[]> {
    const theme = await this.themesRepo.findOne({ where: { id: themeId } });
    if (!theme) throw new NotFoundException(`Theme ${themeId} not found`);
    if (theme.status === 'archived') {
      throw new BadRequestException('已归档主题不能拉取覆盖');
    }

    const mockData = mockPolicyAnalysis(themeId, theme.template);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ThemeCoverageEntity, { themeId });
      const rows = mockData.map((m) =>
        manager.create(ThemeCoverageEntity, {
          themeId,
          regionCode: m.regionCode,
          regionLevel: m.regionLevel,
          mainValue: m.mainValue,
          extraData: m.extraData,
        }),
      );
      const saved = await manager.save(rows);
      return saved;
    });
  }
}
