import { useState } from 'react';
import { Card, Drawer, Empty, Space, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { ThemeByRegionResult } from '@pop/shared-types';
import { fetchThemesByRegion } from '@/api/themes';
import { regionCodeToName } from '@/lib/region-names';
import { palette } from '@/tokens';

const { Text } = Typography;

interface Props {
  regionCode: string | null;
  selectedThemeIds: string[];
  /** ECharts 实例,从 MapCanvas onChartReady 拿到 */
  chart: unknown | null;
  onClose: () => void;
}

// 最小 ECharts 接口 — 避免引 echarts type 包
interface EChartsLike {
  dispatchAction: (action: Record<string, unknown>) => void;
}

export function PolicyRegionDrawer({ regionCode, selectedThemeIds, chart, onClose }: Props) {
  const [pulsedThemeId, setPulsedThemeId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['themes-by-region', regionCode, selectedThemeIds],
    queryFn: () => fetchThemesByRegion(regionCode!, selectedThemeIds),
    enabled: !!regionCode && selectedThemeIds.length > 0,
  });

  const handlePulse = (item: ThemeByRegionResult) => {
    if (!chart) return;
    const c = chart as EChartsLike;
    // 高亮当前 region 自己 + 闪 1s
    const name = regionCode ? regionCodeToName(regionCode) : null;
    if (!name) return;

    c.dispatchAction({ type: 'highlight', geoIndex: 0, name: [name] });
    setPulsedThemeId(item.theme.id);

    setTimeout(() => {
      c.dispatchAction({ type: 'downplay', geoIndex: 0, name: [name] });
      setPulsedThemeId(null);
    }, 1000);
  };

  const regionName = regionCode ? (regionCodeToName(regionCode) ?? regionCode) : '';
  const items = data?.data ?? [];

  return (
    <Drawer
      title={
        <Space>
          <Text strong>{regionName}</Text>
          <Tag color="blue">政策覆盖</Tag>
        </Space>
      }
      placement="right"
      width={400}
      open={!!regionCode}
      onClose={onClose}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="该区域无相关政策(当前涂层覆盖)" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {items.map((item) => {
            const isMain = item.theme.template === 'main';
            const themeColor = isMain ? '#52c41a' : '#ff4d4f';
            return (
              <Card
                key={item.theme.id}
                hoverable
                size="small"
                onClick={() => handlePulse(item)}
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${themeColor}66`,
                  background: `${themeColor}11`,
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={isMain ? 'green' : 'red'}>
                      {isMain ? '主线' : '风险'}
                    </Tag>
                    <Text strong style={{ fontSize: 14 }}>{item.theme.title}</Text>
                    {pulsedThemeId === item.theme.id && (
                      <Tag color="blue" style={{ marginLeft: 4 }}>已闪烁</Tag>
                    )}
                  </Space>
                  <Space size={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      主属性值:<Text strong style={{ color: palette.primary }}>
                        {item.coverage.mainValue}
                      </Text>
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      区划级:{item.coverage.regionLevel === 'province' ? '省'
                        : item.coverage.regionLevel === 'city' ? '市' : '区'}
                    </Text>
                  </Space>
                  {item.theme.regionScope && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.theme.regionScope}
                    </Text>
                  )}
                </Space>
              </Card>
            );
          })}
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
            点击主题在地图上闪烁该区域 1 秒
          </Text>
        </Space>
      )}
    </Drawer>
  );
}
