import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  loadChinaMap,
  loadProvinceMap,
  provinceNameToCode,
} from '@/lib/china-map';
import { palette } from '@/tokens';

interface Props {
  /** 当前下钻到的省份 adcode;null / undefined = 全国视图 */
  provinceCode?: string | null;
  /** 切换下钻;null 表示回全国 */
  onProvinceChange?: (code: string | null) => void;
  /** 通用 region click 回调(下钻 / 省内点击都触发,V0.5 真业务接) */
  onRegionClick?: (info: {
    level: 'country' | 'province';
    code: string | null;
    name: string;
  }) => void;
}

interface LoadedInfo {
  key: string;
  /** 当前显示名(全国 = "中国",单省 = 省名) */
  name: string;
}

/**
 * 中国地图渲染组件(V0.4 c1 · 精简版抄 legacy MapCanvas)
 *
 * c1 范围:
 * - 35 regions 多边形渲染(暗色 geo + 青色边框,对齐 V0.3 token)
 * - hover 高亮(青色填充 + 加粗边框 + 显示省名 label)
 * - click 全国视图任一省 → 下钻到该省 + console.log 省 code/name
 * - 下钻态点击 → console.log(c1 不下钻到市,V0.5+ 再做)
 * - 「返回全国」按钮(下钻态显示)
 *
 * 不含(留给 V0.5+):
 * - 蓝点 / 拜访点 / 图钉 / 涂层等业务图层
 * - 真热力数据
 * - 多层级联(省 → 市 → 区)
 */
export function MapCanvas({
  provinceCode,
  onProvinceChange,
  onRegionClick,
}: Props) {
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    const task = provinceCode
      ? loadProvinceMap(provinceCode).then((geo) => ({
          key: `province_${provinceCode}`,
          name: geo.features[0]?.properties?.name ?? '省份',
        }))
      : loadChinaMap().then(() => ({ key: 'china', name: '中国' }));
    task
      .then((info) => {
        if (!cancelled) setLoaded(info);
      })
      .catch((err) => {
        console.error('[MapCanvas] geo load error', err);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  const option = useMemo(() => {
    if (!loaded) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: (p: { name?: string }) => p.name ?? '' },
      geo: {
        map: loaded.key,
        roam: false,
        label: {
          show: !provinceCode,
          fontSize: 10,
          color: 'rgba(139, 163, 199, 0.55)',
        },
        itemStyle: {
          areaColor: 'rgba(13, 31, 53, 0.85)',
          borderColor: 'rgba(0, 212, 255, 0.28)',
          borderWidth: 0.8,
          shadowColor: 'rgba(0, 212, 255, 0.15)',
          shadowBlur: 8,
        },
        emphasis: {
          label: {
            show: true,
            color: '#e6f4ff',
            fontWeight: 600,
            fontSize: 11,
          },
          itemStyle: {
            areaColor: 'rgba(0, 212, 255, 0.18)',
            borderColor: palette.primary,
            borderWidth: 1.5,
          },
        },
        select: { disabled: true },
      },
    };
  }, [loaded, provinceCode]);

  const onEvents = {
    click: (params: { componentType?: string; name?: string }) => {
      if (params.componentType !== 'geo' || !params.name) return;
      const name = params.name;
      if (!provinceCode) {
        const code = provinceNameToCode(name);
        if (code) {
          // eslint-disable-next-line no-console
          console.log('[MapCanvas] 下钻 → 省', { code, name });
          onProvinceChange?.(code);
          onRegionClick?.({ level: 'country', code, name });
        } else {
          // eslint-disable-next-line no-console
          console.warn('[MapCanvas] 全国 click 未匹配省 adcode', { name });
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('[MapCanvas] 省内点击', { provinceCode, name });
        onRegionClick?.({ level: 'province', code: null, name });
      }
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 暗色背景 + 网格装饰(对齐 legacy 视觉) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 55% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 55%), #0a1628',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />

      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size="large" />
        </div>
      )}

      {/* 「返回全国」按钮 — 仅下钻态显示;放在 toggle 把手右侧避开浮玻璃面板 */}
      {provinceCode && loaded && (
        <Space
          style={{
            position: 'absolute',
            top: 16,
            left: 332, // 浮面板 left:16+宽 280+把手 28+间距 8 = 332
            zIndex: 5,
          }}
        >
          <Button
            type="primary"
            icon={<ArrowLeftOutlined />}
            onClick={() => onProvinceChange?.(null)}
          >
            返回全国
          </Button>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: palette.bgPanel,
              border: `1px solid ${palette.border}`,
              color: palette.primary,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {loaded.name}
          </span>
        </Space>
      )}

      {loaded && option && (
        <ReactECharts
          option={option}
          notMerge
          style={{ width: '100%', height: '100%' }}
          onEvents={onEvents}
        />
      )}
    </div>
  );
}
