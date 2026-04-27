import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { PinEntity } from './entities/pin.entity';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';
import {
  UserRoleCode,
  type AuthenticatedUser,
  type PinStatus,
} from '@pop/shared-types';

/**
 * Pin 删除白名单(PRD §5 权限矩阵简化版)
 * V0.7+ CASL 真矩阵落地后,删除路由换成 @CheckPolicies(ability.can(Delete, Pin))
 */
const PIN_DELETE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);

/**
 * Pin 状态机合法切换 — PRD §4.3.1 + SPEC §3
 *   in_progress → completed / aborted
 *   completed   → in_progress(重开)
 *   aborted     → in_progress(重开)
 *   completed ↔ aborted 不允许直接切(必须先 reopen)
 */
const ALLOWED_TRANSITIONS: Record<PinStatus, PinStatus[]> = {
  in_progress: ['completed', 'aborted'],
  completed: ['in_progress'],
  aborted: ['in_progress'],
};

@Injectable()
export class PinsService {
  constructor(
    @InjectRepository(PinEntity) private readonly repo: Repository<PinEntity>,
  ) {}

  list(): Promise<PinEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<PinEntity> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Pin ${id} not found`);
    return p;
  }

  async create(dto: CreatePinDto, createdBy: string): Promise<PinEntity> {
    const center = lookupCityCenter(dto.provinceCode, dto.cityName);
    if (!center) {
      throw new BadRequestException(
        `未知的 provinceCode/cityName: ${dto.provinceCode}/${dto.cityName}`,
      );
    }
    const pin = this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      status: 'in_progress',
      abortedReason: null,
      closedBy: null,
      closedAt: null,
      priority: dto.priority ?? 'medium',
      provinceCode: dto.provinceCode,
      cityName: dto.cityName,
      lng: center.lng,
      lat: center.lat,
      createdBy,
    });
    return this.repo.save(pin);
  }

  async update(
    id: string,
    dto: UpdatePinDto,
    currentUserId: string,
  ): Promise<PinEntity> {
    const prev = await this.findOne(id);
    const newStatus = (dto.status ?? prev.status) as PinStatus;

    // 状态切换:校验 + 自动维护 closed_* / aborted_reason
    if (newStatus !== prev.status) {
      if (!ALLOWED_TRANSITIONS[prev.status].includes(newStatus)) {
        throw new BadRequestException(
          `非法状态切换:${prev.status} → ${newStatus}`,
        );
      }
      if (newStatus === 'aborted' && !dto.abortedReason) {
        throw new BadRequestException('中止 Pin 必须填写中止原因');
      }
      if (newStatus === 'in_progress') {
        prev.closedAt = null;
        prev.closedBy = null;
        prev.abortedReason = null;
      } else {
        prev.closedAt = new Date();
        prev.closedBy = currentUserId;
        prev.abortedReason = newStatus === 'aborted'
          ? (dto.abortedReason ?? null)
          : null;
      }
      prev.status = newStatus;
    }

    if (dto.title !== undefined) prev.title = dto.title;
    if (dto.description !== undefined) prev.description = dto.description;
    if (dto.priority !== undefined) prev.priority = dto.priority;

    return this.repo.save(prev);
  }

  /**
   * 软删除 — TypeORM 设 deleted_at = now(),后续 find 默认滤掉
   * 关联的 visits.parent_pin_id / comments.parent_pin_id 不动
   * (留 audit trail,V0.7+ 回收站还原时关联自动恢复)
   *
   * 权限白名单:sys_admin / lead / pmo,其他角色抛 403
   */
  async softDelete(id: string, currentUser: AuthenticatedUser): Promise<void> {
    if (!PIN_DELETE_ALLOWED_ROLES.has(currentUser.roleCode)) {
      throw new ForbiddenException('只有管理员/负责人/PMO 可以删除图钉');
    }
    const pin = await this.findOne(id);
    await this.repo.softRemove(pin);
  }
}
