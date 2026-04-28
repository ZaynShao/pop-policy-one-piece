# V0.6 patch · Pin 回收站 UI

> 状态:design 收口,待 writing-plans 拆任务清单
> 上一期:V0.6 β.2.5/β.3 + Pin 软删除 (#9 已 merged 到 main = 8c7c843)

---

## Context · 为什么做这个

V0.6 #9 落地了 Pin 软删除(`pins.deleted_at` + DELETE endpoint + RBAC 白名单 sys_admin/lead/pmo)。但**只能删,不能撤** — 用户误删要 sys_admin 直接 psql 才能还原。回收站是软删除的对称半部:让能删的人(sys_admin/lead/pmo)能看到自己/同事删的 Pin,一键还原。

DEMO 心智:**「点了删除→消失」+「我能找回来」** 才是完整的软删除体验。否则用户不敢点删除按钮(怕误操作不可逆),软删除当作硬删用,V0.6 留的 deleted_at 字段就白浪费了。

---

## 核心决策(brainstorm 已逐项拍)

1. **入口形态:Segmented 切换器**(在现有 PinsTab 内部)
   - 顶部 `[活跃 (n)  |  回收站 (m)]`,默认活跃
   - 不新建 console tab,不污染 sidebar(已 10+ tab)

2. **RBAC 对称**:能删的人能撤
   - sys_admin / lead / pmo:可见 Segmented + 可还原
   - local_ga / central_ga:Segmented 不渲染 + 后端 `?withDeleted=true` 抛 403

3. **不做永久删除按钮**(YAGNI)
   - 演示阶段 Pin 总数 <20,「永久删」全年 0-1 次,sys_admin 直接 SQL 兜底
   - V0.7+ 数据量上来再加 UI

4. **还原后状态维持原值**
   - in_progress 删了还原回 in_progress;completed/aborted 同理
   - `deleted_at` 置 NULL,其他字段不动

5. **大盘永远不显示已删 Pin**
   - 现有 GET /pins 默认 `deletedAt IS NULL`(TypeORM softDelete 自动)— 不变

---

## Architecture

```
                    sys_admin 进 /console/pins
                              │
           ┌──────────────────┴──────────────────┐
           │                                     │
       [活跃] (默认)                       [回收站] (Segmented 切)
           │                                     │
           ▼                                     ▼
GET /pins                           GET /pins?withDeleted=true
(deletedAt IS NULL)                 (deletedAt IS NOT NULL)
           │                                     │
           │   PinDetailDrawer 「删除」          │   行操作 「还原」
           │   DELETE /pins/:id (204)             │   POST /pins/:id/restore (200)
           │   ◄───────────────┐                  │   ───────────────►
           │                   │                  │
           ▼                   │                  ▼
       deleted_at = now()     ─┘             deleted_at = NULL
                                              ─────────────►
                                              (大盘 +1 自动出现)
```

**关键不变量**:
- `deletedAt IS NULL` ⟺ 大盘可见 + 「活跃」视图可见
- `deletedAt IS NOT NULL` ⟺ 大盘隐藏 + 「回收站」视图可见
- restore = `deletedAt = NULL`(原 status 不动)
- delete + restore + delete 路径幂等

---

## DB / Migration

**无新 migration**。V0.6 #9 已加 `pins.deleted_at timestamptz NULL` + `IDX_pins_deleted_at` index。

---

## API

**改造**(1 endpoint)
```
GET /api/v1/pins?withDeleted=true
  ─ 不传 / withDeleted=false  → 行为同现状(deletedAt IS NULL)
  ─ withDeleted=true:
      ─ RBAC 校验 currentUser.roleCode ∈ {sys_admin, lead, pmo}
      ─ ∉ 抛 403「只有管理员/负责人/PMO 可以查看回收站」
      ─ 返 deletedAt IS NOT NULL 的 Pin 列表(order by deletedAt DESC)
```

**新加**(1 endpoint)
```
POST /api/v1/pins/:id/restore
  ─ RBAC 校验同 softDelete:white-list sys_admin/lead/pmo
  ─ 找到 Pin(withDeleted: true,因为目标 Pin 已被软删)
  ─ 不存在 → 404
  ─ 已存在(deletedAt IS NULL,即未删) → 也 200,幂等(restore 视作 idempotent)
  ─ repo.restore(id):deletedAt 置 NULL
  ─ 返 { data: pin }
```

**校验摘要**:
- POST /:id/restore 不接受 body
- DELETE /:id 行为不变(V0.6 #9 已实现)

---

## 后端实施

**`apps/api/src/pins/pins.service.ts`** — 改 + 新加
```ts
const PIN_TRASH_ALLOWED_ROLES = PIN_DELETE_ALLOWED_ROLES;
// 复用 V0.6 #9 已定义的 sys_admin/lead/pmo Set

list(opts: { withDeleted?: boolean; currentUser: AuthenticatedUser }): Promise<PinEntity[]> {
  if (opts.withDeleted) {
    if (!PIN_TRASH_ALLOWED_ROLES.has(opts.currentUser.roleCode)) {
      throw new ForbiddenException('只有管理员/负责人/PMO 可以查看回收站');
    }
    return this.repo.find({
      withDeleted: true,
      where: { deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
    });
  }
  return this.repo.find({ order: { createdAt: 'DESC' } });
}

async restore(id: string, currentUser: AuthenticatedUser): Promise<PinEntity> {
  if (!PIN_TRASH_ALLOWED_ROLES.has(currentUser.roleCode)) {
    throw new ForbiddenException('只有管理员/负责人/PMO 可以还原图钉');
  }
  const pin = await this.repo.findOne({ where: { id }, withDeleted: true });
  if (!pin) throw new NotFoundException(`Pin ${id} not found`);
  await this.repo.restore(id);
  return this.repo.findOneOrFail({ where: { id } });
}
```

**`apps/api/src/pins/pins.controller.ts`** — 改 + 新加
```ts
@Get()
async list(
  @CurrentUser() user: AuthenticatedUser,
  @Query('withDeleted') withDeleted?: string,
) {
  const data = await this.service.list({
    withDeleted: withDeleted === 'true',
    currentUser: user,
  });
  return { data };
}

@Post(':id/restore')
async restore(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return { data: await this.service.restore(id, user) };
}
```

---

## 前端实施

**`apps/web/src/api/pins.ts`** — 新建(集中 fetcher,目前散在 PinsTab/PinDetailDrawer)
```ts
export async function fetchPins(opts?: { withDeleted?: boolean }): Promise<{ data: Pin[] }> {
  const q = opts?.withDeleted ? '?withDeleted=true' : '';
  const r = await fetch(`/api/v1/pins${q}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('pins fetch fail');
  return r.json();
}

export async function restorePin(id: string): Promise<Pin> {
  const r = await fetch(`/api/v1/pins/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'restore fail');
  }
  const j = await r.json();
  return j.data;
}
```

**`apps/web/src/pages/console/PinsTab.tsx`** — 改造
- import `Segmented` + `useAuthStore`
- 顶部 Segmented `[活跃 ({active.length}) | 回收站 ({trash.length})]`,按 role 隐藏
- state: `view: 'active' | 'trash'`,默认 'active'
- 双 useQuery:
  - `['pins', 'active']` → fetchPins() (无 withDeleted)
  - `['pins', 'trash']`  → fetchPins({ withDeleted: true }),enabled = canSeeTrash
- 列结构按 view 切:
  - active:沿用现有 6 列(标题 / 城市 / 状态 / 优先级 / 创建时间 / 操作=编辑)
  - trash:4 列(标题 / 城市 / 删除时间 / 操作=还原)
- 「还原」useMutation → POST /restore → invalidate ['pins'] (key prefix 自动覆盖 active+trash)

**`apps/web/src/components/PinDetailDrawer.tsx`** — 微调
- delete 后 `qc.invalidateQueries({ queryKey: ['pins'] })` 已是 prefix invalidate,**自动覆盖** trash 视图。**0 改动**(确认即可)

**shared-types `Pin` 接口** — 加字段
- 加 `deletedAt: string | null`(回收站列表渲染需要)
- 后端 entity 已有,序列化默认带,前端类型补齐

---

## Testing

**后端 jest 新增 4 测**(`pins.service.spec.ts`):
- `list({ withDeleted: true })` happy:返已删行,deletedAt DESC
- `list({ withDeleted: true })` 拒 local_ga:抛 ForbiddenException
- `restore` happy:deletedAt 置 NULL + 返新 entity
- `restore` 拒 local_ga + 404 不存在 ID

**前端**:
- `npm run typecheck` 0 error
- preview e2e 2 步:
  - sysadmin 切「回收站」→ 看到 V0.6 demo 时软删的 N 条
  - 点「还原」一条 → 大盘自动 +1 出现 + 回收站 -1

**回归**:
- V0.6 17 commits e2e 路径(8 步主流程 + 4 错误 + 5 角色 RBAC)不退化
- /map/local 大盘默认渲染不变(deletedAt IS NULL 是默认)

---

## User 场景脚本(3 步主流程)

```
[0] sys_admin 登录 → /map/local → 3 红/灰 Pin + 32 散点(基线)
[1] 点成都红 Pin → Drawer 「🗑 删除」→ 二次确认 → DELETE 204 → 大盘 -1
[2] 进 /console/pins → 顶部 Segmented [活跃 (2) | 回收站 (1)] → 切「回收站」
    → 列表 1 行(标题=成都新能源... / 城市=成都市 / 删除时间=刚才)
[3] 点行尾「还原」→ POST /restore 200 → 列表 0 行
    → 切回「活跃」 (3) → 跳转 /map/local → 成都红 Pin 回归
```

**RBAC 验证**:
```
[A] 切 local_ga 登录 → /console/pins → 顶部无 Segmented(只看「图钉清单」标题 + 「+新建」)
[B] curl: local_ga token → GET /pins?withDeleted=true → 403
[C] curl: local_ga token → POST /pins/:id/restore → 403
```

---

## 关键文件清单

**后端**(改 + 新)
```
apps/api/src/pins/pins.service.ts     [改:list 加 opts / 新 restore]
apps/api/src/pins/pins.controller.ts  [改:GET 加 query / 新 POST :id/restore]
apps/api/src/pins/__tests__/pins.service.spec.ts  [新:4 jest tests]
```

**前端**(改 + 新)
```
apps/web/src/api/pins.ts                            [新:fetchPins / restorePin 集中 fetcher]
apps/web/src/pages/console/PinsTab.tsx              [改:Segmented + 双 useQuery + 列联动]
packages/shared-types/src/dtos/pin.dto.ts           [改:Pin 加 deletedAt 字段]
```

**总计:~6 文件**(后端 3 / 前端 3),预计 4-6 commits,1-2 小时落地。

---

## 注意事项

- **复用 V0.6 #9 的 PIN_DELETE_ALLOWED_ROLES Set**(同模块,导出 / 重命名为 PIN_TRASH_ALLOWED_ROLES alias)
- **TypeORM `repo.restore(id)` 内部走 UPDATE deletedAt = NULL**,不触发 ON DELETE 级联(visits.parent_pin_id 仍指向原 Pin,自动恢复关联),设计上正好对称软删时 visits 不动
- **React Query invalidate prefix `['pins']`** 同时刷新 active + trash 两个 query — 不需要 invalidate 两次
- **PinsTab.tsx 文件 < 200 行**,加 Segmented + 双 query 后会涨到 ~280 行,仍在可控范围(不需拆 PinsActiveTable / PinsTrashTable 子组件)
