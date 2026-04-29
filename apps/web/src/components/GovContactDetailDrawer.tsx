import { Drawer, Descriptions, Tag, Space, Typography, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { GovContact, Visit } from '@pop/shared-types';
import { fetchVisits } from '@/api/visits';

const { Title, Text } = Typography;

const TIER_LABEL: Record<string, { color: string; label: string }> = {
  core: { color: 'red', label: '核心' },
  important: { color: 'orange', label: '重要' },
  normal: { color: 'default', label: '常规' },
};

interface Props {
  contact: GovContact | null;
  open: boolean;
  onClose: () => void;
}

export function GovContactDetailDrawer({ contact, open, onClose }: Props) {
  const { data: visits } = useQuery({
    queryKey: ['visits', { contactId: contact?.id }],
    queryFn: async () => {
      const all = await fetchVisits();
      return all.data.filter((v: Visit) => v.contactId === contact?.id);
    },
    enabled: !!contact,
  });

  return (
    <Drawer open={open} onClose={onClose} title={contact?.name ?? '联系人详情'} width={520} destroyOnClose>
      {!contact ? <Empty /> : (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="性别">{contact.gender ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="职务">{contact.title}</Descriptions.Item>
            <Descriptions.Item label="重要程度">
              <Tag color={TIER_LABEL[contact.tier].color}>{TIER_LABEL[contact.tier].label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="电话">{contact.phone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="微信">{contact.wechat ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="偏好备注">{contact.preferenceNotes ?? '—'}</Descriptions.Item>
          </Descriptions>

          <div>
            <Title level={5}>拜访记录({visits?.length ?? 0})</Title>
            {(visits ?? []).slice(0, 10).map((v) => (
              <div key={v.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <Text>{v.visitDate ?? v.plannedDate ?? '—'}</Text>
                <Text type="secondary"> · {v.department ?? '—'}</Text>
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
