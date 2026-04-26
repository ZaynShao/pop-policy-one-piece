import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button, Drawer, Tooltip, Typography } from 'antd';
import {
  LeftOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { MapCanvas } from '@/components/MapCanvas';
import { VisitDetailDrawer } from '@/components/VisitDetailDrawer';
import { palette } from '@/tokens';

const { Title, Paragraph } = Typography;

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
 * V0.4 c1:地图画布接真 ECharts(MapCanvas 组件,35 regions 多边形 + hover
 * 高亮 + click 下钻 console.log);属地态 / 政策态切换不重置 currentProvinceCode
 * (双子视图共用画布,§6.1 设计原则:1578)。业务图层(蓝点 / 图钉 / 涂层)
 * 留给 V0.5+。
 */
export function MapShell() {
  const location = useLocation();
  const isPolicy = location.pathname === '/map/policy';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [siderOpen, setSiderOpen] = useState(true);
  const [currentProvinceCode, setCurrentProvinceCode] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

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
      {/* 地图画布 — 真 ECharts(V0.4 c1) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas
          provinceCode={currentProvinceCode}
          onProvinceChange={setCurrentProvinceCode}
          onVisitClick={setSelectedVisitId}
        />
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
              ? '· 涂层勾选(多层级联)\n· 时间维度\n· (c3 待接 · C4/C8 涂层)'
              : '· 时间窗口\n· 区划筛选\n· 角色筛选\n· (β.1 真数据 · 32 条 seed Visit)'}
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

      {/* 大盘 Visit 详情抽屉(β.1 新加 · 散点 click 唤起) */}
      <VisitDetailDrawer
        visitId={selectedVisitId}
        onClose={() => setSelectedVisitId(null)}
      />

      {/* ➕📌 触发的占位抽屉(β.2 接 Pin 时替换) */}
      <Drawer
        title="新增 Pin / 蓝点(占位)"
        placement="right"
        width={400}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Paragraph>
          ➕📌 浮动按钮触发占位 — β.2 接 Pin 实体后替换为创建 Pin 表单,
          β.3 接蓝点(PlanPoint)后扩展计划点录入。
        </Paragraph>
      </Drawer>

      <Outlet />
    </div>
  );
}
