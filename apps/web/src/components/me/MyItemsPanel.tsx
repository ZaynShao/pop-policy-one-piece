import { useState } from 'react';
import { Card, Empty, List, Segmented, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, Pin } from '@pop/shared-types';
import { fetchMyAllItems } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

type Tab = 'visits' | 'pins';

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

function groupBy<T, K extends string>(arr: T[], key: (x: T) => K): Record<K, T[]> {
  return arr.reduce(
    (acc, x) => {
      const k = key(x);
      (acc[k] ??= []).push(x);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function MyItemsPanel() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('visits');

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'all', user?.id],
    queryFn: () => fetchMyAllItems(user!.id),
    enabled: !!user,
  });

  const visits = data?.visits ?? [];
  const pins = data?.pins ?? [];

  const visitGroups = groupBy(visits, (v) => v.status);
  const pinGroups = groupBy(pins, (p) => p.status);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          我的条目
        </Title>
        <Text type="secondary">
          自建拜访 {visits.length} 条 · 自建图钉 {pins.length} 条
        </Text>
      </div>

      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { label: `拜访/计划 (${visits.length})`, value: 'visits' },
          { label: `图钉 (${pins.length})`, value: 'pins' },
        ]}
      />

      {isLoading ? (
        <Card size="small">
          <Text type="secondary">加载中…</Text>
        </Card>
      ) : tab === 'visits' ? (
        visits.length === 0 ? (
          <Card size="small">
            <Empty description="还没自建拜访或计划" />
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {(['planned', 'completed', 'cancelled'] as const).map((s) => {
              const list = visitGroups[s] ?? [];
              if (list.length === 0) return null;
              const tag = VISIT_STATUS_TAG[s];
              return (
                <Card size="small" key={s} title={`${tag.label} (${list.length})`}>
                  <List
                    dataSource={list}
                    size="small"
                    renderItem={(v) => (
                      <List.Item>
                        <Space>
                          <Tag color={tag.color}>{tag.label}</Tag>
                          <Text>{v.title ?? v.contactPerson ?? '—'}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(v.createdAt).format('YYYY-MM-DD')}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              );
            })}
          </Space>
        )
      ) : pins.length === 0 ? (
        <Card size="small">
          <Empty description="还没自建图钉" />
        </Card>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {(['in_progress', 'completed', 'aborted'] as const).map((s) => {
            const list = pinGroups[s] ?? [];
            if (list.length === 0) return null;
            const tag = PIN_STATUS_TAG[s];
            return (
              <Card size="small" key={s} title={`${tag.label} (${list.length})`}>
                <List
                  dataSource={list}
                  size="small"
                  renderItem={(p) => (
                    <List.Item>
                      <Space>
                        <Tag color={tag.color}>{tag.label}</Tag>
                        <Text>{p.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(p.createdAt).format('YYYY-MM-DD')}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            );
          })}
        </Space>
      )}
    </Space>
  );
}
