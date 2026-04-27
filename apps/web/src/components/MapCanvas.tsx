import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Slider, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  loadAllCities,
  loadChinaMap,
  loadProvinceMap,
  provinceNameToCode,
  type GeoJsonFC,
} from '@/lib/china-map';
import {
  generateScatterPoints,
  STATUS_LEGEND,
  type ScatterDatum,
  type RegionSeed,
} from '@/lib/mock-heatmap';
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
  /** 当前层 mock 散点(c2 v3 喂 series.scatter,每点带状态色) */
  scatter: ScatterDatum[];
}

function extractSeeds(geo: GeoJsonFC): RegionSeed[] {
  return featuresToSeeds(geo.features);
}

function featuresToSeeds(features: GeoJsonFC['features']): RegionSeed[] {
  const seeds: RegionSeed[] = [];
  for (const f of features) {
    const c = f.properties.center ?? f.properties.centroid;
    if (!c) continue;
    seeds.push({
      adcode: String(f.properties.adcode),
      center: c,
      provinceCode: f.properties.parent ? String(f.properties.parent.adcode) : undefined,
    });
  }
  return seeds;
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
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_DEFAULT = 1.2;

export function MapCanvas({
  provinceCode,
  onProvinceChange,
  onRegionClick,
}: Props) {
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);
  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setZoom(ZOOM_DEFAULT);
    // c2 数据生成参数:
    // - keepRate 0.5:dropout 一半(模拟初期数据稀疏)
    // - maxBluePerProvince 2:每省蓝点最多 2 个(业务直觉)
    // - 全国级:每市 1 点 radius 0;省下钻:每市 5 点 radius 0.15°
    const SCATTER_OPTS_COMMON = { keepRate: 0.5, maxBluePerProvince: 2 };
    const task: Promise<LoadedInfo> = provinceCode
      ? loadProvinceMap(provinceCode).then((geo) => ({
          key: `province_${provinceCode}`,
          name: geo.features[0]?.properties?.name ?? '省份',
          scatter: generateScatterPoints(extractSeeds(geo), {
            ...SCATTER_OPTS_COMMON,
            pointsPerRegion: 5,
            radius: 0.15,
          }),
        }))
      : Promise.all([loadChinaMap(), loadAllCities()]).then(([_, cities]) => ({
          key: 'china',
          name: '中国',
          scatter: generateScatterPoints(featuresToSeeds(cities), {
            ...SCATTER_OPTS_COMMON,
            pointsPerRegion: 1,
            radius: 0,
          }),
        }));
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
        // c2 v3 v2:zoom 由右侧 Slider 控件驱动(React state),
        // 禁用 ECharts 内置 roam(用户拍 · 不要滚轮缩放)
        zoom,
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
      series: [
        {
          // c2 scatter 离散散点 + 每点状态色
          // 对齐 PRD B1(密度通过散布表达)+ B2(红/黄/绿)+ B3(蓝点)
          // symbolSize 全国 5(星星点点)/ 省下钻 10(密集态)
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          symbolSize: provinceCode ? 10 : 5,
          itemStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.4)',
            opacity: 0.92,
          },
          data: loaded.scatter,
          z: 5,
        },
      ],
    };
  }, [loaded, provinceCode, zoom]);

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

      {/* 四色 legend(c2 v3 打磨)— 画布底部居中,贴近地图主体;
          放大字号/圆点(用户拍:离地图近 + 大一点) */}
      {loaded && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 5,
            padding: '12px 24px',
            background: palette.bgPanel,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            gap: 28,
            alignItems: 'center',
            fontSize: 14,
            color: palette.textBase,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
          }}
        >
          {STATUS_LEGEND.map((s) => (
            <span key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: s.color,
                  boxShadow: `0 0 6px ${s.color}`,
                }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* 右侧 zoom slider(c2 v3 v2)— 用户拍 · 可拖拽控件,
          替代滚轮缩放。位置避开右下 ➕📌(在 right:24 bottom:24 起占 ~92h) */}
      {loaded && (
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 80,
            zIndex: 6,
            padding: '12px 8px',
            background: palette.bgPanel,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
          }}
        >
          <span style={{ fontSize: 11, color: palette.textMuted }}>
            {Math.round(zoom * 100)}%
          </span>
          <div style={{ height: 220 }}>
            <Slider
              vertical
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.1}
              value={zoom}
              onChange={(v) => setZoom(typeof v === 'number' ? v : ZOOM_DEFAULT)}
              tooltip={{ formatter: (v) => `${Math.round((v ?? 1) * 100)}%` }}
            />
          </div>
          <Button
            type="text"
            size="small"
            onClick={() => setZoom(ZOOM_DEFAULT)}
            style={{ fontSize: 11, color: palette.textMuted, padding: '0 4px', height: 22 }}
          >
            复位
          </Button>
        </div>
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
