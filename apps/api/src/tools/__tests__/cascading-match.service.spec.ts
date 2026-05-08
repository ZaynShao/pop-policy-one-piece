import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CascadingMatchService } from '../cascading-match.service';
import { ToolEntity } from '../entities/tool.entity';
import { ToolBindingEntity } from '../entities/tool-binding.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';
import { PinEntity } from '../../pins/entities/pin.entity';

describe('CascadingMatchService.matchByVisit', () => {
  let svc: CascadingMatchService;
  let toolsRepo: any;
  let bindingsRepo: any;
  let visitsRepo: any;
  let pinsRepo: any;

  beforeEach(async () => {
    toolsRepo = { find: jest.fn() };
    bindingsRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    visitsRepo = { findOne: jest.fn() };
    pinsRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CascadingMatchService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolBindingEntity), useValue: bindingsRepo },
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
      ],
    }).compile();
    svc = module.get(CascadingMatchService);
  });

  it('上海长宁区 visit:级联匹配 含 全国 / 全省 / 全市 / 全区 / 区码 / visit 直绑',
    async () => {
      visitsRepo.findOne.mockResolvedValue({
        id: 'v1', provinceCode: '310000', cityCode: '310100', districtCode: '310105',
      });
      bindingsRepo.find.mockResolvedValue([
        { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
        { id: 'b2', toolId: 't2', targetType: 'region', regionScopeTag: 'all_provinces', regionCode: '310000' },
        { id: 'b3', toolId: 't3', targetType: 'region', regionScopeTag: 'all_cities_in_province', regionCode: '310000' },
        { id: 'b4', toolId: 't4', targetType: 'region', regionScopeTag: 'all_districts_in_city', regionCode: '310100' },
        { id: 'b5', toolId: 't5', targetType: 'region', regionScopeTag: 'specific', regionCode: '310105' },
        { id: 'b6', toolId: 't6', targetType: 'visit', visitId: 'v1' },
      ]);
      toolsRepo.find.mockResolvedValue([
        { id: 't1', title: 'A', taxonomyTag: 'policy_interpretation', status: 'published', createdAt: new Date() },
        { id: 't2', title: 'B', taxonomyTag: 'policy_interpretation', status: 'published', createdAt: new Date() },
        { id: 't3', title: 'C', taxonomyTag: 'talk_param_ref', status: 'published', createdAt: new Date() },
        { id: 't4', title: 'D', taxonomyTag: 'talk_param_ref', status: 'published', createdAt: new Date() },
        { id: 't5', title: 'E', taxonomyTag: 'local_data', status: 'published', createdAt: new Date() },
        { id: 't6', title: 'F', taxonomyTag: 'local_data', status: 'published', createdAt: new Date() },
      ]);

      const result = await svc.matchByVisit('v1');
      const totalTools = Object.values(result.groups).reduce((a, b) => a + (b as any[]).length, 0);
      expect(totalTools).toBe(6);
      expect((result.groups as any).policy_interpretation.map((t: any) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    });

  it('去重:同一 tool 多 binding 命中只保留一条', async () => {
    visitsRepo.findOne.mockResolvedValue({ id: 'v1', provinceCode: '310000', cityCode: null, districtCode: null });
    bindingsRepo.find.mockResolvedValue([
      { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
      { id: 'b2', toolId: 't1', targetType: 'visit', visitId: 'v1' },
    ]);
    toolsRepo.find.mockResolvedValue([
      { id: 't1', title: 'A', taxonomyTag: 'other', status: 'published', createdAt: new Date() },
    ]);
    const result = await svc.matchByVisit('v1');
    const all = Object.values(result.groups).flat();
    expect(all.length).toBe(1);
  });

  it('过滤:archived/draft 工具不出现(toolsRepo 内置 status=published 过滤)', async () => {
    visitsRepo.findOne.mockResolvedValue({ id: 'v1', provinceCode: '310000' });
    bindingsRepo.find.mockResolvedValue([
      { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
      { id: 'b2', toolId: 't2', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
    ]);
    // service 调用 toolsRepo.find 时会带 status='published' filter,这里 mock 直接返回过滤后的结果
    toolsRepo.find.mockResolvedValue([
      { id: 't1', title: 'Pub', status: 'published', taxonomyTag: 'other', createdAt: new Date() },
    ]);
    const result = await svc.matchByVisit('v1');
    const all = Object.values(result.groups).flat();
    expect(all.map((t: any) => t.id)).toEqual(['t1']);
  });
});
