import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { THEME_TEMPLATE_LABEL, UserRoleCode, type Theme, type ThemeStatus, type ThemeTemplate } from '@pop/shared-types';
import { fetchThemes } from '@/api/themes';
import { ThemeFormModal } from '@/components/ThemeFormModal';
import { ThemeDetailDrawer } from '@/components/ThemeDetailDrawer';
import { useAuthStore } from '@/stores/auth';

const { Title } = Typography;

const STATUS_TAG: Record<ThemeStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'default', label: '已归档' },
};

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

type View = 'active' | 'archived';

export function ThemesTab() {
  const currentUser = useAuthStore((s) => s.user);
  const canWrite = currentUser ? THEME_WRITE_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [view, setView] = useState<View>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Theme | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useQuery({
    queryKey: ['themes', 'active'],
    queryFn: () => fetchThemes(),
  });

  const archived = useQuery({
    queryKey: ['themes', 'archived'],
    queryFn: () => fetchThemes({ status: 'archived' }),
  });

  const activeThemes = active.data?.data ?? [];
  const archivedThemes = archived.data?.data ?? [];
  const currentList = view === 'active' ? activeThemes : archivedThemes;
  const currentLoading = view === 'active' ? active.isLoading : archived.isLoading;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>政策主题管理 ({currentList.length})</Title>
        {canWrite && view === 'active' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
          >
            新建主题
          </Button>
        )}
      </Space>

      <Segmented<View>
        style={{ marginBottom: 16 }}
        value={view}
        onChange={setView}
        options={[
          { label: `活跃 (${activeThemes.length})`, value: 'active' },
          { label: `归档 (${archivedThemes.length})`, value: 'archived' },
        ]}
      />

      <Table
        dataSource={currentList}
        rowKey="id"
        loading={currentLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title' as const,
            ellipsis: true,
            render: (t: string, r: Theme) => (
              <a onClick={() => setSelectedId(r.id)}>{t}</a>
            ),
          },
          {
            title: '模板',
            dataIndex: 'template' as const,
            width: 110,
            render: (tpl: ThemeTemplate) => THEME_TEMPLATE_LABEL[tpl],
          },
          {
            title: '状态',
            dataIndex: 'status' as const,
            width: 100,
            render: (s: ThemeStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>,
          },
          {
            title: '关键词',
            dataIndex: 'keywords' as const,
            ellipsis: true,
            render: (kws: string[]) => kws.length > 0
              ? kws.slice(0, 3).map((k) => <Tag key={k}>{k}</Tag>)
              : '—',
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt' as const,
            width: 170,
            sorter: (a: Theme, b: Theme) => a.createdAt.localeCompare(b.createdAt),
            defaultSortOrder: 'descend' as const,
            render: (v: string) => v.replace('T', ' ').slice(0, 16),
          },
          ...(canWrite ? [{
            title: '操作',
            width: 80,
            render: (_: unknown, r: Theme) => (
              <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
                编辑
              </Button>
            ),
          }] : []),
        ]}
      />

      <ThemeFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <ThemeDetailDrawer themeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
