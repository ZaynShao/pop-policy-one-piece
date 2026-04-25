import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Row, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { HealthDto } from '@pop/shared-types';
import { http } from '@/lib/http';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

interface RegionsRes {
  data: Array<{ code: string; name: string; level: string }>;
  meta: { count: number };
}

export function AdminHome() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await http.get<HealthDto>('/health')).data,
  });
  const provinces = useQuery({
    queryKey: ['regions', 'province'],
    queryFn: async () =>
      (await http.get<RegionsRes>('/regions', { params: { level: 'province' } }))
        .data,
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>管理后台 · 首页</Title>
      <Text type="secondary">PRD §6.2 · sys_admin 默认首屏 · 健康告警 / 用户列表 / 工单 / 审计</Text>

      {/* 顶部 健康告警 */}
      <Card title={<><WarningOutlined /> 健康告警</>}>
        <Space size="large" wrap>
          {health.isLoading && <Tag>API 检查中…</Tag>}
          {health.data && (
            <>
              <Tag
                icon={<CheckCircleOutlined />}
                color={health.data.status === 'ok' ? 'success' : 'error'}
              >
                API · {health.data.status}
              </Tag>
              <Tag
                icon={<CheckCircleOutlined />}
                color={health.data.db === 'ok' ? 'success' : 'error'}
              >
                DB · {health.data.db}
              </Tag>
            </>
          )}
          {health.error && <Tag color="error">API 无法连通</Tag>}
          {provinces.data && (
            <Tag color="success">Region · 省级 {provinces.data.meta.count} 条</Tag>
          )}
          <Tag color="warning">外部对接 · 占位</Tag>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="用户列表(精简)" style={{ minHeight: 220 }}>
            <Empty description="占位 · 接 H1" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="工单待办 (3)" style={{ minHeight: 220 }}>
            <Empty description="占位 · 数据校正 / 归属转移" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        </Col>
      </Row>

      <Card title="最近审计日志">
        <Empty description="占位 · 接 H5" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>

      <Alert
        type="info"
        showIcon
        message="开发期提示"
        description="此页面用于 sys_admin 跑通业务路径(CASL manage all)。生产环境此账号会走 AuditLog 全量留痕。"
      />
    </Space>
  );
}
