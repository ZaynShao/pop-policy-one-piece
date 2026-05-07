import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';
import type { AuthenticatedUser, ToolStatus, ToolType } from '@pop/shared-types';

interface ListFilter {
  status?: ToolStatus;
  type?: ToolType;
  creatorId?: string;
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(ToolEntity) private readonly repo: Repository<ToolEntity>,
  ) {}

  async create(dto: CreateToolDto, user: AuthenticatedUser): Promise<ToolEntity> {
    if (dto.type === 'document' && !dto.fileUrl) {
      throw new BadRequestException('document 类型必须提供 fileUrl');
    }
    if (dto.type === 'interface' && !dto.paramTemplate) {
      throw new BadRequestException('interface 类型必须提供 paramTemplate');
    }
    const ent = this.repo.create({
      type: dto.type,
      title: dto.title,
      description: dto.description ?? null,
      taxonomyTag: dto.taxonomyTag,
      status: 'draft',
      creatorId: user.id,
      fileUrl: dto.type === 'document' ? dto.fileUrl! : null,
      paramTemplate: dto.type === 'interface' ? dto.paramTemplate! : null,
      responseMapping: dto.type === 'interface' ? dto.responseMapping ?? null : null,
    });
    return this.repo.save(ent);
  }

  async findOne(id: string): Promise<ToolEntity> {
    const t = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException(`Tool ${id} not found`);
    return t;
  }

  async list(filter: ListFilter): Promise<ToolEntity[]> {
    const where: any = { deletedAt: IsNull() };
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.creatorId) where.creatorId = filter.creatorId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async update(id: string, dto: UpdateToolDto, user: AuthenticatedUser): Promise<ToolEntity> {
    const t = await this.findOne(id);
    if (t.creatorId !== user.id) {
      throw new ForbiddenException('只能修改自己创建的工具');
    }
    Object.assign(t, {
      title: dto.title ?? t.title,
      description: dto.description !== undefined ? dto.description : t.description,
      taxonomyTag: dto.taxonomyTag ?? t.taxonomyTag,
      fileUrl: dto.fileUrl !== undefined ? dto.fileUrl : t.fileUrl,
      paramTemplate: dto.paramTemplate !== undefined ? dto.paramTemplate : t.paramTemplate,
      responseMapping: dto.responseMapping !== undefined ? dto.responseMapping : t.responseMapping,
    });
    return this.repo.save(t);
  }
}
