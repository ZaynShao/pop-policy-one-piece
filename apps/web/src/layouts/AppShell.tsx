import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Dropdown, Layout, Segmented, Space, Typography } from 'antd';
import {
  AppstoreOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { UserRoleCode } from '@pop/shared-types';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Header, Content } = Layout;
const { Text } = Typography;

/**
 * 全局 chrome 容器(对应 UI-LAYOUT-V1 §1.1 + §2 R1)。
 *
 * 实现要点:
 * - 顶栏 Logo onClick = **永远进大地图(/map/local)** — 让 ⚠️3「大盘切换控件回归」可达
 *   (§6.2 角色派发只用于登录后首次进入 / 重定向,不是 Logo 行为)
 * - 顶栏中央「大盘切换」是 view-context-aware 子控件,仅 /map/* 显示(R1-β)
 * - sys_admin 顶栏右侧多渲染 ⚙ 管理后台入口(§1.1.a + §1.4 ❌7)
 * - portal 三件套(toast / Modal / Spin)由 AntD ConfigProvider 全局提供,
 *   无需在此封装(对齐 §1.1.b)
 */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const isMapView = location.pathname.startsWith('/map/');
  const mapValue = location.pathname === '/map/policy' ? 'policy' : 'local';
  const isSysAdmin = user.roleCode === UserRoleCode.SysAdmin;

  const userMenu = {
    items: [
      { key: 'me', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/me') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: logout, danger: true },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh', background: palette.bgBase }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: palette.bgPanel,
          borderBottom: `1px solid ${palette.border}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* 左:Logo — 永远进大地图(⚠️3 拍板原意:让大盘切换控件回归) */}
        <div
          onClick={() => navigate('/map/local')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          aria-label="进入大地图"
        >
          <span style={{ fontSize: 22 }}>📍</span>
          <Text
            className="glow-title"
            style={{ color: palette.primary, fontSize: 20, fontWeight: 600 }}
          >
            POP
          </Text>
        </div>

        {/* 中:大盘切换(view-context-aware,仅 /map/* 显示) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {isMapView && (
            <Segmented
              value={mapValue}
              onChange={(v) => navigate(v === 'policy' ? '/map/policy' : '/map/local')}
              options={[
                { label: '属地大盘', value: 'local' },
                { label: '政策大盘', value: 'policy' },
              ]}
            />
          )}
        </div>

        {/* 右:工作台 / 个人中心(下拉) / sys_admin 后台 */}
        <Space size="middle">
          <Button
            type="text"
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/console')}
            style={{ color: palette.textBase }}
          >
            工作台
          </Button>
          {isSysAdmin && (
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/admin')}
              style={{ color: palette.textBase }}
            >
              管理后台
            </Button>
          )}
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <Avatar
              icon={<UserOutlined />}
              style={{ cursor: 'pointer', background: palette.primary }}
            />
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ padding: 0, position: 'relative' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
