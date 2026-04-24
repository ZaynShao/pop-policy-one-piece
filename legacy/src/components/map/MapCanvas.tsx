import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Button, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMapStore } from '@/stores/mapStore';
import { useVisitStore } from '@/stores/visitStore';
import { usePinStore } from '@/stores/pinStore';
import { usePolicyStore } from '@/stores/policyStore';
import { VISIT_COLOR_HEX, type Pin, type VisitRecord, type Policy } from '@/types';
import { provinceNameToCode } from '@/utils/region';
import { resolveCoord, findProvince } from '@/mock/regions';

type LoadedMap = { key: string; name: string };

interface Props {
  onVisitClick?: (visit: VisitRecord) => void;
  onPinClick?: (pin: Pin) => void;
}

export default function MapCanvas({ onVisitClick, onPinClick }: Props) {
  const mode = useMapStore((s) => s.mode);
  const currentProvinceCode = useMapStore((s) => s.currentProvinceCode);
  const drillTo = useMapStore((s) => s.drillTo);
  const selectedPolicyIds = useMapStore((s) => s.selectedPolicyIds);
  const visits = useVisitStore((s) => s.visits);
  const pins = usePinStore((s) => s.pins);
  const policies = usePolicyStore((s) => s.policies);

  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    let cancelled = false;
    const key = currentProvinceCode ? `province_${currentProvinceCode}` : 'china';
    const url = currentProvinceCode
      ? `/geojson/provinces/${currentProvinceCode}.json`
      : `/geojson/china.json`;
    const displayName = currentProvinceCode
      ? findProvince(currentProvinceCode)?.name ?? '省份'
      : '中国';
    setLoaded(null);
    fetch(url)
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        echarts.registerMap(key, geo);
        setLoaded({ key, name: displayName });
      })
      .catch((err) => {
        console.error('GeoJSON load failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProvinceCode]);

  const selectedPolicies = useMemo<Policy[]>(
    () => policies.filter((p) => selectedPolicyIds.includes(p.id)),
    [policies, selectedPolicyIds],
  );

  const option = useMemo(() => {
    if (!loaded) return null;
    const isChinaView = !currentProvinceCode;
    const mapKey = loaded.key;

    // 暗色 geo 基础层（深蓝底 + 青色边框）
    const baseGeo: any = {
      map: mapKey,
      roam: false,
      silent: false,
      label: {
        show: isChinaView,
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
          borderColor: '#00d4ff',
          borderWidth: 1.5,
        },
      },
      select: { disabled: true },
    };

    const series: any[] = [];

    // ===== 属地大盘：拜访彩色点 + 图钉 =====
    if (mode === 'region') {
      const relevantVisits = isChinaView
        ? visits
        : visits.filter((v) => v.provinceCode === currentProvinceCode);

      // 红点用 effectScatter 制造脉动效果
      const redVisits = relevantVisits.filter((v) => v.color === 'red');
      const otherVisits = relevantVisits.filter((v) => v.color !== 'red');

      const toPoint = (v: VisitRecord, emphasize = false) => {
        const coord = resolveCoord(v.provinceCode, v.cityCode, v.districtCode);
        if (!coord) return null;
        const hex = VISIT_COLOR_HEX[v.color];
        return {
          name: v.cityName + (v.districtName ? ` · ${v.districtName}` : ''),
          value: [...coord, 1],
          itemStyle: {
            color: hex,
            shadowBlur: emphasize ? 18 : 10,
            shadowColor: hex,
            borderColor: 'rgba(255, 255, 255, 0.9)',
            borderWidth: 1,
          },
          _visitId: v.id,
        };
      };

      if (otherVisits.length > 0) {
        series.push({
          name: 'visits',
          type: 'scatter',
          coordinateSystem: 'geo',
          symbolSize: isChinaView ? 9 : 15,
          data: otherVisits.map((v) => toPoint(v)).filter(Boolean),
          emphasis: {
            scale: 1.5,
            itemStyle: { shadowBlur: 24 },
          },
          tooltip: {
            formatter: (p: any) => {
              const v = relevantVisits.find((x) => x.id === p.data._visitId);
              if (!v) return '';
              return renderVisitTip(v);
            },
          },
          zlevel: 2,
        });
      }

      if (redVisits.length > 0) {
        series.push({
          name: 'visits',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          symbolSize: isChinaView ? 11 : 17,
          rippleEffect: { period: 3, scale: 3.2, brushType: 'stroke' },
          data: redVisits.map((v) => toPoint(v, true)).filter(Boolean),
          tooltip: {
            formatter: (p: any) => {
              const v = relevantVisits.find((x) => x.id === p.data._visitId);
              if (!v) return '';
              return renderVisitTip(v);
            },
          },
          zlevel: 3,
        });
      }

      // 图钉
      const relevantPins = isChinaView
        ? pins
        : pins.filter((p) => p.provinceCode === currentProvinceCode);
      const pinData = relevantPins
        .map((p) => {
          const coord = resolveCoord(p.provinceCode, p.cityCode);
          if (!coord) return null;
          const statusColor =
            p.status === 'done'
              ? '#52c41a'
              : p.status === 'cancelled'
                ? '#8ba3c7'
                : '#fa541c';
          return {
            name: p.cityName,
            value: [...coord, 2],
            symbol: 'pin',
            symbolSize: isChinaView ? 28 : 40,
            itemStyle: {
              color: statusColor,
              shadowBlur: 14,
              shadowColor: statusColor,
              opacity: 0.95,
            },
            _pinId: p.id,
          };
        })
        .filter(Boolean);

      if (pinData.length > 0) {
        series.push({
          name: 'pins',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: pinData,
          emphasis: { scale: 1.2 },
          tooltip: {
            formatter: (p: any) => {
              const pin = relevantPins.find((x) => x.id === p.data._pinId);
              if (!pin) return '';
              return renderPinTip(pin);
            },
          },
          zlevel: 4,
        });
      }
    }

    // ===== 政策大盘：色块 + 点 =====
    if (mode === 'policy' && selectedPolicies.length > 0) {
      selectedPolicies.forEach((policy, idx) => {
        const coveredNames = new Set<string>();
        if (isChinaView) {
          policy.coverage.forEach((c) => {
            const p = findProvince(c.provinceCode);
            if (p) coveredNames.add(p.name);
          });
        } else {
          policy.coverage
            .filter((c) => c.provinceCode === currentProvinceCode)
            .forEach((c) => {
              const p = findProvince(c.provinceCode);
              if (!p) return;
              if (c.cityCode) {
                const city = p.children?.find((x) => x.code === c.cityCode);
                if (city) coveredNames.add(city.name);
              }
            });
        }

        series.push({
          name: policy.name,
          type: 'map',
          map: mapKey,
          roam: false,
          silent: true,
          label: { show: false },
          itemStyle: {
            areaColor: 'transparent',
            borderColor: 'transparent',
          },
          emphasis: { disabled: true },
          data: Array.from(coveredNames).map((name) => ({
            name,
            value: idx + 1,
            itemStyle: {
              areaColor: policy.color,
              opacity: selectedPolicies.length > 1 ? 0.32 : 0.5,
              borderColor: policy.color,
              borderWidth: 1,
              shadowColor: policy.color,
              shadowBlur: 12,
            },
          })),
          zlevel: 1,
        });
      });

      // 区级覆盖散点
      selectedPolicies.forEach((policy) => {
        const districtCoverage = policy.coverage.filter((c) => c.districtCode);
        const byCity = new Map<string, number>();
        districtCoverage.forEach((c) => {
          const key = `${c.provinceCode}|${c.cityCode}`;
          byCity.set(key, (byCity.get(key) ?? 0) + 1);
        });

        const dots = districtCoverage
          .filter((c) => (isChinaView ? true : c.provinceCode === currentProvinceCode))
          .map((c) => {
            const coord = resolveCoord(c.provinceCode, c.cityCode, c.districtCode);
            if (!coord) return null;
            const count = byCity.get(`${c.provinceCode}|${c.cityCode}`) ?? 1;
            const size = isChinaView ? 4 + Math.min(count, 6) : 8 + count * 2;
            return {
              name: policy.name,
              value: [...coord, count],
              symbolSize: size,
              itemStyle: {
                color: policy.color,
                opacity: 0.95,
                shadowBlur: 12,
                shadowColor: policy.color,
              },
            };
          })
          .filter(Boolean);

        if (dots.length > 0) {
          series.push({
            name: `${policy.name} · 区覆盖`,
            type: 'scatter',
            coordinateSystem: 'geo',
            data: dots,
            zlevel: 2,
          });
        }
      });
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(7, 15, 31, 0.95)',
        borderColor: 'rgba(0, 212, 255, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#e6f4ff', fontSize: 12 },
        extraCssText:
          'box-shadow: 0 0 20px rgba(0,212,255,0.25); backdrop-filter: blur(8px);',
      },
      geo: baseGeo,
      series,
    };
  }, [loaded, mode, currentProvinceCode, visits, pins, selectedPolicies]);

  const onEvents = {
    click: (params: any) => {
      if (params.seriesName === 'pins' && params.data?._pinId) {
        const pin = pins.find((p) => p.id === params.data._pinId);
        if (pin) onPinClick?.(pin);
        return;
      }
      if (params.seriesName === 'visits' && params.data?._visitId) {
        const v = visits.find((x) => x.id === params.data._visitId);
        if (v) onVisitClick?.(v);
        return;
      }
      if (params.componentType === 'geo' && !currentProvinceCode) {
        const code = provinceNameToCode(params.name);
        if (code) drillTo(code);
      }
    },
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background:
          'radial-gradient(ellipse at 55% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 55%), #0a1628',
      }}
    >
      {/* 背景网格线装饰 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)',
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
          <Spin tip="加载地图数据…">
            <div style={{ padding: 24 }} />
          </Spin>
        </div>
      )}
      {currentProvinceCode && (
        <Space style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => drillTo(null)}
            className="glass-panel"
            style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--panel-border)',
              color: 'var(--text-primary)',
            }}
          >
            返回全国
          </Button>
          <span
            className="glass-panel"
            style={{
              padding: '4px 14px',
              fontWeight: 600,
              color: 'var(--accent)',
              textShadow: '0 0 8px var(--accent-glow)',
              fontSize: 13,
            }}
          >
            {loaded?.name ?? ''}
          </span>
        </Space>
      )}
      {loaded && option && (
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          style={{ width: '100%', height: '100%' }}
          onEvents={onEvents}
        />
      )}
    </div>
  );
}

function renderVisitTip(v: VisitRecord) {
  const color = VISIT_COLOR_HEX[v.color];
  return `
    <div style="padding:2px 0; min-width:200px">
      <div style="color:${color}; font-weight:600; margin-bottom:4px">
        ● ${v.cityName}${v.districtName ? ' · ' + v.districtName : ''}
      </div>
      <div style="color:#8ba3c7; font-size:11px">${v.department}</div>
      <div style="color:#e6f4ff; margin-top:4px; line-height:1.5">${v.content}</div>
    </div>`;
}

function renderPinTip(p: Pin) {
  return `
    <div style="padding:2px 0; min-width:220px">
      <div style="color:#fa541c; font-weight:600; margin-bottom:4px">
        📌 ${p.title}
      </div>
      <div style="color:#8ba3c7; font-size:11px">${p.cityName}</div>
      <div style="color:#e6f4ff; margin-top:4px; line-height:1.5">${p.goal}</div>
    </div>`;
}
