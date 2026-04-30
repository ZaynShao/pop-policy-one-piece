import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { GovContactsService } from '../gov-contacts/gov-contacts.service';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';
import { renderAutoComment } from './comment-template';
import {
  UserRoleCode,
  type AuthenticatedUser,
  type VisitStatus,
} from '@pop/shared-types';

const ALLOWED_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  planned: ['completed', 'cancelled'],
  completed: [],            // 不可改 status
  cancelled: ['planned'],   // 重启
};

/**
 * Visit 删除 / 还原白名单(对称 Pin V0.6 patch)
 * V0.7+ CASL 真矩阵落地后,换成 @CheckPolicies(ability.can(Delete, Visit))
 */
const VISIT_DELETE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);
export const VISIT_TRASH_ALLOWED_ROLES = VISIT_DELETE_ALLOWED_ROLES;

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
    @InjectRepository(CommentEntity) private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(GovOrgEntity) private readonly orgsRepo: Repository<GovOrgEntity>,
    private readonly contactsService: GovContactsService,
    private readonly dataSource: DataSource,
  ) {}

  async list(filter?: {
    status?: VisitStatus;
    parentPinId?: string;
    withDeleted?: boolean;
    currentUser?: AuthenticatedUser;
  }): Promise<VisitEntity[]> {
    if (filter?.withDeleted) {
      if (!filter.currentUser || !VISIT_TRASH_ALLOWED_ROLES.has(filter.currentUser.roleCode)) {
        throw new ForbiddenException('只有管理员/负责人/PMO 可以查看回收站');
      }
      // 回收站:仅返回 deleted_at NOT NULL 的条目
      const where: Record<string, unknown> = { deletedAt: Not(IsNull()) };
      if (filter.status) where.status = filter.status;
      if (filter.parentPinId) where.parentPinId = filter.parentPinId;
      return this.repo.find({
        withDeleted: true,
        where,
        order: { deletedAt: 'DESC' },
      });
    }
    const where: Record<string, unknown> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.parentPinId) where.parentPinId = filter.parentPinId;
    return this.repo.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      order: { visitDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<VisitEntity> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`Visit ${id} not found`);
    return v;
  }

  async create(dto: CreateVisitDto, currentUser: AuthenticatedUser): Promise<VisitEntity> {
    const visitorId = currentUser.id;
    const status = dto.status ?? 'completed';

    if (status === 'cancelled') {
      throw new BadRequestException('不允许直接创建 cancelled 状态');
    }

    if (status === 'planned' && !dto.title) {
      throw new BadRequestException('计划点 title 必填');
    }

    if (status === 'completed') {
      if (!dto.visitDate) throw new BadRequestException('visitDate 必填');
      if (!dto.contactPerson) throw new BadRequestException('contactPerson 必填');
      if (!dto.color) throw new BadRequestException('color 必填');
    }

    if (dto.parentPinId) {
      const pin = await this.pinsRepo.findOne({ where: { id: dto.parentPinId } });
      if (!pin) throw new BadRequestException(`parentPin ${dto.parentPinId} not found`);
    }

    const center = lookupCityCenter(dto.provinceCode, dto.cityName);
    if (!center) {
      throw new BadRequestException(
        `未知的 provinceCode/cityName: ${dto.provinceCode}/${dto.cityName}`,
      );
    }

    // K 模块 — orgId 校验 + auto-upsert contact
    let orgId: string | null = dto.orgId ?? null;
    let contactId: string | null = dto.contactId ?? null;

    if (orgId) {
      const org = await this.orgsRepo.findOne({ where: { id: orgId } });
      if (!org || org.deletedAt) {
        throw new BadRequestException('机构不存在或已删除');
      }
    }

    if (contactId) {
      // 显式给 contactId,跳过 upsert(校验交给 FK 兜底)
    } else if (orgId && dto.contactPerson) {
      contactId = await this.contactsService.upsertByOrgAndName({
        orgId,
        name: dto.contactPerson,
        title: dto.contactTitle ?? null,
        user: currentUser,
      });
    }

    const visit = this.repo.create({
      status,
      parentPinId: dto.parentPinId ?? null,
      title: dto.title ?? null,
      plannedDate: dto.plannedDate ?? null,
      visitDate: dto.visitDate ?? null,
      department: dto.department ?? null,
      contactPerson: dto.contactPerson ?? null,
      contactTitle: dto.contactTitle ?? null,
      outcomeSummary: dto.outcomeSummary ?? null,
      color: dto.color ?? null,
      followUp: dto.followUp ?? false,
      provinceCode: dto.provinceCode,
      cityName: dto.cityName,
      lng: center.lng,
      lat: center.lat,
      visitorId,
      orgId,
      contactId,
    });
    return this.repo.save(visit);
  }

  async update(id: string, dto: UpdateVisitDto, currentUserId: string): Promise<VisitEntity> {
    const prev = await this.findOne(id);
    const prevStatus = prev.status;
    const newStatus = (dto.status ?? prev.status) as VisitStatus;

    // 状态切换校验
    if (newStatus !== prev.status) {
      if (!ALLOWED_TRANSITIONS[prev.status as VisitStatus].includes(newStatus)) {
        throw new BadRequestException(`不允许 ${prev.status} → ${newStatus}`);
      }
      if (newStatus === 'completed') {
        const visitDate = dto.visitDate ?? prev.visitDate;
        const contactPerson = dto.contactPerson ?? prev.contactPerson;
        const color = dto.color ?? prev.color;
        if (!visitDate) throw new BadRequestException('转 completed 必须填 visitDate');
        if (!contactPerson) throw new BadRequestException('转 completed 必须填 contactPerson');
        if (!color) throw new BadRequestException('转 completed 必须填 color');
      }
      prev.status = newStatus;
    }

    // completed 状态白名单:不切 status 时只允许 color
    if (prev.status === 'completed' && !dto.status) {
      const allowedKeys = new Set(['color', 'orgId', 'contactId']);
      const dtoKeys = Object.keys(dto).filter((k) => dto[k as keyof UpdateVisitDto] !== undefined);
      const violation = dtoKeys.find((k) => !allowedKeys.has(k));
      if (violation) {
        throw new BadRequestException('已完成拜访只允许改 color / orgId / contactId');
      }
    }

    // 应用 dto 字段
    if (dto.title !== undefined) prev.title = dto.title;
    if (dto.plannedDate !== undefined) prev.plannedDate = dto.plannedDate;
    if (dto.parentPinId !== undefined) {
      if (dto.parentPinId !== null) {
        const pin = await this.pinsRepo.findOne({ where: { id: dto.parentPinId } });
        if (!pin) throw new BadRequestException(`parentPin ${dto.parentPinId} not found`);
      }
      prev.parentPinId = dto.parentPinId;
    }
    if (dto.visitDate !== undefined) prev.visitDate = dto.visitDate;
    if (dto.department !== undefined) prev.department = dto.department;
    if (dto.contactPerson !== undefined) prev.contactPerson = dto.contactPerson;
    if (dto.contactTitle !== undefined) prev.contactTitle = dto.contactTitle;
    if (dto.outcomeSummary !== undefined) prev.outcomeSummary = dto.outcomeSummary;
    if (dto.color !== undefined) prev.color = dto.color;
    if (dto.followUp !== undefined) prev.followUp = dto.followUp;

    // K 模块 — 防止 cross-org 不一致(同时改 orgId + contactId 时校验配对)
    if (
      dto.orgId !== undefined && dto.orgId !== null &&
      dto.contactId !== undefined && dto.contactId !== null
    ) {
      const contact = await this.contactsService.findOne(dto.contactId);
      if (contact.orgId !== dto.orgId) {
        throw new BadRequestException('联系人不属于所选机构');
      }
    }

    // K 模块 — orgId 改了 → 自动清 contactId(防止跨机构残留)
    if (dto.orgId !== undefined) {
      if (dto.orgId !== null) {
        const org = await this.orgsRepo.findOne({ where: { id: dto.orgId } });
        if (!org || org.deletedAt) {
          throw new BadRequestException('机构不存在或已删除');
        }
      }
      const orgChanged = prev.orgId !== dto.orgId;
      prev.orgId = dto.orgId;
      if (orgChanged && dto.contactId === undefined) {
        prev.contactId = null;
      }
    }
    if (dto.contactId !== undefined) prev.contactId = dto.contactId;

    // β.2.5/β.3 触发条件:planned → completed + parentPinId NOT NULL
    const triggerAutoComment = (
      prevStatus === 'planned' &&
      newStatus === 'completed' &&
      prev.parentPinId !== null
    );

    if (!triggerAutoComment) {
      return this.repo.save(prev);
    }

    // 拿 visitor displayName(fallback username)
    const visitor = await this.usersRepo.findOne({ where: { id: prev.visitorId } });
    const visitorName = visitor?.displayName || visitor?.username || '(未知拜访者)';

    // 事务原子:UPDATE visits + INSERT comment
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(VisitEntity, prev);
      const commentBody = renderAutoComment({
        title: saved.title,
        visitDate: saved.visitDate,
        visitorName,
        department: saved.department,
        contactPerson: saved.contactPerson,
        contactTitle: saved.contactTitle,
        color: saved.color,
        outcomeSummary: saved.outcomeSummary,
      });
      await manager.save(CommentEntity, {
        parentPinId: saved.parentPinId!,
        sourceType: 'auto_from_visit',
        body: commentBody,
        linkedVisitId: saved.id,
        createdBy: prev.visitorId,
      });
      return saved;
    });
  }

  /**
   * 软删除 — TypeORM 设 deleted_at = now(),后续 find 默认滤掉
   * 关联 comments.linked_visit_id 不动(留 audit trail · ON DELETE SET NULL 兜底)
   *
   * 权限白名单:sys_admin / lead / pmo,其他角色抛 403
   */
  async softDelete(id: string, currentUser: AuthenticatedUser): Promise<void> {
    if (!VISIT_DELETE_ALLOWED_ROLES.has(currentUser.roleCode)) {
      throw new ForbiddenException('只有管理员/负责人/PMO 可以删除拜访');
    }
    const visit = await this.findOne(id);
    await this.repo.softRemove(visit);
  }

  /**
   * 还原软删 Visit — deleted_at 置 NULL,其他字段不动
   * 权限白名单:sys_admin / lead / pmo
   */
  async restore(id: string, currentUser: AuthenticatedUser): Promise<VisitEntity> {
    if (!VISIT_TRASH_ALLOWED_ROLES.has(currentUser.roleCode)) {
      throw new ForbiddenException('只有管理员/负责人/PMO 可以还原拜访');
    }
    const visit = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!visit) throw new NotFoundException(`Visit ${id} not found`);
    await this.repo.restore(id);
    return this.repo.findOneOrFail({ where: { id } });
  }
}
