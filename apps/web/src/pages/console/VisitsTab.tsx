import { useState } from 'react';
import { Button, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type Visit, type VisitStatus } from '@pop/shared-types';
import { VisitFormModal } from '@/components/VisitFormModal';
import { fetchVisits, restoreVisit } from '@/api/visits';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

const COLOR_TAG: Record<NonNullable<Visit['color']>, { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'orange', label: '紧急' },
  blue: { color: 'blue', label: '计划' },
};

const VISIT_TRASH_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);

type View = 'active' | 'trash';

export function VisitsTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canSeeTrash = currentUser ? VISIT_TRASH_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [view, setView] = useState<View>('active');
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('completed');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | undefined>(undefined);

  const active = useQuery({
    queryKey: ['visits', 'active', statusFilter],
    queryFn: () => fetchVisits({ status: statusFilter }),
  });

  const trash = useQuery({
    queryKey: ['visits', 'trash'],
    queryFn: () => fetchVisits({ withDeleted: true }),
    enabled: canSeeTrash,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreVisit(id),
    onSuccess: () => {
      message.success('已还原');
      qc.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (err) => message.error(`还原失败: ${(err as Error).message}`),
  });

  const activeVisits = active.data?.data ?? [];
  const trashVisits = trash.data?.data ?? [];
  const currentList = view === 'active' ? activeVisits : trashVisits;
  const currentLoading = view === 'active' ? active.isLoading : trash.isLoading;

  const sharedColumns = [
    {
      title: '类型',
      dataIndex: 'status' as const,
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
      dataIndex: 'title' as const,
      key: 'title',
      ellipsis: true,
      render: (t: string | null, row: Visit) =>
        t ?? (row.status === 'completed' ? row.contactPerson ?? '—' : <Text type="secondary">—</Text>),
    },
    {
      title: '拜访日期',
      dataIndex: 'visitDate' as const,
      width: 110,
      sorter: (a: Visit, b: Visit) => (a.visitDate ?? '').localeCompare(b.visitDate ?? ''),
      defaultSortOrder: 'descend' as const,
    },
    { title: '城市', width: 120, render: (_: unknown, r: Visit) => r.cityName },
  ];

  const activeColumns = [
    ...sharedColumns,
    { title: '对接人', dataIndex: 'contactPerson' as const, width: 100 },
    {
      title: '关联项目',
      dataIndex: 'parentPinId' as const,
      key: 'parentPinId',
      width: 110,
      render: (pid: string | null) =>
        pid ? <Text style={{ fontSize: 12 }}>{pid.slice(0, 8)}…</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '产出描述',
      dataIndex: 'outcomeSummary' as const,
      ellipsis: true,
      render: (v: string | null) => {
        const s = v ?? '—';
        return s.length > 30 ? s.slice(0, 30) + '…' : s;
      },
    },
    {
      title: '颜色',
      dataIndex: 'color' as const,
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
      render: (_: unknown, r: Visit) => (
        <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
          编辑
        </Button>
      ),
    },
  ];

  const trashColumns = [
    ...sharedColumns,
    {
      title: '删除时间',
      dataIndex: 'deletedAt' as const,
      width: 170,
      sorter: (a: Visit, b: Visit) => (a.deletedAt ?? '').localeCompare(b.deletedAt ?? ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string | null) => v ? v.replace('T', ' ').slice(0, 16) : '—',
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: Visit) => (
        <Button
          size="small"
          type="link"
          icon={<UndoOutlined />}
          loading={restoreMutation.isPending}
          onClick={() => restoreMutation.mutate(r.id)}
        >
          还原
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>拜访清单 ({currentList.length})</Title>
        {view === 'active' && (
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
        )}
      </Space>

      {canSeeTrash && (
        <Segmented<View>
          style={{ marginBottom: 16 }}
          value={view}
          onChange={setView}
          options={[
            { label: `活跃 (${activeVisits.length})`, value: 'active' },
            { label: `回收站 (${trashVisits.length})`, value: 'trash' },
          ]}
        />
      )}

      <Table
        dataSource={currentList}
        rowKey="id"
        loading={currentLoading}
        pagination={{ pageSize: 20 }}
        columns={view === 'active' ? activeColumns : trashColumns}
      />

      <VisitFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
