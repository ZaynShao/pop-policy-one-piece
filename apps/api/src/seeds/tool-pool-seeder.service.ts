import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolEntity } from '../tools/entities/tool.entity';
import { ToolBindingEntity } from '../tools/entities/tool-binding.entity';
import { UserEntity } from '../users/entities/user.entity';

interface SeedTool {
  type: 'document' | 'interface';
  title: string;
  description: string;
  taxonomyTag: 'policy_interpretation' | 'talk_param_ref' | 'cooperation_template' | 'local_data';
  fileUrl?: string;
  paramTemplate?: Record<string, unknown>;
}

const SEED_TOOLS: SeedTool[] = [
  { type: 'document', title: 'V2G 政策对接谈参 v1.pdf', description: '面向地方政府的 V2G 政策落地谈参参考', taxonomyTag: 'talk_param_ref', fileUrl: '/api/v1/external/mock/files/v2g-talk-param.pdf' },
  { type: 'interface', title: 'V2G 政策分析', description: '按地域返回当地 V2G 政策快览', taxonomyTag: 'policy_interpretation', paramTemplate: { themeCode: 'v2g' } },
  { type: 'document', title: '虚拟电厂 EPC 模板.xlsx', description: '虚拟电厂项目 EPC 工作分解模板', taxonomyTag: 'cooperation_template', fileUrl: '/api/v1/external/mock/files/vpp-epc-template.xlsx' },
  { type: 'interface', title: '充电桩选址分析', description: '按地域生成充电桩选址建议', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'charging' } },
  { type: 'document', title: '新型储能政策解读 v1.pdf', description: '新型储能国家级政策汇编', taxonomyTag: 'policy_interpretation', fileUrl: '/api/v1/external/mock/files/storage-policy.pdf' },
  { type: 'interface', title: '储能项目可行性分析', description: '按地域生成储能项目可行性报告', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'storage' } },
  { type: 'document', title: '电力市场拓展手册 v1.pdf', description: '电力市场拓展实操手册', taxonomyTag: 'cooperation_template', fileUrl: '/api/v1/external/mock/files/em-handbook.pdf' },
  { type: 'interface', title: '电力交易分析', description: '按地域生成电力交易市场参考', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'electricity_market' } },
];

@Injectable()
export class ToolPoolSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ToolPoolSeederService.name);

  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolBindingEntity) private readonly bindingsRepo: Repository<ToolBindingEntity>,
    @InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.toolsRepo.count();
    if (existing > 0) {
      this.logger.log(`tools has ${existing} rows, skipping seed.`);
      return;
    }

    const sysadmin = await this.usersRepo.findOne({ where: { username: 'sysadmin' } });
    if (!sysadmin) {
      this.logger.warn('未找到 sysadmin,跳过 tool seed');
      return;
    }

    for (const t of SEED_TOOLS) {
      const tool = await this.toolsRepo.save(this.toolsRepo.create({
        type: t.type,
        title: t.title,
        description: t.description,
        taxonomyTag: t.taxonomyTag,
        status: 'published',
        creatorId: sysadmin.id,
        fileUrl: t.fileUrl ?? null,
        paramTemplate: t.paramTemplate ?? null,
        responseMapping: null,
      }));
      await this.bindingsRepo.save(this.bindingsRepo.create({
        toolId: tool.id,
        targetType: 'region',
        regionScopeTag: 'nationwide',
        regionCode: null,
      }));
    }
    this.logger.log(`已 seed ${SEED_TOOLS.length} 个工具(全部 nationwide 绑定)`);
  }
}
