import { useState } from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@pop/shared-types';
import { VisitFormModal } from '@/components/VisitFormModal';
import { authHeaders } from '@/lib/api';

const { Title } = Typography;

const COLOR_TAG: Record<Visit['color'], { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'red', label: '紧急' },
};

async function fetchVisits(): Promise<{ data: Visit[] }> {
  const r = await fetch('/api/v1/visits', { headers: authHeaders() });
  if (!r.ok) throw new Error('visits fetch fail');
  return r.json();
}

export function VisitsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['visits'], queryFn: fetchVisits });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | undefined>(undefined);

  const visits = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>拜访清单 ({visits.length})</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
        >
          新建拜访
        </Button>
      </Space>

      <Table
        dataSource={visits}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '拜访日期',
            dataIndex: 'visitDate',
            width: 110,
            sorter: (a, b) => a.visitDate.localeCompare(b.visitDate),
            defaultSortOrder: 'descend',
          },
          { title: '城市', width: 120, render: (_, r) => r.cityName },
          { title: '对接人', dataIndex: 'contactPerson', width: 100 },
          {
            title: '产出描述',
            dataIndex: 'outcomeSummary',
            ellipsis: true,
            render: (v: string) => (v.length > 30 ? v.slice(0, 30) + '…' : v),
          },
          {
            title: '颜色',
            dataIndex: 'color',
            width: 100,
            render: (c: Visit['color']) => <Tag color={COLOR_TAG[c].color}>{COLOR_TAG[c].label}</Tag>,
          },
          {
            title: '操作',
            width: 80,
            render: (_, r) => (
              <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
                编辑
              </Button>
            ),
          },
        ]}
      />

      <VisitFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
