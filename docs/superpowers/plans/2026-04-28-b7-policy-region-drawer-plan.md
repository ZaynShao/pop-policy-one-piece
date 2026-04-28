# V0.7 patch · B7-B9 政策大盘交互升级 实施 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把政策大盘补成完整闭环:看(涂层)→ 问(点 region 弹抽屉)→ 反查(点主题闪其他覆盖区)→ 下钻(二次点击)。

**Architecture:** MapShell 加 `selectedRegionCode` state → MapCanvas 注入 geo.regions[] 浮起视觉 + 二段 click 区分选中/下钻 → PolicyRegionDrawer 拉 `GET /themes/by-region` 数据 + dispatchAction highlight/downplay 反查闪烁。

**Tech Stack:** NestJS(themes service `findByRegion` + controller endpoint)+ React 18 + react-query + ECharts highlight API + antd Drawer。

**Spec:** `docs/superpowers/specs/2026-04-28-b7-policy-region-drawer-design.md`

—

## Task 1:后端 service `findByRegion` + spec 测试

**Files:**
- Modify: `apps/api/src/themes/themes.service.ts`
- Modify: `apps/api/src/themes/__tests__/themes.service.spec.ts`

—

- [ ] **Step 1.1: 写 service 方法骨架**

在 `themes.service.ts` 类内末尾(`unarchive` 方法后)加:

```ts
/**
 * 反查 — 给定 regionCode 返回所有 cover 该 region 的已发布主题
 * Q4 endpoint: GET /api/v1/themes/by-region
 *
 * @param regionCode 6 位 adcode(广东 440000 / 广州 440100 等)
 * @param selectedIds 可选,前端传当前 3 层涂层 id 过滤(MVP Q2=X)
 */
async findByRegion(
  regionCode: string,
  selectedIds?: string[],
): Promise<Array<{
  theme: ThemeEntity;
  coverage: { regionCode: string; regionLevel: ThemeRegionLevel; mainValue: number };
}>> {
  const qb = this.coverageRepo
    .createQueryBuilder('cov')
    .innerJoinAndSelect('cov.theme', 'theme')
    .where('cov.region_code = :code', { code: regionCode })
    .andWhere(`theme.status = 'published'`)
    .andWhere('theme.deleted_at IS NULL')
    .orderBy('theme.created_at', 'DESC');

  if (selectedIds && selectedIds.length > 0) {
    qb.andWhere('theme.id IN (:...selectedIds)', { selectedIds });
  }

  const rows = await qb.getMany();
  return rows.map((cov) => ({
    theme: cov.theme!,
    coverage: {
      regionCode: cov.regionCode,
      regionLevel: cov.regionLevel,
      mainValue: cov.mainValue,
    },
  }));
}
```

需要在文件顶部 import `ThemeRegionLevel`(已经有 `import type { ThemeRegionLevel } from '@pop/shared-types'`,看现有 import 是否齐全)。

- [ ] **Step 1.2: 写测试 case**

在 `__tests__/themes.service.spec.ts` 现有 describe 块尾加:

```ts
describe('findByRegion', () => {
  it('returns themes covering a region', async () => {
    // 用现有 seed 数据(SeedDemoThemes 1777362214001)
    // 智能网联汽车主线政策 cover 「广东省 440000」
    const result = await service.findByRegion('440000');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.theme.title.includes('智能网联'))).toBe(true);
    expect(result[0].coverage.regionCode).toBe('440000');
  });

  it('filters by selectedIds when provided', async () => {
    // 拿 1 个主题 id 单独过滤
    const all = await service.findByRegion('440000');
    if (all.length === 0) return; // skip if seed missing
    const targetId = all[0].theme.id;
    const filtered = await service.findByRegion('440000', [targetId]);
    expect(filtered.length).toBe(1);
    expect(filtered[0].theme.id).toBe(targetId);
  });

  it('returns empty for unknown regionCode', async () => {
    const result = await service.findByRegion('999999');
    expect(result).toEqual([]);
  });

  it('does not return archived themes', async () => {
    // 找一个 published 主题改成 archived,验证不返回
    const all = await service.findByRegion('440000');
    if (all.length === 0) return;
    const id = all[0].theme.id;
    await service.archive(id, mockSysAdmin);
    const after = await service.findByRegion('440000');
    expect(after.find((r) => r.theme.id === id)).toBeUndefined();
    // cleanup
    await service.unarchive(id, mockSysAdmin);
  });
});
```

注意 `mockSysAdmin` 在现有 spec 文件里应该已经有,如果没有,看上方 describe `publish` / `archive` 的测试,沿用一样的 mock 用户。

- [ ] **Step 1.3: 跑测试**

```bash
cd apps/api && pnpm test -- themes.service.spec
```

期望:4 个新 case 全过 + 现有 case 不退化。

- [ ] **Step 1.4: Commit**

```bash
git add apps/api/src/themes/themes.service.ts apps/api/src/themes/__tests__/themes.service.spec.ts
git commit -m "feat(api): themes service findByRegion + 4 jest cases"
```

—

## Task 2:后端 controller endpoint + curl 验证

**Files:**
- Modify: `apps/api/src/themes/themes.controller.ts`

—

- [ ] **Step 2.1: 加 endpoint**

在 `themes.controller.ts` 现有 endpoints 中(GET `/` 之后,GET `/:id` 之前)加:

```ts
@Get('by-region')
async findByRegion(
  @Query('regionCode') regionCode: string,
  @Query('selectedIds') selectedIdsCsv?: string,
) {
  if (!regionCode) {
    throw new BadRequestException('regionCode 必填');
  }
  const selectedIds = selectedIdsCsv
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const data = await this.service.findByRegion(regionCode, selectedIds);
  return { data };
}
```

注意:这条要放 `@Get(':id')` **之前**(NestJS 路由顺序敏感,不然 `:id` 会吞 `by-region`)。

import 头加 `BadRequestException`(已经在 service 里 import 过,controller 也需要):
```ts
import { BadRequestException, ... } from '@nestjs/common';
```

- [ ] **Step 2.2: 重启 API + curl 验证**

```bash
preview_stop / preview_start api-dev

TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"sysadmin"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

# 1. happy
curl -s "http://localhost:3001/api/v1/themes/by-region?regionCode=440000" \
  -H "Authorization: Bearer $TOK" | python3 -m json.tool

# 期望:data 数组含智能网联主题

# 2. 空结果
curl -s "http://localhost:3001/api/v1/themes/by-region?regionCode=999999" \
  -H "Authorization: Bearer $TOK"
# 期望:{"data":[]}

# 3. missing regionCode → 400
curl -s "http://localhost:3001/api/v1/themes/by-region" \
  -H "Authorization: Bearer $TOK" -w '\nhttp=%{http_code}\n'
# 期望:http=400
```

- [ ] **Step 2.3: Commit**

```bash
git add apps/api/src/themes/themes.controller.ts
git commit -m "feat(api): GET /themes/by-region endpoint(B7-B9 反查支持)"
```

—

## Task 3:shared-types `ThemeByRegionResult` 类型导出

**Files:**
- Modify: `packages/shared-types/src/dtos/theme.dto.ts`
- Verify: `packages/shared-types/src/index.ts`(若已 re-export *,无需改)

—

- [ ] **Step 3.1: 加类型**

在 `packages/shared-types/src/dtos/theme.dto.ts` 末尾加:

```ts
import type { ThemeRegionLevel } from '../enums/theme-region-level';

export interface ThemeByRegionResult {
  theme: Theme;
  coverage: {
    regionCode: string;
    regionLevel: ThemeRegionLevel;
    mainValue: number;
  };
}
```

注意:如果 `ThemeRegionLevel` 已经在文件顶部 import 过,不要重复 import。

- [ ] **Step 3.2: 检查 index.ts re-export**

```bash
grep 'theme.dto' packages/shared-types/src/index.ts
```

如果是 `export * from './dtos/theme.dto'` 则自动包含,无需改。

- [ ] **Step 3.3: Build**

```bash
cd packages/shared-types && npm run build
```

期望:无错误。

- [ ] **Step 3.4: Commit**

```bash
git add packages/shared-types/src/dtos/theme.dto.ts
git commit -m "feat(types): ThemeByRegionResult 类型(B7 反查)"
```

—

## Task 4:前端 `api/themes.ts` 加 `fetchThemesByRegion`

**Files:**
- Modify: `apps/web/src/api/themes.ts`

—

- [ ] **Step 4.1: 加 fetcher**

在 `apps/web/src/api/themes.ts` 现有 fetchers 后加:

```ts
import type {
  Theme,
  ThemeCoverage,
  ThemeWithCoverage,
  CreateThemeInput,
  UpdateThemeInput,
  ThemeStatus,
  ThemeByRegionResult,    // ← 新增
} from '@pop/shared-types';

// ... 现有 fetchers ...

export async function fetchThemesByRegion(
  regionCode: string,
  selectedIds?: string[],
): Promise<{ data: ThemeByRegionResult[] }> {
  const params = new URLSearchParams({ regionCode });
  if (selectedIds && selectedIds.length > 0) {
    params.set('selectedIds', selectedIds.join(','));
  }
  const r = await fetch(`/api/v1/themes/by-region?${params.toString()}`, {
    headers: authHeaders(),
  });
  return jsonOrThrow(r, 'themes by-region fetch fail');
}
```

- [ ] **Step 4.2: typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

期望:无错误。

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/src/api/themes.ts
git commit -m "feat(web): fetchThemesByRegion fetcher"
```

—

## Task 5:`MapCanvas` 浮起 + 二段 click + chart ref 暴露

**Files:**
- Modify: `apps/web/src/components/MapCanvas.tsx`

—

- [ ] **Step 5.1: 加 props + import**

在 Props 接口里加:

```ts
interface Props {
  // ... 已有字段 ...
  /** 当前选中浮起的 region adcode(政策大盘交互 B7) */
  selectedRegionCode?: string | null;
  /** click 选中 region 回调(传 null 表示清除浮起) */
  onRegionSelect?: (code: string | null) => void;
  /** chart 实例就绪回调,给抽屉调 dispatchAction */
  onChartReady?: (chart: unknown) => void;
}
```

(`unknown` 是为了不导入 ECharts 类型避免 dep 蔓延 — 调用方按需 cast)

函数签名加 default:

```ts
export function MapCanvas({
  ...,
  selectedRegionCode = null,
  onRegionSelect,
  onChartReady,
  showLocalLayers = true,
}: Props) {
```

- [ ] **Step 5.2: 改 click handler 实现二段**

找到现有 `onEvents.click` 函数,把现有的:

```ts
if (params.componentType !== 'geo' || !params.name) return;
const name = params.name;
if (!provinceCode) {
  const code = provinceNameToCode(name);
  if (code) {
    onProvinceChange?.(code);
    onRegionClick?.({ level: 'country', code, name });
  }
} else {
  onRegionClick?.({ level: 'province', code: null, name });
}
```

改成:

```ts
if (params.componentType !== 'geo' || !params.name) return;
const name = params.name;
const code = !provinceCode ? provinceNameToCode(name) : null;

// 二段 click:同 region 第二次 → 下钻 / 关
if (selectedRegionCode && code === selectedRegionCode) {
  if (!provinceCode && code) {
    onProvinceChange?.(code);
    onRegionClick?.({ level: 'country', code, name });
  }
  onRegionSelect?.(null); // 省视图二次 = 关闭浮起
  return;
}

// 第一次 / 不同 region:选中
if (code && onRegionSelect) {
  onRegionSelect(code);
  return;
}

// 没有 onRegionSelect 时 fallback 到原直接下钻(属地大盘行为)
if (!provinceCode) {
  if (code) {
    onProvinceChange?.(code);
    onRegionClick?.({ level: 'country', code, name });
  }
} else {
  onRegionClick?.({ level: 'province', code: null, name });
}
```

**关键**:`onRegionSelect` 不传时 fallback 到原行为 → 属地大盘不受影响。

- [ ] **Step 5.3: 浮起视觉注入 geo.regions**

找到 `option` useMemo 里的 `geo.regions: overlayRegions`,改成派生:

```ts
const liftedRegions = useMemo(() => {
  if (!selectedRegionCode) return overlayRegions;
  const name = regionCodeToName(selectedRegionCode);
  if (!name) return overlayRegions;
  
  const result = [...overlayRegions];
  const liftedStyle = {
    borderColor: palette.primary,
    borderWidth: 3,
    shadowColor: palette.primary,
    shadowBlur: 16,
  };
  const existing = result.find((r) => r.name === name);
  if (existing) {
    existing.itemStyle = { ...existing.itemStyle, ...liftedStyle };
  } else {
    result.push({ name, itemStyle: liftedStyle });
  }
  return result;
}, [overlayRegions, selectedRegionCode]);
```

然后 `geo.regions: liftedRegions`,option useMemo deps 把 `overlayRegions` 换成 `liftedRegions`。

- [ ] **Step 5.4: chart ref 暴露**

ReactECharts 组件加 `onChartReady` prop:

```tsx
{loaded && option && (
  <ReactECharts
    option={option}
    notMerge
    style={{ width: '100%', height: '100%' }}
    onEvents={onEvents}
    onChartReady={onChartReady}    // ← 新加
  />
)}
```

`onChartReady` 类型签名 react-echarts 支持 `(chart: ECharts) => void`,我们的 props 用 `unknown` 兼容。

- [ ] **Step 5.5: typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5.6: Commit**

```bash
git add apps/web/src/components/MapCanvas.tsx
git commit -m "feat(web): MapCanvas 浮起视觉 + 二段 click + chartRef(B7)"
```

—

## Task 6:`PolicyRegionDrawer` 新组件

**Files:**
- Create: `apps/web/src/components/PolicyRegionDrawer.tsx`

—

- [ ] **Step 6.1: 写组件**

新建 `apps/web/src/components/PolicyRegionDrawer.tsx`:

```tsx
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
  /** ECharts 实例,用于 dispatchAction highlight/downplay */
  chart: unknown | null;
  onClose: () => void;
}

interface EChartsLike {
  getOption: () => { series: Array<{ name: string; data: Array<{ name: string }> }> };
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
    // 找该主题的涂层 series
    const opt = c.getOption();
    const seriesName = `涂层:${item.theme.title}`;
    const series = opt.series.find((s) => s.name === seriesName);
    if (!series) return;
    
    const names = series.data.map((d) => d.name);
    c.dispatchAction({ type: 'highlight', seriesName, name: names });
    setPulsedThemeId(item.theme.id);
    
    setTimeout(() => {
      c.dispatchAction({ type: 'downplay', seriesName });
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
            点击主题在地图上浅闪 1 秒,显示该主题分布
          </Text>
        </Space>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 6.2: typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/components/PolicyRegionDrawer.tsx
git commit -m "feat(web): PolicyRegionDrawer 新组件 + 主题反查闪烁(B7-B9)"
```

—

## Task 7:`MapShell` 挂 state + drawer + cleanup

**Files:**
- Modify: `apps/web/src/pages/MapShell.tsx`

—

- [ ] **Step 7.1: 加 state + effect cleanup**

在 `MapShell` 函数内,现有 useState 之后加:

```ts
const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
const [chart, setChart] = useState<unknown | null>(null);

// 切大盘 / 下钻 都清浮起 + 关抽屉
useEffect(() => {
  setSelectedRegionCode(null);
}, [isPolicy, currentProvinceCode]);
```

需要 import:

```ts
import { useEffect, useState } from 'react';
```

(useEffect 可能已 import,如有则不重复)

import PolicyRegionDrawer:

```ts
import { PolicyRegionDrawer } from '@/components/PolicyRegionDrawer';
```

- [ ] **Step 7.2: 给 MapCanvas 传新 props**

```tsx
<MapCanvas
  provinceCode={currentProvinceCode}
  onProvinceChange={setCurrentProvinceCode}
  onVisitClick={setSelectedVisitId}
  onPinClick={setSelectedPinId}
  themeOverlays={isPolicy ? themeOverlays : undefined}
  showLocalLayers={!isPolicy}
  selectedRegionCode={isPolicy ? selectedRegionCode : null}
  onRegionSelect={isPolicy ? setSelectedRegionCode : undefined}
  onChartReady={setChart}
/>
```

注意:`onRegionSelect` 只在 `isPolicy=true` 时传 — 这样属地大盘 click region 走原 fallback(直接下钻)。

- [ ] **Step 7.3: 挂 PolicyRegionDrawer**

在 `<Outlet />` 之前挂:

```tsx
{/* 政策大盘 region 抽屉(属地大盘不渲染)*/}
{isPolicy && (
  <PolicyRegionDrawer
    regionCode={selectedRegionCode}
    selectedThemeIds={selectedThemeIds}
    chart={chart}
    onClose={() => setSelectedRegionCode(null)}
  />
)}
```

- [ ] **Step 7.4: typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/src/pages/MapShell.tsx
git commit -m "feat(web): MapShell 挂 selectedRegionCode + PolicyRegionDrawer(B7)"
```

—

## Task 8:e2e 浏览器验证 + push PR

**Files:**
- Test only

—

- [ ] **Step 8.1: 重启 vite-dev(若热更新已生效则 skip)**

```bash
preview_list  # 看 vite-dev 状态
```

- [ ] **Step 8.2: 浏览器场景全跑**

按 spec 6.2 节脚本走:

1. `/map/policy` 勾「智能网联」(5 省 cover)
2. click 广东省:
   - `preview_screenshot` 验证广东省 polygon border 加粗(浮起)
   - 抽屉滑出,1 行主题
3. click 抽屉里那行:
   - 山东/四川/江苏/上海 highlight 浅闪 1s
   - 抽屉行加「已闪烁」chip
4. 二次 click 广东 → 下钻进省级视图,浮起消失,抽屉关
5. 切回属地大盘 → 抽屉不渲染
6. `preview_console_logs` 检查 0 error

- [ ] **Step 8.3: 回归保护**

- 切换 `/map/local`:
  - 32 visits + 3 pins 散点位置不变
  - click 省直接下钻(原行为,因 onRegionSelect 不传时 fallback)
- 切换 `/map/policy`:
  - 涂层勾选 0/1/2/3 层 visual 不退化

- [ ] **Step 8.4: Push + 开 PR**

```bash
git push -u origin claude/b7-policy-region-drawer

gh pr create --title "feat: V0.7 patch · B7-B9 政策大盘交互升级(浮起 + 抽屉 + 反查)" --body "$(cat <<'EOF'
## Summary

V0.7 c3+B6 把政策涂层落地了,但只能"看",不能"问"。本 PR 补上交互闭环:

- **点 region**:浮起 + 弹抽屉,显示当前涂层覆盖该 region 的主题列表
- **点抽屉主题**:地图反查闪烁 1s,显示该主题分布
- **二次点击同 region**:下钻进入省级视图(收编原直接下钻)

## Test plan

- [x] 后端 jest:findByRegion 4 case 全过
- [x] 后端 curl:happy / 空 / 400 全过
- [x] 浏览器 e2e:浮起 + 抽屉 + 反查 + 二次下钻全跑
- [x] 回归:属地大盘 click 直接下钻不变 / 涂层叠加不退化

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

—

## 复用 / 注意事项

- **复用 react-query**:抽屉 query key 含 selectedThemeIds → 涂层勾选变化自动 refetch
- **复用 region-names.ts**:regionCode → 中文名(28 条已覆盖)
- **复用 palette tokens**:浮起色 = palette.primary,涂层主线/风险色不变
- **NestJS 路由顺序**:`@Get('by-region')` 必须在 `@Get(':id')` 之前
- **react-echarts onChartReady**:比 ref 更简洁,直接拿到 ECharts 实例
- **highlight/downplay**:dispatchAction 标准 API,seriesName 精确匹配涂层名
- **`chart` 用 unknown**:不在 web 引 ECharts type 包,组件内部 cast 即可
- **属地大盘行为**:onRegionSelect 不传时 MapCanvas fallback 原直接下钻 → 不影响
