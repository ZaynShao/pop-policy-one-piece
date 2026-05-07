import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ToolsService } from '../tools.service';
import { ToolEntity } from '../entities/tool.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
});

const centralUser: AuthenticatedUser = {
  id: 'u-central',
  username: 'central1',
  displayName: '中台 GA 1',
  email: 'c@x.com',
  roleCode: UserRoleCode.CentralGa,
};

describe('ToolsService.create', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: getRepositoryToken(ToolEntity), useValue: repo },
      ],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('document 类型必须有 fileUrl', async () => {
    await expect(
      svc.create({ type: 'document', title: 'X', taxonomyTag: 'ppt_template' } as any, centralUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('interface 类型必须有 paramTemplate', async () => {
    await expect(
      svc.create({ type: 'interface', title: 'X', taxonomyTag: 'ppt_template' } as any, centralUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('document 创建成功 status=draft creator=current user', async () => {
    const out = await svc.create(
      { type: 'document', title: 'V2G 谈参', taxonomyTag: 'talk_param_ref', fileUrl: 'https://oss/x.pdf' } as any,
      centralUser,
    );
    expect(out.status).toBe('draft');
    expect(out.creatorId).toBe('u-central');
  });
});

describe('ToolsService.update', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: getRepositoryToken(ToolEntity), useValue: repo },
      ],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('非 creator 改不了', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'someone-else', type: 'document' });
    await expect(
      svc.update('t1', { title: 'new' }, centralUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creator 可以改', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', type: 'document' });
    repo.save.mockImplementation((x: unknown) => Promise.resolve(x));
    const out = await svc.update('t1', { title: 'new' }, centralUser);
    expect(out.title).toBe('new');
  });

  it('找不到工具抛 NotFound', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.update('t1', { title: 'x' }, centralUser)).rejects.toThrow(NotFoundException);
  });
});
