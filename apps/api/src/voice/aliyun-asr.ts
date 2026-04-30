import axios, { AxiosError } from 'axios';

const ASR_URL = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';
const TIMEOUT_MS = 12_000;
const SUCCESS_STATUS = 20000000;

interface AsrResponse {
  task_id: string;
  result: string;
  status: number;
  message: string;
}

/**
 * 阿里云 NLS 一句话识别 - 直接 POST mp3 binary,同步返回文字。
 *
 * 使用 NLS Token(24 小时有效)。后续接入 AccessKey 后可改成自动续期。
 *
 * 文档:https://help.aliyun.com/zh/isi/developer-reference/restful-api
 */
export async function transcribeAudioWithAliyunNls(
  mp3: Buffer,
  appKey: string,
  token: string,
): Promise<string> {
  if (!appKey || !token) {
    throw new Error('aliyun NLS appKey/token not configured');
  }

  let resp;
  try {
    resp = await axios.post<AsrResponse>(ASR_URL, mp3, {
      headers: {
        'X-NLS-Token': token,
        'Content-Type': 'audio/mpeg',
      },
      params: {
        appkey: appKey,
        format: 'mp3',
        sample_rate: 16000,
        enable_punctuation_prediction: true,
        enable_inverse_text_normalization: true,
      },
      timeout: TIMEOUT_MS,
    });
  } catch (e) {
    const ae = e as AxiosError;
    if (ae.code === 'ECONNABORTED' || ae.message?.includes('timeout')) {
      throw new Error(`aliyun NLS timeout after ${TIMEOUT_MS}ms`);
    }
    const body = JSON.stringify(ae.response?.data ?? {}).slice(0, 300);
    throw new Error(
      `aliyun NLS http error: ${ae.message} status=${ae.response?.status} body=${body}`,
    );
  }

  const data = resp.data;
  if (data.status !== SUCCESS_STATUS) {
    throw new Error(
      `aliyun NLS asr failed: status=${data.status} msg=${data.message} task=${data.task_id}`,
    );
  }
  return data.result ?? '';
}
