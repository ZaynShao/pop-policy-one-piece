import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { CreateThemeDto } from './dtos/create-theme.dto';
import { UpdateThemeDto } from './dtos/update-theme.dto';
import {
  UserRoleCode,
  type AuthenticatedUser,
  type ThemeStatus,
} from '@pop/shared-types';

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

const ALLOWED_TRANSITIONS: Record<ThemeStatus, ThemeStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published'],   // unarchive 直接复活到 published
};

function requireWriteRole(user: AuthenticatedUser): void {
  if (!THEME_WRITE_ALLOWED_ROLES.has(user.roleCode)) {
    throw new ForbiddenException('只有管理员/中台 GA 可以维护政策主题');
  }
}

@Injectable()
export class ThemesService {
  constructor(
    @InjectRepository(ThemeEntity) private readonly repo: Repository<ThemeEntity>,
    @InjectRepository(ThemeCoverageEntity) private readonly coverageRepo: Repository<ThemeCoverageEntity>,
  ) {}

  async list(opts?: { status?: ThemeStatus | 'all' }): Promise<ThemeEntity[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');
    if (opts?.status === 'all') {
      // 不加 where
    } else if (opts?.status === 'archived') {
      qb.where('t.status = :s', { s: 'archived' });
    } else if (opts?.status) {
      qb.where('t.status = :s', { s: opts.status });
    } else {
      // 默认排除 archived
      qb.where('t.status != :s', { s: 'archived' });
    }
    return qb.getMany();
  }

  async findOneWithCoverage(id: string): Promise<ThemeEntity & { coverage: ThemeCoverageEntity[] }> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Theme ${id} not found`);
    const coverage = await this.coverageRepo.find({ where: { themeId: id }, order: { mainValue: 'DESC' } });
    return Object.assign(t, { coverage });
  }

  async create(dto: CreateThemeDto, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const theme = this.repo.create({
      title: dto.title,
      template: dto.template,
      keywords: dto.keywords ?? [],
      regionScope: dto.regionScope ?? null,
      status: 'draft',
      createdBy: currentUser.id,
      publishedAt: null,
    });
    return this.repo.save(theme);
  }

  async update(id: string, dto: UpdateThemeDto, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (dto.title !== undefined) prev.title = dto.title;
    if (dto.keywords !== undefined) prev.keywords = dto.keywords;
    if (dto.regionScope !== undefined) prev.regionScope = dto.regionScope;
    return this.repo.save(prev);
  }

  async publish(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (prev.status !== 'draft') {
      throw new BadRequestException(`不允许 ${prev.status} → published`);
    }
    const coverageCount = await this.coverageRepo.count({ where: { themeId: id } });
    if (coverageCount < 1) {
      throw new BadRequestException('发布前必须先拉取覆盖清单');
    }
    prev.status = 'published';
    prev.publishedAt = new Date();
    return this.repo.save(prev);
  }

  async archive(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (!ALLOWED_TRANSITIONS[prev.status].includes('archived')) {
      throw new BadRequestException(`不允许 ${prev.status} → archived`);
    }
    prev.status = 'archived';
    return this.repo.save(prev);
  }

  async unarchive(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (prev.status !== 'archived') {
      throw new BadRequestException(`只有 archived 主题可恢复`);
    }
    prev.status = 'published';
    return this.repo.save(prev);
  }
}
