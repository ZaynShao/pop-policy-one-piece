import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OSS from 'ali-oss';
import { uuidv7 } from 'uuidv7';
import type { UploadUrlResponseDto } from '@pop/shared-types';

@Injectable()
export class OssService {
  private readonly client: OSS | null;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.bucket = process.env.OSS_BUCKET ?? '';
    this.region = process.env.OSS_REGION ?? '';
    const ak = process.env.OSS_ACCESS_KEY_ID ?? '';
    const sk = process.env.OSS_ACCESS_KEY_SECRET ?? '';
    this.client =
      this.bucket && this.region && ak && sk
        ? new OSS({ region: this.region, accessKeyId: ak, accessKeySecret: sk, bucket: this.bucket })
        : null;
  }

  generateUploadUrl(filename: string, contentType: string): UploadUrlResponseDto {
    if (!this.client) {
      throw new InternalServerErrorException('OSS 未配置 — 检查 OSS_* 环境变量');
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const objectKey = `tools/${uuidv7()}_${safeName}`;
    const uploadUrl = this.client.signatureUrl(objectKey, {
      method: 'PUT',
      'Content-Type': contentType,
      expires: 600,
    });
    const publicUrl = `https://${this.bucket}.${this.region}.aliyuncs.com/${objectKey}`;
    return { uploadUrl, objectKey, publicUrl };
  }
}
