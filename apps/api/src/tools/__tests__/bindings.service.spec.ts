import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BindingsService } from '../bindings.service';
import { ToolBindingEntity } from '../entities/tool-binding.entity';

describe('BindingsService.create', () => {
  let svc: BindingsService;
  let repo: any;

  beforeEach(async () => {
    repo = { create: jest.fn((x: unknown) => x), save: jest.fn((x: any) => Promise.resolve({ ...x, id: 'b1' })), find: jest.fn(), delete: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [BindingsService, { provide: getRepositoryToken(ToolBindingEntity), useValue: repo }],
    }).compile();
    svc = module.get(BindingsService);
  });

  it('pin 模式必须有 pinId', async () => {
    await expect(svc.create('t1', { targetType: 'pin' } as any)).rejects.toThrow(BadRequestException);
  });

  it('visit 模式必须有 visitId', async () => {
    await expect(svc.create('t1', { targetType: 'visit' } as any)).rejects.toThrow(BadRequestException);
  });

  it('region 模式必须有 regionScopeTag', async () => {
    await expect(svc.create('t1', { targetType: 'region', regionCode: '110000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('region nationwide regionCode 可空', async () => {
    const out = await svc.create('t1', { targetType: 'region', regionScopeTag: 'nationwide' } as any);
    expect(out.regionScopeTag).toBe('nationwide');
    expect(out.regionCode).toBeNull();
  });

  it('region specific 必须有 regionCode', async () => {
    await expect(
      svc.create('t1', { targetType: 'region', regionScopeTag: 'specific' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('pin 模式正常创建', async () => {
    const out = await svc.create('t1', { targetType: 'pin', pinId: 'p1' } as any);
    expect(out.pinId).toBe('p1');
    expect(out.toolId).toBe('t1');
  });
});
