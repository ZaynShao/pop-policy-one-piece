import { useEffect, useRef, useState } from 'react';
import { Button, message } from 'antd';
import { AudioOutlined, AudioMutedOutlined, LoadingOutlined } from '@ant-design/icons';
import type {
  VoiceParseVisitContext,
  VoiceParsedFields,
} from '@pop/shared-types';
import { fetchVoiceParseVisit } from '@/api/voice';

interface Props {
  /** 解析成功回调,parsed 里 null 字段表示模型未识别 */
  onParsed: (parsed: VoiceParsedFields, transcript: string) => void;
  /** 解析失败回调,展示友好提示用 */
  onError?: (msg: string) => void;
  /** 上下文获取函数(每次开始上传前调用,确保拿到最新值) */
  getContext: () => VoiceParseVisitContext;
  disabled?: boolean;
}

const MAX_SECONDS = 60;
const CLIENT_TIMEOUT_MS = 20_000; // 客户端兜底超时,后端是 15s

type State = 'idle' | 'recording' | 'parsing';

export function VoiceRecorderButton({
  onParsed,
  onError,
  getContext,
  disabled,
}: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const uploadTimeoutRef = useRef<number | null>(null);
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (uploadTimeoutRef.current) window.clearTimeout(uploadTimeoutRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000) as unknown as number;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async () => {
    if (!supported) {
      message.error('你的浏览器不支持录音(需要 MediaRecorder)');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;
      mr.start();
      recorderRef.current = mr;
      setState('recording');
      startTimer();
    } catch (e) {
      // 防止 getUserMedia 之后 MediaRecorder 构造抛错时 stream 泄漏(麦克风指示常亮)
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const err = e as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message.error('麦克风权限被拒,请到浏览器设置允许');
      } else if (err.name === 'NotFoundError') {
        message.error('没有可用的麦克风设备');
      } else {
        message.error(`录音启动失败:${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopTimer();
  };

  const handleStop = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState('parsing');

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size === 0) {
      message.error('录音为空,请重试');
      setState('idle');
      return;
    }

    const ctrl = new AbortController();
    uploadTimeoutRef.current = window.setTimeout(
      () => ctrl.abort(),
      CLIENT_TIMEOUT_MS,
    ) as unknown as number;

    try {
      const data = await fetchVoiceParseVisit(blob, getContext(), ctrl.signal);
      onParsed(data.parsed, data.transcript);
    } catch (e) {
      const msg =
        (e as Error).name === 'AbortError'
          ? 'AI 解析超时,可重试或手填'
          : (e as Error).message;
      message.error(msg);
      onError?.(msg);
    } finally {
      if (uploadTimeoutRef.current) {
        window.clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      setState('idle');
    }
  };

  const handleClick = () => {
    if (state === 'idle') start();
    else if (state === 'recording') stopRecording();
    // parsing 时按钮 disabled,点不了
  };

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // 三态 UI
  if (state === 'recording') {
    return (
      <Button
        type="primary"
        danger
        size="large"
        block
        icon={<AudioOutlined />}
        onClick={handleClick}
        style={{
          height: 64,
          fontSize: 16,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)',
          borderColor: '#ff4d4f',
          animation: 'pop-pulse 1s ease-in-out infinite',
        }}
      >
        🔴 录音中 {formatTime(seconds)} / {formatTime(MAX_SECONDS)} — 点击停止
      </Button>
    );
  }

  if (state === 'parsing') {
    return (
      <Button
        type="primary"
        danger
        size="large"
        block
        icon={<LoadingOutlined />}
        disabled
        style={{
          height: 64,
          fontSize: 16,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)',
          borderColor: '#ff4d4f',
          opacity: 0.8,
        }}
      >
        ⏳ AI 解析中 — 约 5-10 秒...
      </Button>
    );
  }

  // idle
  return (
    <Button
      type="primary"
      danger
      size="large"
      block
      icon={supported ? <AudioOutlined /> : <AudioMutedOutlined />}
      onClick={handleClick}
      disabled={!supported || disabled}
      style={{
        height: 64,
        fontSize: 16,
        fontWeight: 600,
        background: supported
          ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)'
          : undefined,
        borderColor: supported ? '#ff4d4f' : undefined,
      }}
    >
      🎙️ 语音录入 — 点击开始,说完再点停止
    </Button>
  );
}
