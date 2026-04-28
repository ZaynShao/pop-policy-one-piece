import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type Pin, type PinStatus, type PinPriority } from '@pop/shared-types';
import { PinFormModal } from '@/components/PinFormModal';
import { fetchPins, restorePin } from '@/api/pins';
import { useAuthStore } from '@/stores/auth';

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

const PIN_TRASH_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);

type View = 'active' | 'trash';

export function PinsTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canSeeTrash = currentUser ? PIN_TRASH_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [view, setView] = useState<View>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pin | undefined>(undefined);

  const active = useQuery({
    queryKey: ['pins', 'active'],
    queryFn: () => fetchPins(),
  });

  const trash = useQuery({
    queryKey: ['pins', 'trash'],
    queryFn: () => fetchPins({ withDeleted: true }),
    enabled: canSeeTrash,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restorePin(id),
    onSuccess: () => {
      message.success('已还原');
      qc.invalidateQueries({ queryKey: ['pins'] });
    },
    onError: (err) => message.error(`还原失败: ${(err as Error).message}`),
  });

  const activePins = active.data?.data ?? [];
  const trashPins = trash.data?.data ?? [];
  const currentList = view === 'active' ? activePins : trashPins;
  const currentLoading = view === 'active' ? active.isLoading : trash.isLoading;

  const activeColumns = [
    { title: '标题', dataIndex: 'title' as const, ellipsis: true },
    { title: '城市', width: 120, render: (_: unknown, r: Pin) => r.cityName },
    {
      title: '状态',
      dataIndex: 'status' as const,
      width: 100,
      render: (s: PinStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority' as const,
      width: 90,
      sorter: (a: Pin, b: Pin) => PRIORITY_TAG[a.priority].sortKey - PRIORITY_TAG[b.priority].sortKey,
      render: (p: PinPriority) => <Tag color={PRIORITY_TAG[p].color}>{PRIORITY_TAG[p].label}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt' as const,
      width: 170,
      sorter: (a: Pin, b: Pin) => a.createdAt.localeCompare(b.createdAt),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => v.replace('T', ' ').slice(0, 16),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, r: Pin) => (
        <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
          编辑
        </Button>
      ),
    },
  ];

  const trashColumns = [
    { title: '标题', dataIndex: 'title' as const, ellipsis: true },
    { title: '城市', width: 120, render: (_: unknown, r: Pin) => r.cityName },
    {
      title: '删除时间',
      dataIndex: 'deletedAt' as const,
      width: 170,
      sorter: (a: Pin, b: Pin) => (a.deletedAt ?? '').localeCompare(b.deletedAt ?? ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string | null) => v ? v.replace('T', ' ').slice(0, 16) : '—',
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: Pin) => (
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
        <Title level={4} style={{ margin: 0 }}>图钉清单 ({currentList.length})</Title>
        {view === 'active' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
          >
            新建图钉
          </Button>
        )}
      </Space>

      {canSeeTrash && (
        <Segmented<View>
          style={{ marginBottom: 16 }}
          value={view}
          onChange={setView}
          options={[
            { label: `活跃 (${activePins.length})`, value: 'active' },
            { label: `回收站 (${trashPins.length})`, value: 'trash' },
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

      <PinFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
