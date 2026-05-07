import { Card, Descriptions, Tabs, Typography } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';
import { TodayPanel } from '@/components/me/TodayPanel';
import { MyItemsPanel } from '@/components/me/MyItemsPanel';
import { MyConsumptionsPanel } from '@/components/me/MyConsumptionsPanel';

const { Title, Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: 'GA 负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

/**
 * 个人工作台 — G6 落地后 4 tab:
 *   today      F1 当日动作
 *   items      F2 我的条目
 *   consumptions F4 我的消费记录(stub,等 G1)
 *   profile    F6 基本资料(原有)
 *
 * F3 我的产出(中台 GA 专用)目前不做(中台 GA 角色虚位,见 spec 2026-05-07)。
 * F5 待办事项 P1,不做。
 */
export function Me() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Card className="glass-panel">
        <Title level={2} style={{ color: palette.primary, marginTop: 0 }}>
          个人工作台
        </Title>
        <Tabs
          defaultActiveKey="today"
          items={[
            {
              key: 'today',
              label: '当日动作',
              children: <TodayPanel />,
            },
            {
              key: 'items',
              label: '我的条目',
              children: <MyItemsPanel />,
            },
            {
              key: 'consumptions',
              label: '我的消费记录',
              children: <MyConsumptionsPanel />,
            },
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
          ]}
        />
      </Card>
    </div>
  );
}
