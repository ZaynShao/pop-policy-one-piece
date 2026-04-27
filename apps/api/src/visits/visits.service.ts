import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';
import type { VisitStatus } from '@pop/shared-types';

const ALLOWED_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  planned: ['completed', 'cancelled'],
  completed: [],            // 不可改 status
  cancelled: ['planned'],   // 重启
};

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
    @InjectRepository(CommentEntity) private readonly commentsRepo: Repository<CommentEntity>,
  ) {}

  list(): Promise<VisitEntity[]> {
    return this.repo.find({ order: { visitDate: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<VisitEntity> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`Visit ${id} not found`);
    return v;
  }

  async create(dto: CreateVisitDto, visitorId: string): Promise<VisitEntity> {
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
    });
    return this.repo.save(visit);
  }

  async update(id: string, dto: UpdateVisitDto, currentUserId: string): Promise<VisitEntity> {
    const prev = await this.findOne(id);
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
      const allowedKeys = new Set(['color']);
      const dtoKeys = Object.keys(dto).filter((k) => dto[k as keyof UpdateVisitDto] !== undefined);
      const violation = dtoKeys.find((k) => !allowedKeys.has(k));
      if (violation) {
        throw new BadRequestException('已完成拜访只允许改 visitColor');
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

    return this.repo.save(prev);
  }
}
