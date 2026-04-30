import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GovOrgsService } from '../gov-orgs.service';
import { GovOrgEntity } from '../entities/gov-org.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const sysAdmin: AuthenticatedUser = {
  id: 'u-sys',
  username: 'sys',
  displayName: 'Sys',
  roleCode: UserRoleCode.SysAdmin,
} as AuthenticatedUser;

const localGa: AuthenticatedUser = {
  id: 'u-ga',
  username: 'ga',
  displayName: 'GA',
  roleCode: UserRoleCode.LocalGa,
} as AuthenticatedUser;

describe('GovOrgsService', () => {
  let service: GovOrgsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'g-1', ...x })),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        withDeleted: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const module = await Test.createTestingModule({
      providers: [
        GovOrgsService,
        { provide: getRepositoryToken(GovOrgEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(GovOrgsService);
  });

  it('create: throws ConflictException on UNIQUE violation', async () => {
    repo.save.mockRejectedValueOnce({ code: '23505' });
    await expect(
      service.create({ name: 'A', provinceCode: '430000', cityName: '长沙市', level: 'municipal' }, sysAdmin),
    ).rejects.toThrow(new ConflictException('该机构已存在(同省市同名)'));
  });

  it('update: non-admin without ownership throws ForbiddenException', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'g-1', createdBy: 'someone-else' });
    await expect(service.update('g-1', { name: 'B' }, localGa)).rejects.toThrow(ForbiddenException);
  });

  it('update: sys_admin can edit seed data (createdBy=null)', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'g-1', createdBy: null, name: 'A' });
    repo.save.mockResolvedValueOnce({ id: 'g-1', createdBy: null, name: 'B' });
    const result = await service.update('g-1', { name: 'B' }, sysAdmin);
    expect(result.name).toBe('B');
  });

  it('softDelete: non-admin throws ForbiddenException', async () => {
    await expect(service.softDelete('g-1', localGa)).rejects.toThrow(ForbiddenException);
  });

  it('update: owner (non-admin) can edit their own org', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'g-1', createdBy: 'u-ga', name: 'A' });
    repo.save.mockResolvedValueOnce({ id: 'g-1', createdBy: 'u-ga', name: 'B' });
    const result = await service.update('g-1', { name: 'B' }, localGa);
    expect(result.name).toBe('B');
  });

  it('findOne: throws NotFoundException when missing', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('g-1')).rejects.toThrow(NotFoundException);
  });
});
