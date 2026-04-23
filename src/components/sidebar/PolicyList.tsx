import { Checkbox, Typography, Button, Space, Tag } from 'antd';
import { usePolicyStore } from '@/stores/policyStore';
import { useMapStore } from '@/stores/mapStore';

const { Text } = Typography;

export default function PolicyList() {
  const policies = usePolicyStore((s) => s.policies);
  const selected = useMapStore((s) => s.selectedPolicyIds);
  const toggle = useMapStore((s) => s.togglePolicy);
  const setAll = useMapStore((s) => s.setSelectedPolicies);

  return (
    <div
      className="glass-panel"
      style={{
        width: 'var(--sidebar-w)',
        margin: 16,
        marginRight: 0,
        padding: 16,
        overflowY: 'auto',
        maxHeight: 'calc(100% - 32px)',
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            width: 3,
            height: 14,
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent-glow)',
            borderRadius: 2,
          }}
        />
        <span
          className="glow-title"
          style={{ fontSize: 15, fontWeight: 700 }}
        >
          核心主线政策
        </span>
      </div>
      <Text style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        勾选后在地图上叠加覆盖
      </Text>
      <Space size={6} style={{ marginTop: 12, marginBottom: 4 }}>
        <Button
          size="small"
          onClick={() => setAll(policies.map((p) => p.id))}
          style={{
            background: 'rgba(0, 212, 255, 0.1)',
            borderColor: 'rgba(0, 212, 255, 0.3)',
            color: 'var(--accent)',
          }}
        >
          全选
        </Button>
        <Button
          size="small"
          onClick={() => setAll([])}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          清空
        </Button>
      </Space>
      <div
        style={{
          margin: '12px 0 8px',
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.3) 50%, transparent 100%)',
        }}
      />
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {policies.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: 10,
                borderRadius: 8,
                background: isSel
                  ? `linear-gradient(90deg, ${p.color}22 0%, rgba(0,212,255,0.04) 100%)`
                  : 'rgba(0, 212, 255, 0.03)',
                border: `1px solid ${
                  isSel ? p.color + 'aa' : 'rgba(0, 212, 255, 0.08)'
                }`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isSel ? `0 0 16px ${p.color}33` : 'none',
              }}
            >
              <Checkbox checked={isSel} />
              <div style={{ flex: 1 }}>
                <Space size={6}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: p.color,
                      boxShadow: `0 0 8px ${p.color}`,
                      display: 'inline-block',
                    }}
                  />
                  <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {p.name}
                  </Text>
                  <Tag
                    color={p.level === 'main' ? 'red' : 'default'}
                    style={{ fontSize: 10, margin: 0 }}
                  >
                    {p.level === 'main' ? '主线' : '次线'}
                  </Tag>
                </Space>
                {p.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {p.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Space>
    </div>
  );
}
