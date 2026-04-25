import { useState } from 'react';
import { Button, Card, Drawer, FloatButton, Space, Tag, Typography } from 'antd';
import {
  EnvironmentOutlined,
  FilterOutlined,
  PlusOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { palette } from '@/tokens';

const { Text, Title } = Typography;

export function LocalMap() {
  const [filterOpen, setFilterOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 112px)' }}>
      {/* 占位地图画布 · SVG 最小热力 + 拜访点 + 蓝点 + 图钉 */}
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
        onClick={() => setDetailOpen(true)}
      >
        <svg
          viewBox="0 0 800 500"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* 简化中国轮廓占位(几块灰色块,不是真地图) */}
          <path
            d="M120,140 Q260,80 400,120 T700,180 L720,260 Q620,320 480,300 T200,360 Q140,300 120,140 Z"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(0,212,255,0.18)"
            strokeWidth="1"
          />
          {/* 热力区涂色(关注区高浓度) */}
          <ellipse cx="280" cy="220" rx="70" ry="42" fill="rgba(192,57,43,0.28)" />
          <ellipse cx="500" cy="240" rx="58" ry="36" fill="rgba(250,173,20,0.24)" />
          <ellipse cx="380" cy="180" rx="48" ry="30" fill="rgba(82,196,26,0.20)" />
          {/* 拜访点(绿/黄/红 = PRD §6.5.2 走访颜色) */}
          <circle cx="265" cy="215" r="5" fill={palette.visit.red} />
          <circle cx="295" cy="230" r="5" fill={palette.visit.green} />
          <circle cx="385" cy="185" r="5" fill={palette.visit.green} />
          <circle cx="510" cy="245" r="5" fill={palette.visit.yellow} />
          <circle cx="465" cy="225" r="5" fill={palette.visit.green} />
          {/* 蓝点(政策机会) */}
          <circle cx="340" cy="200" r="6" fill={palette.visit.blue} stroke="#fff" strokeWidth="1" />
          <circle cx="540" cy="270" r="6" fill={palette.visit.blue} stroke="#fff" strokeWidth="1" />
          {/* 图钉 */}
          <g transform="translate(420,170)">
            <path d="M0,-10 L4,0 L0,12 L-4,0 Z" fill="#faad14" />
            <circle r="4" cy="-6" fill="#faad14" stroke="#fff" strokeWidth="0.5" />
          </g>
          <g transform="translate(610,210)">
            <path d="M0,-10 L4,0 L0,12 L-4,0 Z" fill="#faad14" />
            <circle r="4" cy="-6" fill="#faad14" stroke="#fff" strokeWidth="0.5" />
          </g>
        </svg>
        <Tag color="cyan" style={{ position: 'absolute', top: 16, right: 16 }}>
          属地大盘 · stub(高德 SDK 留 V0.3 接入)
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
        <FloatButton
          icon={<PlusOutlined />}
          tooltip="新增蓝点"
          type="primary"
        />
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
