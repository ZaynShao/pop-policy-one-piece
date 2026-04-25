import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { CONSOLE_TABS, visibleTabsForRole } from '@/lib/console-tabs';
import { palette } from '@/tokens';

const { Sider, Content } = Layout;

/**
 * R2-② 工作台 layout(view-local sidebar = tab 切换器)。
 *
 * UI-LAYOUT-V1 §3.2 关键约束:
 * - sidebar 是 view-local 视图 ② 的 tab 切换器,不是全局 chrome(R2 v1 翻车点钉死)
 * - tab 集合按 user.roleCode 过滤(§6.1:1579 + §3.2 5 角色矩阵)
 * - 关系档案为父项,内含机构 + 关键人(§6.1:1551-1553)
 */
export function Console() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const menuItems: MenuProps['items'] = useMemo(() => {
    if (!user) return [];
    const visible = visibleTabsForRole(user.roleCode);
    const groups = visible.filter((t) => t.isGroup);
    const leaves = visible.filter((t) => !t.isGroup && !t.parent);

    const flatItems: MenuProps['items'] = leaves
      .filter((t) => t.path)
      .map((t) => ({ key: t.path!, label: t.label }));

    const groupItems: MenuProps['items'] = groups.map((g) => ({
      key: g.key,
      label: g.label,
      children: visible
        .filter((t) => t.parent === g.key)
        .map((c) => ({ key: c.path!, label: c.label })),
    }));

    return [...flatItems, ...groupItems];
  }, [user]);

  const selectedKeys = useMemo(() => {
    const match = CONSOLE_TABS.find((t) => t.path === location.pathname);
    return match?.path ? [match.path] : [];
  }, [location.pathname]);

  const openKeys = useMemo(() => {
    const match = CONSOLE_TABS.find((t) => t.path === location.pathname);
    return match?.parent ? [match.parent] : [];
  }, [location.pathname]);

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
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
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
