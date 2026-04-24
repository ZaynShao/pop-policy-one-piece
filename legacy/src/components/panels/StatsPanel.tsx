import { useMemo } from 'react';
import { Typography } from 'antd';
import dayjs from 'dayjs';
import { useVisitStore } from '@/stores/visitStore';
import { usePinStore } from '@/stores/pinStore';
import { useMapStore } from '@/stores/mapStore';
import { usePolicyStore } from '@/stores/policyStore';
import { findProvince } from '@/mock/regions';

const { Text } = Typography;

interface StatItem {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}

export default function StatsPanel() {
  const visits = useVisitStore((s) => s.visits);
  const pins = usePinStore((s) => s.pins);
  const mode = useMapStore((s) => s.mode);
  const currentProvinceCode = useMapStore((s) => s.currentProvinceCode);
  const selectedPolicyIds = useMapStore((s) => s.selectedPolicyIds);
  const policies = usePolicyStore((s) => s.policies);

  const title = useMemo(() => {
    if (currentProvinceCode) {
      return findProvince(currentProvinceCode)?.name ?? '区域视图';
    }
    return '全国总览';
  }, [currentProvinceCode]);

  const scoped = useMemo(
    () =>
      currentProvinceCode
        ? visits.filter((v) => v.provinceCode === currentProvinceCode)
        : visits,
    [visits, currentProvinceCode],
  );

  const stats: StatItem[] = useMemo(() => {
    if (mode === 'region') {
      const weekAgo = dayjs().subtract(7, 'day');
      const weekCount = scoped.filter((v) =>
        dayjs(v.visitedAt ?? v.plannedAt ?? v.createdAt).isAfter(weekAgo),
      ).length;
      const red = scoped.filter((v) => v.color === 'red').length;
      const yellow = scoped.filter((v) => v.color === 'yellow').length;
      const planned = scoped.filter((v) => v.status === 'planned').length;
      const cities = new Set(scoped.map((v) => v.cityCode)).size;
      const activePins = (
        currentProvinceCode
          ? pins.filter((p) => p.provinceCode === currentProvinceCode)
          : pins
      ).filter((p) => p.status === 'active').length;
      return [
        { label: '拜访总数', value: scoped.length, sub: '累计' },
        { label: '近 7 日新增', value: weekCount, sub: '拜访' },
        { label: '覆盖城市', value: cities, sub: '个' },
        {
          label: '风险 / 紧急',
          value: red,
          sub: '红点',
          accent: '#ff4d4f',
        },
        {
          label: '价值政策',
          value: yellow,
          sub: '黄点',
          accent: '#faad14',
        },
        { label: '计划蓝点', value: planned, sub: '待执行', accent: '#1677ff' },
        {
          label: '活跃图钉',
          value: activePins,
          sub: '进行中',
          accent: '#fa541c',
        },
      ];
    }
    // 政策大盘
    const selPolicies = policies.filter((p) =>
      selectedPolicyIds.includes(p.id),
    );
    const activePolicies = selPolicies.length;
    const totalCoverage = selPolicies.reduce(
      (acc, p) => acc + p.coverage.length,
      0,
    );
    const provinceCovered = new Set(
      selPolicies.flatMap((p) => p.coverage.map((c) => c.provinceCode)),
    ).size;
    const cityCovered = new Set(
      selPolicies
        .flatMap((p) => p.coverage.filter((c) => c.cityCode).map((c) => c.cityCode!)),
    ).size;
    const districtCovered = selPolicies
      .flatMap((p) => p.coverage.filter((c) => c.districtCode))
      .length;
    return [
      { label: '主线政策（清单）', value: policies.length, sub: '条' },
      { label: '当前叠加', value: activePolicies, sub: '政策' },
      { label: '覆盖省份', value: provinceCovered, sub: '个' },
      { label: '覆盖地市', value: cityCovered, sub: '个' },
      { label: '区级点数', value: districtCovered, sub: '个' },
      { label: '覆盖总条目', value: totalCoverage, sub: '条' },
    ];
  }, [mode, scoped, pins, currentProvinceCode, policies, selectedPolicyIds]);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 260,
        padding: 18,
        zIndex: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
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
        <span className="glow-title" style={{ fontSize: 15, fontWeight: 700 }}>
          {title}
        </span>
      </div>
      <Text style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        {mode === 'region' ? '属地 GA 拜访工作数据' : '主线政策覆盖数据'}
      </Text>
      <div
        style={{
          margin: '14px 0 10px',
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.3) 50%, transparent 100%)',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.12)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 2,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: s.accent ?? 'var(--accent)',
                textShadow: `0 0 10px ${s.accent ?? 'var(--accent-glow)'}55`,
                lineHeight: 1.2,
              }}
            >
              {s.value}
              {s.sub && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontWeight: 400,
                    marginLeft: 4,
                  }}
                >
                  {s.sub}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
