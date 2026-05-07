import { Card, Empty, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchTools } from '@/api/tools';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

/**
 * D12 中台 GA 消费排行 — MVP 简化版:
 * 列出自己创建的所有工具(不做时间序列图)。
 * 真正的 per-tool count 留给后续。
 */
export function ConsumptionTab() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['tools', 'mine', user?.id],
    queryFn: () => fetchTools({ creatorId: user?.id }),
    enabled: !!user,
  });

  const tools = data?.data ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ marginTop: 0, color: palette.primary }}>我的工具消费明细</Title>
      <Text type="secondary">中台 GA 视角:看自己工具的消费情况</Text>
      <Card size="small">
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : tools.length === 0 ? (
          <Empty description="你还没有创建工具" />
        ) : (
          <Table
            rowKey="id"
            dataSource={tools}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: '名称', dataIndex: 'title', key: 'title', ellipsis: true },
              { title: '类型', dataIndex: 'type', key: 'type', width: 100,
                render: (t: string) => <Tag color={t === 'document' ? 'blue' : 'purple'}>{t === 'document' ? '文档' : '接口'}</Tag> },
              { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
              { title: '创建', dataIndex: 'createdAt', key: 'created', width: 160,
                render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
            ]}
          />
        )}
      </Card>
    </Space>
  );
}
