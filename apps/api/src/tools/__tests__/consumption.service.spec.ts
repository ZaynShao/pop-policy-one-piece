import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsumptionService } from '../consumption.service';
import { ToolEntity } from '../entities/tool.entity';
import { ToolConsumptionLogEntity } from '../entities/tool-consumption-log.entity';
import { ExternalMockService } from '../../external-mock/external-mock.service';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const localUser: AuthenticatedUser = {
  id: 'u-local', username: 'l', displayName: 'L', email: 'l@x', roleCode: UserRoleCode.LocalGa,
};

describe('ConsumptionService.download', () => {
  let svc: ConsumptionService;
  let toolsRepo: any;
  let logsRepo: any;

  beforeEach(async () => {
    toolsRepo = { findOne: jest.fn() };
    logsRepo = { create: jest.fn((x: unknown) => x), save: jest.fn((x: any) => Promise.resolve({ ...x, id: 'l1' })) };
    const module = await Test.createTestingModule({
      providers: [
        ConsumptionService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolConsumptionLogEntity), useValue: logsRepo },
        { provide: ExternalMockService, useValue: { invoke: jest.fn() } },
      ],
    }).compile();
    svc = module.get(ConsumptionService);
  });

  it('document 下载:写日志 + 返回 fileUrl', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', fileUrl: 'https://oss/x.pdf', status: 'published' });
    const r = await svc.download('t1', localUser, { contextVisitId: 'v1' });
    expect(r.fileUrl).toBe('https://oss/x.pdf');
    expect(logsRepo.save).toHaveBeenCalled();
  });

  it('interface 工具不能 download', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'interface', status: 'published' });
    await expect(svc.download('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });

  it('archived 工具不能 download', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', status: 'archived' });
    await expect(svc.download('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });
});

describe('ConsumptionService.invoke', () => {
  let svc: ConsumptionService;
  let toolsRepo: any;
  let logsRepo: any;
  let mock: any;

  beforeEach(async () => {
    toolsRepo = { findOne: jest.fn() };
    logsRepo = { create: jest.fn((x: unknown) => x), save: jest.fn((x: any) => Promise.resolve({ ...x, id: 'l1' })) };
    mock = { invoke: jest.fn().mockReturnValue({ summary: 'X', downloadUrl: '/y', params: {}, generatedAt: 'now' }) };
    const module = await Test.createTestingModule({
      providers: [
        ConsumptionService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolConsumptionLogEntity), useValue: logsRepo },
        { provide: ExternalMockService, useValue: mock },
      ],
    }).compile();
    svc = module.get(ConsumptionService);
  });

  it('interface 调用:走 mock + 写日志含 response', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'interface', status: 'published', paramTemplate: { region: 'auto' } });
    const r = await svc.invoke('t1', localUser, { contextRegionCode: '310000' });
    expect(mock.invoke).toHaveBeenCalledWith(expect.objectContaining({ regionCode: '310000' }));
    expect(r.response.summary).toBe('X');
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ interfaceResponse: r.response }));
  });

  it('document 工具不能 invoke', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', status: 'published' });
    await expect(svc.invoke('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });
});
