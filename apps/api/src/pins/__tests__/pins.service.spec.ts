import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PinsService } from '../pins.service';
import { PinEntity } from '../entities/pin.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

// PinsService.create 用了 lookupCityCenter — 即便本测试只覆盖 list/restore,
// 模块加载时也要 mock 掉避免依赖 GeoJSON 文件。
jest.mock('../../lib/geojson-cities', () => ({
  lookupCityCenter: jest.fn(() => ({ lng: 0, lat: 0 })),
  loadGeoJsonCities: jest.fn(),
  listAllProvincesCities: jest.fn(() => []),
}));

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  restore: jest.fn(),
  softRemove: jest.fn(),
});

const userOf = (roleCode: UserRoleCode): AuthenticatedUser => ({
  id: 'u1',
  username: 'test',
  displayName: 'Test',
  email: 't@x',
  roleCode,
});

describe('PinsService — recycle bin', () => {
  let svc: PinsService;
  let pinsRepo: any;

  beforeEach(async () => {
    pinsRepo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        PinsService,
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
      ],
    }).compile();
    svc = module.get(PinsService);
  });

  describe('list({ withDeleted })', () => {
    it('returns soft-deleted rows for sys_admin', async () => {
      pinsRepo.find.mockResolvedValue([{ id: 'p1', deletedAt: new Date() }]);
      const out = await svc.list({ withDeleted: true, currentUser: userOf(UserRoleCode.SysAdmin) });
      expect(out).toHaveLength(1);
      expect(pinsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.list({ withDeleted: true, currentUser: userOf(UserRoleCode.LocalGa) }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('default list (no withDeleted) works for any role', async () => {
      pinsRepo.find.mockResolvedValue([{ id: 'p1' }]);
      const out = await svc.list({ currentUser: userOf(UserRoleCode.LocalGa) });
      expect(out).toHaveLength(1);
      expect(pinsRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('restore', () => {
    it('restores deleted pin for pmo', async () => {
      const deletedPin = { id: 'p1', deletedAt: new Date() };
      const restoredPin = { id: 'p1', deletedAt: null };
      pinsRepo.findOne.mockResolvedValue(deletedPin);
      pinsRepo.findOneOrFail.mockResolvedValue(restoredPin);
      const out = await svc.restore('p1', userOf(UserRoleCode.Pmo));
      expect(pinsRepo.restore).toHaveBeenCalledWith('p1');
      expect(out.deletedAt).toBeNull();
    });

    it('throws 403 for central_ga', async () => {
      await expect(
        svc.restore('p1', userOf(UserRoleCode.CentralGa)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 if pin not found', async () => {
      pinsRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.restore('p-nope', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
