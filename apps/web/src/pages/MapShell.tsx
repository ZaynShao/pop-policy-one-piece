import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button, Drawer, Tooltip, Typography } from 'antd';
import {
  EnvironmentOutlined,
  LeftOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

/**
 * R2-① 大盘视图 layout(/map/local + /map/policy 共用画布)。
 *
 * UI-LAYOUT-V1 §3.1 关键约束:
 * - 双子视图共用画布,切换仅图层 + 左面板(底图状态保持) — §6.1 设计原则:1578
 * - 左面板 = **absolute 浮动玻璃面板**,**不挤压地图**(用户拍 2026-04-25 晚)
 * - ➕📌 浮动按钮 = **圆形图标按钮**(shape="circle" size="large"),
 *   absolute 叠层,贴地图画布内部右下角(§3.6 第 1.5 条 + 用户拍 圆形)
 * - 右抽屉默认收起,点击点(蓝点 / 图钉 / 涂层点)从右滑出
 *
 * V0.3 骨架阶段:地图画布用占位 div(V0.4 接真地图)。
 */
export function MapShell() {
  const location = useLocation();
  const isPolicy = location.pathname === '/map/policy';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [siderOpen, setSiderOpen] = useState(true);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 64px)',
        background: palette.bgBase,
        overflow: 'hidden',
      }}
    >
      {/* 地图画布占位 — 铺满整层(view-local) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: palette.textMuted,
        }}
      >
        <EnvironmentOutlined style={{ fontSize: 64, color: palette.primary, opacity: 0.4 }} />
        <Text style={{ color: palette.textMuted, marginTop: 16 }}>
          地图画布占位 · 35 regions 底图待接(V0.4)
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 4 }}>
          当前态:{isPolicy ? '政策大盘 · 涂层 + 涂层点' : '属地大盘 · 热力 + 拜访点 + 蓝点 + 图钉'}
        </Text>
      </div>

      {/* 左面板 — absolute 浮动玻璃面板,不挤压地图(用户拍) */}
      {siderOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            bottom: 16,
            width: 280,
            padding: 16,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            background: palette.bgPanel,
            border: `1px solid ${palette.border}`,
            borderRadius: 12,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Title level={5} style={{ color: palette.primary, marginTop: 0 }}>
            {isPolicy ? '政策大盘 · 涂层勾选' : '属地大盘 · 热力筛选'}
          </Title>
          <Paragraph style={{ color: palette.textMuted, fontSize: 12, whiteSpace: 'pre-line' }}>
            {isPolicy
              ? '· 涂层勾选(多层级联)\n· 时间维度\n· (V0.4 接真涂层)'
              : '· 时间窗口\n· 区划筛选\n· 角色筛选\n· (V0.4 接真热力)'}
          </Paragraph>
        </div>
      )}

      {/* 左面板 toggle 按钮 — 始终在面板右边缘外的垂直中间(把手位置) */}
      <Tooltip title={siderOpen ? '收起左面板' : '展开左面板'} placement="right">
        <Button
          type="primary"
          icon={siderOpen ? <LeftOutlined /> : <RightOutlined />}
          onClick={() => setSiderOpen((v) => !v)}
          aria-label={siderOpen ? '收起左面板' : '展开左面板'}
          style={{
            position: 'absolute',
            left: 16 + 280, // 面板右边缘 = 16 + 280 = 296,按钮挨着面板右侧
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 64,
            padding: 0,
            borderRadius: '0 8px 8px 0', // 右半圆角(把手风)
            zIndex: 11,
          }}
        />
      </Tooltip>

      {/* ➕📌 圆形浮动按钮组 — absolute 叠层贴画布内部右下角 */}
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 10,
        }}
      >
        <Tooltip title="新增蓝点" placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            aria-label="新增蓝点"
          />
        </Tooltip>
        <Tooltip title="新增图钉" placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<PushpinOutlined />}
            onClick={() => setDrawerOpen(true)}
            aria-label="新增图钉"
          />
        </Tooltip>
      </div>

      {/* 右抽屉:点详情面板(默认收起) */}
      <Drawer
        title="点详情面板(占位)"
        placement="right"
        width={400}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Paragraph>
          UI-LAYOUT-V1 §3.1 R2-① 右抽屉占位。生产实现:点击地图上的蓝点 / 图钉 / 涂层点唤起,
          含 B15(属地)/ C11(政策)工具级联。
        </Paragraph>
      </Drawer>

      <Outlet />
    </div>
  );
}
