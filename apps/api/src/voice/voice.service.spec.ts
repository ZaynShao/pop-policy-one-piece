import { Test } from '@nestjs/testing';
import {
  BadGatewayException,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import axios from 'axios';
import { VoiceService } from './voice.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VoiceService', () => {
  let service: VoiceService;
  const ctx = {
    today: '2026-04-29',
    currentProvinceCode: '310000',
    currentCityName: '浦东新区',
  };
  const audio = Buffer.from('fakeaudio');

  beforeEach(async () => {
    process.env.MINIMAX_API_KEY = 'sk-test';
    const module = await Test.createTestingModule({
      providers: [VoiceService],
    }).compile();
    service = module.get(VoiceService);
    jest.clearAllMocks();
    // 跳过真实 ffmpeg 转码 — 测试只关心 MiniMax 解析逻辑
    jest
      .spyOn(service as unknown as { transcodeToMp3: () => Promise<Buffer> }, 'transcodeToMp3')
      .mockResolvedValue(Buffer.from('fake-mp3'));
  });

  afterEach(() => {
    delete process.env.MINIMAX_API_KEY;
  });

  it('parses valid JSON response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天去上海发改委',
                visitDate: '2026-04-29',
                provinceCode: '310000',
                cityName: '上海市',
                department: '上海发改委',
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.transcript).toBe('今天去上海发改委');
    expect(result.parsed.provinceCode).toBe('310000');
    expect(result.parsed.cityName).toBe('上海市');
    expect(result.parsed.contactPerson).toBeNull();
  });

  it('strips <think> wrapper and extracts JSON', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content:
                '<think>let me reason about this</think>\n{"transcript":"今天","visitDate":null,"provinceCode":null,"cityName":null,"department":null,"contactPerson":null,"contactTitle":null,"outcomeSummary":null,"color":null,"followUp":null}',
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.transcript).toBe('今天');
  });

  it('rejects empty transcript', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '',
                visitDate: null,
                provinceCode: null,
                cityName: null,
                department: null,
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });

  it('rejects non-JSON response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'I cannot do this' } }] },
    });

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws RequestTimeoutException on axios ECONNABORTED', async () => {
    const err = new Error('timeout of 15000ms exceeded') as any;
    err.code = 'ECONNABORTED';
    mockedAxios.post.mockRejectedValueOnce(err);

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(RequestTimeoutException);
  });

  it('cleans invalid color to null', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天',
                visitDate: null,
                provinceCode: null,
                cityName: null,
                department: null,
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: 'purple',
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.color).toBeNull();
  });

  it('cleans empty string fields to null', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天',
                visitDate: '',
                provinceCode: '   ',
                cityName: null,
                department: '上海发改委',
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.visitDate).toBeNull();
    expect(result.parsed.provinceCode).toBeNull();
    expect(result.parsed.department).toBe('上海发改委');
  });

  it('throws InternalServerErrorException when MINIMAX_API_KEY is missing', async () => {
    delete process.env.MINIMAX_API_KEY;
    // re-create service so the empty env is captured at construction
    const module = await Test.createTestingModule({
      providers: [VoiceService],
    }).compile();
    const localService = module.get(VoiceService);

    await expect(
      localService.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws BadGatewayException on non-timeout axios error', async () => {
    const err = new Error('Network Error') as any;
    err.code = 'ECONNREFUSED';
    err.response = { status: 500 };
    mockedAxios.post.mockRejectedValueOnce(err);

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when MiniMax returns empty content', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      },
    });

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });
});
