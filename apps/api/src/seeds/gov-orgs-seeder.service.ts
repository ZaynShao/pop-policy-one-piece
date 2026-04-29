import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';

interface SeedRow {
  name: string;
  shortName: string;
  provinceCode: string;
  cityName: string;
  level: 'national' | 'provincial' | 'municipal';
  functionTags: string[];
}

@Injectable()
export class GovOrgsSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GovOrgsSeederService.name);

  constructor(
    @InjectRepository(GovOrgEntity) private readonly repo: Repository<GovOrgEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) {
      this.logger.log(`gov_orgs has ${count} rows, skipping seed.`);
      return;
    }

    const path = join(__dirname, 'gov-orgs-seed.json');
    try {
      const raw = readFileSync(path, 'utf8');
      const rows: SeedRow[] = JSON.parse(raw);
      const entities = rows.map((r) => this.repo.create({
        name: r.name,
        shortName: r.shortName,
        provinceCode: r.provinceCode,
        cityName: r.cityName,
        districtName: null,
        level: r.level,
        parentOrgId: null,
        functionTags: r.functionTags,
        address: null,
        createdBy: null,
      }));
      await this.repo.save(entities, { chunk: 100 });
      this.logger.log(`Seeded ${entities.length} gov_orgs.`);
    } catch (e) {
      this.logger.error(`Failed to seed gov_orgs from ${path}: ${(e as Error).message}`);
      // Do not rethrow — let the app continue with empty/partial table
    }
  }
}
