import { Avatar, Dropdown, Space, Tag } from 'antd';
import { UserOutlined, LogoutOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABEL } from '@/types';

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'workbench',
            icon: <AppstoreOutlined />,
            label: '工作台',
            onClick: () => navigate('/workbench/expansion'),
          },
          { type: 'divider' },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            onClick: () => {
              logout();
              navigate('/login', { replace: true });
            },
          },
        ],
      }}
    >
      <Space style={{ cursor: 'pointer' }}>
        <Avatar icon={<UserOutlined />} />
        <span>{user.nickname}</span>
        <Tag>{ROLE_LABEL[user.role]}</Tag>
      </Space>
    </Dropdown>
  );
}
