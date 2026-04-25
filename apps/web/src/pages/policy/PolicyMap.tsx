import { useState } from 'react';
import { Card, Checkbox, Drawer, Space, Tag, Typography } from 'antd';
import { palette } from '@/tokens';
import { CHINA_PATH, CHINA_VIEWBOX, CITIES, lonLatToSvg } from '@/lib/china-path';

const { Text } = Typography;

type ThemeKey = 'energy' | 'manuf' | 'finance';

interface ThemeOverlay {
  key: ThemeKey;
  label: string;
  color: string;
  fillStrong: string;
  fillMid: string;
  fillWeak: string;
  /** [中心 lon, 中心 lat, 度数半径 lng, 度数半径 lat](强 / 中 / 弱 三层) */
  blobs: Array<[number, number, number, number, 'strong' | 'mid' | 'weak']>;
  /** 涂层点(政府机构所在城市) */
  points: Array<{ city: keyof typeof CITIES; size: number }>;
}

const THEMES: ThemeOverlay[] = [
  {
    key: 'energy',
    label: '能源',
    color: '#00d4ff',
    fillStrong: 'rgba(0,212,255,0.34)',
    fillMid: 'rgba(0,212,255,0.20)',
    fillWeak: 'rgba(0,212,255,0.12)',
    blobs: [
      [120.5, 30.8, 2.6, 1.6, 'strong'],
      [113.5, 22.8, 2.0, 1.4, 'mid'],
      [105.5, 30.0, 2.4, 1.5, 'weak'],
    ],
    points: [
      { city: 'hangzhou', size: 7 },
      { city: 'shanghai', size: 6 },
      { city: 'guangzhou', size: 6 },
      { city: 'chengdu', size: 5 },
    ],
  },
  {
    key: 'manuf',
    label: '制造',
    color: '#faad14',
    fillStrong: 'rgba(250,173,20,0.30)',
    fillMid: 'rgba(250,173,20,0.18)',
    fillWeak: 'rgba(250,173,20,0.10)',
    blobs: [
      [114.3, 30.6, 2.0, 1.3, 'strong'],
      [113.5, 22.8, 1.6, 1.0, 'mid'],
    ],
    points: [
      { city: 'wuhan', size: 6 },
      { city: 'shenzhen', size: 5 },
    ],
  },
  {
    key: 'finance',
    label: '金融',
    color: '#52c41a',
    fillStrong: 'rgba(82,196,26,0.28)',
    fillMid: 'rgba(82,196,26,0.16)',
    fillWeak: 'rgba(82,196,26,0.10)',
    blobs: [
      [116.4, 39.9, 1.8, 1.4, 'strong'],
      [121.5, 31.2, 1.6, 1.2, 'strong'],
    ],
    points: [
      { city: 'beijing', size: 6 },
      { city: 'shanghai', size: 6 },
    ],
  },
];

export function PolicyMap() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [active, setActive] = useState<ThemeKey[]>(['energy', 'manuf']);

  const visibleThemes = THEMES.filter((t) => active.includes(t.key));

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 112px)' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.05), transparent 60%), #08111e',
          borderRadius: 12,
          border: `1px solid ${palette.border}`,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={CHINA_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* 中国国境 */}
          <path
            d={CHINA_PATH}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(0,212,255,0.32)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* 涂层色块(多主题深浅,§6.5.4) */}
          {visibleThemes.map((t) =>
            t.blobs.map(([lng, lat, rxLng, ryLat, level], i) => {
              const [cx, cy] = lonLatToSvg(lng, lat);
              const [rxX] = lonLatToSvg(lng + rxLng, lat);
              const [, ryY] = lonLatToSvg(lng, lat + ryLat);
              const fill =
                level === 'strong' ? t.fillStrong : level === 'mid' ? t.fillMid : t.fillWeak;
              return (
                <ellipse
                  key={`${t.key}-${i}`}
                  cx={cx}
                  cy={cy}
                  rx={Math.abs(rxX - cx)}
                  ry={Math.abs(ryY - cy)}
                  fill={fill}
                />
              );
            }),
          )}
          {/* 涂层点 · §6.5.5 */}
          {visibleThemes.map((t) =>
            t.points.map((p) => {
              const [cx, cy] = lonLatToSvg(...CITIES[p.city].coord);
              return (
                <circle
                  key={`${t.key}-${p.city}`}
                  cx={cx}
                  cy={cy}
                  r={p.size}
                  fill={t.color}
                  stroke="#fff"
                  strokeWidth={1}
                />
              );
            }),
          )}
        </svg>
        <Tag color="cyan" style={{ position: 'absolute', top: 16, right: 16 }}>
          政策大盘 · stub(底图状态保持,§6.1)
        </Tag>
      </div>

      <Drawer
        title="政策主题"
        placement="left"
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        mask={false}
        width={240}
        getContainer={false}
        rootStyle={{ position: 'absolute' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text type="secondary" style={{ fontSize: 12 }}>勾选(可多选叠加)</Text>
          <Checkbox.Group
            value={active}
            onChange={(v) => setActive(v as ThemeKey[])}
          >
            <Space direction="vertical">
              {THEMES.map((t) => (
                <Checkbox key={t.key} value={t.key}>
                  <span style={{ color: t.color }}>● {t.label}</span>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
          <Card size="small">
            <Text style={{ fontSize: 12 }}>
              多涂层叠加 G28 MVP 不做(§6.6.2)
            </Text>
          </Card>
        </Space>
      </Drawer>
    </div>
  );
}
