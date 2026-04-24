import { Card, Col, Row, Tag, Typography, Empty, Button } from 'antd';
import { FilePptOutlined, FileTextOutlined, DatabaseOutlined, BulbOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { Title, Paragraph, Text } = Typography;

const TOOLKITS = [
  {
    type: 'ppt',
    icon: <FilePptOutlined style={{ fontSize: 32, color: '#d4380d' }} />,
    title: 'PPT 模板',
    desc: '公司标准介绍 PPT / 场景化方案 PPT',
    phase: '二期',
  },
  {
    type: 'visit_letter',
    icon: <FileTextOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    title: '拜访函',
    desc: '标准拜访函模板，按城市自动替换抬头',
    phase: '二期',
  },
  {
    type: 'one_pager',
    icon: <DatabaseOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    title: '地方数据一张纸',
    desc: '当地合作加油站、充电桩数量、总用电规模（接口整合）',
    phase: '二期',
  },
  {
    type: 'talking_points',
    icon: <BulbOutlined style={{ fontSize: 32, color: '#faad14' }} />,
    title: '拜访谈参（LLM 生成）',
    desc: '基于政策知识库和当地数据自动生成沟通要点',
    phase: '三期',
  },
];

export default function Toolkits() {
  const user = useAuthStore((s) => s.user);
  const canUpload = user?.role === 'central_ga';

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <Title level={4} style={{ marginTop: 0 }}>
        工具箱
      </Title>
      <Paragraph type="secondary">
        演示原型仅展示工具箱的信息架构，实际上传、下载、LLM 生成等能力将在二期落地。
      </Paragraph>
      <Row gutter={[16, 16]}>
        {TOOLKITS.map((t) => (
          <Col key={t.type} xs={24} sm={12} md={12} lg={6}>
            <Card hoverable style={{ height: '100%' }}>
              <div style={{ marginBottom: 12 }}>{t.icon}</div>
              <Title level={5} style={{ marginTop: 0 }}>
                {t.title}
                <Tag style={{ marginLeft: 8 }} color="default">
                  {t.phase}
                </Tag>
              </Title>
              <Text type="secondary">{t.desc}</Text>
              <div style={{ marginTop: 12 }}>
                {canUpload ? (
                  <Button size="small" disabled>
                    上传（占位）
                  </Button>
                ) : (
                  <Button size="small" disabled>
                    浏览（占位）
                  </Button>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未上传任何工具包。二期开放文件上传后，此处会显示全部历史工具包。"
        />
      </Card>
    </div>
  );
}
