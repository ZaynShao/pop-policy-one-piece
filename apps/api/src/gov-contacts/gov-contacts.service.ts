import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GovContactEntity } from './entities/gov-contact.entity';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { CreateGovContactDto } from './dtos/create-gov-contact.dto';
import { UpdateGovContactDto } from './dtos/update-gov-contact.dto';
import { ListGovContactDto } from './dtos/list-gov-contact.dto';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

@Injectable()
export class GovContactsService {
  constructor(
    @InjectRepository(GovContactEntity) private readonly repo: Repository<GovContactEntity>,
    @InjectRepository(GovOrgEntity) private readonly orgsRepo: Repository<GovOrgEntity>,
  ) {}

  async list(q: ListGovContactDto): Promise<GovContactEntity[]> {
    const qb = this.repo.createQueryBuilder('c');
    qb.where('1=1');
    if (q.orgId) qb.andWhere('c.orgId = :oid', { oid: q.orgId });
    if (q.ownerUserId) qb.andWhere('c.ownerUserId = :uid', { uid: q.ownerUserId });
    if (q.tier) qb.andWhere('c.tier = :t', { t: q.tier });
    if (q.search) qb.andWhere('c.name ILIKE :s', { s: `%${q.search}%` });
    qb.orderBy('c.lastEngagedAt', 'DESC', 'NULLS LAST').addOrderBy('c.name', 'ASC');
    qb.take(q.limit ?? 50);
    return qb.getMany();
  }

  async findOne(id: string): Promise<GovContactEntity> {
    const c = await this.repo.findOne({ where: { id }, relations: ['org'] });
    if (!c) throw new NotFoundException(`GovContact ${id} not found`);
    return c;
  }

  async create(dto: CreateGovContactDto, user: AuthenticatedUser): Promise<GovContactEntity> {
    const org = await this.orgsRepo.findOne({ where: { id: dto.orgId } });
    if (!org || org.deletedAt) {
      throw new BadRequestException('机构不存在或已删除');
    }

    const entity = this.repo.create({
      name: dto.name,
      gender: dto.gender ?? null,
      orgId: dto.orgId,
      title: dto.title,
      tier: dto.tier ?? 'normal',
      phone: dto.phone ?? null,
      wechat: dto.wechat ?? null,
      preferenceNotes: dto.preferenceNotes ?? null,
      ownerUserId: dto.ownerUserId ?? user.id,
      createdBy: user.id,
    });
    try {
      return await this.repo.save(entity);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('该机构下已有同名联系人');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateGovContactDto, user: AuthenticatedUser): Promise<GovContactEntity> {
    const c = await this.findOne(id);
    this.assertCanEdit(c, user);

    if (dto.name !== undefined) c.name = dto.name;
    if (dto.gender !== undefined) c.gender = dto.gender;
    if (dto.title !== undefined) c.title = dto.title;
    if (dto.tier !== undefined) c.tier = dto.tier;
    if (dto.phone !== undefined) c.phone = dto.phone;
    if (dto.wechat !== undefined) c.wechat = dto.wechat;
    if (dto.preferenceNotes !== undefined) c.preferenceNotes = dto.preferenceNotes;
    if (dto.ownerUserId !== undefined) c.ownerUserId = dto.ownerUserId;

    try {
      return await this.repo.save(c);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('改名后与同机构下既有联系人重名');
      }
      throw e;
    }
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    if (user.roleCode !== UserRoleCode.SysAdmin) {
      throw new ForbiddenException('只有 sys_admin 可以删除联系人');
    }
    const c = await this.findOne(id);
    await this.repo.softRemove(c);
  }

  /**
   * Visit 提交时调用 — auto-upsert by (orgId, name)
   * 已存在 → 返回 existing.id
   * 不存在 → 新建并返回 newOne.id
   */
  async upsertByOrgAndName(args: {
    orgId: string;
    name: string;
    title: string | null;
    user: AuthenticatedUser;
  }): Promise<string> {
    const existing = await this.repo.findOne({
      where: { orgId: args.orgId, name: args.name.trim() },
    });
    if (existing) return existing.id;

    const created = await this.create(
      {
        orgId: args.orgId,
        name: args.name.trim(),
        title: args.title?.trim() || '未填',
      },
      args.user,
    );
    return created.id;
  }

  private assertCanEdit(c: GovContactEntity, user: AuthenticatedUser): void {
    if (user.roleCode === UserRoleCode.SysAdmin) return;
    if (c.ownerUserId === user.id) return;
    throw new ForbiddenException('无权修改该联系人');
  }
}
