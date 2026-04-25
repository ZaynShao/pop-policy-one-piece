import { useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Layout, Menu, Segmented, Space, Tag, Typography } from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  PushpinOutlined,
  SettingOutlined,
  SolutionOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';
import { sidebarItemsForRole } from '@/routes/role-default-route';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: 'GA 负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

const ICONS: Record<string, React.ReactNode> = {
  '/console/dashboard': <DashboardOutlined />,
  '/console/visits': <UnorderedListOutlined />,
  '/console/pins': <PushpinOutlined />,
  '/console/weekly': <SolutionOutlined />,
  '/console/export': <FileSearchOutlined />,
  '/console/tool-consumption': <BarChartOutlined />,
  '/console/my-consumption': <BarChartOutlined />,
  '/central/tools': <ToolOutlined />,
  '/central/themes': <AppstoreOutlined />,
  '/admin/users': <UserOutlined />,
  '/admin/roles': <SolutionOutlined />,
  '/admin/params': <SettingOutlined />,
  '/admin/audit': <AuditOutlined />,
  '/admin/tickets': <FileSearchOutlined />,
  '/admin': <DashboardOutlined />,
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const mapMode = location.pathname.startsWith('/map/policy') ? 'policy' : 'local';

  const sidebar = useMemo(
    () => (user ? sidebarItemsForRole(user.roleCode) : []),
    [user],
  );

  if (!user) return null;

  const onMapSwitch = (val: string | number) => {
    navigate(val === 'policy' ? '/map/policy' : '/map/local');
  };

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
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
        <Space size="large">
          <Text strong className="glow-title" style={{ fontSize: 18 }}>
            POP
          </Text>
          <Segmented
            value={mapMode}
            onChange={onMapSwitch}
            options={[
              { label: '属地大盘', value: 'local' },
              { label: '政策大盘', value: 'policy' },
            ]}
          />
        </Space>
        <Space size="middle">
          {user.roleCode === 'sys_admin' && (
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/admin')}
              style={{ color: palette.textBase }}
            >
              管理后台
            </Button>
          )}
          <Tag color="cyan" icon={<UserOutlined />}>
            {ROLE_LABEL[user.roleCode] ?? user.roleCode}
          </Tag>
          <Avatar size={32} icon={<UserOutlined />} />
          <Button icon={<LogoutOutlined />} size="small" onClick={onLogout}>
            登出
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={220}
          style={{
            background: palette.bgPanel,
            borderRight: `1px solid ${palette.border}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ background: 'transparent', border: 'none', padding: '8px 0' }}
            items={sidebar.map((it) => ({
              key: it.path,
              icon: ICONS[it.path] ?? <EnvironmentOutlined />,
              label: <Link to={it.path}>{it.label}</Link>,
            }))}
          />
        </Sider>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
