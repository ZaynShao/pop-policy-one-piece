import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';

/**
 * 阿里云 NLS Token 管理器 — 用 AccessKey 自动签发 + 缓存 + 续期。
 *
 * 替代旧的 ALI_NLS_TOKEN 静态环境变量(24h 失效需手工换)。
 *
 * 使用方式:
 *   await tokenManager.getToken()          // 缓存有效 → 直接返回
 *   await tokenManager.getToken(true)      // 强制重签(token 被阿里拒掉时调)
 *
 * 文档:https://help.aliyun.com/zh/isi/getting-started/obtain-an-access-token
 */

interface AliyunTokenResponse {
  Token?: { Id: string; ExpireTime: number };
  ErrCode?: number;
  ErrMsg?: string;
  RequestId?: string;
}

const REFRESH_BUFFER_SEC = 3600; // 提前 1 小时刷新,避免边界失效
const FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class AliyunTokenManager {
  private readonly logger = new Logger(AliyunTokenManager.name);
  private readonly akId = process.env.ALI_NLS_AK_ID ?? '';
  private readonly akSecret = process.env.ALI_NLS_AK_SECRET ?? '';
  private cached: { token: string; expireAt: number } | null = null;
  private inflight: Promise<{ token: string; expireAt: number }> | null = null;

  isConfigured(): boolean {
    return !!(this.akId && this.akSecret);
  }

  /**
   * 拿当前可用 token。`force=true` 强制重签(用于 token 被拒后的 retry)。
   * 并发去重:多个调用同时进来只触发 1 次 fetch。
   */
  async getToken(force = false): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('ALI_NLS_AK_ID / ALI_NLS_AK_SECRET not configured');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      !force &&
      this.cached &&
      this.cached.expireAt > nowSec + REFRESH_BUFFER_SEC
    ) {
      return this.cached.token;
    }

    if (!this.inflight) {
      this.inflight = this.fetchToken().finally(() => {
        this.inflight = null;
      });
    }
    const fresh = await this.inflight;
    this.cached = fresh;
    return fresh.token;
  }

  private async fetchToken(): Promise<{ token: string; expireAt: number }> {
    const params: Record<string, string> = {
      AccessKeyId: this.akId,
      Action: 'CreateToken',
      Format: 'JSON',
      RegionId: 'cn-shanghai',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2019-02-28',
    };

    const pe = (s: string) =>
      encodeURIComponent(s)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');

    const sortedKeys = Object.keys(params).sort();
    const canonical = sortedKeys
      .map((k) => `${pe(k)}=${pe(params[k])}`)
      .join('&');
    const stringToSign = `GET&${pe('/')}&${pe(canonical)}`;
    params.Signature = crypto
      .createHmac('sha1', `${this.akSecret}&`)
      .update(stringToSign)
      .digest('base64');

    const finalQs = Object.keys(params)
      .sort()
      .map((k) => `${pe(k)}=${pe(params[k])}`)
      .join('&');
    const url = `https://nls-meta.cn-shanghai.aliyuncs.com/?${finalQs}`;

    let resp;
    try {
      resp = await axios.get<AliyunTokenResponse>(url, {
        timeout: FETCH_TIMEOUT_MS,
      });
    } catch (e) {
      const ae = e as AxiosError;
      throw new Error(
        `aliyun NLS CreateToken http error: ${ae.message} status=${ae.response?.status}`,
      );
    }

    const data = resp.data;
    if (!data.Token?.Id || !data.Token.ExpireTime) {
      throw new Error(
        `aliyun NLS CreateToken failed: code=${data.ErrCode} msg=${data.ErrMsg} requestId=${data.RequestId}`,
      );
    }
    this.logger.log(
      `aliyun NLS token refreshed, expires at ${new Date(
        data.Token.ExpireTime * 1000,
      ).toISOString()}`,
    );
    return { token: data.Token.Id, expireAt: data.Token.ExpireTime };
  }
}
