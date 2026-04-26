import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
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
    const center = lookupCityCenter(dto.provinceCode, dto.cityName);
    if (!center) {
      throw new BadRequestException(
        `未知的 provinceCode/cityName: ${dto.provinceCode}/${dto.cityName}`,
      );
    }
    const visit = this.repo.create({
      visitDate: dto.visitDate,
      department: dto.department,
      contactPerson: dto.contactPerson,
      contactTitle: dto.contactTitle ?? null,
      outcomeSummary: dto.outcomeSummary,
      color: dto.color,
      followUp: dto.followUp,
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
    if (dto.visitDate !== undefined) v.visitDate = dto.visitDate;
    if (dto.department !== undefined) v.department = dto.department;
    if (dto.contactPerson !== undefined) v.contactPerson = dto.contactPerson;
    if (dto.contactTitle !== undefined) v.contactTitle = dto.contactTitle;
    if (dto.outcomeSummary !== undefined) v.outcomeSummary = dto.outcomeSummary;
    if (dto.color !== undefined) v.color = dto.color;
    if (dto.followUp !== undefined) v.followUp = dto.followUp;
    return this.repo.save(v);
  }
}
