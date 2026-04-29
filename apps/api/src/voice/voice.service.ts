import { spawn } from 'child_process';
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
  VoiceParsedFields,
} from '@pop/shared-types';
import { buildVoicePrompt } from './prompt';

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

  async parseVisit(
    audio: Buffer,
    mimeType: string,
    ctx: VoiceParseVisitContext,
  ): Promise<VoiceParseVisitResponse> {
    if (!this.apiKey) {
      this.logger.error('MINIMAX_API_KEY not configured');
      throw new InternalServerErrorException('AI 服务未配置');
    }

    // MiniMax 不接受 webm/opus,只接受 mp3/wav/flac/pcm。
    // 浏览器 MediaRecorder 录的是 webm,服务端用 ffmpeg 转码。
    let mp3: Buffer;
    try {
      mp3 = await this.transcodeToMp3(audio, mimeType);
    } catch (e) {
      this.logger.error(`ffmpeg transcode failed: ${(e as Error).message}`);
      throw new BadGatewayException('音频转码失败');
    }

    const audioBase64 = mp3.toString('base64');
    const format = 'mp3';
    const prompt = buildVoicePrompt(ctx);

    let resp;
    try {
      resp = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'input_audio',
                  input_audio: { data: audioBase64, format },
                },
              ],
            },
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

    // 模型可能在 JSON 前后带 <think>...</think> 或其他文字,提取第一个 { 到最后一个 }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      this.logger.error(`MiniMax returned non-JSON: ${content.slice(0, 500)}`);
      throw new BadGatewayException('AI 返回格式错误');
    }
    const jsonStr = content.slice(firstBrace, lastBrace + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      this.logger.error(
        `JSON.parse failed: ${(e as Error).message}, raw: ${jsonStr.slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回格式错误');
    }

    const transcript =
      typeof parsed.transcript === 'string' ? parsed.transcript : '';
    if (!transcript || transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      this.logger.warn(
        `MiniMax returned empty/too-short transcript (length=${transcript.length})`,
      );
      throw new BadGatewayException('没有识别到内容,请重录');
    }

    const fields: VoiceParsedFields = {
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

    return { transcript, parsed: fields };
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
