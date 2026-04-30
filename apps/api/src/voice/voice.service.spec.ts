import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadGatewayException, InternalServerErrorException, RequestTimeoutException } from '@nestjs/common';
import axios from 'axios';
import { VoiceService } from './voice.service';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import * as aliyunAsr from './aliyun-asr';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VoiceService', () => {
  let service: VoiceService;
  let orgsRepo: any;
  const ctx = { today: '2026-04-29', currentProvinceCode: '430000', currentCityName: '长沙市' };
  const audio = Buffer.from('fakeaudio');

  beforeEach(async () => {
    process.env.MINIMAX_API_KEY = 'sk-test';
    process.env.ALI_NLS_APP_KEY = 'app-test';
    process.env.ALI_NLS_TOKEN = 'token-test';

    orgsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const module = await Test.createTestingModule({
      providers: [
        VoiceService,
        { provide: getRepositoryToken(GovOrgEntity), useValue: orgsRepo },
      ],
    }).compile();
    service = module.get(VoiceService);

    jest.clearAllMocks();
    // Skip ffmpeg
    jest.spyOn(service as any, 'transcodeToMp3').mockResolvedValue(Buffer.from('fake-mp3'));
    // Skip Aliyun ASR
    jest.spyOn(aliyunAsr, 'transcribeAudioWithAliyunNls').mockResolvedValue('今天去长沙发改委张处长');
  });

  afterEach(() => {
    delete process.env.MINIMAX_API_KEY;
    delete process.env.ALI_NLS_APP_KEY;
    delete process.env.ALI_NLS_TOKEN;
  });

  function mockMiniMax(content: string) {
    mockedAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content } }] },
    } as any);
  }

  it('parses valid JSON + fuzzy match name exact', async () => {
    mockMiniMax(JSON.stringify({
      transcript: '今天去长沙发改委',
      visitDate: '2026-04-29',
      provinceCode: '430000',
      cityName: '长沙市',
      department: '长沙市发展和改革委员会',
      contactPerson: null,
      contactTitle: null,
      outcomeSummary: null,
      color: null,
      followUp: null,
    }));
    orgsRepo.findOne.mockResolvedValueOnce({ id: 'org-csfgw' });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.department).toBe('长沙市发展和改革委员会');
    expect(result.parsed.orgId).toBe('org-csfgw');
  });

  it('fuzzy match shortName exact', async () => {
    mockMiniMax(JSON.stringify({
      transcript: 't', visitDate: null, provinceCode: '430000', cityName: '长沙市',
      department: '长沙发改委', contactPerson: null, contactTitle: null,
      outcomeSummary: null, color: null, followUp: null,
    }));
    orgsRepo.findOne
      .mockResolvedValueOnce(null)        // name exact miss
      .mockResolvedValueOnce({ id: 'org-csfgw' });  // shortName exact hit

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.orgId).toBe('org-csfgw');
  });

  it('fuzzy match LIKE - returns null when multiple candidates', async () => {
    mockMiniMax(JSON.stringify({
      transcript: 't', visitDate: null, provinceCode: '430000', cityName: '长沙市',
      department: '发改委', contactPerson: null, contactTitle: null,
      outcomeSummary: null, color: null, followUp: null,
    }));
    orgsRepo.findOne.mockResolvedValue(null);  // 都不全等
    orgsRepo.createQueryBuilder().getMany.mockResolvedValueOnce([
      { id: 'a' }, { id: 'b' },  // 2 candidates → no match
    ]);

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.orgId).toBeNull();
    expect(result.parsed.department).toBe('发改委');
  });

  it('no department → no fuzzy match call', async () => {
    mockMiniMax(JSON.stringify({
      transcript: 't', visitDate: null, provinceCode: null, cityName: null,
      department: null, contactPerson: null, contactTitle: null,
      outcomeSummary: null, color: null, followUp: null,
    }));

    const result = await service.parseVisit(audio, 'audio/webm', { today: '2026-04-29' });
    expect(orgsRepo.findOne).not.toHaveBeenCalled();
    expect(result.parsed.orgId).toBeNull();
  });

  it('no provinceCode in ctx + LLM not parsing → no fuzzy', async () => {
    mockMiniMax(JSON.stringify({
      transcript: 't', visitDate: null, provinceCode: null, cityName: null,
      department: '某发改委', contactPerson: null, contactTitle: null,
      outcomeSummary: null, color: null, followUp: null,
    }));

    const result = await service.parseVisit(audio, 'audio/webm', { today: '2026-04-29' });
    expect(orgsRepo.findOne).not.toHaveBeenCalled();
    expect(result.parsed.orgId).toBeNull();
  });

  it('strips <think> wrapper', async () => {
    mockMiniMax('<think>reasoning</think>\n{"transcript":"t","visitDate":null,"provinceCode":null,"cityName":null,"department":null,"contactPerson":null,"contactTitle":null,"outcomeSummary":null,"color":null,"followUp":null}');
    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.transcript).toBe('今天去长沙发改委张处长');
  });

  it('rejects empty transcript from ASR', async () => {
    jest.spyOn(aliyunAsr, 'transcribeAudioWithAliyunNls').mockResolvedValueOnce('');
    await expect(service.parseVisit(audio, 'audio/webm', ctx))
      .rejects.toThrow(BadGatewayException);
  });

  it('rejects non-JSON LLM response', async () => {
    mockMiniMax('I cannot do this');
    await expect(service.parseVisit(audio, 'audio/webm', ctx))
      .rejects.toThrow(BadGatewayException);
  });

  it('throws RequestTimeoutException on axios ECONNABORTED', async () => {
    const err: any = new Error('timeout');
    err.code = 'ECONNABORTED';
    mockedAxios.post.mockRejectedValueOnce(err);
    await expect(service.parseVisit(audio, 'audio/webm', ctx))
      .rejects.toThrow(RequestTimeoutException);
  });

  it('throws InternalServerErrorException when MINIMAX_API_KEY missing', async () => {
    delete process.env.MINIMAX_API_KEY;
    const module = await Test.createTestingModule({
      providers: [
        VoiceService,
        { provide: getRepositoryToken(GovOrgEntity), useValue: orgsRepo },
      ],
    }).compile();
    const localService = module.get(VoiceService);
    await expect(localService.parseVisit(audio, 'audio/webm', ctx))
      .rejects.toThrow(InternalServerErrorException);
  });
});
