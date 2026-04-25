import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { UserRoleCode } from '@pop/shared-types';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_PAGES } from '@/lib/admin-pages';
import { homeForRole } from '@/lib/role-home';
import { palette } from '@/tokens';

const { Sider, Content } = Layout;

/**
 * R2-③ 管理后台 layout(sys_admin only)。
 *
 * UI-LAYOUT-V1 §3.3 关键约束:
 * - 仅 sys_admin 可达(§1.4 ❌7);非 sys_admin 重定向到角色默认首屏
 * - 与工作台 sidebar 是不同视图的不同组件实例,不复用(§1.4 ❌5)
 */
export function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;
  if (user.roleCode !== UserRoleCode.SysAdmin) {
    return <Navigate to={homeForRole(user.roleCode)} replace />;
  }

  const items = ADMIN_PAGES.map((p) => ({
    key: p.path,
    label: p.ref ? `${p.label}(${p.ref})` : p.label,
  }));

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', background: palette.bgBase }}>
      <Sider
        width={220}
        style={{
          background: palette.bgPanel,
          borderRight: `1px solid ${palette.border}`,
        }}
      >
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </Sider>
      <Content style={{ padding: 16, overflow: 'auto' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
