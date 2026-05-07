import { Card, Empty, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, Pin } from '@pop/shared-types';
import { fetchMyTodayItems } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

const VISIT_STATUS_TAG: Record<Visit['status'], { color: string; label: string }> = {
  planned: { color: 'blue', label: '计划' },
  completed: { color: 'green', label: '已拜访' },
  cancelled: { color: 'default', label: '已取消' },
};

const PIN_STATUS_TAG: Record<Pin['status'], { color: string; label: string }> = {
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已完成' },
  aborted: { color: 'default', label: '已终止' },
};

export function TodayPanel() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'today', user?.id],
    queryFn: () => fetchMyTodayItems(user!.id),
    enabled: !!user,
  });

  const visits = data?.visits ?? [];
  const pins = data?.pins ?? [];
  const total = visits.length + pins.length;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          今天 ({dayjs().format('YYYY-MM-DD')})
        </Title>
        <Text type="secondary">你今天新建了 {total} 条条目。</Text>
      </div>

      <Card size="small" title={`今日新建拜访/计划 (${visits.length})`}>
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : visits.length === 0 ? (
          <Empty
            description="今天还没新建拜访或计划"
            imageStyle={{ height: 40 }}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <List
            dataSource={visits}
            size="small"
            renderItem={(v) => {
              const tag = VISIT_STATUS_TAG[v.status];
              return (
                <List.Item>
                  <Space>
                    <Tag color={tag.color}>{tag.label}</Tag>
                    <Text>{v.title ?? v.contactPerson ?? '—'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(v.createdAt).format('HH:mm')}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Card size="small" title={`今日新建图钉 (${pins.length})`}>
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : pins.length === 0 ? (
          <Empty
            description="今天还没新建图钉"
            imageStyle={{ height: 40 }}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <List
            dataSource={pins}
            size="small"
            renderItem={(p) => {
              const tag = PIN_STATUS_TAG[p.status];
              return (
                <List.Item>
                  <Space>
                    <Tag color={tag.color}>{tag.label}</Tag>
                    <Text>{p.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(p.createdAt).format('HH:mm')}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Card size="small" title="今日下载/调用工具 (G1 工具池上线后填充)">
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          属地 GA 在拜访点详情页下载成品文档 / 调用接口的留痕。
          <br />
          依赖 G1 D 模块,目前 G1 未上线。
        </Paragraph>
      </Card>
    </Space>
  );
}
