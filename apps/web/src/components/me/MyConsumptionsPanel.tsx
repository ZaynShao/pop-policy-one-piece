import { Card, Empty, Space, Typography } from 'antd';
import { palette } from '@/tokens';

const { Title, Paragraph } = Typography;

/**
 * F4 我的消费记录 — G6 阶段 stub。
 *
 * 真实数据依赖 G1 工具池(D 模块)落地后产生的 ToolConsumption 表。
 * G1 上线后:替换为 useQuery 拉 /api/v1/me/consumptions,展示下载/调用记录。
 */
export function MyConsumptionsPanel() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          我的消费记录
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          属地 GA 视角:你下载过的成品文档 + 调用过的接口留痕。
        </Paragraph>
      </div>

      <Card size="small">
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <span>暂无消费记录</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                工具池(G1 D 模块)上线后,你下载/调用的工具会在这里留痕。
              </span>
            </Space>
          }
        />
      </Card>
    </Space>
  );
}
