import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button, Drawer, Layout, Typography } from 'antd';
import { EnvironmentOutlined, PlusOutlined, PushpinOutlined } from '@ant-design/icons';
import { palette } from '@/tokens';

const { Sider, Content } = Layout;
const { Title, Paragraph, Text } = Typography;

/**
 * R2-① 大盘视图 layout(/map/local + /map/policy 共用画布)。
 *
 * UI-LAYOUT-V1 §3.1 关键约束:
 * - 双子视图共用画布,切换仅图层 + 左面板(底图状态保持) — §6.1 设计原则:1578
 * - ➕📌 浮动按钮 = absolute 定位,叠在地图画布内部右下角(§3.6 第 1.5 条,用户拍)
 * - 右抽屉默认收起,点击点(蓝点 / 图钉 / 涂层点)从右滑出
 *
 * V0.3 骨架阶段:地图画布用占位 div(V0.4 接真地图)。
 */
export function MapShell() {
  const location = useLocation();
  const isPolicy = location.pathname === '/map/policy';
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', background: palette.bgBase }}>
      <Sider
        width={280}
        collapsible
        style={{
          background: palette.bgPanel,
          borderRight: `1px solid ${palette.border}`,
        }}
      >
        <div style={{ padding: 16 }}>
          <Title level={5} style={{ color: palette.primary, marginTop: 0 }}>
            {isPolicy ? '政策大盘 · 涂层勾选' : '属地大盘 · 热力筛选'}
          </Title>
          <Paragraph style={{ color: palette.textMuted, fontSize: 12 }}>
            {isPolicy
              ? '· 涂层勾选(多层级联)\n· 时间维度\n· (V0.4 接真涂层)'
              : '· 时间窗口\n· 区划筛选\n· 角色筛选\n· (V0.4 接真热力)'}
          </Paragraph>
        </div>
      </Sider>

      <Content
        style={{
          position: 'relative',
          margin: 16,
          background: palette.bgPanel,
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* 地图画布占位 */}
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

        {/* ➕📌 浮动按钮组(absolute 叠层,贴地图画布内部右下角 — §3.6 第 1.5 条) */}
        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 10,
          }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            新增蓝点
          </Button>
          <Button type="primary" icon={<PushpinOutlined />} onClick={() => setDrawerOpen(true)}>
            新增图钉
          </Button>
        </div>

        {/* 右抽屉:点详情面板(默认收起;V0.3 用「新增」按钮触发占位) */}
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
      </Content>
    </Layout>
  );
}
