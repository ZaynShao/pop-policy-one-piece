import { useState } from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Pin, PinStatus, PinPriority } from '@pop/shared-types';
import { PinFormModal } from '@/components/PinFormModal';
import { authHeaders } from '@/lib/api';

const { Title } = Typography;

const STATUS_TAG: Record<PinStatus, { color: string; label: string }> = {
  in_progress: { color: 'purple', label: '进行中' },
  completed: { color: 'default', label: '完成' },
  aborted: { color: 'default', label: '中止' },
};

const PRIORITY_TAG: Record<PinPriority, { color: string; label: string; sortKey: number }> = {
  high: { color: 'red', label: '高', sortKey: 3 },
  medium: { color: 'orange', label: '中', sortKey: 2 },
  low: { color: 'green', label: '低', sortKey: 1 },
};

async function fetchPins(): Promise<{ data: Pin[] }> {
  const r = await fetch('/api/v1/pins', { headers: authHeaders() });
  if (!r.ok) throw new Error('pins fetch fail');
  return r.json();
}

export function PinsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['pins'], queryFn: fetchPins });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pin | undefined>(undefined);

  const pins = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>图钉清单 ({pins.length})</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
        >
          新建图钉
        </Button>
      </Space>

      <Table
        dataSource={pins}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title',
            ellipsis: true,
          },
          { title: '城市', width: 120, render: (_, r) => r.cityName },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: PinStatus) => (
              <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>
            ),
          },
          {
            title: '优先级',
            dataIndex: 'priority',
            width: 90,
            sorter: (a, b) =>
              PRIORITY_TAG[a.priority].sortKey - PRIORITY_TAG[b.priority].sortKey,
            render: (p: PinPriority) => (
              <Tag color={PRIORITY_TAG[p].color}>{PRIORITY_TAG[p].label}</Tag>
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 170,
            sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
            defaultSortOrder: 'descend',
            render: (v: string) => v.replace('T', ' ').slice(0, 16),
          },
          {
            title: '操作',
            width: 80,
            render: (_, r) => (
              <Button
                size="small"
                type="link"
                onClick={() => { setEditing(r); setModalOpen(true); }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />

      <PinFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
