import { useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type GovOrg, type GovOrgLevel, type CityListResponse } from '@pop/shared-types';
import { fetchGovOrgs, deleteGovOrg } from '@/api/gov-orgs';
import { GovOrgFormModal } from '@/components/GovOrgFormModal';
import { GovOrgDetailDrawer } from '@/components/GovOrgDetailDrawer';
import { useAuthStore } from '@/stores/auth';
import { authHeaders } from '@/lib/api';

const { Title, Text } = Typography;

const LEVEL_LABEL: Record<GovOrgLevel, { color: string; label: string }> = {
  national: { color: 'red', label: '中央' },
  provincial: { color: 'gold', label: '省级' },
  municipal: { color: 'blue', label: '市级' },
  district: { color: 'green', label: '区/县级' },
};

export function OrgsTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSysAdmin = currentUser?.roleCode === UserRoleCode.SysAdmin;

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<GovOrgLevel | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GovOrg | undefined>(undefined);
  const [drawerOrg, setDrawerOrg] = useState<GovOrg | null>(null);

  const list = useQuery({
    queryKey: ['gov-orgs', { search, level: levelFilter }],
    queryFn: () => fetchGovOrgs({
      search: search || undefined,
      level: levelFilter === 'all' ? undefined : levelFilter,
      limit: 100,
    }),
  });

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const r = await fetch('/api/v1/cities', { headers: authHeaders() });
      if (!r.ok) throw new Error('cities fetch fail');
      return (await r.json()) as CityListResponse;
    },
    staleTime: Infinity,
  });

  const getProvinceName = (code: string): string => {
    if (code === '000000') return '中央';
    return cityList?.data.find((p) => p.provinceCode === code)?.provinceName ?? code;
  };

  const deleteMutation = useMutation({
    mutationFn: deleteGovOrg,
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['gov-orgs'] });
    },
    onError: (e) => message.error(`删除失败: ${(e as Error).message}`),
  });

  const orgs = list.data?.data ?? [];

  const columns = [
    {
      title: '机构名',
      key: 'name',
      render: (_: unknown, r: GovOrg) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => setDrawerOrg(r)}>{r.name}</a>
          {r.shortName && <Text type="secondary" style={{ fontSize: 12 }}>{r.shortName}</Text>}
        </Space>
      ),
    },
    {
      title: '层级', dataIndex: 'level' as const, width: 90,
      render: (l: GovOrgLevel) => <Tag color={LEVEL_LABEL[l].color}>{LEVEL_LABEL[l].label}</Tag>,
    },
    {
      title: '省 / 市', key: 'location', width: 200,
      render: (_: unknown, r: GovOrg) => `${getProvinceName(r.provinceCode)} / ${r.cityName}`,
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, r: GovOrg) => (
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
        <Title level={4} style={{ margin: 0 }}>机构列表 ({orgs.length})</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>
          新建机构
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜机构名/简称" allowClear style={{ width: 240 }}
          onSearch={(v) => setSearch(v)} />
        <Select value={levelFilter} onChange={setLevelFilter} style={{ width: 120 }}
          options={[
            { label: '全部层级', value: 'all' },
            { label: '中央', value: 'national' },
            { label: '省级', value: 'provincial' },
            { label: '市级', value: 'municipal' },
            { label: '区/县级', value: 'district' },
          ]} />
      </Space>

      <Table dataSource={orgs} rowKey="id" loading={list.isLoading}
        pagination={{ pageSize: 20 }} columns={columns} />

      <GovOrgFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <GovOrgDetailDrawer org={drawerOrg} open={!!drawerOrg} onClose={() => setDrawerOrg(null)} />
    </div>
  );
}
