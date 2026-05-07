import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { ExternalMockService } from '../external-mock/external-mock.service';
import type { AuthenticatedUser, ConsumptionLogWithTool, MockInvokeResponseDto } from '@pop/shared-types';

interface ContextDto {
  contextPinId?: string;
  contextVisitId?: string;
  contextRegionCode?: string;
}

@Injectable()
export class ConsumptionService {
  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolConsumptionLogEntity) private readonly logsRepo: Repository<ToolConsumptionLogEntity>,
    private readonly mock: ExternalMockService,
  ) {}

  async download(toolId: string, user: AuthenticatedUser, ctx: ContextDto): Promise<{ fileUrl: string }> {
    const t = await this.assertConsumable(toolId);
    if (t.type !== 'document') throw new BadRequestException('只有 document 类工具可下载');
    await this.writeLog(t.id, user.id, ctx);
    return { fileUrl: t.fileUrl! };
  }

  async invoke(toolId: string, user: AuthenticatedUser, ctx: ContextDto): Promise<{ response: MockInvokeResponseDto }> {
    const t = await this.assertConsumable(toolId);
    if (t.type !== 'interface') throw new BadRequestException('只有 interface 类工具可调用');
    const themeCode = (t.paramTemplate as any)?.themeCode ?? undefined;
    const response = this.mock.invoke({
      regionCode: ctx.contextRegionCode ?? '',
      themeCode,
    });
    await this.writeLog(t.id, user.id, ctx, response);
    return { response };
  }

  async listForUser(userId: string): Promise<ConsumptionLogWithTool[]> {
    const logs = await this.logsRepo.find({
      where: { consumerId: userId },
      relations: ['tool'],
      order: { consumedAt: 'DESC' },
      take: 200,
    });
    return logs.map((l) => ({
      id: l.id,
      toolId: l.toolId,
      consumerId: l.consumerId,
      consumedAt: l.consumedAt.toISOString(),
      contextPinId: l.contextPinId,
      contextVisitId: l.contextVisitId,
      contextRegionCode: l.contextRegionCode,
      interfaceResponse: l.interfaceResponse,
      tool: l.tool ? {
        id: l.tool.id, title: l.tool.title, type: l.tool.type, taxonomyTag: l.tool.taxonomyTag,
      } : { id: l.toolId, title: '(已删)', type: 'document', taxonomyTag: 'other' },
    }));
  }

  async listForTool(toolId: string): Promise<ToolConsumptionLogEntity[]> {
    return this.logsRepo.find({
      where: { toolId },
      order: { consumedAt: 'DESC' },
      take: 500,
    });
  }

  private async assertConsumable(toolId: string): Promise<ToolEntity> {
    const t = await this.toolsRepo.findOne({ where: { id: toolId, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException(`Tool ${toolId} not found`);
    if (t.status !== 'published') throw new BadRequestException(`工具状态为 ${t.status},不可消费`);
    return t;
  }

  private async writeLog(
    toolId: string,
    consumerId: string,
    ctx: ContextDto,
    interfaceResponse?: MockInvokeResponseDto,
  ): Promise<ToolConsumptionLogEntity> {
    const ent = this.logsRepo.create({
      toolId,
      consumerId,
      contextPinId: ctx.contextPinId ?? null,
      contextVisitId: ctx.contextVisitId ?? null,
      contextRegionCode: ctx.contextRegionCode ?? null,
      interfaceResponse: (interfaceResponse ?? null) as Record<string, unknown> | null,
    });
    return this.logsRepo.save(ent) as Promise<ToolConsumptionLogEntity>;
  }
}
