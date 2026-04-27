import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

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

  async update(id: string, dto: UpdateVisitDto): Promise<VisitEntity> {
    const v = await this.findOne(id);
    if (dto.visitDate !== undefined) v.visitDate = dto.visitDate ?? null;
    if (dto.department !== undefined) v.department = dto.department ?? null;
    if (dto.contactPerson !== undefined) v.contactPerson = dto.contactPerson ?? null;
    if (dto.contactTitle !== undefined) v.contactTitle = dto.contactTitle ?? null;
    if (dto.outcomeSummary !== undefined) v.outcomeSummary = dto.outcomeSummary ?? null;
    if (dto.color !== undefined) v.color = dto.color ?? null;
    if (dto.followUp !== undefined) v.followUp = dto.followUp;
    return this.repo.save(v);
  }
}
