import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CrownOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  RocketOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { LoginResponseDto, UserRoleCode } from '@pop/shared-types';
import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

interface RoleOption {
  username: string;
  label: string;
  role: UserRoleCode;
  icon: React.ReactNode;
  desc: string;
  /** 强调此为"跑通业务"优先入口(CASL manage all) */
  isSuperRole?: boolean;
}

// 对齐 PRD §1.1-1.5 + migration 0003 seed;sysadmin 置顶并强调全权限
const ROLES: RoleOption[] = [
  {
    username: 'sysadmin',
    label: '系统管理员 · 开发跑通业务入口',
    role: 'sys_admin' as UserRoleCode,
    icon: <RocketOutlined />,
    desc: 'PRD §1.5 + §5.4 · 全权限(CASL manage all)· 所有业务路径一键走通',
    isSuperRole: true,
  },
  {
    username: 'lead',
    label: 'GA 负责人(王负责)',
    role: 'lead' as UserRoleCode,
    icon: <TeamOutlined />,
    desc: 'PRD §1.1 · 统筹视图 + Pin 编辑',
  },
  {
    username: 'pmo',
    label: 'PMO(钱 PMO)',
    role: 'pmo' as UserRoleCode,
    icon: <AppstoreOutlined />,
    desc: 'PRD §1.2 · 代负责人操作',
  },
  {
    username: 'local_ga',
    label: '属地 GA(赵属地)',
    role: 'local_ga' as UserRoleCode,
    icon: <EnvironmentOutlined />,
    desc: 'PRD §1.3 · 本地蓝点 / 拜访',
  },
  {
    username: 'central_ga',
    label: '中台 GA(孙中台)',
    role: 'central_ga' as UserRoleCode,
    icon: <CrownOutlined />,
    desc: 'PRD §1.4 · 工具 / 政策主题',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;

  const handleLogin = async (username: string) => {
    setLoadingUser(username);
    setError(null);
    try {
      const res = await http.post<LoginResponseDto>('/auth/login', {
        username,
      });
      setSession(res.data.accessToken, res.data.expiresAt, res.data.user);
      navigate(from ?? '/', { replace: true });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '登录失败,请稍后再试';
      setError(String(msg));
    } finally {
      setLoadingUser(null);
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
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 640 }}>
        <header style={{ textAlign: 'center' }}>
          <Title level={1} className="glow-title" style={{ marginBottom: 8 }}>
            政策 One Piece · POP
          </Title>
          <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
            V0.1 · 假 SSO 登录(PRD §8.1 MVP fallback)
          </Paragraph>
          <Tag color="processing" style={{ marginTop: 8 }}>
            点击一个角色即可登录 —— 无密码,仅开发环境
          </Tag>
        </header>

        {error && <Alert type="error" message={error} showIcon closable />}

        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={
            <Space direction="vertical" size={2}>
              <Text strong>开发期提示</Text>
              <Text style={{ fontSize: 12, color: palette.textMuted }}>
                "系统管理员"已开放 CASL manage all,**开发期跑通业务优先选它**。
                其他 4 个业务角色的写权限随 PRD §5 矩阵逐步落实,现在选它们可能在某些写操作上被 CASL 拦截。
              </Text>
            </Space>
          }
        />

        <Card
          className="glass-panel"
          title={<span style={{ color: palette.primary }}>选择角色</span>}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {ROLES.map((r) => {
              const btn = (
                <Button
                  key={r.username}
                  size="large"
                  block
                  type={r.isSuperRole ? 'primary' : 'default'}
                  icon={r.icon}
                  loading={loadingUser === r.username}
                  disabled={loadingUser !== null && loadingUser !== r.username}
                  onClick={() => handleLogin(r.username)}
                  style={{
                    height: 64,
                    textAlign: 'left',
                    padding: '0 16px',
                    ...(r.isSuperRole
                      ? {
                          boxShadow: `0 0 18px ${palette.primary}66`,
                          fontWeight: 600,
                        }
                      : {}),
                  }}
                >
                  <Space
                    direction="vertical"
                    size={0}
                    style={{ width: '100%' }}
                  >
                    <Space>
                      <Text strong style={r.isSuperRole ? { color: '#fff' } : {}}>
                        {r.label}
                      </Text>
                      {r.isSuperRole && (
                        <Tag color="magenta" style={{ marginLeft: 4 }}>
                          全权限
                        </Tag>
                      )}
                    </Space>
                    <Text
                      style={{
                        color: r.isSuperRole
                          ? 'rgba(255,255,255,0.85)'
                          : palette.textMuted,
                        fontSize: 12,
                      }}
                    >
                      {r.desc}
                    </Text>
                  </Space>
                </Button>
              );

              return r.isSuperRole ? (
                <Tooltip
                  key={r.username}
                  title="此账号由 migration 0003 seed,用于开发期快速走查所有业务路径。PRD §5 真权限矩阵落下后,其他 4 角色会逐步能写。"
                  placement="right"
                >
                  {btn}
                </Tooltip>
              ) : (
                btn
              );
            })}
          </Space>
        </Card>
      </Space>
    </div>
  );
}
