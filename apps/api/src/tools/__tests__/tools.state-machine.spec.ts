import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ToolsService } from '../tools.service';
import { ToolEntity } from '../entities/tool.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const centralUser: AuthenticatedUser = { id: 'u-central', username: 'c', displayName: 'C', email: 'c@x', roleCode: UserRoleCode.CentralGa };

describe('ToolsService 状态机', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn((x: unknown) => Promise.resolve(x)) };
    const module = await Test.createTestingModule({
      providers: [ToolsService, { provide: getRepositoryToken(ToolEntity), useValue: repo }],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('publish: draft → published', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'draft' });
    const out = await svc.publish('t1', centralUser);
    expect(out.status).toBe('published');
  });

  it('publish: 非 draft 拒绝', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'published' });
    await expect(svc.publish('t1', centralUser)).rejects.toThrow(BadRequestException);
  });

  it('archive: published → archived', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'published' });
    const out = await svc.archive('t1', centralUser);
    expect(out.status).toBe('archived');
  });

  it('archive: draft 拒绝', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'draft' });
    await expect(svc.archive('t1', centralUser)).rejects.toThrow(BadRequestException);
  });

  it('restore: archived → published', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'archived' });
    const out = await svc.restore('t1', centralUser);
    expect(out.status).toBe('published');
  });

  it('非 creator 不能改状态', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'other', status: 'draft' });
    await expect(svc.publish('t1', centralUser)).rejects.toThrow(ForbiddenException);
  });
});
