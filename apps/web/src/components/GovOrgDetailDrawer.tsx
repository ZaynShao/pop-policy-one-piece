import { Drawer, Descriptions, Tag, Space, Typography, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { GovOrg, GovContact, Visit, CityListResponse } from '@pop/shared-types';
import { fetchVisits } from '@/api/visits';
import { authHeaders } from '@/lib/api';

const { Title, Text } = Typography;

const LEVEL_LABEL: Record<string, string> = {
  national: '中央',
  provincial: '省级',
  municipal: '市级',
  district: '区/县级',
};

interface Props {
  org: GovOrg | null;
  open: boolean;
  onClose: () => void;
}

export function GovOrgDetailDrawer({ org, open, onClose }: Props) {
  // TODO Task 9: switch this to fetchGovContacts({ orgId: org!.id }) and enabled: !!org once that API client exists
  const { data: contacts } = useQuery({
    queryKey: ['gov-contacts', { orgId: org?.id }],
    queryFn: async () => ({ data: [] as GovContact[] }),
    enabled: false,  // Task 9 will re-enable
  });

  // 省 code → name lookup,使用与 GovOrgFormModal 相同的 cityList query key 复用缓存
  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const r = await fetch('/api/v1/cities', { headers: authHeaders() });
      if (!r.ok) throw new Error('cities fetch fail');
      return (await r.json()) as CityListResponse;
    },
    staleTime: Infinity,
  });

  const provinceName = (() => {
    if (!org) return '';
    if (org.provinceCode === '000000') return '中央';
    return cityList?.data.find((p) => p.provinceCode === org.provinceCode)?.provinceName ?? org.provinceCode;
  })();

  const { data: visits } = useQuery({
    queryKey: ['visits', { orgId: org?.id }],
    queryFn: async () => {
      // NOTE: visits GET 暂不支持 orgId filter(V0.7 加),前端全拉后过滤(数据量小够用)
      const all = await fetchVisits();
      return all.data.filter((v: Visit) => v.orgId === org?.id);
    },
    enabled: !!org,
  });

  return (
    <Drawer open={open} onClose={onClose} title={org?.name ?? '机构详情'} width={520} destroyOnClose>
      {!org ? <Empty /> : (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="简称">{org.shortName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="层级"><Tag>{LEVEL_LABEL[org.level]}</Tag></Descriptions.Item>
            <Descriptions.Item label="省 / 市">{provinceName} / {org.cityName}</Descriptions.Item>
            <Descriptions.Item label="区/县">{org.districtName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="地址">{org.address ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {(org.functionTags ?? []).map((t) => <Tag key={t}>{t}</Tag>)}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Title level={5}>联系人({contacts?.data.length ?? 0})</Title>
            {(contacts?.data ?? []).map((c: GovContact) => (
              <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <Text strong>{c.name}</Text>
                <Text type="secondary"> · {c.title}</Text>
                {c.tier !== 'normal' && <Tag style={{ marginLeft: 8 }} color={c.tier === 'core' ? 'red' : 'orange'}>{c.tier === 'core' ? '核心' : '重要'}</Tag>}
              </div>
            ))}
            {(contacts?.data.length ?? 0) === 0 && <Text type="secondary">暂无</Text>}
          </div>

          <div>
            <Title level={5}>历史拜访({visits?.length ?? 0})</Title>
            {(visits ?? []).slice(0, 10).map((v) => (
              <div key={v.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <Text>{v.visitDate ?? v.plannedDate ?? '—'}</Text>
                <Text type="secondary"> · {v.contactPerson ?? '—'}</Text>
                <Text style={{ marginLeft: 8, fontSize: 12 }}>{(v.outcomeSummary ?? '').slice(0, 30)}</Text>
              </div>
            ))}
            {(visits ?? []).length === 0 && <Text type="secondary">暂无</Text>}
          </div>
        </Space>
      )}
    </Drawer>
  );
}
