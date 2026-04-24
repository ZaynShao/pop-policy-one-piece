import { useMemo } from 'react';
import { Typography } from 'antd';
import { useVisitStore } from '@/stores/visitStore';
import { usePolicyStore } from '@/stores/policyStore';
import { useMapStore } from '@/stores/mapStore';
import { findProvince } from '@/mock/regions';

const { Text } = Typography;

interface Row {
  key: string;
  primary: string;
  secondary?: string;
  score: number;
  color?: string;
}

export default function TopRankPanel() {
  const visits = useVisitStore((s) => s.visits);
  const policies = usePolicyStore((s) => s.policies);
  const mode = useMapStore((s) => s.mode);
  const currentProvinceCode = useMapStore((s) => s.currentProvinceCode);
  const selectedPolicyIds = useMapStore((s) => s.selectedPolicyIds);

  const rows: Row[] = useMemo(() => {
    if (mode === 'region') {
      // 城市热度排行（过滤当前视图）
      const scoped = currentProvinceCode
        ? visits.filter((v) => v.provinceCode === currentProvinceCode)
        : visits;
      const agg = new Map<
        string,
        { city: string; province: string; score: number; red: number }
      >();
      scoped.forEach((v) => {
        const key = `${v.provinceCode}|${v.cityCode}`;
        const cur = agg.get(key) ?? {
          city: v.cityName,
          province: v.provinceName,
          score: 0,
          red: 0,
        };
        // 颜色权重：红=3 黄=2 绿=1 蓝=0.5
        const weight =
          v.color === 'red'
            ? 3
            : v.color === 'yellow'
              ? 2
              : v.color === 'green'
                ? 1
                : 0.5;
        cur.score += weight;
        if (v.color === 'red') cur.red += 1;
        agg.set(key, cur);
      });
      return Array.from(agg.entries())
        .map(([key, x]) => ({
          key,
          primary: x.city,
          secondary: x.province,
          score: Number(x.score.toFixed(1)),
          color: x.red > 0 ? '#ff4d4f' : undefined,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    }
    // 政策大盘：按覆盖条目数排行
    const source =
      selectedPolicyIds.length > 0
        ? policies.filter((p) => selectedPolicyIds.includes(p.id))
        : policies;
    return source
      .map((p) => {
        const provinces = new Set(p.coverage.map((c) => c.provinceCode));
        const list = Array.from(provinces)
          .map((code) => findProvince(code)?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(' · ');
        return {
          key: p.id,
          primary: p.name,
          secondary: list,
          score: p.coverage.length,
          color: p.color,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [mode, visits, policies, currentProvinceCode, selectedPolicyIds]);

  const title = mode === 'region' ? '城市工作热度 TOP' : '政策覆盖 TOP';
  const scoreLabel = mode === 'region' ? '热度分' : '覆盖数';
  const maxScore = rows[0]?.score ?? 1;

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        width: 280,
        padding: 16,
        zIndex: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 3,
              height: 14,
              background: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent-glow)',
              borderRadius: 2,
            }}
          />
          <span className="glow-title" style={{ fontSize: 14, fontWeight: 700 }}>
            {title}
          </span>
        </div>
        <Text style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          {scoreLabel}
        </Text>
      </div>
      {rows.length === 0 ? (
        <Text style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          {mode === 'policy'
            ? '勾选左侧政策查看覆盖排行'
            : '暂无数据'}
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, idx) => {
            const pct = (r.score / maxScore) * 100;
            const barColor = r.color ?? '#00d4ff';
            return (
              <div key={r.key} style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 3,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 3,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        background:
                          idx === 0
                            ? '#ff4d4f'
                            : idx === 1
                              ? '#fa8c16'
                              : idx === 2
                                ? '#faad14'
                                : 'rgba(0, 212, 255, 0.15)',
                        color: idx < 3 ? '#fff' : 'var(--accent)',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                      }}
                    >
                      {r.primary}
                    </span>
                    {r.secondary && (
                      <span
                        style={{ color: 'var(--text-dim)', fontSize: 11 }}
                      >
                        {r.secondary}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      color: barColor,
                      fontWeight: 700,
                      fontSize: 13,
                      textShadow: `0 0 6px ${barColor}88`,
                    }}
                  >
                    {r.score}
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: 'rgba(0, 212, 255, 0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${barColor}44 0%, ${barColor} 100%)`,
                      boxShadow: `0 0 8px ${barColor}88`,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
