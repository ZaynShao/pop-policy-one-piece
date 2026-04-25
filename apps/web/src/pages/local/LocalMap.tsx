import { useState } from 'react';
import { Card, Drawer, FloatButton, Space, Tag, Typography } from 'antd';
import {
  FilterOutlined,
  PlusOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { palette } from '@/tokens';
import { CHINA_PATH, CHINA_VIEWBOX, CITIES, lonLatToSvg } from '@/lib/china-path';

const { Text, Title } = Typography;

const VISIT_POINTS: Array<{
  city: keyof typeof CITIES;
  status: 'green' | 'yellow' | 'red';
}> = [
  { city: 'shanghai', status: 'green' },
  { city: 'hangzhou', status: 'green' },
  { city: 'beijing', status: 'yellow' },
  { city: 'guangzhou', status: 'red' },
  { city: 'chengdu', status: 'green' },
  { city: 'wuhan', status: 'yellow' },
];

const BLUE_PIN_CITIES: Array<keyof typeof CITIES> = ['xian', 'chongqing'];
const FLAG_PIN_CITIES: Array<keyof typeof CITIES> = ['shenzhen'];

const STATUS_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: palette.visit.green,
  yellow: palette.visit.yellow,
  red: palette.visit.red,
};

// 热力区(经纬度中心 + 度数半径,占位 demo)
const HOTSPOTS: Array<{
  center: [number, number];
  rxLng: number;
  ryLat: number;
  fill: string;
  name: string;
}> = [
  { center: [120.5, 30.8], rxLng: 2.6, ryLat: 1.6, fill: 'rgba(192,57,43,0.30)', name: '长三角' },
  { center: [113.5, 23.0], rxLng: 1.8, ryLat: 1.2, fill: 'rgba(250,173,20,0.26)', name: '珠三角' },
  { center: [105.5, 30.0], rxLng: 2.5, ryLat: 1.4, fill: 'rgba(82,196,26,0.22)', name: '成渝' },
  { center: [116.5, 39.5], rxLng: 2.0, ryLat: 1.5, fill: 'rgba(0,212,255,0.20)', name: '京津冀' },
];

export function LocalMap() {
  const [filterOpen, setFilterOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 112px)' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 30% 40%, rgba(0,212,255,0.06), transparent 60%), radial-gradient(circle at 70% 60%, rgba(0,212,255,0.04), transparent 60%), #08111e',
          borderRadius: 12,
          border: `1px solid ${palette.border}`,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={CHINA_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
          onClick={() => setDetailOpen(true)}
        >
          {/* 中国国境(simplified china geojson · ~3.6KB · V0.3 接高德 SDK 时移除) */}
          <path
            d={CHINA_PATH}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(0,212,255,0.32)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* 热力区(关注区高浓度) */}
          {HOTSPOTS.map((h) => {
            const [cx, cy] = lonLatToSvg(h.center[0], h.center[1]);
            const [rxX] = lonLatToSvg(h.center[0] + h.rxLng, h.center[1]);
            const [, ryY] = lonLatToSvg(h.center[0], h.center[1] + h.ryLat);
            return (
              <ellipse
                key={h.name}
                cx={cx}
                cy={cy}
                rx={Math.abs(rxX - cx)}
                ry={Math.abs(ryY - cy)}
                fill={h.fill}
              />
            );
          })}
          {/* 拜访点 · §6.5.2 走访颜色 */}
          {VISIT_POINTS.map((p, i) => {
            const [cx, cy] = lonLatToSvg(...CITIES[p.city].coord);
            return <circle key={i} cx={cx} cy={cy} r={5} fill={STATUS_COLOR[p.status]} />;
          })}
          {/* 蓝点 · 政策机会 */}
          {BLUE_PIN_CITIES.map((c) => {
            const [cx, cy] = lonLatToSvg(...CITIES[c].coord);
            return (
              <circle
                key={c}
                cx={cx}
                cy={cy}
                r={6}
                fill={palette.visit.blue}
                stroke="#fff"
                strokeWidth={1}
              />
            );
          })}
          {/* 图钉 */}
          {FLAG_PIN_CITIES.map((c) => {
            const [cx, cy] = lonLatToSvg(...CITIES[c].coord);
            return (
              <g key={c} transform={`translate(${cx},${cy})`}>
                <path d="M0,-12 L5,0 L0,14 L-5,0 Z" fill="#faad14" />
                <circle r={5} cy={-7} fill="#faad14" stroke="#fff" strokeWidth={0.5} />
              </g>
            );
          })}
        </svg>
        <Tag color="cyan" style={{ position: 'absolute', top: 16, right: 16 }}>
          属地大盘 · stub(simplified china geojson 占位 / 高德 SDK 留 V0.3)
        </Tag>
        <Space
          size="small"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: palette.bgPanel,
            padding: '6px 12px',
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Tag color={palette.visit.green}>● 已访</Tag>
          <Tag color={palette.visit.yellow}>● 待访</Tag>
          <Tag color={palette.visit.red}>● 逾期</Tag>
          <Tag color={palette.visit.blue}>● 蓝点</Tag>
          <Tag color="orange">📌 图钉</Tag>
        </Space>
      </div>

      {/* 左抽屉 · 筛选 */}
      <Drawer
        title="筛选"
        placement="left"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        mask={false}
        width={240}
        getContainer={false}
        rootStyle={{ position: 'absolute' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>关注区</Text>
            <div><Tag>全域</Tag><Tag>关注区 A</Tag><Tag>关注区 B</Tag></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>时间窗</Text>
            <div><Tag>近 30 天</Tag><Tag>近 90 天</Tag></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>业务类型</Text>
            <div><Tag>能源</Tag><Tag>制造</Tag><Tag>金融</Tag></div>
          </div>
          <Tag>占位 · V0.3 接入真筛选</Tag>
        </Space>
      </Drawer>

      {/* 右抽屉 · 点详情 */}
      <Drawer
        title="拜访点详情"
        placement="right"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        mask={false}
        width={320}
        getContainer={false}
        rootStyle={{ position: 'absolute' }}
      >
        <Card size="small">
          <Title level={5} style={{ marginTop: 0 }}>杭州市发改委</Title>
          <Text type="secondary">区划:330100 · 类型:能源</Text>
          <div style={{ marginTop: 12 }}>
            <Tag color="green">已访</Tag>
            <Text style={{ fontSize: 12 }}>2026-04-20</Text>
          </div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>占位 · V0.3 接 Visit API</Text>
          </div>
        </Card>
      </Drawer>

      {/* 右下 FAB */}
      <FloatButton.Group shape="circle" style={{ right: 24, bottom: 24 }}>
        <FloatButton icon={<PlusOutlined />} tooltip="新增蓝点" type="primary" />
        <FloatButton icon={<PushpinOutlined />} tooltip="新增图钉" />
        <FloatButton
          icon={<FilterOutlined />}
          tooltip="筛选"
          onClick={() => setFilterOpen(true)}
        />
      </FloatButton.Group>
    </div>
  );
}
