import { useState } from 'react';
import { Card, Checkbox, Drawer, Space, Tag, Typography } from 'antd';
import { palette } from '@/tokens';

const { Text } = Typography;

export function PolicyMap() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [themes, setThemes] = useState(['energy', 'manuf']);

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
          viewBox="0 0 800 500"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <path
            d="M120,140 Q260,80 400,120 T700,180 L720,260 Q620,320 480,300 T200,360 Q140,300 120,140 Z"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(0,212,255,0.18)"
            strokeWidth="1"
          />
          {/* 涂层色块 · 多主题(能源 / 制造 / 金融) · §6.5.4 深浅 */}
          {themes.includes('energy') && (
            <>
              <ellipse cx="260" cy="200" rx="80" ry="50" fill="rgba(0,212,255,0.32)" />
              <ellipse cx="380" cy="180" rx="60" ry="38" fill="rgba(0,212,255,0.20)" />
              <ellipse cx="540" cy="240" rx="70" ry="42" fill="rgba(0,212,255,0.12)" />
            </>
          )}
          {themes.includes('manuf') && (
            <>
              <ellipse cx="320" cy="260" rx="60" ry="38" fill="rgba(250,173,20,0.28)" />
              <ellipse cx="500" cy="220" rx="50" ry="32" fill="rgba(250,173,20,0.18)" />
            </>
          )}
          {themes.includes('finance') && (
            <ellipse cx="420" cy="220" rx="55" ry="36" fill="rgba(82,196,26,0.24)" />
          )}
          {/* 涂层点(政策机会) · §6.5.5 大小 */}
          <circle cx="270" cy="195" r="7" fill="#00d4ff" stroke="#fff" strokeWidth="1" />
          <circle cx="385" cy="180" r="5" fill="#00d4ff" stroke="#fff" strokeWidth="1" />
          <circle cx="545" cy="245" r="6" fill="#00d4ff" stroke="#fff" strokeWidth="1" />
          <circle cx="325" cy="265" r="5" fill="#faad14" stroke="#fff" strokeWidth="1" />
          <circle cx="505" cy="225" r="4" fill="#faad14" stroke="#fff" strokeWidth="1" />
          <circle cx="425" cy="225" r="6" fill="#52c41a" stroke="#fff" strokeWidth="1" />
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
            value={themes}
            onChange={(v) => setThemes(v as string[])}
          >
            <Space direction="vertical">
              <Checkbox value="energy">
                <span style={{ color: '#00d4ff' }}>● 能源</span>
              </Checkbox>
              <Checkbox value="manuf">
                <span style={{ color: '#faad14' }}>● 制造</span>
              </Checkbox>
              <Checkbox value="finance">
                <span style={{ color: '#52c41a' }}>● 金融</span>
              </Checkbox>
            </Space>
          </Checkbox.Group>
          <Card size="small">
            <Text style={{ fontSize: 12 }}>多涂层叠加 G28 MVP 不做(§6.6.2)</Text>
          </Card>
        </Space>
      </Drawer>
    </div>
  );
}
