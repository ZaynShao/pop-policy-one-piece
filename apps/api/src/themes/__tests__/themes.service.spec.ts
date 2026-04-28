import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThemesService } from '../themes.service';
import { ThemeEntity } from '../entities/theme.entity';
import { ThemeCoverageEntity } from '../entities/theme-coverage.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: x.id ?? 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const userOf = (roleCode: UserRoleCode): AuthenticatedUser => ({
  id: 'u1', username: 'test', displayName: 'Test', email: 't@x', roleCode,
});

describe('ThemesService', () => {
  let svc: ThemesService;
  let themesRepo: any;
  let coverageRepo: any;

  beforeEach(async () => {
    themesRepo = mockRepo();
    coverageRepo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ThemesService,
        { provide: getRepositoryToken(ThemeEntity), useValue: themesRepo },
        { provide: getRepositoryToken(ThemeCoverageEntity), useValue: coverageRepo },
      ],
    }).compile();
    svc = module.get(ThemesService);
  });

  describe('create', () => {
    it('forces status=draft and assigns createdBy', async () => {
      const out = await svc.create(
        { title: 'X', template: 'main' },
        userOf(UserRoleCode.CentralGa),
      );
      expect(out.status).toBe('draft');
      expect(out.createdBy).toBe('u1');
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.create({ title: 'X', template: 'main' }, userOf(UserRoleCode.LocalGa)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('publish', () => {
    it('rejects if coverage=0', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      coverageRepo.count.mockResolvedValue(0);
      await expect(
        svc.publish('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(/发布前必须先拉取覆盖清单/);
    });

    it('publishes if coverage>=1', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      coverageRepo.count.mockResolvedValue(5);
      const out = await svc.publish('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('published');
      expect(out.publishedAt).toBeInstanceOf(Date);
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.publish('t1', userOf(UserRoleCode.LocalGa)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 if status is archived', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'archived' });
      await expect(
        svc.publish('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive / unarchive', () => {
    it('archive published → archived', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      const out = await svc.archive('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('archived');
    });

    it('archive draft → 400', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await expect(
        svc.archive('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });

    it('unarchive archived → published', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'archived' });
      const out = await svc.unarchive('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('published');
    });

    it('unarchive draft → 400', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await expect(
        svc.unarchive('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneWithCoverage', () => {
    it('throws 404 if not found', async () => {
      themesRepo.findOne.mockResolvedValue(null);
      await expect(svc.findOneWithCoverage('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns theme with coverage array', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', title: 'X' });
      coverageRepo.find.mockResolvedValue([{ id: 'c1', themeId: 't1' }]);
      const out = await svc.findOneWithCoverage('t1');
      expect(out.coverage).toHaveLength(1);
    });
  });
});
