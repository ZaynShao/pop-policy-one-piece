import { Button, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { fetchPolicies, fetchPolicyTopics } from '@/api/policies';
import { regionCodeToName } from '@/lib/region-names';
import { getTopicColorScale, palette } from '@/tokens';
import type { PolicyLevel } from '@pop/shared-types';

const { Text } = Typography;

const LEVEL_LABEL: Record<PolicyLevel, string> = {
  national: '国家级',
  provincial: '省级',
  municipal: '市级',
  district: '区县级',
};

const LEVEL_TAG_COLOR: Record<PolicyLevel, string> = {
  national: 'magenta',
  provincial: 'purple',
  municipal: 'geekblue',
  district: 'cyan',
};

interface Props {
  topic: string | null;
  /** 'national' = 顶部 badge 触发,看全部国家级;否则按 region 过滤 */
  mode: 'national' | 'region' | null;
  /** mode=region 时:省 code(全国视图)或 市 code(省内视图) */
  regionCode: string | null;
  /** mode=region 且为城市级时,带 cityName 精确;否则按省聚合 */
  cityName: string | null;
  onClose: () => void;
}

/**
 * 政策清单浮窗 — 跟 PolicyRegionDrawer 同款 absolute 玻璃面板
 *
 * 触发场景:
 *   - 点 national badge → mode='national', 显示该主题国家级全部
 *   - 点省份(全国视图)→ mode='region', regionCode=省code, 显示该省所有 (含下属市)
 *   - 点城市(省内视图)→ mode='region', regionCode=省code, cityName=市名
 */
export function PolicyListDrawer({ topic, mode, regionCode, cityName, onClose }: Props) {
  const enabled = !!topic && !!mode;

  const params = (() => {
    if (!topic || !mode) return null;
    if (mode === 'national') return { topic, level: 'national' as const };
    if (cityName && regionCode) return { topic, provinceCode: regionCode, cityName };
    if (regionCode) return { topic, provinceCode: regionCode };
    return null;
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['policies-list', params],
    queryFn: () => fetchPolicies(params!),
    enabled: enabled && !!params,
  });

  // 共享同 queryKey,跟 MapShell 同 cache,不会触发额外请求
  const topicsQuery = useQuery({
    queryKey: ['policy-topics'],
    queryFn: fetchPolicyTopics,
    staleTime: 5 * 60_000,
  });
  const allTopics = topicsQuery.data?.data ?? [];

  if (!enabled) return null;

  const items = data?.data ?? [];

  // 主题色阶(取中亮档作为 drawer 强调色)— 同 MapShell 用字典序 index 分配
  const topicScale = topic ? getTopicColorScale(topic, allTopics) : palette.policyColoring.scales[0];
  const topicAccent = topicScale[3];

  const headerText = (() => {
    if (mode === 'national') return '国家级政策';
    if (cityName) return cityName;
    if (regionCode) {
      const name = regionCodeToName(regionCode);
      return name ?? regionCode;
    }
    return '';
  })();

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        right: 60,
        top: 16,
        width: 380,
        maxHeight: 'calc(100vh - 64px - 32px)',
        padding: 16,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        background: palette.bgPanel,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space size={8}>
          <Text strong style={{ color: topicAccent, fontSize: 15 }}>
            {headerText}
          </Text>
          <Tag style={{ margin: 0, background: `${topicAccent}33`, border: `1px solid ${topicAccent}66`, color: palette.textBase }}>
            {topic}
          </Tag>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="关闭"
          style={{ color: palette.textMuted }}
        />
      </div>

      <Text type="secondary" style={{ fontSize: 11, marginBottom: 8 }}>
        {isLoading ? '加载中…' : `共 ${items.length} 条`}
      </Text>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty
            description={<Text type="secondary" style={{ fontSize: 12 }}>该范围下暂无政策</Text>}
            imageStyle={{ height: 60 }}
          />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {items.map((p) => (
              <Card
                key={p.id}
                size="small"
                style={{
                  border: `1px solid ${topicAccent}33`,
                  background: `${topicAccent}08`,
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space size={6} wrap>
                    <Tag color={LEVEL_TAG_COLOR[p.level]} style={{ margin: 0 }}>
                      {LEVEL_LABEL[p.level]}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{p.issueDate}</Text>
                    {p.cityName && (
                      <Text type="secondary" style={{ fontSize: 11 }}>· {p.cityName}</Text>
                    )}
                  </Space>
                  <Text strong style={{ fontSize: 13, color: palette.textBase, lineHeight: 1.4 }}>
                    {p.title}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>
                    {p.issuingOrg}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.textBase, opacity: 0.85, lineHeight: 1.5 }}>
                    {p.summary}
                  </Text>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </div>
    </div>
  );
}
