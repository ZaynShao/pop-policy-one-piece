# SPEC · V0.6 β.2 Pin/图钉

> 状态:approved(2026-04-27 brainstorm 5 轮收口 · 用户 + Claude)
> 估时:~1.5d(对齐 HANDOFF §7.14)
> 依赖:V0.6 β.1 已 merge(`apps/api/src/lib/geojson-cities.ts` 必须存在)
> Base 分支:main(c27295a — β.1 squash 后)
> Head 分支:`claude/v06-beta2-pin`

---

## 1 · 这一轮做什么、为什么

V0.6 β.1 把 Visit 真业务跑通 — 散点点击抽屉 + 工作台 Table CRUD,完成第一个端到端业务实体。β.2 接着把 **PRD §3.3 B7 + B9** 落地:**Pin = 图钉 = 项目机会标记**。

对齐 PRD 三个 P0:
- **B7**(L452)图钉创建 + 维护(标题 / 地理位置 / 状态 / 关联主题)— β.2 砍 related_theme_ids(c3 政策主题表还没建)
- **B9**(L454)图钉状态机 `in_progress` ⇄ `completed` / `aborted`,**允许重开**(2026-04-23 用户拍板)
- **B8 留言板** + G16 自动同步 → β.2.5 / β.3 一起做(蓝点转色 listener 是 β.3 的事,手动留言板 UI 单独 β.2.5)

**不对齐**(留后续):
- B8 Pin 留言板(Comment 实体 + UI)→ β.2.5
- G16 子蓝点完成 → 父 Pin 自动留言 → β.3
- related_theme_ids(政策主题关联)→ c3 政策大盘
- CASL `pmo/lead` 真矩阵(PRD §4.3.1 Pin 编辑权限)→ V0.7;β.2 全 sys_admin

**为什么这样切**:
- B7 + B9 是 demo 主体闭环(创建 / 编辑 / 状态切换 + 大盘可见 + 工作台 CRUD)
- B8 留言板 UI + G16 自动同步天然耦合(留言来源有手动 / auto_from_planpoint 两类),拆开做有割裂感,合到 β.2.5 / β.3 一起做更聚焦
- related_theme_ids 没 PolicyTheme 表无 caller(β.1 教训:不写没 caller 的字段)
- 估时 ~1.5d 严格对齐 HANDOFF §7.14;含留言板会破到 ~2.5d

---

## 2 · 数据模型

### Pin 实体(`apps/api/src/pins/entities/pin.entity.ts`,新增)

**9 业务 + 2 地理 + 4 系统**(对齐 β.1 Visit 「7+4+系统」量级)。

**命名约定**(对齐 β.1 实际 entity 实施风格):
- DB column 用 snake_case(下表「字段」列即 DB 列名)
- TypeORM entity 属性 + DTO + JSON wire 全用 camelCase(`@Column({ name: 'snake_case' })` 标注)
- 示例:`province_code` 列 → `provinceCode` 属性

| 字段(DB column) | 类型 | 必填 | 含义 | 示例 |
|---|---|---|---|---|
| `id` | uuid | ✅ | gen_random_uuid() | |
| `title` | varchar(100) | ✅ | 标题 | `成都新能源汽车产业链对接` |
| `description` | text | ⬜ | 详细描述 | |
| `status` | enum `pin_status` | ✅ | `in_progress` / `completed` / `aborted`,默认 `in_progress` | |
| `aborted_reason` | text | ⬜ | 中止原因(`status=aborted` 时必填,重开置空) | `政策窗口关闭,等下一轮` |
| `closed_by` | uuid | ⬜ | 关闭人 FK users(完成/中止时填,重开置空)`onDelete: RESTRICT` | |
| `closed_at` | timestamptz | ⬜ | 最近一次完成/中止时间(重开置空) | |
| `priority` | enum `pin_priority` | ✅ | `high` / `medium` / `low`,默认 `medium` | `high` |
| `province_code` | varchar(6) | ✅ | 省级行政区划代码(对齐 β.1 idiom,而非 PRD `region_code`) | `510000` |
| `city_name` | varchar(64) | ✅ | 市名 | `成都市` |
| `lng` / `lat` | double precision | ✅ | 后端 `lookupCityCenter()` 自动填 — 复用 β.1 `geojson-cities.ts` | |
| `created_by` | uuid | ✅ | 创建人 FK users `onDelete: RESTRICT`(= owner) | |
| `created_at` | timestamptz | ✅ | `default now()` | |
| `updated_at` | timestamptz | ✅ | `default now()` + auto update | |

**索引**:`created_by` / `status` / `province_code`(常用查询)。

**命名对齐 β.1**:
- 用 `province_code` + `city_name` 而非 PRD `region_code` — β.2 不做精到区级,V0.7 改 schema 时再考虑通用化
- 用 `created_by/created_at` 而非 PRD `opened_by/opened_at` — 系统时间戳冗余,语义不变

### 共享类型(`packages/shared-types/src/dtos/pin.dto.ts`,新增)

```ts
export type PinStatus = 'in_progress' | 'completed' | 'aborted';
export type PinPriority = 'high' | 'medium' | 'low';

export interface Pin {
  id: string;
  title: string;
  description: string | null;
  status: PinStatus;
  abortedReason: string | null;
  closedBy: string | null;
  closedAt: string | null;
  priority: PinPriority;
  provinceCode: string;
  cityName: string;
  lng: number;
  lat: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePinInput {
  title: string;
  description?: string;
  priority?: PinPriority;          // 默认 medium
  provinceCode: string;
  cityName: string;
}
// status 创建时强制 in_progress,不接受外部值
// closed_* / aborted_reason 创建时必为空
// lng/lat 后端自动从 lookupCityCenter 填

export interface UpdatePinInput {
  title?: string;
  description?: string | null;
  status?: PinStatus;
  abortedReason?: string | null;
  priority?: PinPriority;
  // 不允许改 provinceCode / cityName(改了会动 lng/lat 影响散点位置 — 跟 β.1 Visit 同策略)
}
```

字段命名:**camelCase**(对齐 β.1 user.dto / visit.dto + NestJS 默认序列化)。

---

## 3 · 后端 API

### 端点(`apps/api/src/pins/pins.controller.ts`,新增)

5 端点,完全对齐 β.1 Visit idiom,全走全局 `JwtAuthGuard`:

```
GET    /api/v1/pins              list(默认 created_at desc)
GET    /api/v1/pins/:id          单条
POST   /api/v1/pins              create(status 强制 in_progress)
PUT    /api/v1/pins/:id          edit + 状态切换(单端点搞定,跟 β.1 一样)
                                 — 状态机校验 + aborted_reason / closed_* 自动填/置空在 service.update
```

不做的端点:
- `DELETE /api/v1/pins/:id` → V0.7 soft delete + audit log
- `PATCH /api/v1/pins/:id/status` → 不拆,合到 PUT(β.1 idiom 一致)

### 状态机校验(`pins.service.ts.update()`)

```ts
async update(id, dto, currentUserId) {
  const prev = await this.findOne(id);
  const newStatus = dto.status ?? prev.status;

  // 状态机合法性 — PRD §4.3.1:
  //   in_progress ⇄ completed
  //   in_progress ⇄ aborted
  //   completed → in_progress(重开)
  //   aborted → in_progress(重开)
  //   completed ↔ aborted 不允许直接切(必须先 reopen)
  if (newStatus !== prev.status) {
    const allowed = {
      in_progress: ['completed', 'aborted'],
      completed:   ['in_progress'],
      aborted:     ['in_progress'],
    };
    if (!allowed[prev.status].includes(newStatus)) {
      throw new BadRequestException(`非法状态切换:${prev.status} → ${newStatus}`);
    }

    // aborted 必填 reason
    if (newStatus === 'aborted' && !dto.abortedReason) {
      throw new BadRequestException('中止 Pin 必须填写中止原因');
    }

    // 重开:置空 closed_at / closed_by / aborted_reason
    if (newStatus === 'in_progress') {
      prev.closedAt = null;
      prev.closedBy = null;
      prev.abortedReason = null;
    } else {
      // 关闭(completed / aborted):自动填 closed_at + closed_by
      prev.closedAt = new Date().toISOString();
      prev.closedBy = currentUserId;
      prev.abortedReason = newStatus === 'aborted' ? dto.abortedReason : null;
    }
    prev.status = newStatus;
  }

  // 其他字段 patch
  if (dto.title !== undefined) prev.title = dto.title;
  if (dto.description !== undefined) prev.description = dto.description;
  if (dto.priority !== undefined) prev.priority = dto.priority;
  // provinceCode / cityName 不接受改 — UpdatePinInput 类型已限制

  return this.repo.save(prev);
}
```

### Migration

- `1745500000005-AddPinsTable.ts` — 加 `pin_status` enum + `pin_priority` enum + `pins` 表 + 3 索引
- `1745500000006-SeedDemoPins.ts` — 见 §4

---

## 4 · seed 数据

### `apps/api/src/database/migrations/1745500000006-SeedDemoPins.ts`(新增)

3 条,覆盖状态机 3 态 + priority 3 档:

| # | 城市 / `province_code` | `title` | `status` | `priority` | 其他 |
|---|---|---|---|---|---|
| 1 | 成都市 / `510000` | 成都新能源汽车产业链对接 | `in_progress` | `high` | description: 「与成都市经发局对接成都新能源汽车产业,涉及 V2G 试点合作意向初步沟通」 |
| 2 | 广州市 / `440000` | 广州 V2G 试点推进 | `completed` | `medium` | description: 「广州市发改委 V2G 示范应用试点合作意向已落地;closed_at = now() - 30 day;closed_by = sysadmin user id」 |
| 3 | 上海市 / `310000` | 上海数据要素市场化试点 | `aborted` | `low` | description: 「上海经信委对接数据要素流通市场化探索」;aborted_reason: 「政策窗口关闭,等下一轮政策周期重启」;closed_at = now() - 60 day;closed_by = sysadmin user id |

**设计意图**:
- 3 态各 1 条 → 状态机 demo 完整(紫 / 暗灰 / 浅灰)
- 3 档 priority 各 1 条 → 工作台 Table sort by priority 能看到效果
- `created_by` 都填 sysadmin user id(对齐 β.1 SeedDemoVisits 的 5 demo 用户分配,β.2 简化用单一 sysadmin)
- **上海故意选**:β.1 没有上海 Visit,Pin 落上海是孤立的图钉 → demo「项目立项但因政策窗口关闭中止,故无后续拜访」的真实场景(stakeholder 提问预期内)

**Idempotent**:`up()` 跑前 `DELETE FROM pins`(MVP 简化,生产 migration 不可清表 — 跟 β.1 SeedDemoVisits 同策略,注释说明)。

---

## 5 · 前端工作台「图钉清单」tab

### `apps/web/src/pages/console/PinsTab.tsx`(替换 V0.3 StubCard 占位)

参考 `VisitsTab.tsx` 风格:

- `useQuery({ queryKey: ['pins'], queryFn: fetchPins })`
- `fetchPins` 用 `lib/api.ts` 的 `authHeaders()`(β.1 token bug 已修)
- 标题栏:`图钉清单 ({pins.length})` + 「新建图钉」按钮
- 表格列:
  - 标题(`title`,主列,占主要宽度)
  - 城市(`cityName`,width 120)
  - 状态(`status` 三色 Tag:in_progress=紫 / completed=灰 / aborted=浅灰)
  - 优先级(`priority` Tag:high=红 / medium=橙 / low=绿)+ sorter
  - 创建时间(`createdAt`,sorter,defaultSortOrder: 'descend')
  - 操作:[编辑] 跳同 `PinFormModal`
- 分页 pageSize: 20(seed 3 条不会触发分页,但保留 idiom)

### `apps/web/src/components/PinFormModal.tsx`(新增,参考 `VisitFormModal`)

- `open` / `onClose` / `editing?: Pin` props 跟 VisitFormModal 一样
- 字段:
  - 标题 `title`(必填,Input maxLength 100)
  - 描述 `description`(可选,TextArea rows 4)
  - 优先级 `priority`(Select,默认 medium)
  - 省份 `provinceCode`(Select,数据从 `/api/v1/cities`,**编辑态禁用**)
  - 城市 `cityName`(Select cascading,**编辑态禁用**)
  - **状态相关字段**(只在编辑态显示):
    - 状态 `status`(Radio.Group:进行中 / 完成 / 中止)
    - 中止原因 `abortedReason`(TextArea,只在 `status === 'aborted'` 时显示,必填)
- 状态切换提示:重开/关闭时 Modal 内 Alert 提示「重开会清空关闭信息」/「中止后须填写原因」
- Submit:POST `/api/v1/pins`(创建)/ PUT `/api/v1/pins/:id`(编辑)
- Success:`queryClient.invalidateQueries({ queryKey: ['pins'] })`

---

## 6 · 前端大盘 R2-① 改动

### `apps/web/src/components/MapCanvas.tsx`(扩展)

加第二个 scatter series 渲染 Pin:

- `useQuery({ queryKey: ['pins'], queryFn: fetchPins })`(并行 visits 和 pins,react-query 自动缓存)
- 新 series:
  ```ts
  {
    type: 'scatter',
    coordinateSystem: 'geo',
    geoIndex: 0,
    symbol: 'pin',                         // ⭐ ECharts 内置图钉形状
    symbolSize: provinceCode ? 22 : 14,    // 比 Visit 圆点(5/10)明显大
    itemStyle: { /* 按 status 颜色 */ },
    data: pinsToScatterData(pins),
    z: 6,                                  // 比 Visit 散点(z:5)略高,Pin 浮在上层
  }
  ```
- `pinsToScatterData(pins)`:
  ```ts
  pins.map(p => ({
    value: [p.lng, p.lat, 1],
    itemStyle: {
      color: PIN_STATUS_COLOR[p.status],   // 紫 / 暗灰 / 浅灰
      opacity: p.status === 'aborted' ? 0.5 : 1,
      shadowBlur: 8,
      shadowColor: 'rgba(0,0,0,0.4)',
    },
    name: p.title,
    pinId: p.id,                           // click 派发用
  }))
  ```
- `PIN_STATUS_COLOR`(写到 `apps/web/src/tokens.ts` 或 MapCanvas 顶部常量):
  - `in_progress` = `#B388FF`(紫)
  - `completed` = `#607D8B`(暗灰)
  - `aborted` = `#BDBDBD`(浅灰)
- click 事件:`params.componentSubType === 'scatter'` 时区分 series — Visit series 派发 `onVisitClick(visitId)`,Pin series 派发 `onPinClick(pinId)`(用 `params.seriesIndex` 或 `params.data.pinId` 区分)
- legend 不动(底部 4 色 Visit legend 不加 Pin — 状态色是项目状态语义,Pin 跟 Visit legend 分离;**Pin 的状态色靠 Detail Drawer 解释 / 工作台 Tag 复用**)

### `apps/web/src/pages/MapShell.tsx`(扩展)

- 加 `selectedPinId` state(跟 `selectedVisitId` 平级)
- `<MapCanvas onPinClick={setSelectedPinId} />` 多接一个 prop
- **删除现有占位「新增 Pin/蓝点」抽屉**(line 142-157 的 `<Drawer title="新增 Pin / 蓝点(占位)">`)
- 加 `pinModalOpen` state,➕📌 浮按钮 onClick 改 `setPinModalOpen(true)`(替换 `setDrawerOpen(true)`)
- 加 `<PinFormModal open={pinModalOpen} onClose={...} />`
- 加 `<PinDetailDrawer pinId={selectedPinId} onClose={() => setSelectedPinId(null)} />`

### 新组件:`apps/web/src/components/PinDetailDrawer.tsx`(新增)

参考 `VisitDetailDrawer.tsx`,差异:

- 顶部状态切换按钮组:
  - 当前 `in_progress` → 显示「✓ 标记完成」「✕ 中止」
  - 当前 `completed` → 显示「↺ 重开」
  - 当前 `aborted` → 显示「↺ 重开」 + 显示中止原因
- 「✕ 中止」按钮 onClick → 弹 Modal.confirm 收 abortedReason 输入(必填),提交 PUT
- 详情区:title / description / priority Tag / 城市 / 创建时间 / 关闭时间(if any)
- 「编辑」按钮:打开同一 PinFormModal(editing 态)
- 演示文档下载:**β.2 不做**(Pin 没有 demo 文档需求,Visit 才有;tile 删掉)

---

## 7 · 状态机 UI(B9 落实)

```
[in_progress] ──「✓ 标记完成」──→ [completed] ──「↺ 重开」──→ [in_progress]
              ──「✕ 中止」──────→ [aborted]   ──「↺ 重开」──→ [in_progress]
                (弹 Modal 收 reason)

不允许:completed ↔ aborted 直接切(必须先 reopen)
```

**重开机制**(2026-04-23 用户拍板):
- 重开时 service 自动置空 `closed_at` / `closed_by` / `aborted_reason`(已在 §3 service 逻辑中)
- `opened_at` 不变(= `created_at`,Pin 一生只有 1 个 opened_at)
- 历史变更去 V0.7 audit log 查(β.2 不做)

---

## 8 · 跟 β.1 复用的部分(零新代码)

| β.2 用到的 | β.1 已建 | 复用方式 |
|---|---|---|
| 后端 `lookupCityCenter(provinceCode, cityName)` | `apps/api/src/lib/geojson-cities.ts` | 直接 import,POST 时填 lng/lat |
| 后端 `GET /api/v1/cities` | β.1 `CitiesController` | 不动,前端 PinFormModal 共用 |
| 前端 `authHeaders()` | `apps/web/src/lib/api.ts` | fetch wrapper,所有 pin fetch 复用 |
| 前端 `palette.visit.*` | `apps/web/src/tokens.ts` | Pin 用单独 PIN_STATUS_COLOR(避免色相冲突) |
| 前端 react-query `QueryClient` | β.1 已配 | 加 `['pins']` queryKey,自动缓存 |
| 前端 AntD `Modal` / `Drawer` / `Table` | β.1 已用 | PinFormModal 是 VisitFormModal 复制改名 |

**不重复的 idiom 风险**:无。Pin 的所有共享基础设施都直接复用(对齐 β.1 token bug 教训:先 grep 现有 codebase)。

---

## 9 · 工程细节

### Migration 顺序
- `1745500000005-AddPinsTable.ts`
- `1745500000006-SeedDemoPins.ts`

依赖 V0.2 SeedDemoUsers(取 sysadmin id),跟 β.1 SeedDemoVisits 同检查方式。

### Module 注册
`apps/api/src/app.module.ts` 加 `import { PinsModule }` + 加到 imports 数组(对齐 β.1 VisitsModule 注册)。

### 大盘双 query 并行
- `useQuery(['visits'])` + `useQuery(['pins'])` 同 MapCanvas,react-query 自动并发
- 两个都加载完才显示散点(可选 `Promise.all` 等待,或者各自渲染各自 series — **后者**,任一加载完就先渲染各自 layer)

### 数据稀疏时
- 3 个 Pin 散点稀疏正常 — Pin 是「项目机会标记」,语义就是「重要项目少而精」
- 不加 dropout / hash 抖动(β.1 mock-heatmap 那套 dropout 是假数据稀疏感,真业务不需要)

---

## 10 · 验证(end-to-end)

按 §7.13 教训(「e2e 验证不能只 curl + DOM,必须从浏览器登录 → 跳页面 → 看 Network → 看数据」):

### 后端
1. `npm run typecheck --workspace=@pop/api` 通过
2. `npm run migration:run --workspace=@pop/api` 跑通,`pins` 表 + `pin_status` enum + `pin_priority` enum + 3 索引建好
3. `psql` 看 `pins` 表 3 条 seed(成都/广州/上海各 1)
4. curl 验证(用 sysadmin token):
   - `GET /api/v1/pins` 返 3 条
   - `POST /api/v1/pins` 创建第 4 条(返 201 + lng/lat 自动填)
   - `PUT /api/v1/pins/:id` `{ status: 'completed' }` 返 closed_at 填好
   - `PUT /api/v1/pins/:id` `{ status: 'in_progress' }` 重开,closed_at 置空
   - `PUT /api/v1/pins/:id` `{ status: 'aborted' }` 不带 reason → 400
   - `PUT /api/v1/pins/:id` `{ status: 'aborted', abortedReason: 'X' }` → 200
   - `PUT /api/v1/pins/:id` `{ status: 'aborted' }`(从 completed)→ 400 非法切换

### 前端(浏览器实测,不只 curl)
5. `/login` sysadmin → `/map/local`:
   - 大盘可见 3 个 Pin 图钉形状(成都紫色 in_progress / 广州暗灰 completed / 上海浅灰半透 aborted)
   - 跟现有 32 个 Visit 散点共存,视觉清晰区分
   - 点 Pin → PinDetailDrawer 弹出,顶部按钮组按状态显示
   - 在 PinDetailDrawer 点「✕ 中止」(成都那条)→ 输入 reason → 保存 → Pin 颜色变浅灰半透
   - 点「↺ 重开」(广州那条)→ Pin 颜色变紫,closed_at 消失
   - ➕📌 浮按钮 → PinFormModal 弹出 → 填省+市+title 创建 → 大盘新 Pin 出现 / 工作台 Table +1
6. `/console/pins` 工作台:
   - Table 3 条(创建后 4 条)
   - 状态 Tag + priority Tag 颜色对应
   - 「新建图钉」按钮共用 PinFormModal
   - 「编辑」入口跳同一 Modal,字段预填
7. 回归 V0.4/V0.5/β.1 视觉(浮玻璃 / 把手 / Slider / Legend / Visit 散点 / VisitDetailDrawer 不退化)
8. console / Network 无 401 / 500 / runtime error

---

## 11 · 工作量 + worktree

**估时**:~1.5d(对齐 §7.14)
- 后端:0.5d(entity / migration / service 含状态机校验 / controller / module)
- 前端 MapCanvas + MapShell 接入:0.4d
- 前端 PinFormModal + PinDetailDrawer:0.4d
- 工作台 PinsTab:0.2d
- e2e + 文档:0.1d

**worktree**:`claude/v06-beta2-pin`,从 main(c27295a — β.1 squash 后)起。
- 起步前必须 `git fetch && git checkout main && git pull`(把 β.1 拉下来),避免基于过期 main

**commit / PR**:
- 单 commit squash 推 PR(对齐 β.1 风格)
- PR base = main,head = `claude/v06-beta2-pin`
- 跟 β.1 一样:reviewer 浏览器实测后 self-merge

---

## 12 · 不在本 spec 范围(留后续)

- **B8 Pin 留言板**(Comment 实体 + 手动留言 UI)→ β.2.5
- **G16 子蓝点完成自动同步留言** → β.3(蓝点转色 listener 触发)
- **PlanPoint(蓝点)实体 + 状态机** → β.3
  - **β.3 视觉约定**(本 spec 内拍板,β.3 不再讨论):蓝点用跟 Visit 散点完全相同的形状(圆点)+ size(全国 5px / 省下钻 10px)+ style,仅颜色用 `palette.visit.blue`
- **Pin → PlanPoint 派生(B4)**:Pin Detail Drawer 加「基于此 Pin 创建蓝点」入口 → β.3
- **related_theme_ids**(政策主题关联)→ c3 政策大盘,Pin entity 加字段 + UI cascading 多选
- **CASL `pmo/lead` 真矩阵**(Pin 编辑权限按 PRD §4.3.1)→ V0.7
- **Soft delete + audit log**(B9 Pin 删除 / 状态变更历史)→ V0.7
- **B14 工作台筛选**(状态 / priority / 时间 / 城市)→ V0.7
- **B12 H5 移动端 Pin 录入** → V0.7+
- **B15 Pin 详情页工具加载**(点开 Pin 看「该地域可用工具」)→ 等 D 工具模块
