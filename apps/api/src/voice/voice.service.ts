import { spawn } from 'child_process';
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import axios, { AxiosError } from 'axios';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
  VoiceParsedFields,
} from '@pop/shared-types';
import { GovOrgEntity } from '../gov-orgs/entities/gov-org.entity';
import { buildVoicePrompt } from './prompt';
import { transcribeAudioWithAliyunNls } from './aliyun-asr';

const TIMEOUT_MS = 15_000;
const VALID_COLORS = ['red', 'yellow', 'green'] as const;
const MIN_TRANSCRIPT_CHARS = 2; // 1-char output usually means model failed/noise
const FFMPEG_TIMEOUT_MS = 8_000; // 60s 音频转码大概 1-2s,8s 兜底

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly apiKey = process.env.MINIMAX_API_KEY ?? '';
  private readonly baseUrl =
    process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1';
  private readonly model = 'MiniMax-M2.7-highspeed';
  private readonly nlsAppKey = process.env.ALI_NLS_APP_KEY ?? '';
  private readonly nlsToken = process.env.ALI_NLS_TOKEN ?? '';

  constructor(
    @InjectRepository(GovOrgEntity) private readonly orgsRepo: Repository<GovOrgEntity>,
  ) {}

  async parseVisit(
    audio: Buffer,
    mimeType: string,
    ctx: VoiceParseVisitContext,
  ): Promise<VoiceParseVisitResponse> {
    if (!this.apiKey) {
      this.logger.error('MINIMAX_API_KEY not configured');
      throw new InternalServerErrorException('AI 服务未配置');
    }
    if (!this.nlsAppKey || !this.nlsToken) {
      this.logger.error('ALI_NLS_APP_KEY / ALI_NLS_TOKEN not configured');
      throw new InternalServerErrorException('语音识别服务未配置');
    }

    // 1. 浏览器录的是 webm/opus, 阿里 NLS 接受 mp3/wav/pcm, 服务端 ffmpeg 转 mp3。
    let mp3: Buffer;
    try {
      mp3 = await this.transcodeToMp3(audio, mimeType);
    } catch (e) {
      this.logger.error(`ffmpeg transcode failed: ${(e as Error).message}`);
      throw new BadGatewayException('音频转码失败');
    }

    // 2. 阿里云 NLS 一句话识别: mp3 → transcript
    let transcript: string;
    try {
      transcript = await transcribeAudioWithAliyunNls(
        mp3,
        this.nlsAppKey,
        this.nlsToken,
      );
    } catch (e) {
      this.logger.error(`aliyun ASR failed: ${(e as Error).message}`);
      throw new BadGatewayException('语音识别失败');
    }

    if (!transcript || transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      this.logger.warn(
        `aliyun ASR returned empty/too-short transcript (length=${transcript.length})`,
      );
      throw new BadGatewayException('没有识别到内容,请重录');
    }

    // 3. MiniMax chat completions (纯文字): transcript → JSON
    const prompt = buildVoicePrompt(ctx);

    let resp;
    try {
      resp = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: transcript },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUT_MS,
        },
      );
    } catch (e) {
      const ae = e as AxiosError;
      if (ae.code === 'ECONNABORTED' || ae.message?.includes('timeout')) {
        this.logger.warn(`MiniMax timeout after ${TIMEOUT_MS}ms`);
        throw new RequestTimeoutException('AI 解析超时');
      }
      const respBody = JSON.stringify(ae.response?.data ?? {}).slice(0, 500);
      this.logger.error(
        `MiniMax fetch failed: ${ae.message} status=${ae.response?.status} body=${respBody}`,
      );
      throw new BadGatewayException('AI 服务不可用');
    }

    const content: string = resp.data?.choices?.[0]?.message?.content ?? '';
    if (!content) {
      this.logger.error(
        `MiniMax returned empty content. raw: ${JSON.stringify(resp.data).slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回空内容');
    }

    // Reasoning 模型(M2.7-highspeed)会在 <think>...</think> 内 sketch 思考(常包含
    // 候选 JSON),最终答案在 </think> 之后。先剥掉 think 段再提取 JSON。
    const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      this.logger.error(
        `MiniMax returned non-JSON after stripping think: ${stripped.slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回格式错误');
    }
    const jsonStr = stripped.slice(firstBrace, lastBrace + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      this.logger.error(
        `JSON.parse failed: ${(e as Error).message}, raw: ${jsonStr.slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回格式错误');
    }

    const fields: Omit<VoiceParsedFields, 'orgId'> = {
      visitDate: this.cleanString(parsed.visitDate),
      provinceCode: this.cleanString(parsed.provinceCode),
      cityName: this.cleanString(parsed.cityName),
      department: this.cleanString(parsed.department),
      contactPerson: this.cleanString(parsed.contactPerson),
      contactTitle: this.cleanString(parsed.contactTitle),
      outcomeSummary: this.cleanString(parsed.outcomeSummary),
      color: this.cleanColor(parsed.color),
      followUp: typeof parsed.followUp === 'boolean' ? parsed.followUp : null,
    };

    // K 模块 — fuzzy match GovOrg
    let matchedOrgId: string | null = null;
    const provinceCode = fields.provinceCode || ctx.currentProvinceCode || null;
    if (fields.department && provinceCode) {
      matchedOrgId = await this.fuzzyMatchGovOrg(
        fields.department,
        provinceCode,
        fields.cityName || ctx.currentCityName || null,
      );
    }

    // transcript 用 ASR 的(更可信),不用 MiniMax 输出里的 transcript 字段
    return {
      transcript,
      parsed: { ...fields, orgId: matchedOrgId },
    };
  }

  /**
   * 优先级:
   * 1. name === department(全等)
   * 2. shortName === department
   * 3. name LIKE %department% AND 候选只有 1 条
   * 否则 null
   */
  private async fuzzyMatchGovOrg(
    department: string,
    provinceCode: string,
    cityName: string | null,
  ): Promise<string | null> {
    const baseWhere: Record<string, unknown> = {
      provinceCode,
      deletedAt: IsNull(),
    };
    if (cityName) baseWhere.cityName = cityName;

    // 1. name 全等
    const exact = await this.orgsRepo.findOne({
      where: { ...baseWhere, name: department },
    });
    if (exact) return exact.id;

    // 2. shortName 全等
    const exactShort = await this.orgsRepo.findOne({
      where: { ...baseWhere, shortName: department },
    });
    if (exactShort) return exactShort.id;

    // 3. name LIKE %department% — 仅当唯一匹配
    const qb = this.orgsRepo.createQueryBuilder('o')
      .where('o.provinceCode = :pc', { pc: provinceCode })
      .andWhere('o.deletedAt IS NULL')
      .andWhere('o.name ILIKE :s', { s: `%${department}%` });
    if (cityName) qb.andWhere('o.cityName = :cn', { cn: cityName });
    const candidates = await qb.take(2).getMany();
    if (candidates.length === 1) return candidates[0].id;

    return null;
  }

  /** 清洗:string + 非空 + trim,否则 null */
  private cleanString(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t === '' ? null : t;
  }

  /** 颜色白名单,否则 null */
  private cleanColor(v: unknown): 'red' | 'yellow' | 'green' | null {
    if (typeof v !== 'string') return null;
    return (VALID_COLORS as readonly string[]).includes(v)
      ? (v as 'red' | 'yellow' | 'green')
      : null;
  }

  /**
   * 用 ffmpeg 把任意输入(webm/opus/wav/...)转成 mp3 64kbps。
   * MiniMax chat completions 不接受 webm,只接受 mp3/wav/flac/pcm。
   */
  private transcodeToMp3(input: Buffer, _mimeType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-i',
        'pipe:0',
        '-f',
        'mp3',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '64k',
        '-ar',
        '16000', // 16 kHz 采样,对 ASR 已足够,体积更小
        '-ac',
        '1', // 单声道
        '-loglevel',
        'error',
        'pipe:1',
      ]);

      const out: Buffer[] = [];
      const err: Buffer[] = [];
      const timer = setTimeout(() => {
        ff.kill('SIGKILL');
        reject(new Error(`ffmpeg timeout after ${FFMPEG_TIMEOUT_MS}ms`));
      }, FFMPEG_TIMEOUT_MS);

      ff.stdout.on('data', (d: Buffer) => out.push(d));
      ff.stderr.on('data', (d: Buffer) => err.push(d));
      ff.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(Buffer.concat(out));
        } else {
          reject(
            new Error(
              `ffmpeg exit ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`,
            ),
          );
        }
      });
      ff.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });

      ff.stdin.write(input);
      ff.stdin.end();
    });
  }
}
