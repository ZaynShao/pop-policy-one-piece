import { Card, Collapse, Empty, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ConsumptionLogWithTool } from '@pop/shared-types';
import { fetchMyConsumptions } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

export function MyConsumptionsPanel() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'consumptions', user?.id],
    queryFn: fetchMyConsumptions,
    enabled: !!user,
  });

  const items = data?.data ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>我的消费记录</Title>
        <Text type="secondary">你下载过的成品文档 + 调用过的接口工具留痕(共 {items.length} 条)</Text>
      </div>

      <Card size="small">
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : items.length === 0 ? (
          <Empty description="还没有消费记录" />
        ) : (
          <List
            dataSource={items}
            size="small"
            renderItem={(it: ConsumptionLogWithTool) => (
              <List.Item>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={it.tool.type === 'document' ? 'blue' : 'purple'}>{it.tool.type === 'document' ? '下载' : '调用'}</Tag>
                    <Text strong>{it.tool.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(it.consumedAt).format('YYYY-MM-DD HH:mm')}</Text>
                  </Space>
                  {it.interfaceResponse && (
                    <Collapse ghost size="small" items={[{
                      key: 'r', label: '查看返回',
                      children: <Paragraph code style={{ fontSize: 12 }}>{JSON.stringify(it.interfaceResponse, null, 2)}</Paragraph>,
                    }]} />
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
