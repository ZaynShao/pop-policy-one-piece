import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, Space, Tag, Typography } from 'antd';
import type { HealthDto } from '@pop/shared-types';
import { palette } from './tokens';

const { Title, Paragraph, Text } = Typography;

async function fetchHealth(): Promise<HealthDto> {
  const res = await axios.get<HealthDto>('/api/v1/health');
  return res.data;
}

export function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  return (
    <div style={{ minHeight: '100vh', padding: 32 }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 960 }}>
        <header>
          <Title level={1} className="glow-title" style={{ marginBottom: 8 }}>
            政策 One Piece · POP
          </Title>
          <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
            V0.1 Week 1 · 骨架验证 · 界面布局按 PRD §6 协同拍定
          </Paragraph>
        </header>

        <Card className="glass-panel" title={<span style={{ color: palette.primary }}>后端健康检查</span>}>
          {isLoading && <Text>检查中…</Text>}
          {error && (
            <Space direction="vertical">
              <Tag color="error">后端未响应</Tag>
              <Text style={{ color: palette.textMuted }}>
                请在另一个终端执行 <Text code>npm run dev:api</Text>
              </Text>
            </Space>
          )}
          {data && (
            <Space direction="vertical">
              <Tag color="success">status: {data.status}</Tag>
              <Text>service: {data.service}</Text>
              <Text>version: {data.version}</Text>
              <Text style={{ color: palette.textMuted }}>timestamp: {data.timestamp}</Text>
            </Space>
          )}
        </Card>

        <Card className="glass-panel" title={<span style={{ color: palette.primary }}>下一步</span>}>
          <ol style={{ color: palette.textBase, lineHeight: 1.9 }}>
            <li>docker compose up -d 起 Postgres / Redis / MinIO</li>
            <li>设计 PRD §4 数据模型 → TypeORM 实体 + 首批 migration</li>
            <li>落 PRD §5 权限矩阵(CASL + 5 角色)</li>
            <li>按 PRD §6 协同拍定首屏布局</li>
          </ol>
        </Card>
      </Space>
    </div>
  );
}
