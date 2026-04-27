import { useState } from 'react';
import { Button, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Visit, VisitStatus } from '@pop/shared-types';
import { VisitFormModal } from '@/components/VisitFormModal';
import { authHeaders } from '@/lib/api';

const { Title, Text } = Typography;

const COLOR_TAG: Record<NonNullable<Visit['color']>, { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'orange', label: '紧急' },
  blue: { color: 'blue', label: '计划' },
};

export function VisitsTab() {
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('completed');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['visits', statusFilter],
    queryFn: async () => {
      const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const r = await fetch(`/api/v1/visits${q}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('visits fetch fail');
      return r.json() as Promise<{ data: Visit[] }>;
    },
  });

  const visits = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>拜访清单 ({visits.length})</Title>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '计划中', value: 'planned' },
              { label: '已拜访', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ]}
            style={{ width: 120 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
          >
            新建拜访
          </Button>
        </Space>
      </Space>

      <Table
        dataSource={visits}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '类型',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (s: VisitStatus) => (
              <Tag color={s === 'planned' ? 'blue' : s === 'completed' ? 'green' : 'default'}>
                {s === 'planned' ? '计划' : s === 'completed' ? '已拜访' : '已取消'}
              </Tag>
            ),
          },
          {
            title: '标题',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            render: (t: string | null, row: Visit) =>
              t ?? (row.status === 'completed' ? row.contactPerson ?? '—' : <Text type="secondary">—</Text>),
          },
          {
            title: '拜访日期',
            dataIndex: 'visitDate',
            width: 110,
            sorter: (a, b) => (a.visitDate ?? '').localeCompare(b.visitDate ?? ''),
            defaultSortOrder: 'descend',
          },
          { title: '城市', width: 120, render: (_, r) => r.cityName },
          { title: '对接人', dataIndex: 'contactPerson', width: 100 },
          {
            title: '关联项目',
            dataIndex: 'parentPinId',
            key: 'parentPinId',
            width: 110,
            render: (pid: string | null) =>
              pid ? <Text style={{ fontSize: 12 }}>{pid.slice(0, 8)}…</Text> : <Text type="secondary">—</Text>,
          },
          {
            title: '产出描述',
            dataIndex: 'outcomeSummary',
            ellipsis: true,
            render: (v: string | null) => {
              const s = v ?? '—';
              return s.length > 30 ? s.slice(0, 30) + '…' : s;
            },
          },
          {
            title: '颜色',
            dataIndex: 'color',
            width: 100,
            render: (c: Visit['color'], row: Visit) => {
              if (row.status === 'planned') return <Tag color="blue">计划</Tag>;
              if (!c) return <Text type="secondary">—</Text>;
              return <Tag color={COLOR_TAG[c].color}>{COLOR_TAG[c].label}</Tag>;
            },
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
