import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Slider, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Visit, Pin, PinStatus } from '@pop/shared-types';
import {
  loadChinaMap,
  loadProvinceMap,
  provinceNameToCode,
} from '@/lib/china-map';
import { authHeaders } from '@/lib/api';
import { palette } from '@/tokens';

interface Props {
  /** 当前下钻到的省份 adcode;null / undefined = 全国视图 */
  provinceCode?: string | null;
  /** 切换下钻;null 表示回全国 */
  onProvinceChange?: (code: string | null) => void;
  /** 通用 region click 回调(下钻 / 省内点击都触发) */
  onRegionClick?: (info: {
    level: 'country' | 'province';
    code: string | null;
    name: string;
  }) => void;
  /** β.1 新增:点击 Visit 散点回调,传 visit.id */
  onVisitClick?: (visitId: string) => void;
  /** β.2 新增:点击 Pin 图钉回调,传 pin.id */
  onPinClick?: (pinId: string) => void;
}

interface LoadedInfo {
  key: string;
  name: string;
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_DEFAULT = 1.2;

const COLOR_HEX: Record<'red' | 'yellow' | 'green', string> = {
  red: palette.visit.red,
  yellow: palette.visit.yellow,
  green: palette.visit.green,
};
const COLOR_LABEL: Record<'red' | 'yellow' | 'green', string> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
};

const visitColorByRow = (v: Visit): string => {
  if (v.status === 'planned') return palette.visit.blue;
  if (v.status === 'cancelled') return 'rgba(180, 180, 180, 0.4)';
  return v.color ? COLOR_HEX[v.color as 'red' | 'yellow' | 'green'] : palette.visit.green;
};

const STATUS_LEGEND = [
  { color: palette.visit.red, label: '紧急' },
  { color: palette.visit.yellow, label: '层级提升' },
  { color: palette.visit.green, label: '常规' },
  { color: palette.visit.blue, label: '计划未执行(蓝点 β.3)' },
];

async function fetchVisits(): Promise<{ data: Visit[] }> {
  const r = await fetch('/api/v1/visits', {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('visits fetch fail');
  return r.json();
}

const PIN_STATUS_COLOR: Record<PinStatus, string> = {
  in_progress: '#cf1322',  // 红(antd red-7,跟 Visit 橙色拉开 + 醒目)
  completed: '#607D8B',    // 暗灰
  aborted: '#BDBDBD',      // 浅灰
};

const PIN_STATUS_OPACITY: Record<PinStatus, number> = {
  in_progress: 0.95,
  completed: 0.9,
  aborted: 0.5,
};

async function fetchPins(): Promise<{ data: Pin[] }> {
  const r = await fetch('/api/v1/pins', { headers: authHeaders() });
  if (!r.ok) throw new Error('pins fetch fail');
  return r.json();
}

export function MapCanvas({ provinceCode, onProvinceChange, onRegionClick, onVisitClick, onPinClick }: Props) {
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);
  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT);

  // β.1:从 API 拿真 Visit 数据
  const { data: visitsData } = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
    staleTime: 30_000,
  });
  const visits = visitsData?.data ?? [];

  // β.2:从 API 拿真 Pin 数据
  const { data: pinsResp } = useQuery({
    queryKey: ['pins'],
    queryFn: fetchPins,
  });
  const pins = pinsResp?.data ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setZoom(ZOOM_DEFAULT);
    const task: Promise<LoadedInfo> = provinceCode
      ? loadProvinceMap(provinceCode).then((geo) => ({
          key: `province_${provinceCode}`,
          name: geo.features[0]?.properties?.name ?? '省份',
        }))
      : loadChinaMap().then(() => ({ key: 'china', name: '中国' }));
    task
      .then((info) => { if (!cancelled) setLoaded(info); })
      .catch((err) => { console.error('[MapCanvas] geo load error', err); });
    return () => { cancelled = true; };
  }, [provinceCode]);

  const scatterData = useMemo(() =>
    visits
      .filter((v) => !provinceCode || v.provinceCode === provinceCode)
      .map((v) => ({
        value: [v.lng, v.lat, 1],
        itemStyle: { color: visitColorByRow(v) },
        name: `${v.cityName} · ${v.visitDate} · ${COLOR_LABEL[(v.color ?? 'green') as 'red' | 'yellow' | 'green']}`,
        visitId: v.id,
      })),
    [visits, provinceCode],
  );

  const pinsScatterData = useMemo(() =>
    pins
      .filter((p) => !provinceCode || p.provinceCode === provinceCode)
      .map((p) => ({
        value: [p.lng, p.lat, 1],
        itemStyle: {
          color: PIN_STATUS_COLOR[p.status],
          opacity: PIN_STATUS_OPACITY[p.status],
          shadowBlur: 8,
          shadowColor: 'rgba(0,0,0,0.4)',
        },
        name: p.title,
        pinId: p.id,
      })),
    [pins, provinceCode],
  );

  const option = useMemo(() => {
    if (!loaded) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: (p: { name?: string }) => p.name ?? '' },
      geo: {
        map: loaded.key,
        zoom,
        roam: false,
        label: {
          show: !provinceCode,
          fontSize: 10,
          color: 'rgba(139, 163, 199, 0.55)',
        },
        itemStyle: {
          areaColor: 'rgba(13, 31, 53, 0.85)',
          borderColor: 'rgba(0, 212, 255, 0.28)',
          borderWidth: 0.8,
          shadowColor: 'rgba(0, 212, 255, 0.15)',
          shadowBlur: 8,
        },
        emphasis: {
          label: { show: true, color: '#e6f4ff', fontWeight: 600, fontSize: 11 },
          itemStyle: {
            areaColor: 'rgba(0, 212, 255, 0.18)',
            borderColor: palette.primary,
            borderWidth: 1.5,
          },
        },
        select: { disabled: true },
      },
      series: [
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          symbolSize: provinceCode ? 14 : 8,
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            opacity: 0.95,
          },
          data: scatterData,
          z: 5,
        },
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          symbol: 'pin',
          // 用户拍 ×3 size:全国 14→42 / 省下钻 22→66(图钉醒目)
          symbolSize: provinceCode ? 66 : 42,
          data: pinsScatterData,
          z: 6,
          silent: false,
        },
      ],
    };
  }, [loaded, provinceCode, zoom, scatterData, pinsScatterData]);

  const onEvents = {
    click: (params: { componentType?: string; name?: string; data?: { visitId?: string; pinId?: string } }) => {
      if (params.componentType === 'series' && params.data?.visitId) {
        onVisitClick?.(params.data.visitId);
        return;
      }
      if (params.componentType === 'series' && params.data?.pinId) {
        onPinClick?.(params.data.pinId);
        return;
      }
      if (params.componentType !== 'geo' || !params.name) return;
      const name = params.name;
      if (!provinceCode) {
        const code = provinceNameToCode(name);
        if (code) {
          onProvinceChange?.(code);
          onRegionClick?.({ level: 'country', code, name });
        }
      } else {
        onRegionClick?.({ level: 'province', code: null, name });
      }
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 55% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 55%), #0a1628',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
        backgroundSize: '56px 56px', pointerEvents: 'none', opacity: 0.7,
      }} />

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      )}

      {/* 「返回全国」按钮 */}
      {provinceCode && loaded && (
        <Space style={{ position: 'absolute', top: 16, left: 332, zIndex: 5 }}>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => onProvinceChange?.(null)}>
            返回全国
          </Button>
          <span style={{
            padding: '6px 14px', borderRadius: 8,
            background: palette.bgPanel, border: `1px solid ${palette.border}`,
            color: palette.primary, fontWeight: 600, fontSize: 13,
          }}>
            {loaded.name}
          </span>
        </Space>
      )}

      {/* 4 色 legend(底部居中)*/}
      {loaded && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 5,
          padding: '12px 24px', background: palette.bgPanel, border: `1px solid ${palette.border}`,
          borderRadius: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', gap: 28, alignItems: 'center', fontSize: 14, color: palette.textBase,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        }}>
          {STATUS_LEGEND.map((s) => (
            <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: s.color, boxShadow: `0 0 6px ${s.color}`,
              }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* 右侧 zoom slider */}
      {loaded && (
        <div style={{
          position: 'absolute', right: 28, top: 80, zIndex: 6,
          padding: '12px 8px', background: palette.bgPanel, border: `1px solid ${palette.border}`,
          borderRadius: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        }}>
          <span style={{ fontSize: 11, color: palette.textMuted }}>{Math.round(zoom * 100)}%</span>
          <div style={{ height: 220 }}>
            <Slider
              vertical min={ZOOM_MIN} max={ZOOM_MAX} step={0.1}
              value={zoom}
              onChange={(v) => setZoom(typeof v === 'number' ? v : ZOOM_DEFAULT)}
              tooltip={{ formatter: (v) => `${Math.round((v ?? 1) * 100)}%` }}
            />
          </div>
          <Button type="text" size="small" onClick={() => setZoom(ZOOM_DEFAULT)}
            style={{ fontSize: 11, color: palette.textMuted, padding: '0 4px', height: 22 }}>
            复位
          </Button>
        </div>
      )}

      {loaded && option && (
        <ReactECharts option={option} notMerge style={{ width: '100%', height: '100%' }} onEvents={onEvents} />
      )}
    </div>
  );
}
