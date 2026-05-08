import { Button, Card, Collapse, Empty, List, Modal, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Tool, MockInvokeResponseDto } from '@pop/shared-types';
import { downloadTool, fetchToolsByPoint, invokeTool } from '@/api/tools';
import { useState } from 'react';

const { Text, Paragraph } = Typography;

const TAX_LABEL: Record<string, string> = {
  ppt_template: 'PPT 模板',
  talk_param_ref: '谈参参考',
  local_data: '地方数据',
  cooperation_template: '合作模板',
  policy_interpretation: '政策解读',
  other: '其他',
};

interface Props {
  visitId?: string;
  pinId?: string;
  contextRegionCode?: string;
}

export function ToolListInDrawer({ visitId, pinId, contextRegionCode }: Props) {
  const [mockResult, setMockResult] = useState<MockInvokeResponseDto | null>(null);
  const q = useQuery({
    queryKey: ['tools', 'by-point', visitId, pinId],
    queryFn: () => fetchToolsByPoint({ visitId, pinId }),
    enabled: !!(visitId || pinId),
  });

  const dl = useMutation({
    mutationFn: (toolId: string) => downloadTool(toolId, { contextVisitId: visitId, contextPinId: pinId, contextRegionCode }),
    onSuccess: (r) => { window.open(r.data.fileUrl, '_blank'); },
    onError: (e) => message.error(`下载失败: ${(e as Error).message}`),
  });

  const inv = useMutation({
    mutationFn: (toolId: string) => invokeTool(toolId, { contextVisitId: visitId, contextPinId: pinId, contextRegionCode }),
    onSuccess: (r) => setMockResult(r.data.response),
    onError: (e) => message.error(`调用失败: ${(e as Error).message}`),
  });

  const groups = q.data?.data.groups ?? {};
  const totalTools = Object.values(groups).reduce((a, b) => a + (b as Tool[]).length, 0);

  if (q.isLoading) return <Text type="secondary">加载工具…</Text>;
  if (totalTools === 0) return <Empty description="该点暂无可用工具" styles={{ image: { height: 36 } }} />;

  return (
    <>
      <Collapse defaultActiveKey={Object.keys(groups)} ghost size="small"
        items={Object.entries(groups).map(([tag, tools]) => ({
          key: tag,
          label: <Text strong>{TAX_LABEL[tag] ?? tag} ({(tools as Tool[]).length})</Text>,
          children: (
            <List
              dataSource={tools as Tool[]}
              size="small"
              renderItem={(t) => (
                <List.Item
                  actions={t.type === 'document'
                    ? [<Button size="small" key="dl" loading={dl.isPending} onClick={() => dl.mutate(t.id)}>下载</Button>]
                    : [<Button size="small" key="inv" loading={inv.isPending} onClick={() => inv.mutate(t.id)}>调用</Button>]}
                >
                  <Space>
                    <Tag color={t.type === 'document' ? 'blue' : 'purple'}>{t.type === 'document' ? '文档' : '接口'}</Tag>
                    <Text>{t.title}</Text>
                  </Space>
                </List.Item>
              )}
            />
          ),
        }))}
      />
      <Modal title="调用结果" open={!!mockResult} onCancel={() => setMockResult(null)} onOk={() => setMockResult(null)} cancelButtonProps={{ style: { display: 'none' } }}>
        {mockResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph>{mockResult.summary}</Paragraph>
            <Card size="small" title="参数"><Text code>{JSON.stringify(mockResult.params, null, 2)}</Text></Card>
            <Button type="link" href={mockResult.downloadUrl} target="_blank">下载假定制 PDF</Button>
          </Space>
        )}
      </Modal>
    </>
  );
}
