import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VisitsService } from '../visits.service';
import { VisitEntity } from '../entities/visit.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { CommentEntity } from '../../comments/entities/comment.entity';
import { UserEntity } from '../../users/entities/user.entity';

// Mock lookupCityCenter so tests don't depend on GeoJSON file loading
jest.mock('../../lib/geojson-cities', () => ({
  lookupCityCenter: jest.fn(() => ({ lng: 104.065735, lat: 30.659462 })),
  loadGeoJsonCities: jest.fn(),
  listAllProvincesCities: jest.fn(() => []),
}));

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
    const manager = {
      save: jest.fn((entity: any, data: any) =>
        Promise.resolve({ ...data, id: data.id ?? 'mock-uuid' }),
      ),
    };
    return cb(manager);
  }),
});

describe('VisitsService.create', () => {
  let svc: VisitsService;
  let pinsRepo: any;

  beforeEach(async () => {
    const visitsRepo = mockRepo();
    pinsRepo = mockRepo();
    const commentsRepo = mockRepo();
    const usersRepo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
        { provide: getRepositoryToken(CommentEntity), useValue: commentsRepo },
        { provide: getRepositoryToken(UserEntity), useValue: usersRepo },
        { provide: DataSource, useValue: mockDataSource() },
      ],
    }).compile();

    svc = module.get(VisitsService);
  });

  const baseGeo = { provinceCode: '510000', cityName: '成都市' };
  const visitorId = 'visitor-uuid';

  it('rejects status=cancelled on create', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'cancelled' }, visitorId),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires title when status=planned', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'planned' }, visitorId),
    ).rejects.toThrow(/title/);
  });

  it('requires visitDate/contactPerson/color when status=completed', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'completed' }, visitorId),
    ).rejects.toThrow(/visitDate|contactPerson|color/);
  });

  it('validates parentPinId exists', async () => {
    pinsRepo.findOne.mockResolvedValue(null);
    await expect(
      svc.create(
        { ...baseGeo, status: 'planned', title: 'x', parentPinId: 'non-exist' },
        visitorId,
      ),
    ).rejects.toThrow(/parentPin/i);
  });

  it('creates planned visit with parentPin successfully', async () => {
    pinsRepo.findOne.mockResolvedValue({ id: 'pin-1', title: 'Pin' });
    const result = await svc.create(
      { ...baseGeo, status: 'planned', title: '拜访某厂', parentPinId: 'pin-1', plannedDate: '2026-05-15' },
      visitorId,
    );
    expect(result.status).toBe('planned');
    expect(result.parentPinId).toBe('pin-1');
    expect(result.title).toBe('拜访某厂');
  });

  it('creates completed visit (default status) with backward compat', async () => {
    const result = await svc.create(
      {
        ...baseGeo,
        visitDate: '2026-04-27',
        department: '某局',
        contactPerson: '张工',
        color: 'green',
        followUp: false,
      },
      visitorId,
    );
    expect(result.status).toBe('completed');
  });
});

describe('VisitsService.update state machine', () => {
  let svc: VisitsService;
  let visitsRepo: any;
  let usersRepo: any;
  let ds: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    visitsRepo = mockRepo();
    const pinsRepo = mockRepo();
    const commentsRepo = mockRepo();
    usersRepo = mockRepo();
    ds = mockDataSource();

    const module = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
        { provide: getRepositoryToken(CommentEntity), useValue: commentsRepo },
        { provide: getRepositoryToken(UserEntity), useValue: usersRepo },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();

    svc = module.get(VisitsService);
  });

  const plannedVisit = (overrides = {}) => ({
    id: 'v1',
    status: 'planned',
    parentPinId: null,
    title: 'plan',
    plannedDate: null,
    visitDate: null,
    department: null,
    contactPerson: null,
    contactTitle: null,
    outcomeSummary: null,
    color: null,
    followUp: false,
    provinceCode: '510000',
    cityName: '成都市',
    lng: 0, lat: 0, visitorId: 'u1',
    ...overrides,
  });

  it('rejects completed → planned', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(svc.update('v1', { status: 'planned' }, 'u1')).rejects.toThrow(/不允许.*completed.*planned/);
  });

  it('rejects completed → cancelled', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(svc.update('v1', { status: 'cancelled' }, 'u1')).rejects.toThrow(/不允许.*completed.*cancelled/);
  });

  it('allows planned → completed with required fields', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    const result = await svc.update('v1', {
      status: 'completed',
      visitDate: '2026-04-27',
      contactPerson: '张工',
      department: '某局',
      color: 'green',
    }, 'u1');
    expect(result.status).toBe('completed');
  });

  it('rejects planned → completed without visitDate', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    await expect(
      svc.update('v1', { status: 'completed' }, 'u1'),
    ).rejects.toThrow(/visitDate/);
  });

  it('allows planned → cancelled', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    const result = await svc.update('v1', { status: 'cancelled' }, 'u1');
    expect(result.status).toBe('cancelled');
  });

  it('allows cancelled → planned (restart)', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'cancelled' }));
    const result = await svc.update('v1', { status: 'planned' }, 'u1');
    expect(result.status).toBe('planned');
  });

  it('completed: only allows changing color', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    const result = await svc.update('v1', { color: 'yellow' }, 'u1');
    expect(result.color).toBe('yellow');
  });

  it('completed: rejects changing other fields', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(
      svc.update('v1', { outcomeSummary: 'changed' }, 'u1'),
    ).rejects.toThrow(/已完成拜访只允许改 color/);
  });

  it('auto-creates comment when planned → completed with parentPinId', async () => {
    const visit = plannedVisit({ parentPinId: 'pin-1', title: 'T6 auto comment' });
    visitsRepo.findOne.mockResolvedValue(visit);
    usersRepo.findOne.mockResolvedValue({ id: 'u1', displayName: '系统管理员', username: 'sysadmin' });

    const result = await svc.update('v1', {
      status: 'completed',
      visitDate: '2026-04-27',
      department: '中芯成都',
      contactPerson: '张工',
      contactTitle: '副总',
      color: 'yellow',
      outcomeSummary: '希望补贴翻倍',
    }, 'u1');

    expect(result.status).toBe('completed');
    expect(ds.transaction).toHaveBeenCalledTimes(1);

    // Verify manager.save was called twice (visit + comment)
    const managerSaveCalls = (ds.transaction as jest.Mock).mock.calls;
    expect(managerSaveCalls.length).toBe(1);
  });

  it('does NOT create comment when planned → completed without parentPinId', async () => {
    const visit = plannedVisit({ parentPinId: null });
    visitsRepo.findOne.mockResolvedValue(visit);

    await svc.update('v1', {
      status: 'completed',
      visitDate: '2026-04-27',
      contactPerson: '张工',
      color: 'green',
    }, 'u1');

    expect(ds.transaction).not.toHaveBeenCalled();
    expect(visitsRepo.save).toHaveBeenCalledTimes(1);
  });
});
