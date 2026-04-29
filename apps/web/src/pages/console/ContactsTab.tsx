import { useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type GovContact, type ContactTier } from '@pop/shared-types';
import { fetchGovContacts, deleteGovContact } from '@/api/gov-contacts';
import { fetchGovOrgs } from '@/api/gov-orgs';
import { GovContactFormModal } from '@/components/GovContactFormModal';
import { GovContactDetailDrawer } from '@/components/GovContactDetailDrawer';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

const TIER_LABEL: Record<ContactTier, { color: string; label: string }> = {
  core: { color: 'red', label: '核心' },
  important: { color: 'orange', label: '重要' },
  normal: { color: 'default', label: '常规' },
};

export function ContactsTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSysAdmin = currentUser?.roleCode === UserRoleCode.SysAdmin;

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<ContactTier | 'all'>('all');
  const [orgFilter, setOrgFilter] = useState<string | undefined>(undefined);
  const [orgSearch, setOrgSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GovContact | undefined>(undefined);
  const [drawer, setDrawer] = useState<GovContact | null>(null);

  const list = useQuery({
    queryKey: ['gov-contacts', { search, tier: tierFilter, orgId: orgFilter }],
    queryFn: () => fetchGovContacts({
      search: search || undefined,
      tier: tierFilter === 'all' ? undefined : tierFilter,
      orgId: orgFilter,
      limit: 100,
    }),
  });

  const orgs = useQuery({
    queryKey: ['gov-orgs', { search: orgSearch }],
    queryFn: () => fetchGovOrgs({ search: orgSearch || undefined, limit: 30 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGovContact,
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['gov-contacts'] });
    },
    onError: (e) => message.error(`删除失败: ${(e as Error).message}`),
  });

  const contacts = list.data?.data ?? [];

  const columns = [
    {
      title: '姓名', key: 'name',
      render: (_: unknown, r: GovContact) => (
        <Space>
          <a onClick={() => setDrawer(r)}>{r.name}</a>
          {r.gender && <Text type="secondary" style={{ fontSize: 12 }}>{r.gender}</Text>}
        </Space>
      ),
    },
    { title: '所属机构', key: 'orgName', render: (_: unknown, r: GovContact) => (r as any).org?.name ?? '—' },
    { title: '职务', dataIndex: 'title' as const, width: 100 },
    {
      title: '重要程度', dataIndex: 'tier' as const, width: 100,
      render: (t: ContactTier) => <Tag color={TIER_LABEL[t].color}>{TIER_LABEL[t].label}</Tag>,
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, r: GovContact) => (
        <Space>
          <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>编辑</Button>
          {isSysAdmin && (
            <Popconfirm title="确认删除?" onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>联系人列表 ({contacts.length})</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>
          新建联系人
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="搜姓名" allowClear style={{ width: 200 }} onSearch={setSearch} />
        <Select
          showSearch allowClear
          placeholder="按机构过滤"
          filterOption={false}
          onSearch={setOrgSearch}
          onChange={setOrgFilter}
          style={{ width: 240 }}
          options={(orgs.data?.data ?? []).map((o) => ({
            label: `${o.name}${o.shortName ? ` (${o.shortName})` : ''}`,
            value: o.id,
          }))}
        />
        <Select value={tierFilter} onChange={setTierFilter} style={{ width: 120 }}
          options={[
            { label: '全部', value: 'all' },
            { label: '核心', value: 'core' },
            { label: '重要', value: 'important' },
            { label: '常规', value: 'normal' },
          ]} />
      </Space>

      <Table dataSource={contacts} rowKey="id" loading={list.isLoading}
        pagination={{ pageSize: 20 }} columns={columns} />

      <GovContactFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <GovContactDetailDrawer contact={drawer} open={!!drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
