import { Avatar, Button, List, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABEL } from '@/types';
import { UserOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const ROLE_COLOR: Record<string, string> = {
  ga: 'geekblue',
  pmo: 'gold',
  lead: 'magenta',
  central_ga: 'cyan',
  exec: 'purple',
};

export default function Login() {
  const users = useAuthStore((s) => s.users);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const onPick = (id: string) => {
    login(id);
    navigate('/', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(0, 212, 255, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(114, 46, 209, 0.12) 0%, transparent 50%), #0a1628',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景网格线 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />
      <div
        className="glass-panel"
        style={{
          width: 680,
          maxWidth: '100%',
          padding: 36,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={10}>
            <span style={{ fontSize: 28 }}>🗺️</span>
            <Title level={3} className="glow-title" style={{ margin: 0 }}>
              政策 One Piece
            </Title>
            <span className="demo-badge">DEMO</span>
          </Space>
          <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
            属地政策大地图 · 演示原型（选择一个角色进入）
          </Paragraph>
          <Text style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            数据为演示种子，实际上线后将接入政策知识库与 GA 团队工作记录
          </Text>
        </Space>
        <List
          style={{ marginTop: 28 }}
          dataSource={users}
          split={false}
          renderItem={(u) => (
            <List.Item
              style={{
                padding: '12px 14px',
                marginBottom: 8,
                background: 'rgba(0, 212, 255, 0.04)',
                border: '1px solid rgba(0, 212, 255, 0.1)',
                borderRadius: 8,
                transition: 'all 0.2s',
              }}
              actions={[
                <Button
                  key="enter"
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                  onClick={() => onPick(u.id)}
                >
                  进入
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    style={{
                      background: 'rgba(0, 212, 255, 0.15)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                    }}
                  />
                }
                title={
                  <Space>
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {u.nickname}
                    </Text>
                    <Tag color={ROLE_COLOR[u.role]}>{ROLE_LABEL[u.role]}</Tag>
                  </Space>
                }
                description={
                  <Text style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {u.email}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
