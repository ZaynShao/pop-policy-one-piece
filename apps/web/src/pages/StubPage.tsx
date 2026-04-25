import { Card, Empty, Space, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

interface Props {
  title: string;
  prdRef?: string;
}

export function StubPage({ title, prdRef }: Props) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        {title} · stub
      </Title>
      {prdRef && <Text type="secondary">{prdRef}</Text>}
      <Card>
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <Text>页面骨架占位 · V0.3 实现</Text>
              <Tag color="cyan">UI-LAYOUT-V0 协同拍 · 不写业务</Tag>
            </Space>
          }
        />
      </Card>
    </Space>
  );
}
