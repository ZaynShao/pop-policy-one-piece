# V0.6 β.2.5 + β.3 蓝点闭环 · 实施 spec

> 状态:approved 2026-04-27 · 待 writing-plans 拆任务清单
> 范围:β.2.5(留言板)+ β.3(PlanPoint 蓝点)合并实施

---

## Context · 为什么做这个

V0.6 β.2 已经把 Pin(图钉,3 seed) + Visit(拜访,32 seed)两个真业务跑起来了,但用户场景**只有「拜访的事实」(已完成的 Visit) + 「项目的立项」(Pin),没有「拜访前的计划」**。PRD §B8/G16 + SPEC-V0.6-beta2-pin §18-30 / §426-430 把 β.2.5 (留言板) + β.3 (蓝点 PlanPoint) 设计为耦合一起做 — 这一期把它做完,demo 才能讲一个完整故事:

> Pin → 派生计划点(蓝)→ 拜访(转色)→ 自动留言到父 Pin

用户的核心心智是「**同一个点改 status 就变色**」 — 蓝色 = 未拜访,转 status 后 = 拜访点(红/黄/绿)。这个直觉决定了实现要走「**单表升级**」而不是「2 表 1:1 配对」 — 见下面 11 条决策。

—

## 核心决策(brainstorm 已逐项拍)

**数据模型**

1. **不新建 plan_points 表** — 把现有 `visits` 表升级为「计划/拜访点」统一实体
2. **加 4 字段**:`status`(planned|completed|cancelled)、`parent_pin_id`(FK pins,nullable)、`title`(varchar)、`planned_date`(date,nullable)
3. **`visit_color` enum 扩 1 值**:`blue`(planned 时使用,完成态仍 red/yellow/green)
4. **32 条 seed 回填**:`status='completed'`、`parent_pin_id=NULL`、`title=NULL`(前端展示「(化身拜访)」占位)
5. **Pin → 计划点:1:N**(一个 Pin 派生多条 planned)
6. **化身拜访也能 status=planned**(`parent_pin_id=NULL + status=planned` 合法 — 「计划走访某老乡」场景)

**状态机**

7. `planned → completed`:**不可逆**,且 completed 时 `visitDate / contactPerson / color` 必填
8. `planned → cancelled`:允许;`cancelled → planned`:允许重启
9. **completed 状态下只允许改 visitColor**(白名单 1 字段),其他字段抛 400「已完成拜访只允许改 visitColor」
10. `completed → *`:全禁(包含 cancelled / planned)

**自动留言**

11. **触发时机**:`visits.update` 把 status 从 `planned → completed` 且 `parentPinId IS NOT NULL` 时,事务内 `INSERT comments` 到父 Pin
12. **Comment 模板(中档)**:
    > ✅ 计划点「{title}」已完成。{visitDate} {visitor.name} 拜访 {department}({contactPerson} {contactTitle}),色 {colorZh},摘要:{outcomeSummary}
    其中 `colorZh`:red→紧急 / yellow→层级提升 / green→常规
13. **新建 comments 表**:`id / parentPinId(NOT NULL FK) / sourceType('manual'|'auto_from_visit') / body / linkedVisitId(nullable) / createdBy / createdAt`
14. **手动留言 UI 一起上**:Pin Drawer 加「留言板」section,显示 list + textarea + 发送

**前端形态**

15. **大盘视觉**:visits 单 series,**同形同尺寸**(全国 5px / 省下钻 10px),色按 `status === 'planned' ? blue : visitColor` 推
16. **工作台**:原「拜访清单」tab 加 status 筛选,默认 completed
17. **创建表单**:**1 套 + 头上 `[○ 计划中  ● 已拜访]` 切换器**,字段动态显示;Pin Drawer 派生预填 `defaultStatus='planned' + presetParentPinId + lng/lat`,工作台 +新建 默认 completed 可切

—

## Architecture(数据模型 + 数据流)

```
┌────────────────────────────────┐
│  pins  (沿用,β.2 已落地)       │
│  ─────                         │
│  id, title, status, priority,  │
│  abortedReason, lng, lat ...   │
└──────┬─────────────────────────┘
       │ 1
       │ N (parent_pin_id)
       │              ┌──────────────────────────────┐
       │              │ comments  (新建,β.2.5)       │
       │              │  ─────                       │
       │              │  id, parentPinId NOT NULL,   │
       │              │  sourceType:                 │
       │              │   'manual'|'auto_from_visit',│
       │              │  body, linkedVisitId,        │
       │              │  createdBy, createdAt        │
       ▼              └──────────────────────────────┘
┌─────────────────────────────┐
│  visits  (升级,32 seed)     │
│  ─────                      │
│  id, ...                    │
│  ─── 新增 4 字段 ───        │
│  status: planned|completed| │
│          cancelled (NOT NULL)│
│  parent_pin_id (FK pins)    │
│  title (varchar, null)      │
│  planned_date (date, null)  │
│  ─── 现有 11 字段 ───        │
│  visit_date, department,    │
│  contact_person, color,     │
│  outcome_summary, follow_up,│
│  province_code, city_name,  │
│  lng, lat, visitor_id       │
└─────────────────────────────┘

visit_color enum:  red | yellow | green | blue ◄── 新增
```

**端到端数据流**

```
[1] Pin Drawer「派生计划点」→ POST /visits {status:'planned', parentPinId, title, lng, lat, planned_date?}
    └─► visits 新增 1 行(蓝点)
[2] 蓝点 Drawer「转为已拜访」→ PUT /visits/:id {status:'completed', visitDate, contactPerson, color, ...}
    └─► 后端事务原子:
         a. UPDATE visits SET status=completed + 拜访字段
         b. IF parent_pin_id NOT NULL: INSERT comments(sourceType='auto_from_visit', body=模板渲染)
    └─► 大盘同坐标点变色(蓝→红/黄/绿),Pin 留言板 +1
[3] Pin Drawer 留言板手动 → POST /pins/:pinId/comments {body}
    └─► comments 新增 1 行(sourceType='manual'),Pin 留言板 +1
```

**关键不变量**

- visits 行 4 种合法身份:`(parentPinId NULL/NOT, status planned/completed/cancelled)` 任意组合
- 状态转移:`planned ↔ cancelled` 双向;`planned → completed` 单向不可逆;`completed → *` 全禁
- Comment 自动生成**仅在** `planned → completed` + `parentPinId NOT NULL`;手动不限
- 不动 pins 表 / users 表 / 现有 32 visits seed 字段(只回填 status / parentPinId / title / plannedDate)

—

## DB Migration

**Migration 1:visits 升级 + visit_color 扩 enum**

文件:`apps/api/src/migrations/{ts}-AddVisitStatusAndPin.ts`

```sql
-- 1. visit_color 加 'blue'
ALTER TYPE visit_color ADD VALUE 'blue';

-- 2. status enum + 列
CREATE TYPE visit_status AS ENUM ('planned', 'completed', 'cancelled');

ALTER TABLE visits
  ADD COLUMN status visit_status NOT NULL DEFAULT 'completed',
  ADD COLUMN parent_pin_id uuid NULL REFERENCES pins(id) ON DELETE SET NULL,
  ADD COLUMN title varchar(100) NULL,
  ADD COLUMN planned_date date NULL;

-- 3. 索引
CREATE INDEX idx_visits_parent_pin ON visits(parent_pin_id);
CREATE INDEX idx_visits_status ON visits(status);

-- DOWN:
-- DROP INDEX ...; ALTER TABLE visits DROP COLUMN ...; DROP TYPE visit_status;
-- 注:visit_color 'blue' 移除不可逆(PG enum 限制),DOWN 接受
```

**Migration 2:comments 表新建**

文件:`apps/api/src/migrations/{ts}-CreateComments.ts`

```sql
CREATE TYPE comment_source AS ENUM ('manual', 'auto_from_visit');

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_pin_id uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  source_type comment_source NOT NULL,
  body text NOT NULL,
  linked_visit_id uuid NULL REFERENCES visits(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_parent_pin ON comments(parent_pin_id, created_at DESC);
```

**Seed**:不新增 — demo 时让用户**真实操作**派生→转色→留言整流程。

**ON DELETE 策略**

- `comments.parent_pin_id ON DELETE CASCADE` — Pin 硬删时留言一起删(V0.7 才上 Pin DELETE)
- `visits.parent_pin_id ON DELETE SET NULL` — Pin 删了 Visit 还在,化身化
- `comments.linked_visit_id ON DELETE SET NULL` — Visit 删了留言保留

—

## 后端 API + 状态机

**改造 endpoints(visits 模块)**

```
GET    /api/v1/visits?status=&parentPinId=  ← 加 query param
POST   /api/v1/visits                        ← DTO 加 status/parentPinId/title/plannedDate
PUT    /api/v1/visits/:id                    ← 状态机校验 + Comment listener
GET    /api/v1/visits/:id                    ← 不变
DELETE                                        ← 不实现(V0.7)
```

**新加 endpoints(comments 模块)**

```
GET   /api/v1/pins/:pinId/comments    ← 列表(按 parentPinId,createdAt DESC)
POST  /api/v1/pins/:pinId/comments    ← 仅 manual(服务端写死 sourceType='manual')
```

**POST /visits 校验**(`apps/api/src/visits/visits.service.ts:create`)

```
- status='completed' → visitDate/contactPerson/color 必填(沿用)
- status='planned'   → title 必填,其他业务字段可空
- status='cancelled' → 创建时不允许直接新建(无意义)
- parentPinId 给则校验存在
```

**PUT /visits/:id 状态机**(`apps/api/src/visits/visits.service.ts:update`)

```ts
const allowed = {
  planned:   ['completed', 'cancelled'],
  completed: [],                          // 不可改 status
  cancelled: ['planned'],                 // 重启
};

if (dto.status && dto.status !== prev.status) {
  if (!allowed[prev.status].includes(dto.status))
    throw new BadRequestException(`不允许 ${prev.status} → ${dto.status}`);
  if (dto.status === 'completed') {
    requires(dto.visitDate, 'visitDate');
    requires(dto.contactPerson, 'contactPerson');
    requires(dto.color, 'color');
  }
}

// completed 状态下只允许改 visitColor(白名单)
if (prev.status === 'completed' && !dto.status) {
  const allowedKeys = new Set(['color']);
  for (const key of Object.keys(dto)) {
    if (!allowedKeys.has(key))
      throw new BadRequestException('已完成拜访只允许改 visitColor');
  }
}
```

**Comment auto listener**(同 service.update,事务内 — TypeORM `@Transaction()` 或 `dataSource.transaction()`)

```ts
if (prev.status === 'planned' && dto.status === 'completed' && prev.parentPinId) {
  await this.commentsRepo.save({
    parentPinId: prev.parentPinId,
    sourceType: 'auto_from_visit',
    body: renderTemplate(prev, dto, visitor),
    linkedVisitId: prev.id,
    createdBy: visitor.id,  // 拜访者本人
  });
}
```

**模板渲染函数**(`apps/api/src/visits/comment-template.ts`,新文件)

```ts
const COLOR_ZH = { red: '紧急', yellow: '层级提升', green: '常规' };

export function renderAutoComment(prev, dto, visitor): string {
  return `✅ 计划点「${prev.title || dto.title}」已完成。`
    + `${dto.visitDate} ${visitor.name} 拜访 ${dto.department}`
    + `(${dto.contactPerson} ${dto.contactTitle || ''}),`
    + `色 ${COLOR_ZH[dto.color]},摘要:${dto.outcomeSummary || '(无)'}`;
}
```

**POST /pins/:pinId/comments 校验**(`apps/api/src/comments/comments.service.ts`,新模块)

```
- parentPinId 校验 pin 存在
- sourceType 强制 'manual'(忽略前端值)
- linkedVisitId 强制 NULL
- createdBy = req.user.id
- body maxLength 500
```

—

## 前端组件改动

**4.1 共享类型**(`packages/shared-types`)

```diff
- export type VisitColor = 'red' | 'yellow' | 'green';
+ export type VisitColor = 'red' | 'yellow' | 'green' | 'blue';
+ export type VisitStatus = 'planned' | 'completed' | 'cancelled';
+ export type CommentSource = 'manual' | 'auto_from_visit';
+ export interface Comment { id, parentPinId, sourceType, body, linkedVisitId?, createdBy?, createdAt }
```

`Visit` 接口加 `status / parentPinId? / title? / plannedDate?`

**4.2 MapCanvas + tokens**(`apps/web/src/components/MapCanvas.tsx` + `tokens.ts`)

- `palette.visit.blue` 占位启用(已存在 β.3 注释)
- visits series 颜色函数:`row => row.status === 'planned' ? palette.visit.blue : palette.visit[row.color]`
- size 不变,不拆 series

**4.3 VisitFormModal**(`apps/web/src/components/VisitFormModal.tsx` — 改动最大)

- 顶部加 antd `Segmented` 切换器:`[○ 计划中  ● 已拜访]`
- 字段联动:
  - 「计划中」→ 仅 `title*` / `plannedDate(可选 DatePicker)` / 坐标 / `parentPinId(若预填则 readonly)`
  - 「已拜访」→ 沿用现有 `visitDate*/department/contactPerson/contactTitle/outcomeSummary/followUp/color*` + 坐标 + parentPinId(若预填 readonly)
- props 加:`defaultStatus?: 'planned' | 'completed'`,`presetParentPinId?: string`
- 提交时 status 跟随切换器

**4.4 VisitDetailDrawer**(`apps/web/src/components/VisitDetailDrawer.tsx`)

- planned 形态:大蓝标 + `title / plannedDate / 父 Pin 链接 / 坐标` + 主按钮「转为已拜访」+ 次按钮「取消计划」
- completed 形态:沿用现状 + 「关联 Pin」展示 + visitColor 可改下拉(白名单)
- cancelled 形态:灰标 + 「重启为计划中」按钮

**4.5 PinDetailDrawer**(`apps/web/src/components/PinDetailDrawer.tsx`)

- 加按钮:**「派生计划点」**(在编辑按钮旁) → 打开 `VisitFormModal({ defaultStatus: 'planned', presetParentPinId: thisPin.id, lng: pin.lng, lat: pin.lat })`
- 加底部 section:**「留言板」**
  - GET `/pins/:id/comments` 拉列表
  - 列表项:头像 + createdBy 用户名 + 时间 + body,sourceType='auto_from_visit' 加 `🤖` icon
  - 底部 textarea(maxLength 500)+「发送」 → POST `/pins/:id/comments`,乐观更新

**4.6 VisitsTab**(`apps/web/src/pages/console/VisitsTab.tsx`)

- 表头加 status 筛选 Select(全部 / 计划中 / 已拜访 / 已取消),默认「已拜访」
- 表格新增列:`status badge` / `title`(planned 时主显)/ `关联项目`(parentPin 标题)
- +新建 → `VisitFormModal({ defaultStatus: 'completed' })`(用户可手动切「计划中」做化身计划)

**4.7 MapShell click handler**(`apps/web/src/pages/MapShell.tsx`)

- 蓝点(planned)和橙/黄/绿点(completed)统一 click → 同一个 `VisitDetailDrawer`,内部按 status 渲染

—

## 用户场景脚本(8 步主流程)

```
[0] sys_admin 登录 → /map/local;看到 3 红/灰 Pin + 32 橙/黄/绿散点(β.2 回归)
[1] 点成都「川渝半导体补贴政策跟进」红 Pin → PinDrawer 打开,看到「派生计划点」+「留言板(空)」
[2] 「派生计划点」→ VisitFormModal 锁「计划中」,parentPinId 预填,坐标预填成都;
    填 title=「拜访中芯成都厂」,plannedDate=2026-05-15,提交
[3] 大盘成都坐标多 1 个蓝散点(z:5),红图钉(z:6)在上 — 视觉清晰
[4] 点蓝散点 → VisitDrawer 显示「计划中」+ 主按钮「转为已拜访」+ 次按钮「取消计划」
[5] 「转为已拜访」→ VisitFormModal 自动切「已拜访」,字段全开;
    填 visitDate/department/contactPerson/contactTitle/outcomeSummary/color=yellow,提交
[6] 大盘同坐标蓝散点变黄 — 同一个点改 status 就变色 ✅
[7] 点红 Pin → PinDrawer 留言板多 1 条 🤖 系统留言(模板渲染)
[8] textarea 输入「这条线索值得继续追,下周约部委对接」→ 发送;留言板 +1 条 manual 留言
```

**工作台补充验证**

```
[A] 工作台「拜访清单」tab 默认 completed → 看到 33 条(+ 关联项目列)
[B] 切到「计划中」→ 0 条;+新建 切「计划中」填 title=「化身计划:走访某老乡」 → 化身 planned 验证
```

**错误路径 4 个**

```
[X] PUT 一条 completed { status: 'planned' } → 400「不允许 completed → planned」
[Y] PUT 一条 planned { status: 'completed' } 缺 visitDate → 400「visitDate 必填」
[Z] PUT 一条 completed { outcomeSummary: 'x' } → 400「已完成拜访只允许改 visitColor」
[W] POST /pins/无效 ID/comments → 404
```

—

## Verification

**6.1 后端**

```bash
preview_start({ name: 'api-dev' })
cd apps/api && pnpm migration:run

# DB 验证
psql -d pop -c "\d visits"     # 看 status / parent_pin_id / title / planned_date 列
psql -d pop -c "\d comments"
psql -d pop -c "SELECT COUNT(*) FROM visits WHERE status='completed';"  # 32
psql -d pop -c "SELECT COUNT(*) FROM visits WHERE status='planned';"    # 0(开始)

# curl 4 个错误路径(见上)
```

**6.2 端到端浏览器**

```
1. preview_start({ name: 'api-dev' }) + 'vite-dev'
2. 浏览器登录 sys_admin → /map/local
3. 按上面场景脚本 [0]-[8] 跑,每步用 preview_snapshot + preview_screenshot 留证
4. preview_console_logs 检查无 error
5. preview_network 看 POST/PUT 状态码 + Comment auto INSERT 事务原子性
6. 工作台 [A][B] 跑一遍
```

**6.3 回归保护**

- β.2 大盘视觉(3 红/灰 Pin + 32 橙/黄/绿 Visit)在 [0] 步无变化
- β.1 +新建 拜访默认 status=completed 路径不退化
- Pin CRUD(✓/✕/↺/编辑)无影响
- 32 条 visits seed 渲染坐标 / color 跟 β.1 一致

—

## 关键文件清单

**后端(改 + 新)**

```
apps/api/src/migrations/{ts}-AddVisitStatusAndPin.ts          [新]
apps/api/src/migrations/{ts}-CreateComments.ts                [新]
apps/api/src/visits/entities/visit.entity.ts                  [改:加 status/parentPinId/title/plannedDate]
apps/api/src/visits/dto/create-visit.dto.ts                   [改]
apps/api/src/visits/dto/update-visit.dto.ts                   [改]
apps/api/src/visits/visits.service.ts                         [改:状态机 + Comment listener + 事务]
apps/api/src/visits/visits.controller.ts                      [改:GET 加 query param]
apps/api/src/visits/comment-template.ts                       [新]
apps/api/src/comments/comments.module.ts                      [新]
apps/api/src/comments/comments.controller.ts                  [新]
apps/api/src/comments/comments.service.ts                     [新]
apps/api/src/comments/entities/comment.entity.ts              [新]
apps/api/src/comments/dto/create-comment.dto.ts               [新]
apps/api/src/app.module.ts                                    [改:挂 CommentsModule]
```

**前端(改 + 新)**

```
packages/shared-types/src/enums/visit-color.ts                [改:加 'blue']
packages/shared-types/src/enums/visit-status.ts               [新]
packages/shared-types/src/enums/comment-source.ts             [新]
packages/shared-types/src/dtos/visit.ts                       [改:加 status/parentPinId/title/plannedDate]
packages/shared-types/src/dtos/comment.ts                     [新]
apps/web/src/components/MapCanvas.tsx                         [改:visits color 函数]
apps/web/src/components/VisitFormModal.tsx                    [改:加 Segmented + 字段联动]
apps/web/src/components/VisitDetailDrawer.tsx                 [改:三态渲染]
apps/web/src/components/PinDetailDrawer.tsx                   [改:加「派生计划点」+「留言板」section]
apps/web/src/components/PinCommentBoard.tsx                   [新:留言板组件]
apps/web/src/pages/console/VisitsTab.tsx                      [改:status 筛选 + title/parentPin 列]
apps/web/src/pages/MapShell.tsx                               [改:click handler 统一]
apps/web/src/lib/tokens.ts                                    [改:启用 palette.visit.blue]
apps/web/src/api/comments.ts                                  [新:GET/POST 客户端]
```

—

## 注意事项 / 复用既有

- **复用 PinFormModal 的坐标输入逻辑**(可微调 lng/lat 这块)— 不重写
- **复用 antd Segmented**(VisitFormModal 顶部切换器),不引新依赖
- **复用 react-query**(useQuery/useMutation 拉/推 comments 数据)
- **复用 zustand 'pop-auth' key 取 token**(避免 localStorage 'pop_token' 假设的 β.1 教训)
- **复用 tokens.ts 的 z-index 体系**(蓝散点用 visit z:5,红图钉 z:6)
- **PG enum 不可移除值** — 'blue' 加进去 down 接受不删
- **完成状态白名单只允许 visitColor 改** — 工程上一处 if,确保边界不漏
- **Comment auto listener 必须事务内** — 避免 visit 切了 status 但 comment 失败的不一致

—

## 下一步

1. **退出 plan mode** → ExitPlanMode
2. **搬这份 spec 到** `docs/superpowers/specs/2026-04-27-v06-beta25-beta3-bluepoint-design.md` + git commit
3. **走 superpowers:writing-plans** 拆任务清单(预估 3-5 个 commit / PR 单元)
4. **按 task list 跑 superpowers:test-driven-development + executing-plans**
