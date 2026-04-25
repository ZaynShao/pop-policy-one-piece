import { Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BellOutlined,
  CalendarOutlined,
  PushpinOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

const TRACK_CARD_STYLE: React.CSSProperties = { height: 140 };

export function ConsoleDashboard() {
  const nav = useNavigate();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>综合看板 · stub</Title>
      <Text type="secondary">PRD §6.2 · lead/pmo 默认首屏 · 三轨横排 + 预警/事件分栏 + 快跳</Text>

      {/* 三轨卡 · 横排 3 列 */}
      <Row gutter={16}>
        <Col span={8}>
          <Card style={TRACK_CARD_STYLE} title={<><Tag color="cyan">政策三轨</Tag></>}>
            <Statistic
              title="覆盖率"
              value={68}
              suffix="%"
              valueStyle={{ color: palette.visit.green }}
              prefix={<ArrowUpOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>占位 · V0.3 接 E 模块</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={TRACK_CARD_STYLE} title={<><Tag color="cyan">工具三轨</Tag></>}>
            <Statistic
              title="本周调用"
              value={142}
              valueStyle={{ color: palette.visit.green }}
              prefix={<ArrowUpOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>占位</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={TRACK_CARD_STYLE} title={<><Tag color="cyan">属地三轨</Tag></>}>
            <Statistic
              title="拜访达成"
              value={43}
              suffix="%"
              valueStyle={{ color: palette.visit.yellow }}
              prefix={<ArrowDownOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>占位</Text>
          </Card>
        </Col>
      </Row>

      {/* 预警 + 事件 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title={<><BellOutlined /> 掉队预警</>} style={{ minHeight: 220 }}>
            <Empty description="占位 · V0.3 接 E2" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<><CalendarOutlined /> 本周关键事件</>} style={{ minHeight: 220 }}>
            <Empty description="占位 · V0.3 接 E3" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        </Col>
      </Row>

      {/* 快速跳转 */}
      <Card title="快速跳转">
        <Space size="middle">
          <Button icon={<PushpinOutlined />} onClick={() => nav('/console/pins')}>
            图钉清单
          </Button>
          <Button icon={<UnorderedListOutlined />} onClick={() => nav('/console/visits')}>
            拜访清单
          </Button>
          <Button icon={<CalendarOutlined />} onClick={() => nav('/console/weekly')}>
            周观测
          </Button>
        </Space>
      </Card>
    </Space>
  );
}
