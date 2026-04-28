# V0.7 patch · B7-B9 政策大盘交互升级 · 设计 spec

> 状态:brainstorm 已收口(2026-04-28),待 writing-plans 拆任务清单

—

## Context · 为什么做这个

V0.7 c3 + B6(PR #11)落地了"政策主题模块 + 涂层渲染",政策大盘可以勾选最多 3 层主题涂层叠加染色。但是 **只能看,不能问** — 用户没法点 region 问"这块儿被哪些政策 cover 了"。demo 故事到这里就断了。

本期把政策大盘补成完整闭环:**看(涂层)→ 问(点 region 弹抽屉)→ 反查(点主题闪其他覆盖区)→ 下钻(二次点击)**。

—

## 核心决策(brainstorm 已逐项拍)

**交互设计**

1. **二段 click 区分选中和下钻**:第一次 click region → 浮起 + 弹抽屉;**同一 region** 第二次 click → 下钻
2. **浮起视觉**:加边框宽度 + 主色描边 + 阴影,**不动 areaColor**(避免覆盖涂层色)
3. **抽屉内容范围**(Q2=X):只显示当前已勾选涂层中 cover 该 region 的主题 — 跟涂层联动,简洁直观
4. **反查交互**(Q3=P):点抽屉里某主题 → 该主题 cover 的所有其他 region 浅闪 1 秒,然后回归
5. **省视图二次 click**:不再下钻(没有市级 GeoJSON 加载),只 toggle 关闭抽屉(未来加市级 drill 留扩展点)

**数据**

6. **后端新加 endpoint**(Q4):`GET /api/v1/themes/by-region?regionCode=&selectedIds=`
   - 服务端做 JOIN 过滤,前端只渲染
   - `selectedIds` 可选,MVP 默认全部已发布主题里 cover 该 region 的(给后续 Q2 演化到 Z=显示全量留空间)
7. **抽屉数据 cache**:react-query key `['themes-by-region', regionCode, selectedIds]`,涂层勾选变化自动 refetch

**状态管理**

8. **新 state**:`MapShell.selectedRegionCode: string | null`(单选,跟 currentProvinceCode 解耦)
9. **state 切换边界**:
   - 切政策 ↔ 属地大盘:清 `selectedRegionCode`(避免跨视图遗留)
   - 切 currentProvinceCode(下钻):清 `selectedRegionCode`(下钻后浮起态无意义)
   - 关抽屉(右上 X):清 `selectedRegionCode`(浮起也消失)

—

## 用户场景脚本(4 步主流程 + 2 边界)

```
[0] sys_admin 进 /map/policy,勾选「智能网联汽车主线政策」(覆盖 5 省)
[1] click 广东省 polygon →
    a. selectedRegionCode='440000',广东省 polygon 加深绿描边 + 阴影"浮起"
    b. 右抽屉滑出,标题「广东省」,列表 1 条:「智能网联汽车主线政策」(主线 + mainValue=42)
[2] click 抽屉里那一行 → 
    地图上其他 4 省(山东/四川/江苏/上海)highlight 浅闪 1 秒,1s 后 downplay 回归
    抽屉那行加 chip「已闪烁」1s
[3] 再次 click 广东省(已浮起)→ 
    a. 触发 onProvinceChange('440000')
    b. 清 selectedRegionCode + 关抽屉
    c. 下钻到广东省级视图,看到广州/深圳市级染色
[4] 在省视图 click 广州市 polygon →
    a. selectedRegionCode='440100' + 浮起 + 抽屉
    b. 抽屉显示该市级主题(若涂层 city-level coverage 含广州)
    c. 二次 click 广州 → 清 selected + 关抽屉(无市级下钻)
```

**边界场景**

```
[E1] 抽屉打开时切换涂层勾选 → react-query 自动 refetch,抽屉内容更新
     若新 selectedThemeIds cover 该 region = 0 主题,显示空态「该区域无相关政策」
[E2] 抽屉打开时切换大盘(政策 ↔ 属地)→ MapShell 清 selectedRegionCode + 关抽屉
[E3] 切换 provinceCode(下钻 / 返回全国)→ MapShell 清 selectedRegionCode + 关抽屉
[E4] click 没有涂层覆盖的 region(如新疆)→ 抽屉照常打开 + 浮起,但内容空 + 显示空态
```

—

## Architecture(数据流)

```
┌──────────────────────────────────────────┐
│ MapShell                                 │
│  state:                                  │
│    selectedThemeIds: string[]   (已存)    │
│    selectedRegionCode: string|null (新)  │
│  effects:                                │
│    onProvinceChange / mode 切换 → 清     │
└──────┬───────────────────────────────────┘
       │ props
┌──────▼───────────────────────────────────┐
│ MapCanvas                                │
│  + props: selectedRegionCode             │
│  + props: onRegionSelect(code)           │
│  click 派发:                              │
│    name → code → 若 code==selected:      │
│       全国: onProvinceChange             │
│       省级: onRegionSelect(null)         │
│    若 code!=selected:                    │
│       onRegionSelect(code)               │
│  视觉:                                    │
│    selectedRegionCode 注入 geo.regions[] │
│    覆盖该 region 的 itemStyle:            │
│      borderColor: palette.primary        │
│      borderWidth: 3                      │
│      shadowBlur: 16                      │
│      shadowColor: palette.primary        │
│  ref:                                    │
│    onChartReady(chart) 把实例传出去      │
│    给抽屉调 dispatchAction               │
└──────┬───────────────────────────────────┘
       │ ref + props
┌──────▼───────────────────────────────────┐
│ PolicyRegionDrawer (新)                  │
│  props: regionCode, selectedThemeIds,    │
│         chartRef, onClose                │
│  query: ['themes-by-region', code, ids]  │
│         GET /themes/by-region?...        │
│  渲染:                                    │
│    - regionCode → 中文名(查表 / 接口)    │
│    - 主题列表,每行:title + tag + mainVal│
│    - click 行 →                          │
│      chart.dispatchAction({ type:        │
│        'highlight', seriesIndex/name,    │
│        names: [matched regions] })       │
│      setTimeout 1000 → downplay          │
│      抽屉行 chip「已闪烁」1s             │
│    - 空态:「该区域无相关政策」           │
└──────────────────────────────────────────┘

新后端 endpoint
┌─────────────────────────────────────────────────┐
│ GET /api/v1/themes/by-region                    │
│   ?regionCode=440000                            │
│   [&selectedIds=id1,id2,id3]                    │
│                                                 │
│ Service:                                        │
│   QueryBuilder JOIN themes + theme_coverage     │
│   WHERE coverage.region_code = :code            │
│     AND themes.status = 'published'             │
│     AND themes.deleted_at IS NULL               │
│     [AND themes.id IN (:...selectedIds)]        │
│   ORDER BY themes.created_at DESC               │
│                                                 │
│ Returns: [{                                     │
│   theme: { id, title, template, regionScope, …},│
│   coverage: { regionCode, regionLevel, mainVal }│
│ }, ...]                                         │
└─────────────────────────────────────────────────┘
```

**关键不变量**

- `selectedRegionCode` 单选(同时只能浮起 1 个 region)
- 浮起视觉只动 border / shadow,**不覆盖涂层 areaColor**(用户既能看涂层色也能看选中态)
- 反查 highlight 走 `chart.dispatchAction`,纯视觉无状态污染
- 抽屉数据靠 react-query cache,不复制到 state(避免 stale)
- 切大盘 / 下钻 / 关抽屉都清 `selectedRegionCode`(防止跨视图状态遗留)

—

## DB · 不动

c3 + B6 已经把 `themes` + `theme_coverage` 建好了,本期只查不写。**0 migration**。

—

## 后端 API + Service

### 新 endpoint:`GET /api/v1/themes/by-region`

文件:`apps/api/src/themes/themes.controller.ts` + `themes.service.ts`

```ts
// controller
@Get('by-region')
async findByRegion(
  @Query('regionCode') regionCode: string,
  @Query('selectedIds') selectedIdsCsv?: string,
) {
  const selectedIds = selectedIdsCsv?.split(',').filter(Boolean);
  const data = await this.service.findByRegion(regionCode, selectedIds);
  return { data };
}

// service
async findByRegion(
  regionCode: string,
  selectedIds?: string[],
): Promise<Array<{ theme: ThemeEntity; coverage: ThemeCoverageEntity }>> {
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
    coverage: { regionCode: cov.regionCode, regionLevel: cov.regionLevel, mainValue: cov.mainValue },
  }));
}
```

**校验** & **失败路径**:
- regionCode 必填(missing → 400)
- selectedIds 可选,空字符串 / 缺失 = 不过滤
- regionCode 格式不校验(允许任意值,空结果合法)

**Test cases**(`themes.service.spec.ts` 加):
- happy:存在 cover → 返回主题 + 覆盖详情
- selectedIds 过滤:传 1 个 id → 只返回该主题
- 空结果:不存在 cover region → 返回 []
- archived 主题不返回:确保 status='published' 过滤生效

### 共享类型(packages/shared-types)

```ts
// dtos/theme.dto.ts 加
export interface ThemeByRegionResult {
  theme: Theme;
  coverage: {
    regionCode: string;
    regionLevel: ThemeRegionLevel;
    mainValue: number;
  };
}
```

—

## 前端组件改动

### 1. `apps/web/src/api/themes.ts`(改 · 加 fetcher)

```ts
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

### 2. `apps/web/src/components/MapCanvas.tsx`(改)

**Props 新增**
- `selectedRegionCode?: string | null` — 浮起态
- `onRegionSelect?: (code: string | null) => void` — 选中回调
- `onChartReady?: (chart: ECharts) => void` — 暴露 ECharts 实例给抽屉

**click 逻辑改造**(在现有 onEvents.click 内)

```ts
if (params.componentType === 'geo' && params.name) {
  const name = params.name;
  // 全国视图:province name → code;省视图:city name → ???
  const code = !provinceCode ? provinceNameToCode(name) : null;
  // 省视图 city-level: 用 GeoJSON properties.adcode 拿,需扩展 china-map.ts
  
  // 二段:同 region 第二次 click
  if (selectedRegionCode === code && code) {
    if (!provinceCode) {
      onProvinceChange?.(code);    // 全国 → 下钻
    }
    onRegionSelect?.(null);         // 省视图 → toggle 关
    return;
  }
  
  // 第一次 click 或换 region
  if (code) {
    onRegionSelect?.(code);
  }
}
```

**「浮起」注入 geo.regions[]**

```ts
const regions = useMemo(() => {
  const result = [...overlayRegions];
  if (selectedRegionCode) {
    const name = regionCodeToName(selectedRegionCode);
    if (name) {
      // 找已有 entry 还是 push 新的
      const existing = result.find((r) => r.name === name);
      const lifted = {
        borderColor: palette.primary,
        borderWidth: 3,
        shadowColor: palette.primary,
        shadowBlur: 16,
      };
      if (existing) {
        existing.itemStyle = { ...existing.itemStyle, ...lifted };
      } else {
        result.push({ name, itemStyle: lifted });
      }
    }
  }
  return result;
}, [overlayRegions, selectedRegionCode]);
```

**onChartReady**

react-echarts 提供 `onChartReady` callback 拿实例。MapCanvas 把它转给上层。

### 3. `apps/web/src/components/PolicyRegionDrawer.tsx`(新)

```tsx
interface Props {
  regionCode: string | null;
  selectedThemeIds: string[];
  chart: ECharts | null;
  onClose: () => void;
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
    // 找该主题 cover 的所有 region(从已加载涂层 series 数据反查)
    const opt = chart.getOption();
    const targetSeries = opt.series.find(s => s.name === `涂层:${item.theme.title}`);
    const names = targetSeries?.data.map(d => d.name) ?? [];
    
    chart.dispatchAction({ type: 'highlight', seriesName: targetSeries?.name, name: names });
    setPulsedThemeId(item.theme.id);
    setTimeout(() => {
      chart.dispatchAction({ type: 'downplay', seriesName: targetSeries?.name });
      setPulsedThemeId(null);
    }, 1000);
  };
  
  return (
    <Drawer
      title={regionCode ? regionCodeToName(regionCode) : ''}
      placement="right"
      width={400}
      open={!!regionCode}
      onClose={onClose}
    >
      {/* 列表 + 空态 + 加载态 */}
      {data?.data.map(item => (
        <Card hoverable onClick={() => handlePulse(item)}>
          <Tag color={item.theme.template === 'main' ? 'green' : 'red'}>
            {item.theme.template === 'main' ? '主线' : '风险'}
          </Tag>
          <Text strong>{item.theme.title}</Text>
          <Text type="secondary">主属性值: {item.coverage.mainValue}</Text>
          {pulsedThemeId === item.theme.id && <Tag color="blue">已闪烁</Tag>}
        </Card>
      ))}
    </Drawer>
  );
}
```

### 4. `apps/web/src/pages/MapShell.tsx`(改)

```tsx
// state
const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
const [chart, setChart] = useState<ECharts | null>(null);

// effect:切大盘 / 下钻 都清浮起
useEffect(() => { setSelectedRegionCode(null); }, [isPolicy, currentProvinceCode]);

// 传 props
<MapCanvas
  ...
  selectedRegionCode={isPolicy ? selectedRegionCode : null}
  onRegionSelect={setSelectedRegionCode}
  onChartReady={setChart}
/>

{/* 政策大盘抽屉(属地大盘不渲染)*/}
{isPolicy && (
  <PolicyRegionDrawer
    regionCode={selectedRegionCode}
    selectedThemeIds={selectedThemeIds}
    chart={chart}
    onClose={() => setSelectedRegionCode(null)}
  />
)}
```

—

## 用户场景测试 + 错误路径

**6.1 后端 curl**

```bash
# 1. happy
TOK=$(login sysadmin)
curl "http://localhost:3001/api/v1/themes/by-region?regionCode=440000" -H "Authorization: Bearer $TOK"
# 期望:广东省下 cover 的所有 published 主题

# 2. selectedIds 过滤
curl "http://localhost:3001/api/v1/themes/by-region?regionCode=440000&selectedIds=$THEME_ID" -H "..."

# 3. 空结果
curl "http://localhost:3001/api/v1/themes/by-region?regionCode=999999" -H "..."  # → []

# 4. regionCode missing → 400(NestJS Validation)
```

**6.2 浏览器 e2e**

```
1. 政策大盘勾「智能网联」(5 省 cover)
2. click 广东省:
   a. preview_inspect 验证广东 polygon border 加粗(visual: lifted)
   b. 抽屉滑出,1 行主题
3. click 抽屉「智能网联」:
   a. 山东/四川/江苏/上海 highlight 浅闪 1 秒
   b. 1s 后 downplay
4. 二次 click 广东 → 下钻到广东省级视图(currentProvinceCode='440000')
   验证:浮起消失 + 抽屉关 + currentProvinceCode 改了
5. 切回属地大盘 → 浮起 / 抽屉都不显示(isPolicy=false 时不渲染)
6. preview_console_logs 无 error
```

**6.3 回归保护**

- c3 涂层勾选(0/1/2/3 层)visual 不退化
- 全国 → 下钻原行为(单击下钻)在**未点过 region** 时维持(因为 selectedRegionCode=null)
  - 等等,这里有冲突 — 见下面"行为变更说明"
- Pin / Visit 创建按钮位置 / 点击不影响

**行为变更说明(重要)**

V0.7 patch 之前:政策大盘 click 省 = 直接下钻(因为没有 selectedRegionCode 概念)。
本期之后:政策大盘 click 省 = **第一次浮起 + 抽屉**,**第二次同省下钻**。

属地大盘下钻**不变**(原 onProvinceChange 直接生效),因为 isPolicy=false 时 PolicyRegionDrawer 不渲染,onRegionSelect 也不传(MapShell 的 props 条件控制)。

→ **行为变更影响**:政策大盘下钻多 1 步(point + click again)。这是产品交互 trade-off,brainstorm 已确认。

—

## 关键文件清单

```
后端(改 + 0 新)
  apps/api/src/themes/themes.controller.ts             [改]
  apps/api/src/themes/themes.service.ts                [改]
  apps/api/src/themes/__tests__/themes.service.spec.ts [改]

前端(改 + 1 新)
  apps/web/src/api/themes.ts                       [改]
  apps/web/src/components/MapCanvas.tsx            [改]
  apps/web/src/components/PolicyRegionDrawer.tsx   [新]
  apps/web/src/pages/MapShell.tsx                  [改]

shared-types
  packages/shared-types/src/dtos/theme.dto.ts      [改]
```

—

## 复用既有 / 注意事项

- **复用 react-query**(useQuery 拉 by-region 数据,key 含 selectedThemeIds 自动 refetch)
- **复用 region-names.ts**(regionCode → 中文名,加新条目即可)
- **复用 china-map.ts** 的 `provinceNameToCode`(全国 click 映射)
- **省视图 city-level click** 需要把 city name → code 也建一个查表(用 GeoJSON 的 adcode 字段),或在前端先用 reverse map(已有 region-names 28 条覆盖的 16 城市级)
- **chart ref**:`react-echarts` 的 `onChartReady` 比 ref 简洁,采用前者
- **highlight / downplay**:ECharts API 标准,seriesName 精确匹配涂层 series 的 name(`涂层:${title}`)
- **不动 overlayRegions 的 itemStyle 浮起注入**:用 `useMemo` 的派生计算,保持 immutability
- **空态文案**:「该区域无相关政策」,统一 demo 风格,不用 antd `<Empty>`(过重)

—

## 下一步

1. **退出 plan mode** → 已 brainstorm,直接 writing-plans
2. **写 plan**:`docs/superpowers/plans/2026-04-28-b7-policy-region-drawer-plan.md`
3. **拆 task**:估 6-8 task / 1 PR(后端 endpoint + service test + 共享类型 + 前端 4 文件)
4. **subagent-driven-development** 跑掉
