import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { CreateBindingDto } from './dtos/create-binding.dto';

@Injectable()
export class BindingsService {
  constructor(
    @InjectRepository(ToolBindingEntity) private readonly repo: Repository<ToolBindingEntity>,
  ) {}

  async create(toolId: string, dto: CreateBindingDto): Promise<ToolBindingEntity> {
    if (dto.targetType === 'pin' && !dto.pinId) throw new BadRequestException('pin 模式必须提供 pinId');
    if (dto.targetType === 'visit' && !dto.visitId) throw new BadRequestException('visit 模式必须提供 visitId');
    if (dto.targetType === 'region') {
      if (!dto.regionScopeTag) throw new BadRequestException('region 模式必须提供 regionScopeTag');
      if (dto.regionScopeTag !== 'nationwide' && !dto.regionCode) {
        throw new BadRequestException('region scope 非 nationwide 时必须提供 regionCode');
      }
    }
    const ent = this.repo.create({
      toolId,
      targetType: dto.targetType,
      pinId: dto.targetType === 'pin' ? dto.pinId! : null,
      visitId: dto.targetType === 'visit' ? dto.visitId! : null,
      regionCode: dto.targetType === 'region' ? (dto.regionCode ?? null) : null,
      regionScopeTag: dto.targetType === 'region' ? dto.regionScopeTag! : null,
    });
    return this.repo.save(ent);
  }

  async listByTool(toolId: string): Promise<ToolBindingEntity[]> {
    return this.repo.find({ where: { toolId }, order: { createdAt: 'ASC' } });
  }

  async delete(bindingId: string): Promise<void> {
    await this.repo.delete(bindingId);
  }
}
