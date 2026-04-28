import { useState } from 'react';
import { Button, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
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

/**
 * 政策大盘 region 浮窗(B7-B9 用户拍 — 抽屉太占空间换浮窗)
 *
 * 展示当前涂层覆盖该 region 的主题列表,点 card 触发反查闪烁。
 * absolute 玻璃卡片 right:24 / top:16,跟左面板对称,不挤压地图。
 */
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

  if (!regionCode) return null;

  const regionName = regionCodeToName(regionCode) ?? regionCode;
  const items = data?.data ?? [];

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        right: 60, // 留出 zoom slider 空间(slider 在 right:28)
        top: 16,
        width: 360,
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
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text strong style={{ color: palette.primary, fontSize: 15 }}>{regionName}</Text>
          <Tag color="blue" style={{ margin: 0 }}>政策覆盖</Tag>
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

      {/* 主体 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty
            description={<Text type="secondary" style={{ fontSize: 12 }}>该区域无相关政策(当前涂层覆盖)</Text>}
            imageStyle={{ height: 60 }}
          />
        ) : (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
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
                    <Space wrap>
                      <Tag color={isMain ? 'green' : 'red'} style={{ margin: 0 }}>
                        {isMain ? '主线' : '风险'}
                      </Tag>
                      <Text strong style={{ fontSize: 13 }}>{item.theme.title}</Text>
                      {pulsedThemeId === item.theme.id && (
                        <Tag color="blue" style={{ margin: 0 }}>已闪烁</Tag>
                      )}
                    </Space>
                    <Space size={12} wrap>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        主属性值:
                        <Text strong style={{ color: palette.primary, marginLeft: 4 }}>
                          {item.coverage.mainValue}
                        </Text>
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
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
            <Text type="secondary" style={{ fontSize: 10, textAlign: 'center', display: 'block', marginTop: 4 }}>
              点击主题在地图上闪烁该区域 1 秒
            </Text>
          </Space>
        )}
      </div>
    </div>
  );
}
