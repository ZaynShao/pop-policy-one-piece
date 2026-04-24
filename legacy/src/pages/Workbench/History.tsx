import { Card, Empty, Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function History() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginTop: 0 }}>
        历史工具包
      </Title>
      <Paragraph type="secondary">
        每次按计划点生成的工具包都会在这里留痕。二期开放生成与分发能力后，此处会显示历史记录。
      </Paragraph>
      <Card>
        <Empty description="暂无历史记录（二期开放）" />
      </Card>
    </div>
  );
}
