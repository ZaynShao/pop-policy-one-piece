import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tool, ToolStatus } from '@pop/shared-types';
import { archiveTool, fetchTools, publishTool, restoreTool } from '@/api/tools';
import { ToolFormModal } from '@/components/tools/ToolFormModal';

const STATUS_TAG: Record<ToolStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'gold', label: '已下架' },
};

const TYPE_LABEL: Record<'document' | 'interface', string> = {
  document: '成品文档',
  interface: '调用接口',
};

export function ToolsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ToolStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const list = useQuery({
    queryKey: ['tools', statusFilter],
    queryFn: () => fetchTools(statusFilter === 'all' ? {} : { status: statusFilter }),
  });

  const pubMut = useMutation({
    mutationFn: publishTool,
    onSuccess: () => { message.success('发布成功'); qc.invalidateQueries({ queryKey: ['tools'] }); },
    onError: (e) => message.error(`发布失败: ${(e as Error).message}`),
  });
  const archMut = useMutation({
    mutationFn: archiveTool,
    onSuccess: () => { message.success('下架成功'); qc.invalidateQueries({ queryKey: ['tools'] }); },
    onError: (e) => message.error(`下架失败: ${(e as Error).message}`),
  });
  const restMut = useMutation({
    mutationFn: restoreTool,
    onSuccess: () => { message.success('恢复成功'); qc.invalidateQueries({ queryKey: ['tools'] }); },
    onError: (e) => message.error(`恢复失败: ${(e as Error).message}`),
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { label: '全部', value: 'all' },
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
            { label: '已下架', value: 'archived' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建工具</Button>
      </Space>
      <Table<Tool>
        rowKey="id"
        dataSource={list.data?.data ?? []}
        loading={list.isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '名称', dataIndex: 'title', key: 'title', ellipsis: true },
          { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: 'document' | 'interface') => TYPE_LABEL[t] },
          { title: 'taxonomy', dataIndex: 'taxonomyTag', key: 'tax', width: 140 },
          {
            title: '状态', dataIndex: 'status', key: 'status', width: 100,
            render: (s: ToolStatus) => { const t = STATUS_TAG[s]; return <Tag color={t.color}>{t.label}</Tag>; },
          },
          {
            title: '操作', key: 'op', width: 220,
            render: (_, t) => (
              <Space>
                {t.status === 'draft' && <Button size="small" onClick={() => pubMut.mutate(t.id)}>发布</Button>}
                {t.status === 'published' && <Button size="small" onClick={() => archMut.mutate(t.id)}>下架</Button>}
                {t.status === 'archived' && <Button size="small" onClick={() => restMut.mutate(t.id)}>恢复</Button>}
              </Space>
            ),
          },
        ]}
      />
      <ToolFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Space>
  );
}
