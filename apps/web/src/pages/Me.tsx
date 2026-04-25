import { Card, Descriptions, Tabs, Typography } from 'antd';
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

/**
 * R2-④ 个人中心(全角色)— 顶部水平 Tabs 3 项。
 * UI-LAYOUT-V1 §3.4 + §6.1:1571-1574。
 */
export function Me() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Card className="glass-panel">
        <Title level={2} style={{ color: palette.primary, marginTop: 0 }}>
          个人中心
        </Title>
        <Tabs
          defaultActiveKey="profile"
          items={[
            {
              key: 'profile',
              label: '基本资料',
              children: (
                <Descriptions column={1}>
                  <Descriptions.Item label="显示名">
                    <Text strong>{user.displayName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="角色">
                    {ROLE_LABEL[user.roleCode] ?? user.roleCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'notifications',
              label: '通知设置',
              children: (
                <Paragraph style={{ color: palette.textMuted }}>
                  站内 / 邮件偏好 stub · V0.4+ 实施
                </Paragraph>
              ),
            },
            {
              key: 'activity',
              label: '最近活动',
              children: (
                <Paragraph style={{ color: palette.textMuted }}>
                  本人最近 N 条 AuditLog 视图(只读) stub · V0.4+ 实施
                </Paragraph>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
