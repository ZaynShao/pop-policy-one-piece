import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GovOrgEntity } from './entities/gov-org.entity';
import { CreateGovOrgDto } from './dtos/create-gov-org.dto';
import { UpdateGovOrgDto } from './dtos/update-gov-org.dto';
import { ListGovOrgDto } from './dtos/list-gov-org.dto';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

@Injectable()
export class GovOrgsService {
  constructor(
    @InjectRepository(GovOrgEntity) private readonly repo: Repository<GovOrgEntity>,
  ) {}

  async list(q: ListGovOrgDto): Promise<GovOrgEntity[]> {
    const qb = this.repo.createQueryBuilder('o');
    if (q.withDeleted === 'true') qb.withDeleted();
    qb.where('1=1');
    // K 模块 — 北京(110000)合并中央部委(provinceCode='000000', level='national', cityName='北京市')
    if (q.provinceCode === '110000') {
      qb.andWhere('(o.provinceCode = :pc OR o.level = :nat)', { pc: q.provinceCode, nat: 'national' });
    } else if (q.provinceCode) {
      qb.andWhere('o.provinceCode = :pc', { pc: q.provinceCode });
    }
    if (q.cityName) qb.andWhere('o.cityName = :cn', { cn: q.cityName });
    if (q.level) qb.andWhere('o.level = :lv', { lv: q.level });
    if (q.search) {
      qb.andWhere('(o.name ILIKE :s OR o.shortName ILIKE :s)', { s: `%${q.search}%` });
    }
    qb.orderBy('o.cityName', 'ASC').addOrderBy('o.name', 'ASC');
    qb.take(q.limit ?? 50);
    return qb.getMany();
  }

  async findOne(id: string): Promise<GovOrgEntity> {
    const org = await this.repo.findOne({
      where: { id },
      relations: ['parent'],
    });
    if (!org) throw new NotFoundException(`GovOrg ${id} not found`);
    return org;
  }

  async create(dto: CreateGovOrgDto, user: AuthenticatedUser): Promise<GovOrgEntity> {
    const entity = this.repo.create({
      name: dto.name,
      shortName: dto.shortName ?? null,
      provinceCode: dto.provinceCode,
      cityName: dto.cityName,
      districtName: dto.districtName ?? null,
      level: dto.level,
      parentOrgId: dto.parentOrgId ?? null,
      functionTags: dto.functionTags ?? [],
      address: dto.address ?? null,
      createdBy: user.id,
    });
    try {
      return await this.repo.save(entity);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('该机构已存在(同省市同名)');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateGovOrgDto, user: AuthenticatedUser): Promise<GovOrgEntity> {
    const org = await this.findOne(id);
    this.assertCanEdit(org, user);

    if (dto.name !== undefined) org.name = dto.name;
    if (dto.shortName !== undefined) org.shortName = dto.shortName;
    if (dto.districtName !== undefined) org.districtName = dto.districtName;
    if (dto.level !== undefined) org.level = dto.level;
    if (dto.parentOrgId !== undefined) org.parentOrgId = dto.parentOrgId;
    if (dto.functionTags !== undefined) org.functionTags = dto.functionTags;
    if (dto.address !== undefined) org.address = dto.address;

    try {
      return await this.repo.save(org);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('改名后与既有机构重名');
      }
      throw e;
    }
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    if (user.roleCode !== UserRoleCode.SysAdmin) {
      throw new ForbiddenException('只有 sys_admin 可以删除机构');
    }
    const org = await this.findOne(id);
    await this.repo.softRemove(org);
  }

  private assertCanEdit(org: GovOrgEntity, user: AuthenticatedUser): void {
    if (user.roleCode === UserRoleCode.SysAdmin) return;
    if (org.createdBy === null) {
      throw new ForbiddenException('seed 机构只允许 sys_admin 修改');
    }
    if (org.createdBy !== user.id) {
      throw new ForbiddenException('无权修改该机构(非创建者)');
    }
  }
}
