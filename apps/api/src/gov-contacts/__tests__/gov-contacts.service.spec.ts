import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GovContactsService } from '../gov-contacts.service';
import { GovContactEntity } from '../entities/gov-contact.entity';
import { GovOrgEntity } from '../../gov-orgs/entities/gov-org.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const sysAdmin: AuthenticatedUser = {
  id: 'u-sys', username: 'sys', displayName: 'Sys', roleCode: UserRoleCode.SysAdmin,
} as AuthenticatedUser;

const localGa: AuthenticatedUser = {
  id: 'u-ga', username: 'ga', displayName: 'GA', roleCode: UserRoleCode.LocalGa,
} as AuthenticatedUser;

describe('GovContactsService', () => {
  let service: GovContactsService;
  let repo: any;
  let orgsRepo: any;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'c-1', ...x })),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };
    orgsRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'o-1', deletedAt: null }),
    };
    const module = await Test.createTestingModule({
      providers: [
        GovContactsService,
        { provide: getRepositoryToken(GovContactEntity), useValue: repo },
        { provide: getRepositoryToken(GovOrgEntity), useValue: orgsRepo },
      ],
    }).compile();
    service = module.get(GovContactsService);
  });

  it('create: throws if orgId not exists', async () => {
    orgsRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.create({ name: '张', orgId: 'o-x', title: '处长' }, sysAdmin),
    ).rejects.toThrow('机构不存在');
  });

  it('create: throws ConflictException on UNIQUE violation', async () => {
    repo.save.mockRejectedValueOnce({ code: '23505' });
    await expect(
      service.create({ name: '张', orgId: 'o-1', title: '处长' }, sysAdmin),
    ).rejects.toThrow(new ConflictException('该机构下已有同名联系人'));
  });

  it('update: non-owner non-admin throws ForbiddenException', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'c-1', ownerUserId: 'someone-else' });
    await expect(service.update('c-1', { tier: 'core' }, localGa)).rejects.toThrow(ForbiddenException);
  });

  it('update: owner can edit own contact', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'c-1', ownerUserId: 'u-ga', tier: 'normal' });
    repo.save.mockResolvedValueOnce({ id: 'c-1', tier: 'core' });
    const result = await service.update('c-1', { tier: 'core' }, localGa);
    expect(result.tier).toBe('core');
  });

  it('softDelete: non-admin throws ForbiddenException', async () => {
    await expect(service.softDelete('c-1', localGa)).rejects.toThrow(ForbiddenException);
  });

  it('findOne: NotFound when missing', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('c-1')).rejects.toThrow(NotFoundException);
  });

  it('upsertByOrgAndName: returns existing.id when contact found', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'c-existing', orgId: 'o-1', name: '张处长' });
    const result = await service.upsertByOrgAndName({
      orgId: 'o-1',
      name: '张处长',
      title: '处长',
      user: sysAdmin,
    });
    expect(result).toBe('c-existing');
    // Should NOT have called create / save
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('upsertByOrgAndName: creates and returns new id when contact not found', async () => {
    repo.findOne.mockResolvedValueOnce(null);  // initial existence check: not found
    // create() will run, which calls orgsRepo.findOne (org exists, default mock) + repo.save
    const result = await service.upsertByOrgAndName({
      orgId: 'o-1',
      name: '李处长',
      title: '处长',
      user: sysAdmin,
    });
    expect(result).toBe('c-1');  // matches default `repo.save` mock returning { id: 'c-1', ... }
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'o-1',
      name: '李处长',
      title: '处长',
    }));
  });
});
