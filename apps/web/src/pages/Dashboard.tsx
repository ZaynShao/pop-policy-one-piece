import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { HealthDto } from '@pop/shared-types';
import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: 'GA 负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

const ROLE_COLOR: Record<string, string> = {
  sys_admin: 'magenta',
  lead: 'gold',
  pmo: 'purple',
  local_ga: 'green',
  central_ga: 'cyan',
};

interface RegionsRes {
  data: Array<{ code: string; name: string; level: string }>;
  meta: { count: number };
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await http.get<HealthDto>('/health')).data,
  });

  const provinces = useQuery({
    queryKey: ['regions', 'province'],
    queryFn: async () =>
      (await http.get<RegionsRes>('/regions', { params: { level: 'province' } }))
        .data,
  });

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', padding: 32 }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 1040 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Title level={1} className="glow-title" style={{ marginBottom: 4 }}>
              政策 One Piece · POP
            </Title>
            <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
              V0.1 · Week 2 起步 · 登录联调通过 · 界面布局按 PRD §6 协同拍定
            </Paragraph>
          </div>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            登出
          </Button>
        </header>

        {user.roleCode === 'sys_admin' ? (
          <Alert
            type="success"
            showIcon
            message="你当前是系统管理员 · CASL manage all · 全权限"
            description="开发期此账号可直接跑通所有业务路径。生产环境该账号会走 AuditLog 全量留痕(PRD §5.4 覆盖原则)。"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message={`你当前是业务角色「${ROLE_LABEL[user.roleCode] ?? user.roleCode}」`}
            description="PRD §5 权限矩阵尚未落完,某些写操作可能被 CASL 拦截。开发期跑通业务建议登出后用「系统管理员」账号。"
          />
        )}

        <Card
          className="glass-panel"
          title={<span style={{ color: palette.primary }}>当前用户</span>}
        >
          <Space size="large" align="start">
            <Avatar size={64} icon={<UserOutlined />} />
            <Descriptions column={1} size="small" style={{ flex: 1 }}>
              <Descriptions.Item label="显示名">
                <Text strong>{user.displayName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                <Tag color={ROLE_COLOR[user.roleCode] ?? 'default'}>
                  {ROLE_LABEL[user.roleCode] ?? user.roleCode}
                </Tag>
                <Text code style={{ marginLeft: 8 }}>
                  {user.roleCode}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
              <Descriptions.Item label="用户 ID">
                <Text code style={{ fontSize: 12 }}>
                  {user.id}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Card>

        <Card
          className="glass-panel"
          title={<span style={{ color: palette.primary }}>后端联通检查</span>}
        >
          <Space direction="vertical">
            <Space>
              <Text>API 健康:</Text>
              {health.isLoading && <Tag>检查中…</Tag>}
              {health.data && (
                <>
                  <Tag color="success">status: {health.data.status}</Tag>
                  <Tag color={health.data.db === 'ok' ? 'success' : 'error'}>
                    db: {health.data.db}
                  </Tag>
                </>
              )}
              {health.error && <Tag color="error">无法连通</Tag>}
            </Space>
            <Space>
              <Text>Region 数据:</Text>
              {provinces.isLoading && <Tag>加载中…</Tag>}
              {provinces.data && (
                <Tag color="success">省级 {provinces.data.meta.count} 条</Tag>
              )}
              {provinces.error && <Tag color="error">读取失败</Tag>}
            </Space>
          </Space>
        </Card>

        <Card
          className="glass-panel"
          title={<span style={{ color: palette.primary }}>下一步</span>}
        >
          <ol style={{ color: palette.textBase, lineHeight: 1.9, margin: 0 }}>
            <li>按 PRD §6 协同拍定首屏布局(地图 / 列表 / 工作台三区权重)</li>
            <li>Pin / PlanPoint / Visit 三张核心业务表 + API(PRD §4.3)</li>
            <li>GovOrg / GovContact K 模块(PRD §4.3.6)</li>
            <li>CASL 权限矩阵跟着业务实体落(PRD §5)</li>
          </ol>
        </Card>
      </Space>
    </div>
  );
}
