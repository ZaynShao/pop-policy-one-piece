import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitsService } from '../visits.service';
import { VisitEntity } from '../entities/visit.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { CommentEntity } from '../../comments/entities/comment.entity';

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

describe('VisitsService.create', () => {
  let svc: VisitsService;
  let pinsRepo: any;

  beforeEach(async () => {
    const visitsRepo = mockRepo();
    pinsRepo = mockRepo();
    const commentsRepo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
        { provide: getRepositoryToken(CommentEntity), useValue: commentsRepo },
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
