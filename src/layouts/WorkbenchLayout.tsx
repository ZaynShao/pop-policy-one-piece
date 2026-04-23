import { Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  UnorderedListOutlined,
  TeamOutlined,
  AppstoreAddOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;

export default function WorkbenchLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { key: '/workbench/expansion', icon: <UnorderedListOutlined />, label: '拓展清单' },
    { key: '/workbench/users', icon: <TeamOutlined />, label: '成员' },
    { key: '/workbench/toolkits', icon: <AppstoreAddOutlined />, label: '工具箱' },
    { key: '/workbench/history', icon: <HistoryOutlined />, label: '历史工具包' },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <Sider
        width={200}
        style={{
          background: 'rgba(7, 15, 31, 0.85)',
          borderRight: '1px solid rgba(0, 212, 255, 0.15)',
        }}
        breakpoint="md"
        collapsedWidth={64}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, paddingTop: 12 }}
        />
      </Sider>
      <Content style={{ background: 'transparent', overflowY: 'auto' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
