# V0.7 · c3 政策主题 + B6 涂层 design

> 状态:design 收口,待 writing-plans 拆任务清单
> 上一期:Pin 回收站 (#10 open) — 本 spec 基于 `claude/pin-recycle-bin` 起新分支
> 工作分支:`claude/c3-theme-b6-overlay`

---

## Context · 为什么做这个

V0.6 + Pin 回收站完成了「属地大盘」的全部业务(Visit / Pin / 留言板 / 软删 / 回收站)。但 PRD 设计的「政策大盘」(`/map/policy`) 还是空壳 — 涂层切换器、政策主题、覆盖清单一个都没落。

这一期把 PRD §2.4 场景 3 + §6 涂层规则真做出来:
- **中台 GA 角色**(孙中台)有了真业务工作流
- **政策大盘**(`/map/policy`) 有视觉冲击力的色块/点染色
- **完整闭环**:中台维护主题 → 拉取覆盖清单 → 发布 → 一线在地图上勾选涂层 → 看色块 / 点

---

## 核心决策(brainstorm 已逐项拍)

1. **数据模型**:`themes` 表 + `theme_coverage` 表(1:N CASCADE)
2. **状态机**:`draft ↔ published ↔ archived`(对称 Pin),所有状态可重启
3. **不变量**:`published` 必须有 ≥1 条 coverage(发布前校验)
4. **模板**:仅「主线政策」+「核心风险」2 套(PRD §2.4 已定义),自定义留 V0.7+
5. **外部系统 mock**:本地纯函数 `mockPolicyAnalysis(themeId, template)` 生成 ~13-19 条覆盖(5-8 省 + 8-11 市)
6. **涂层叠加**:1-3 层(antd Select `maxCount=3`)
7. **涂层渲染规则**(PRD §6 固化):
   - 全国层(currentProvinceCode=null):province 级 → 色块,city 级 → 点
   - 省级层:city 级 → 色块,district 级 → 点
   - main_value 决定深浅 / 大小
8. **RBAC**:写权限 sys_admin / central_ga;读权限所有登录用户
9. **seed**:2 个 published 主题 + mock coverage(demo 一开就能看到涂层)
10. **archived 主题**默认不在涂层选择器(对称 Pin 回收站)

---

## Architecture

```
┌─────────────────────────────┐
│ themes 表(新建)             │
│  ─────                      │
│  id uuid PK                 │
│  title varchar(100)         │
│  template enum('main','risk')│
│  keywords text[]            │
│  region_scope text          │   描述性文字,如「全国 / 长三角 / 粤港澳」
│  status enum('draft','published','archived')
│  created_by uuid FK users   │
│  created_at timestamptz     │
│  updated_at timestamptz     │
│  published_at timestamptz NULL │   发布时间(归档保留)
└──┬──────────────────────────┘
   │ 1
   │ N (theme_id ON DELETE CASCADE)
   ▼
┌─────────────────────────────┐
│ theme_coverage 表(新建)     │
│  ─────                      │
│  id uuid PK                 │
│  theme_id uuid FK themes    │
│  region_code varchar(6)     │   省/市/区 6 位
│  region_level enum('province','city','district')
│  main_value double          │   主属性值(渲染 by 深浅 / 大小)
│  extra_data jsonb           │   政诉数等其他维度,demo 阶段可空
│  last_fetched_at timestamptz│
└─────────────────────────────┘
```

**端到端数据流**

```
[中台 GA 工作台]                       [属地大盘 / 政策大盘]
                                       
[1] /console/themes 工作台 tab            [4] /map/policy
    ├─ 列表 + Segmented [活跃 / 归档]        ├─ 左面板加涂层选择器(antd Select multi)
    └─ +新建主题(选模板 / 关键词)            │   options: 仅 published 主题
                                            │   maxCount: 3
[2] 详情 Drawer:                            │
    ├─ 拉取覆盖按钮 → POST :id/fetch       └─ 大盘渲染:
    │  └─ DELETE existing + INSERT new        ├─ 现有 visit / pin scatter(不动)
    │     (mockPolicyAnalysis 生成 5-10)      ├─ + 选中主题的 coverage 涂层
    ├─ 覆盖预览(table)                        │  按 currentProvinceCode 自动切层级
    ├─ 发布按钮 → POST :id/publish           │  · 全国层:province 色块 + city 点
    │  └─ 校验 coverage>=1                    │  · 省级层:city 色块 + district 点
    │     status: draft → published          └─ 1-3 层叠加(透明度区分)
    └─ 归档/恢复按钮:status: published ↔ archived
                                       ─────────────────────────────────────
[3] 主题管理 RBAC:                          [访问 RBAC]
    sys_admin / central_ga: CRUD            涂层选择器:所有登录用户(只读消费)
    其他角色:列表只读,无 +新建按钮
```

**关键不变量**
- `themes.status='archived'` 不出现在涂层选择器(对称 Pin 回收站)
- `theme_coverage.theme_id` ON DELETE CASCADE — 主题硬删时一起删
- 重新拉取 coverage = 事务内 DELETE + INSERT(覆盖语义,无历史版本)
- 发布前校验:`COUNT(coverage WHERE theme_id=:id) >= 1`
- 涂层渲染按 `currentProvinceCode` 决定 region_level filter:`null → province` / 否则 `city`

---

## DB / Migration

**Migration 1**(新建):`{ts}-CreateThemes.ts`

```sql
CREATE TYPE theme_template AS ENUM ('main', 'risk');
CREATE TYPE theme_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE theme_region_level AS ENUM ('province', 'city', 'district');

CREATE TABLE themes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title varchar(100) NOT NULL,
  template theme_template NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  region_scope text,
  status theme_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL
);
CREATE INDEX idx_themes_status ON themes(status);
CREATE INDEX idx_themes_created_by ON themes(created_by);

CREATE TABLE theme_coverage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  region_code varchar(6) NOT NULL,
  region_level theme_region_level NOT NULL,
  main_value double precision NOT NULL,
  extra_data jsonb,
  last_fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_theme_coverage_theme ON theme_coverage(theme_id);
CREATE INDEX idx_theme_coverage_region ON theme_coverage(region_code);
```

**Migration 2**(seed):`{ts}-SeedDemoThemes.ts`

```
2 个 published 主题:
  · "智能网联汽车主线政策"(template=main),central_ga 创建,覆盖 5 个省级 + 8 个市级
  · "数据安全核心风险"(template=risk),central_ga 创建,覆盖 6 个省级 + 10 个市级
mock coverage 直接 INSERT(不调 mock 函数,避免随机性影响 demo 一致性)
```

---

## API

```
GET    /api/v1/themes?status=          ← 列表,默认 status=published+draft(不含 archived)
GET    /api/v1/themes/:id              ← 详情(含 coverage 数组)
POST   /api/v1/themes                  ← 创建(强制 status='draft')
PUT    /api/v1/themes/:id              ← 编辑(title / keywords / regionScope,不能改 template)
POST   /api/v1/themes/:id/fetch-coverage  ← 触发 mock 拉取(事务 DELETE + INSERT)
POST   /api/v1/themes/:id/publish      ← draft → published(校验 coverage>=1)
POST   /api/v1/themes/:id/archive      ← published → archived
POST   /api/v1/themes/:id/unarchive    ← archived → published(直接复活,不回 draft)
```

**RBAC**(写路径:POST/PUT/POST :id/* 等):sys_admin / central_ga,其他 403。

**校验**:
- POST title 必填,template ∈ {main, risk}
- PUT 不接受 status 字段(状态切换走专用 endpoint)
- POST :id/publish 校验 coverage 至少 1 条,否则 400
- POST :id/fetch-coverage 接受 draft / published 状态(已发布主题也能重新拉取);archived 状态返 400

---

## 后端实施

```
apps/api/src/themes/
├── entities/
│   ├── theme.entity.ts              [新]
│   └── theme-coverage.entity.ts     [新]
├── dtos/
│   ├── create-theme.dto.ts          [新]
│   └── update-theme.dto.ts          [新]
├── themes.controller.ts             [新]
├── themes.service.ts                [新:CRUD + 状态机 + RBAC]
├── coverage.service.ts              [新:DELETE+INSERT 事务]
├── mock-policy-analysis.ts          [新:纯函数,确定性 random by themeId hash]
├── themes.module.ts                 [新]
└── __tests__/
    └── themes.service.spec.ts       [新:7-8 jest tests]

apps/api/src/database/migrations/
├── {ts}-CreateThemes.ts             [新]
└── {ts}-SeedDemoThemes.ts           [新]

apps/api/src/app.module.ts           [改:挂 ThemesModule]
```

**`mock-policy-analysis.ts` 设计**:
```typescript
// 基于 themeId hash 确定性生成,每个主题每次拉取结果一致(便于 demo)
export function mockPolicyAnalysis(themeId: string, template: 'main' | 'risk'): MockCoverage[] {
  const seed = hashString(themeId);
  const provinceCount = 5 + (seed % 4);     // 5-8 省
  const cityCount = provinceCount + 3;       // 8-11 市
  // 主线政策:main_value 范围 1-50(区覆盖数语义)
  // 核心风险:main_value 范围 10-200(政诉数语义)
  const valueRange = template === 'main' ? [1, 50] : [10, 200];
  // ... 返回 [{ regionCode, regionLevel, mainValue, extraData }, ...]
}
```

**RBAC 白名单**:
```typescript
const THEME_WRITE_ALLOWED_ROLES = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);
```

---

## 前端实施

```
apps/web/src/api/themes.ts           [新:fetcher 集中]

apps/web/src/pages/console/ThemesTab.tsx   [新:政策主题管理 tab]
  ├─ Segmented [活跃 (n) | 归档 (m)] (按 RBAC 显示)
  ├─ Table:标题 / 模板 / 状态 / 覆盖数 / 创建时间 / 操作
  ├─ +新建按钮(仅 sys_admin/central_ga)
  └─ 行操作:查看(打开 ThemeDetailDrawer)/ 编辑

apps/web/src/components/ThemeFormModal.tsx     [新:新建/编辑]
  └─ template Radio (主线政策 / 核心风险) + title + keywords (Tags) + regionScope

apps/web/src/components/ThemeDetailDrawer.tsx  [新:详情]
  ├─ Descriptions:基本字段
  ├─ "拉取覆盖清单" 按钮(loading state)→ 显示返回的 coverage 列表
  ├─ Coverage Table 预览(region_code 翻成中文名 / region_level / main_value)
  ├─ "发布" 按钮(draft 时显示,校验 coverage>=1)
  └─ "归档" / "恢复" 按钮(状态切换)

apps/web/src/components/MapCanvas.tsx          [改:加 themeOverlays prop]
  ├─ 新 prop:themeOverlays?: ThemeOverlay[]
  ├─ 在 visit/pin scatter series 之前加 N 个 overlay series:
  │  · province 级 coverage → ECharts map series(visualMap by main_value)
  │  · city/district 级 coverage → scatter,size by main_value
  └─ 按 currentProvinceCode 决定 region_level filter

apps/web/src/pages/MapShell.tsx                [改:左面板涂层选择器]
  ├─ 仅 location.pathname === '/map/policy' 时显示
  ├─ antd Select mode='multiple' maxCount=3
  ├─ options 来自 fetchPublishedThemes
  └─ value (themeIds[]) 传给 MapCanvas 的 themeOverlays
```

**shared-types**:
```
packages/shared-types/src/enums/theme-template.ts   [新]
packages/shared-types/src/enums/theme-status.ts     [新]
packages/shared-types/src/enums/theme-region-level.ts [新]
packages/shared-types/src/dtos/theme.dto.ts         [新]
  · Theme / ThemeCoverage / CreateThemeInput / UpdateThemeInput
packages/shared-types/src/index.ts                  [改:re-export]
```

**RBAC 前端**:
- ThemesTab 的「+新建」按钮按 `useAuthStore.user.roleCode` 隐藏
- 涂层选择器(MapShell)所有登录用户都能看(读权限全开)

---

## 用户场景脚本(8 步主流程)

```
[0] central_ga 登录 → 工作台「政策主题管理」tab
[1] 看到 2 条 seed published 主题(智能网联汽车 / 数据安全)
[2] +新建主题 → 模板选「主线政策」+ title=「测试主题」+ 关键词=「测试」 → 保存
    └─ 列表 +1 行(状态=draft / 覆盖数=0)
[3] 点击新主题 → Drawer → 「拉取覆盖清单」按钮
    └─ 按钮 loading → 返回 mock ~13-19 条 coverage(5-8 省 + 8-11 市),显示在 Coverage Table 中
[4] 点「发布」按钮 → 200 → 状态切 published
[5] 切到 /map/policy(政策大盘)
[6] 左面板涂层选择器:勾选「测试主题」+「智能网联汽车」(2 层叠加)
    └─ 大盘渲染:5-8 个省色块(深浅不同)+ 多个城市点
[7] 点击地图任一省下钻 → currentProvinceCode 切到省级
    └─ 涂层自动切:地市色块 + 区级点
[8] central_ga 退出,登 local_ga
    └─ 工作台「政策主题管理」tab:看到 3 条主题列表(只读),无 +新建按钮
    └─ /map/policy 涂层选择器仍可用(读权限全开)
```

**RBAC 错误路径 4 个**(curl)
```
[X] local_ga POST /themes → 403
[Y] central_ga PUT 已 archived 主题 → 200(允许编辑 archived 也合理,跟 Pin 状态机对称)
[Z] central_ga POST :id/publish 但 coverage=0 → 400「发布前必须先拉取覆盖清单」
[W] sysadmin POST :id/fetch-coverage 在 archived 状态 → 400「已归档主题不能拉取覆盖」
```

---

## Testing

**后端 jest 新加 ~7 tests**(`themes.service.spec.ts`):
- list 默认排除 archived
- list ?status=archived 返归档
- create 强制 status='draft'(忽略前端传值)
- publish:有 coverage 成功 / 无 coverage 抛 400
- archive:published → archived 成功
- RBAC:local_ga create / publish / archive → 403
- mockPolicyAnalysis 同 themeId 同 template 多次调用结果一致(确定性)

**前端**:
- `npm run typecheck` 0 error
- preview e2e 主流程(8 步)
- 回归:V0.6 17 + Pin 回收站 6 commits 全过

---

## 关键文件清单

**后端**(新)
```
apps/api/src/themes/entities/theme.entity.ts
apps/api/src/themes/entities/theme-coverage.entity.ts
apps/api/src/themes/dtos/create-theme.dto.ts
apps/api/src/themes/dtos/update-theme.dto.ts
apps/api/src/themes/themes.controller.ts
apps/api/src/themes/themes.service.ts
apps/api/src/themes/coverage.service.ts
apps/api/src/themes/mock-policy-analysis.ts
apps/api/src/themes/themes.module.ts
apps/api/src/themes/__tests__/themes.service.spec.ts
apps/api/src/database/migrations/{ts}-CreateThemes.ts
apps/api/src/database/migrations/{ts}-SeedDemoThemes.ts
apps/api/src/app.module.ts (改:挂模块)
```

**前端**(新 + 改)
```
apps/web/src/api/themes.ts
apps/web/src/pages/console/ThemesTab.tsx
apps/web/src/components/ThemeFormModal.tsx
apps/web/src/components/ThemeDetailDrawer.tsx
apps/web/src/components/MapCanvas.tsx (改:加 themeOverlays)
apps/web/src/pages/MapShell.tsx (改:涂层选择器)
packages/shared-types/src/enums/theme-template.ts
packages/shared-types/src/enums/theme-status.ts
packages/shared-types/src/enums/theme-region-level.ts
packages/shared-types/src/dtos/theme.dto.ts
packages/shared-types/src/index.ts (改:re-export)
```

**总计 ~22 文件,预计 10-12 commits / 4-6 小时**

---

## 注意事项 / 复用

- **复用 Pin 回收站状态机模式**(draft↔published↔archived 类似 Pin 的 in_progress↔completed↔aborted),Service 写法基本可复制
- **复用 V0.6 #9 的 PIN_DELETE_ALLOWED_ROLES 模式**,新建 THEME_WRITE_ALLOWED_ROLES Set
- **复用 PinsTab 的 Segmented + 双 useQuery 双视图模式**(ThemesTab 的「活跃 / 归档」)
- **复用 PinDetailDrawer 的 useMutation + invalidate prefix 模式**(ThemeDetailDrawer)
- **复用 V0.6 #9 / Pin 回收站 jest mock 模板**(getRepositoryToken / Test.createTestingModule)
- **复用 ECharts geo map series**(MapCanvas 已有,省级 / 市级 region polygon 已加载)
- **复用 visit/pin scatter 渲染层**(themeOverlays 加在 visits/pins 之前,确保 visits/pins 在最上层不被遮)
- **mock-policy-analysis 用确定性 hash**(同 themeId 同 template 同结果)— 避免 demo 一致性问题

---

## 已知 V0.7+ 留尾

- 真接外部政策分析系统(0.7 #11/#12)— mock 函数有清晰 interface,后续替换简单
- 涂层主属性值的「色彩公式」具体阈值 — PRD §6 待最终拍定,本期用 linear scale + 模板差异化数值范围简化
- 涂层勾选历史(用户上次勾选了什么)— 不做,每次进 /map/policy 默认空
- 主题归档自动通知 — 不做
- 主题 audit log — 不做
