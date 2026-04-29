import { authHeaders } from '@/lib/api';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
} from '@pop/shared-types';

/**
 * 调后端 /voice/parse-visit,上传音频 + 上下文,返回解析后的字段
 *
 * 错误情况:抛 Error,message 是后端返回的友好文字(message 字段)
 */
export async function fetchVoiceParseVisit(
  audio: Blob,
  context: VoiceParseVisitContext,
  signal?: AbortSignal,
): Promise<VoiceParseVisitResponse> {
  const fd = new FormData();
  fd.append('audio', audio);
  fd.append('context', JSON.stringify(context));

  const r = await fetch('/api/v1/voice/parse-visit', {
    method: 'POST',
    headers: authHeaders(), // 注意:不要手动设 Content-Type,fetch 会自动加 boundary
    body: fd,
    signal,
  });

  if (!r.ok) {
    let msg = `语音解析失败 (HTTP ${r.status})`;
    try {
      const j = await r.json();
      if (j.message) msg = typeof j.message === 'string' ? j.message : msg;
    } catch {
      /* 忽略 */
    }
    throw new Error(msg);
  }

  return r.json();
}
