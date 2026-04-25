import { Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export function ToolConsumption() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>工具消费排行 · stub</Title>
      <Text type="secondary">PRD §6.2 · central_ga 默认首屏 · 个人视角看自己工具的调用</Text>

      <Card>
        <Space size="middle" style={{ marginBottom: 16 }}>
          <Select placeholder="时间" style={{ width: 120 }} disabled />
          <Select placeholder="角色" style={{ width: 120 }} disabled />
          <Select placeholder="工具类型" style={{ width: 140 }} disabled />
          <Button icon={<DownloadOutlined />} disabled>
            导出
          </Button>
          <Tag color="cyan">占位 · V0.3 接 D17</Tag>
        </Space>

        <Table
          columns={[
            { title: '工具名', dataIndex: 'name' },
            { title: '调用次数', dataIndex: 'calls' },
            { title: '调用人', dataIndex: 'caller' },
            { title: '趋势', dataIndex: 'trend' },
          ]}
          dataSource={[]}
          locale={{
            emptyText: (
              <Empty
                description="占位 · D17 接入后展示"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={false}
        />
      </Card>
    </Space>
  );
}
