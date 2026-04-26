import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
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

/**
 * 综合看板 tab(/console/dashboard)— lead/pmo 默认 + sys_admin 开发期。
 *
 * V0.3 layout 骨架阶段:沿用原 Dashboard.tsx 的健康检查 + 当前用户 + 角色提示
 * 作为占位内容(让综合看板一打开就有真东西看,顺便自检后端联通)。
 *
 * V0.4+ 真业务:E 模块三轨进展 + 掉队预警 + 本周关键事件。
 */
export function DashboardTab() {
  const user = useAuthStore((s) => s.user);

  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await http.get<HealthDto>('/health')).data,
  });

  const provinces = useQuery({
    queryKey: ['regions', 'province'],
    queryFn: async () =>
      (await http.get<RegionsRes>('/regions', { params: { level: 'province' } })).data,
  });

  if (!user) return null;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={2} style={{ color: palette.primary, marginTop: 0 }}>
        综合看板
      </Title>

      {user.roleCode === 'sys_admin' ? (
        <Alert
          type="success"
          showIcon
          message="你当前是系统管理员 · CASL manage all · 全权限"
          description="开发期此账号可见全 tab。生产严格按权限矩阵(主要在管理后台)。"
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message={`你当前是「${ROLE_LABEL[user.roleCode] ?? user.roleCode}」`}
          description="V0.3 layout 骨架阶段;真业务 E 模块(三轨进展 + 掉队预警 + 本周关键事件)V0.4+ 实施。"
        />
      )}

      <Card className="glass-panel" title={<span style={{ color: palette.primary }}>当前用户</span>}>
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
          </Descriptions>
        </Space>
      </Card>

      <Card className="glass-panel" title={<span style={{ color: palette.primary }}>后端联通检查</span>}>
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
            {provinces.data && <Tag color="success">省级 {provinces.data.meta.count} 条</Tag>}
            {provinces.error && <Tag color="error">读取失败</Tag>}
          </Space>
        </Space>
      </Card>

      <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
        UI-LAYOUT-V1 §3.2 R2-② · 综合看板 tab(E 模块) · V0.3 layout 骨架阶段
      </Paragraph>
    </Space>
  );
}
