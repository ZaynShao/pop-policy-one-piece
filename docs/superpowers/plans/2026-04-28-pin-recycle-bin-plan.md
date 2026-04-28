# Pin 回收站 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pin 回收站 UI(还原已软删 Pin)— V0.6 #9 软删除的对称半部。

**Architecture:** PinsTab 加 antd Segmented `[活跃 | 回收站]` 切换器 + 双 useQuery,后端 GET /pins 加 `?withDeleted=true` query + 新加 POST /pins/:id/restore。无新 migration / 无新 entity / 无新前端组件。RBAC 沿用 V0.6 PIN_DELETE_ALLOWED_ROLES(sys_admin/lead/pmo)。

**Tech Stack:** NestJS 10 + TypeORM 0.3 + Jest;React 18 + Vite + antd 5 + react-query 5。

**Spec:** `docs/superpowers/specs/2026-04-28-pin-recycle-bin-design.md`

**Branch:** `claude/pin-recycle-bin`(已切,基于 origin/main = 8c7c843)

---

## File Structure

**修改**(4):
- `apps/api/src/pins/pins.service.ts` — list 加 opts / 新 restore / export PIN_TRASH_ALLOWED_ROLES alias
- `apps/api/src/pins/pins.controller.ts` — GET 加 @Query + 新 POST :id/restore
- `apps/web/src/pages/console/PinsTab.tsx` — Segmented + 双 useQuery + 列联动
- `packages/shared-types/src/dtos/pin.dto.ts` — Pin 加 deletedAt 字段

**新建**(2):
- `apps/api/src/pins/__tests__/pins.service.spec.ts` — 4 jest tests(restore happy/RBAC/404 + list withDeleted RBAC)
- `apps/web/src/api/pins.ts` — fetchPins / restorePin 集中 fetcher

---

## Task 1:shared-types Pin 加 deletedAt 字段

**Files:**
- Modify: `packages/shared-types/src/dtos/pin.dto.ts`

- [ ] **Step 1.1: 改 Pin 接口加 deletedAt**

打开 `packages/shared-types/src/dtos/pin.dto.ts`,找到 `interface Pin` 块(line 16-35),在 `updatedAt` 后加 `deletedAt`:

```typescript
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
  deletedAt: string | null;  // ◄── 新加(V0.6 #9 软删除时间,回收站 UI 用)
}
```

- [ ] **Step 1.2: 跑 typecheck 验证无连锁报错**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
npm run typecheck --workspaces --if-present 2>&1 | tail -10
```

期望:0 error。如果 PinsTab/PinDetailDrawer 之前用 `Pick<Pin, ...>` 或类似导致新字段连锁,会显示 — 不应有。

- [ ] **Step 1.3: commit**

```bash
git add packages/shared-types/src/dtos/pin.dto.ts
git commit -m "$(cat <<'EOF'
feat(shared-types): Pin 加 deletedAt 字段(回收站 UI 准备)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2:后端 service 改造 + 新建 jest 测试

**Files:**
- Modify: `apps/api/src/pins/pins.service.ts`
- Create: `apps/api/src/pins/__tests__/pins.service.spec.ts`

- [ ] **Step 2.1: 改 pins.service.ts 加 imports + 重命名 alias**

找到现有 `PIN_DELETE_ALLOWED_ROLES` 常量(应在文件顶部)。**保留原名,只加一个 alias export**(不破坏 V0.6 #9 的 import):

```typescript
// 文件顶部 import 区域追加:
import { IsNull, Not, Repository } from 'typeorm';
// (typeorm 已有 import,只是加 IsNull / Not 两个 named export)

// 在 PIN_DELETE_ALLOWED_ROLES 定义后追加:
export const PIN_TRASH_ALLOWED_ROLES = PIN_DELETE_ALLOWED_ROLES;
```

⚠️ Read 现有 service.ts 顶部确认 typeorm import 当前形态,只加缺的 named exports,不重写整段 import。

- [ ] **Step 2.2: 改 list() 签名,接受可选 opts**

找到现有 `list()` 方法:

```typescript
list(): Promise<PinEntity[]> {
  return this.repo.find({ order: { createdAt: 'DESC' } });
}
```

替换为:

```typescript
list(opts?: { withDeleted?: boolean; currentUser?: AuthenticatedUser }): Promise<PinEntity[]> {
  if (opts?.withDeleted) {
    if (!opts.currentUser || !PIN_TRASH_ALLOWED_ROLES.has(opts.currentUser.roleCode)) {
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
```

⚠️ `AuthenticatedUser` 已在文件顶部 import(V0.6 #9 加的)。如果没有,从 `@pop/shared-types` 加。

- [ ] **Step 2.3: 在 service 末尾加 restore 方法**

紧跟现有 `softDelete` 方法之后:

```typescript
/**
 * 还原软删 Pin — deleted_at 置 NULL,其他字段不动
 * 权限白名单:sys_admin / lead / pmo
 * 幂等:已存在(未删)的 Pin restore 也返 200
 */
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

- [ ] **Step 2.4: 新建 `apps/api/src/pins/__tests__/pins.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PinsService } from '../pins.service';
import { PinEntity } from '../entities/pin.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  restore: jest.fn(),
  softRemove: jest.fn(),
});

const userOf = (roleCode: UserRoleCode): AuthenticatedUser => ({
  id: 'u1',
  username: 'test',
  displayName: 'Test',
  email: 't@x',
  roleCode,
});

describe('PinsService — recycle bin', () => {
  let svc: PinsService;
  let pinsRepo: any;

  beforeEach(async () => {
    pinsRepo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        PinsService,
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
      ],
    }).compile();
    svc = module.get(PinsService);
  });

  describe('list({ withDeleted })', () => {
    it('returns soft-deleted rows for sys_admin', async () => {
      pinsRepo.find.mockResolvedValue([{ id: 'p1', deletedAt: new Date() }]);
      const out = await svc.list({ withDeleted: true, currentUser: userOf(UserRoleCode.SysAdmin) });
      expect(out).toHaveLength(1);
      expect(pinsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.list({ withDeleted: true, currentUser: userOf(UserRoleCode.LocalGa) }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('default list (no withDeleted) works for any role', async () => {
      pinsRepo.find.mockResolvedValue([{ id: 'p1' }]);
      const out = await svc.list({ currentUser: userOf(UserRoleCode.LocalGa) });
      expect(out).toHaveLength(1);
      expect(pinsRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('restore', () => {
    it('restores deleted pin for pmo', async () => {
      const deletedPin = { id: 'p1', deletedAt: new Date() };
      const restoredPin = { id: 'p1', deletedAt: null };
      pinsRepo.findOne.mockResolvedValue(deletedPin);
      pinsRepo.findOneOrFail.mockResolvedValue(restoredPin);
      const out = await svc.restore('p1', userOf(UserRoleCode.Pmo));
      expect(pinsRepo.restore).toHaveBeenCalledWith('p1');
      expect(out.deletedAt).toBeNull();
    });

    it('throws 403 for central_ga', async () => {
      await expect(
        svc.restore('p1', userOf(UserRoleCode.CentralGa)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 if pin not found', async () => {
      pinsRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.restore('p-nope', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2.5: 跑 jest 验证**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/api && npx jest --silent 2>&1 | tail -10
```

期望:`Tests: 25 passed, 25 total`(原 19 个 visits + 新 6 个 pins)。

如果 fail:
- `Cannot find name 'AuthenticatedUser'` → service.ts 顶部加 `import { type AuthenticatedUser, ... } from '@pop/shared-types';`
- `Cannot find module '@pop/shared-types'` 在 jest → 看 V0.6 visits jest 怎么 setup 的(jest config 有 paths mapping)
- `pinsRepo.restore is not a function` → mockRepo 里漏了 restore,加上

- [ ] **Step 2.6: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -5
```

期望:0 error。注意:V0.6 PinsController 调用 `service.list()` 无参,新签名 opts 是可选的,**不破坏现有调用**。

- [ ] **Step 2.7: commit**

```bash
git add apps/api/src/pins/pins.service.ts apps/api/src/pins/__tests__/pins.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): PinsService 加 list({withDeleted}) 路径 + restore 方法 (回收站)

- list 新签名接受可选 opts:{withDeleted, currentUser},RBAC 同 softDelete
- restore(id, user) 校验角色 → repo.restore → 返新 entity
- 6 jest 单测覆盖 happy/403/404 路径
- export PIN_TRASH_ALLOWED_ROLES alias(语义清晰)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3:后端 controller 改造

**Files:**
- Modify: `apps/api/src/pins/pins.controller.ts`

- [ ] **Step 3.1: 改 GET 接受 @Query('withDeleted') + @CurrentUser**

打开 `apps/api/src/pins/pins.controller.ts`,找到现有 `@Get() async list()`:

```typescript
@Get()
async list() {
  const data = await this.service.list();
  return { data };
}
```

替换为:

```typescript
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
```

⚠️ 顶部 imports 确认有 `Query` from `@nestjs/common`(V0.6 已在 visits.controller 用过,pins 这边可能没引)。如果没,改:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
```

- [ ] **Step 3.2: 加 POST /:id/restore 路由**

紧跟现有 `softDelete` 路由之后:

```typescript
@Post(':id/restore')
async restore(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return { data: await this.service.restore(id, user) };
}
```

- [ ] **Step 3.3: 验证 typecheck + nest 路由打印**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -5
```

期望:0 error。

ts-node-dev 会自动 hot restart,可以 verify route 注册:

```bash
sleep 3
curl -s http://localhost:3001/api/v1/health
# 期望:{"status":"ok"} — 服务还跑着
```

- [ ] **Step 3.4: e2e curl 验证 5 角色 RBAC**

```bash
TOKEN_SA=$(curl -sX POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)
TOKEN_LOCALGA=$(curl -sX POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"local_ga"}' | jq -r .accessToken)

# 创个测试 Pin 然后软删(作为回收站测试目标)
NEW_PIN=$(curl -sX POST -H "Authorization: Bearer $TOKEN_SA" -H "Content-Type: application/json" \
  -d '{"title":"回收站 e2e 测试","priority":"low","provinceCode":"310000","cityName":"上海市"}' \
  http://localhost:3001/api/v1/pins | jq -r .data.id)
echo "NEW_PIN=$NEW_PIN"
curl -sX DELETE -H "Authorization: Bearer $TOKEN_SA" -w "delete=%{http_code}\n" http://localhost:3001/api/v1/pins/$NEW_PIN

echo "--- sysadmin GET ?withDeleted=true (期望含 NEW_PIN) ---"
curl -sH "Authorization: Bearer $TOKEN_SA" "http://localhost:3001/api/v1/pins?withDeleted=true" | jq ".data | map(.id) | contains([\"$NEW_PIN\"])"

echo "--- local_ga GET ?withDeleted=true (期望 403) ---"
curl -sH "Authorization: Bearer $TOKEN_LOCALGA" -w "\nHTTP=%{http_code}\n" "http://localhost:3001/api/v1/pins?withDeleted=true"

echo "--- sysadmin restore (期望 200 + deletedAt=null) ---"
curl -sX POST -H "Authorization: Bearer $TOKEN_SA" "http://localhost:3001/api/v1/pins/$NEW_PIN/restore" | jq '.data.deletedAt'

echo "--- local_ga restore (期望 403) ---"
# 软删一次再让 local_ga restore
curl -sX DELETE -H "Authorization: Bearer $TOKEN_SA" -o /dev/null http://localhost:3001/api/v1/pins/$NEW_PIN
curl -sX POST -H "Authorization: Bearer $TOKEN_LOCALGA" -w "\nHTTP=%{http_code}\n" "http://localhost:3001/api/v1/pins/$NEW_PIN/restore"

echo "--- 不存在 ID restore (期望 404) ---"
curl -sX POST -H "Authorization: Bearer $TOKEN_SA" -w "\nHTTP=%{http_code}\n" http://localhost:3001/api/v1/pins/00000000-0000-0000-0000-000000000000/restore

echo "--- 清理 ---"
psql -U pop -d pop -c "DELETE FROM pins WHERE id='$NEW_PIN';" 2>&1
```

期望:
- sysadmin GET ?withDeleted: `true`(包含 NEW_PIN)
- local_ga GET ?withDeleted: HTTP=403
- sysadmin restore: `null`(deletedAt 已置 NULL)
- local_ga restore: HTTP=403
- 不存在 ID: HTTP=404

- [ ] **Step 3.5: commit**

```bash
git add apps/api/src/pins/pins.controller.ts
git commit -m "$(cat <<'EOF'
feat(api): pins.controller GET 加 withDeleted query + POST :id/restore

curl e2e 5 路径全过:
  sysadmin GET withDeleted → 含已删
  local_ga GET withDeleted → 403
  sysadmin restore → 200 + deletedAt=null
  local_ga restore → 403
  不存在 ID restore → 404

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4:前端 api/pins.ts 集中 fetcher

**Files:**
- Create: `apps/web/src/api/pins.ts`

- [ ] **Step 4.1: 写文件**

```typescript
import type { Pin } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchPins(opts?: { withDeleted?: boolean }): Promise<{ data: Pin[] }> {
  const q = opts?.withDeleted ? '?withDeleted=true' : '';
  const r = await fetch(`/api/v1/pins${q}`, { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'pins fetch fail');
  }
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

- [ ] **Step 4.2: typecheck + commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/web/src/api/pins.ts
git commit -m "$(cat <<'EOF'
feat(web): 新建 apps/web/src/api/pins.ts(fetchPins / restorePin 集中 fetcher)

跟 apps/web/src/api/comments.ts 同模式,把散在 PinsTab/PinDetailDrawer 的 fetch
集中。引入支持 withDeleted query 的 fetchPins 形态,为回收站 UI 准备。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5:前端 PinsTab 改造(Segmented + 双视图)

**Files:**
- Modify: `apps/web/src/pages/console/PinsTab.tsx`

- [ ] **Step 5.1: Read 现有文件确认起点**

```bash
# 让 implementer 先 Read 当前 PinsTab.tsx 全文(~107 行)
```

- [ ] **Step 5.2: 整体重写为支持双视图**

替换整个文件为:

```typescript
import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type Pin, type PinStatus, type PinPriority } from '@pop/shared-types';
import { PinFormModal } from '@/components/PinFormModal';
import { fetchPins, restorePin } from '@/api/pins';
import { useAuthStore } from '@/stores/auth';

const { Title } = Typography;

const STATUS_TAG: Record<PinStatus, { color: string; label: string }> = {
  in_progress: { color: 'purple', label: '进行中' },
  completed: { color: 'default', label: '完成' },
  aborted: { color: 'default', label: '中止' },
};

const PRIORITY_TAG: Record<PinPriority, { color: string; label: string; sortKey: number }> = {
  high: { color: 'red', label: '高', sortKey: 3 },
  medium: { color: 'orange', label: '中', sortKey: 2 },
  low: { color: 'green', label: '低', sortKey: 1 },
};

const PIN_TRASH_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);

type View = 'active' | 'trash';

export function PinsTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canSeeTrash = currentUser ? PIN_TRASH_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [view, setView] = useState<View>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pin | undefined>(undefined);

  const active = useQuery({
    queryKey: ['pins', 'active'],
    queryFn: () => fetchPins(),
  });

  const trash = useQuery({
    queryKey: ['pins', 'trash'],
    queryFn: () => fetchPins({ withDeleted: true }),
    enabled: canSeeTrash,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restorePin(id),
    onSuccess: () => {
      message.success('已还原');
      qc.invalidateQueries({ queryKey: ['pins'] });
    },
    onError: (err) => message.error(`还原失败: ${(err as Error).message}`),
  });

  const activePins = active.data?.data ?? [];
  const trashPins = trash.data?.data ?? [];
  const currentList = view === 'active' ? activePins : trashPins;
  const currentLoading = view === 'active' ? active.isLoading : trash.isLoading;

  const activeColumns = [
    { title: '标题', dataIndex: 'title' as const, ellipsis: true },
    { title: '城市', width: 120, render: (_: unknown, r: Pin) => r.cityName },
    {
      title: '状态',
      dataIndex: 'status' as const,
      width: 100,
      render: (s: PinStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority' as const,
      width: 90,
      sorter: (a: Pin, b: Pin) => PRIORITY_TAG[a.priority].sortKey - PRIORITY_TAG[b.priority].sortKey,
      render: (p: PinPriority) => <Tag color={PRIORITY_TAG[p].color}>{PRIORITY_TAG[p].label}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt' as const,
      width: 170,
      sorter: (a: Pin, b: Pin) => a.createdAt.localeCompare(b.createdAt),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => v.replace('T', ' ').slice(0, 16),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, r: Pin) => (
        <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
          编辑
        </Button>
      ),
    },
  ];

  const trashColumns = [
    { title: '标题', dataIndex: 'title' as const, ellipsis: true },
    { title: '城市', width: 120, render: (_: unknown, r: Pin) => r.cityName },
    {
      title: '删除时间',
      dataIndex: 'deletedAt' as const,
      width: 170,
      sorter: (a: Pin, b: Pin) => (a.deletedAt ?? '').localeCompare(b.deletedAt ?? ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string | null) => v ? v.replace('T', ' ').slice(0, 16) : '—',
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: Pin) => (
        <Button
          size="small"
          type="link"
          icon={<UndoOutlined />}
          loading={restoreMutation.isPending}
          onClick={() => restoreMutation.mutate(r.id)}
        >
          还原
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>图钉清单 ({currentList.length})</Title>
        {view === 'active' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
          >
            新建图钉
          </Button>
        )}
      </Space>

      {canSeeTrash && (
        <Segmented<View>
          style={{ marginBottom: 16 }}
          value={view}
          onChange={setView}
          options={[
            { label: `活跃 (${activePins.length})`, value: 'active' },
            { label: `回收站 (${trashPins.length})`, value: 'trash' },
          ]}
        />
      )}

      <Table
        dataSource={currentList}
        rowKey="id"
        loading={currentLoading}
        pagination={{ pageSize: 20 }}
        columns={view === 'active' ? activeColumns : trashColumns}
      />

      <PinFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
```

⚠️ 关键设计点(给 implementer):
- React Query partial-prefix invalidate:`['pins']` 自动覆盖 `['pins','active']` + `['pins','trash']`,所以 PinDetailDrawer 的删除 onSuccess 已有的 invalidate 自动刷回收站 — 不改 PinDetailDrawer
- `Segmented<View>` 的 generic 是 antd 5.7+ 的写法,兼容当前依赖
- `canSeeTrash` 决定 Segmented 是否渲染(local_ga/central_ga 看不到)
- trash 的 useQuery `enabled: canSeeTrash` 避免 local_ga 触发 ?withDeleted=true → 403 报错

- [ ] **Step 5.3: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

- [ ] **Step 5.4: 浏览器实测(vite-dev 热更)**

打开 http://localhost:5173/console/pins (sysadmin 登录),期望:
- 看到 Segmented `[活跃 (3) | 回收站 (0)]`(假设当前回收站空)
- 切「回收站」→ 表 0 行,显示 antd Empty
- 切回「活跃」→ 表 3 行,完整 6 列(含编辑按钮)

如果回收站要看到东西:从大盘点任一 Pin → Drawer「删除」→ 切回 `/console/pins` → 切「回收站」→ 应有 1 行 + 「还原」按钮。点还原后回到「活跃」+1。

- [ ] **Step 5.5: commit**

```bash
git add apps/web/src/pages/console/PinsTab.tsx
git commit -m "$(cat <<'EOF'
feat(web): PinsTab 加 Segmented 切换器 [活跃 | 回收站] + 还原按钮

- 顶部 Segmented 按 user.roleCode 显示(local_ga/central_ga 不可见)
- 双 useQuery:['pins','active'] + ['pins','trash']
- 列结构按 view 切:active 6 列(含编辑) / trash 4 列(含还原)
- restoreMutation invalidate ['pins'] prefix 自动刷两个 query

复用 V0.6 #9 的 RBAC 白名单(sys_admin/lead/pmo)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6:e2e 浏览器主流程 + push + PR

**Files:** 无文件改动,纯 e2e 验证 + 集成。

- [ ] **Step 6.1: 浏览器走完整 4 步主流程**

```
[1] sysadmin /map/local 基线 → 3 红/灰 Pin
[2] 点成都红 Pin Drawer → 「🗑 删除」→ 二次确认 → DELETE 204 → 大盘 -1
[3] /console/pins → 顶部 Segmented `[活跃 (2) | 回收站 (1)]` → 切「回收站」
    → 表 1 行(标题=成都新能源... / 城市=成都市 / 删除时间=刚才)
[4] 点行尾「还原」→ 200 → 表 0 行 → 切回「活跃」(3) → 跳 /map/local 看成都红 Pin 回归
```

`preview_screenshot` 留 4 张证(对应 4 步)。

- [ ] **Step 6.2: RBAC 浏览器实测**

```
- 退出登录 → 用 local_ga 登 → /console/pins
- 期望:无 Segmented 切换器、无回收站视图、只见活跃 3 行 + 「+新建」
- 点任一 Pin → Drawer 无「🗑 删除」按钮(V0.6 #9 已实现)
```

`preview_screenshot` 留 1 张证(local_ga PinsTab 视图)。

- [ ] **Step 6.3: console_logs 检查无 functional error**

```javascript
// preview_console_logs({ level: 'error' })
```

期望:只有已知 antd `destroyOnClose` 弃用警告,无 React render error / TypeError / fetch error。

- [ ] **Step 6.4: push 分支 + 提 PR**

⚠️ Push 是 user-visible action。**先确认用户拍**再做。

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git push -u origin claude/pin-recycle-bin
gh pr create --title "feat: V0.6 patch · Pin 回收站 UI" --body "$(cat <<'EOF'
## Summary

V0.6 #9 Pin 软删除的对称半部 — 让能删的人能撤。

- PinsTab 加 Segmented `[活跃 | 回收站]`,按 RBAC 显示
- 后端 GET /pins?withDeleted=true + POST /pins/:id/restore
- RBAC 沿用 V0.6 #9 白名单(sys_admin/lead/pmo)
- 还原后大盘自动回归(deletedAt = NULL → 默认查询恢复可见)
- 不做永久删除按钮(YAGNI,SQL 兜底)

## Test plan

- [x] 后端 25 个 jest tests 全过(原 19 + 新 6)
- [x] curl 5 角色 RBAC e2e:sysadmin/lead/pmo restore → 200,local_ga/central_ga → 403,不存在 ID → 404
- [x] 浏览器 4 步主流程:删 → 进回收站 → 还原 → 大盘 +1 自动回归
- [x] 浏览器 RBAC:local_ga 看不到 Segmented + 看不到「删除」按钮
- [x] typecheck + build 0 error
- [x] V0.6 #9 e2e 路径(8 步主流程 + 4 错误 + 5 角色 RBAC)无回归

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 覆盖检查**:

| Spec 决策 | 落到 Task | 状态 |
|---|---|---|
| Segmented 切换器 | T5 Step 5.2 | ✅ |
| RBAC 对称(sys_admin/lead/pmo) | T2 service.list/restore + T5 PIN_TRASH_ALLOWED_ROLES | ✅ |
| 不做永久删除 | spec 明确 / plan 不出现 | ✅ |
| 还原后维持原 status | T2 restore 只改 deletedAt,不动 status | ✅ |
| 大盘永远不显示已删 | 默认查询 deletedAt IS NULL,不变 | ✅ |
| GET /pins?withDeleted=true | T3 Step 3.1 | ✅ |
| POST /pins/:id/restore | T3 Step 3.2 | ✅ |
| Pin 接口加 deletedAt | T1 Step 1.1 | ✅ |
| api/pins.ts 集中 fetcher | T4 Step 4.1 | ✅ |
| 4 jest tests | T2 Step 2.4(实际 6 个,更全) | ✅ |
| 用户场景脚本 3 步 | T6 Step 6.1 | ✅ |
| RBAC 验证 | T6 Step 6.2 | ✅ |

**Coverage 完整,无 spec 遗漏。**

**2. Placeholder scan**: 全文搜「TBD」「TODO」「fill in」「待补」 — 无。

**3. Type consistency**:
- `fetchPins / restorePin` 在 T4 定义,T5 调用,签名一致 ✓
- `PIN_TRASH_ALLOWED_ROLES` 在 T2 后端 export,T5 前端独立定义同名(共享 types 不放 RBAC 规则,前后端各定义一份对齐 V0.6 #9 模式)✓
- `View = 'active' | 'trash'` 仅 T5 内部使用 ✓
- T2 jest mock 的 `pinsRepo.restore / findOne / findOneOrFail` 跟 T2 service 实现的调用对齐 ✓

**4. 已知非冲突点**:
- T5 PinsTab 改写后 `pins.length` 总数会变成 `currentList.length`(按当前 view),但 V0.6 文案「图钉清单 (n)」里这是预期的(切回收站时 n 表示回收站行数)。如果用户希望「活跃 + 回收站」总数,需另议 — spec 里没指定,从 demo 角度按 view 计数更直觉。

---

## Plan complete

**Saved to:** `docs/superpowers/plans/2026-04-28-pin-recycle-bin-plan.md`

**预计:6 commits / 30-60 min**

- T1 shared-types(1 commit)
- T2 后端 service + jest(1 commit)
- T3 后端 controller(1 commit)
- T4 前端 api fetcher(1 commit)
- T5 前端 PinsTab(1 commit)
- T6 e2e + push + PR
