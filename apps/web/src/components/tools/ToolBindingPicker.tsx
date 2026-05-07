import { Button, Card, Select, Space, Tag, Typography } from 'antd';
import type { CreateBindingRequestDto, RegionScope } from '@pop/shared-types';
import { useState } from 'react';

const { Text } = Typography;

const SCOPE_LABEL: Record<RegionScope, string> = {
  nationwide: '全国',
  all_provinces: '全省',
  all_cities_in_province: '全市',
  all_districts_in_city: '全区',
  specific: '指定地域',
};

export type PendingBinding = CreateBindingRequestDto & { _tmpId: string };

interface Props {
  bindings: PendingBinding[];
  onChange: (bindings: PendingBinding[]) => void;
}

export function ToolBindingPicker({ bindings, onChange }: Props) {
  const [scope, setScope] = useState<RegionScope>('nationwide');
  const [regionCode, setRegionCode] = useState<string>('');

  const add = () => {
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next: PendingBinding =
      scope === 'nationwide'
        ? { _tmpId: tmpId, targetType: 'region', regionScopeTag: 'nationwide', regionCode: null }
        : { _tmpId: tmpId, targetType: 'region', regionScopeTag: scope, regionCode };
    if (scope !== 'nationwide' && !regionCode) return;
    onChange([...bindings, next]);
    setRegionCode('');
  };

  const remove = (id: string) => onChange(bindings.filter((b) => b._tmpId !== id));

  return (
    <Card size="small" title="绑定" style={{ marginTop: 12 }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap>
          <Select
            value={scope}
            onChange={setScope}
            options={(Object.keys(SCOPE_LABEL) as RegionScope[]).map((s) => ({ value: s, label: SCOPE_LABEL[s] }))}
            style={{ width: 140 }}
          />
          {scope !== 'nationwide' && (
            <input
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="region_code (省/市/区码)"
              style={{ width: 220, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          )}
          <Button onClick={add}>加绑定</Button>
        </Space>
        <Space wrap>
          {bindings.length === 0 && <Text type="secondary">还没加绑定</Text>}
          {bindings.map((b) => {
            let label: string;
            if (b.targetType === 'region') {
              label = `${SCOPE_LABEL[b.regionScopeTag]}${b.regionCode ? ` ${b.regionCode}` : ''}`;
            } else {
              label = b.targetType;
            }
            return (
              <Tag key={b._tmpId} closable onClose={(e) => { e.preventDefault(); remove(b._tmpId); }}>
                {label}
              </Tag>
            );
          })}
        </Space>
      </Space>
    </Card>
  );
}
