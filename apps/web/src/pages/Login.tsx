import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import type { LoginResponseDto } from '@pop/shared-types';
import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

/**
 * R2-① 登录页 — V0.7+ 真登录(用户名 + 密码 bcrypt 校验)
 *
 * 默认管理员:sysadmin / pop2026(初次部署后 admin 应改密码)
 * 其他用户由 sysadmin 在「管理后台 / 用户管理」创建并分配角色
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const res = await http.post<LoginResponseDto>('/auth/login', values);
      setSession(res.data.accessToken, res.data.expiresAt, res.data.user);
      navigate(from ?? '/', { replace: true });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '登录失败,请稍后再试';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 420 }}>
        <header style={{ textAlign: 'center' }}>
          <Title level={1} className="glow-title" style={{ marginBottom: 8 }}>
            政策 One Piece · POP
          </Title>
          <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
            用户名 + 密码登录
          </Paragraph>
        </header>

        {error && <Alert type="error" message={error} showIcon closable onClose={() => setError(null)} />}

        <Card
          className="glass-panel"
          title={<span style={{ color: palette.primary }}>登录</span>}
        >
          <Form<LoginForm> layout="vertical" onFinish={handleSubmit} disabled={loading}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }, { max: 32 }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: palette.textMuted }} />}
                placeholder="username"
                autoComplete="username"
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
                { max: 64 },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: palette.textMuted }} />}
                placeholder="至少 6 位"
                autoComplete="current-password"
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>

          <Text
            type="secondary"
            style={{
              fontSize: 12,
              display: 'block',
              marginTop: 12,
              textAlign: 'center',
            }}
          >
            没有账号?<Tag color="processing" style={{ marginLeft: 4 }}>请联系管理员</Tag>
          </Text>
        </Card>

        <Text
          type="secondary"
          style={{ fontSize: 11, textAlign: 'center', display: 'block' }}
        >
          默认管理员:sysadmin / pop2026
        </Text>
      </Space>
    </div>
  );
}
