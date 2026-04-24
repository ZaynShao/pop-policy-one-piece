import { Layout, Button, Space } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation } from 'react-router-dom';
import ModeSwitch from '@/components/header/ModeSwitch';
import UserMenu from '@/components/header/UserMenu';

const { Header, Content } = Layout;

export default function MainLayout() {
  const location = useLocation();
  const isWorkbench = location.pathname.startsWith('/workbench');

  return (
    <Layout style={{ height: '100vh', background: 'transparent' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(7, 15, 31, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
          boxShadow: '0 1px 16px rgba(0, 212, 255, 0.12)',
          height: 56,
          lineHeight: '56px',
          zIndex: 20,
        }}
      >
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          <Space size={10}>
            <span style={{ fontSize: 22 }}>🗺️</span>
            <span
              className="glow-title"
              style={{ fontWeight: 700, fontSize: 18 }}
            >
              政策 One Piece
            </span>
            <span className="demo-badge">DEMO</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              属地政策大地图
            </span>
          </Space>
        </Link>
        {!isWorkbench && <ModeSwitch />}
        <Space size="middle">
          <Link to="/workbench/expansion">
            <Button type="text" icon={<AppstoreOutlined />}>
              工作台
            </Button>
          </Link>
          <UserMenu />
        </Space>
      </Header>
      <Content style={{ position: 'relative', overflow: 'hidden' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
