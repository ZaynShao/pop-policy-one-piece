# G6 · F 个人工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把个人工作台 (`/me`) 从只有"基本资料 + 2 个 stub tab"扩展到 PRD §3.7 F1-F4 的真用户日常入口:F1 当日动作 / F2 我的条目 / F4 我的消费记录。

**Architecture:** **纯前端**。不动后端,不加新 API endpoint。复用现有 `GET /api/v1/visits` 和 `GET /api/v1/pins`,在 React 组件里用 `visitorId / createdBy === currentUser.id` + `createdAt >= 今日 0:00` 做客户端过滤。F4 (我的消费记录) 是 stub,等 G1 工具池上线后再 wire up。

**Tech Stack:** React 18 + TypeScript + antd 5 + @tanstack/react-query + dayjs + zustand。无 web 端单元测试框架(项目惯例),验证靠 `npm run typecheck` + Claude Preview 工具的手动 smoke。

**Spec:** `docs/superpowers/specs/2026-05-07-gap-sequencing-design.md` (G6 行)
**PRD:** `docs/PRD-user-led.md` §3.7 (F1/F2/F4 定义) + §1.3 (属地 GA 是真用户)

---

## File Structure

| 路径 | 操作 | 职责 |
|---|---|---|
| `apps/web/src/api/me.ts` | **新建** | 客户端聚合 helper:`fetchMyTodayItems()` / `fetchMyAllItems()`,内部调 `fetchVisits` + `fetchPins` 后过滤 |
| `apps/web/src/components/me/TodayPanel.tsx` | **新建** | F1 当日动作面板(今日新建 visit/pin + 工具消费 stub 区块) |
| `apps/web/src/components/me/MyItemsPanel.tsx` | **新建** | F2 我的条目面板(自建 visit + pin,按 status 分组) |
| `apps/web/src/components/me/MyConsumptionsPanel.tsx` | **新建** | F4 我的消费记录(纯 stub,empty state 指向 G1) |
| `apps/web/src/pages/Me.tsx` | **修改** | 用 4 tabs(基本资料 / 当日动作 / 我的条目 / 我的消费记录)替换现有 3 tabs(基本资料 / 通知设置 / 最近活动) |

---

## Task 1: 客户端聚合 helper

**Files:**
- Create: `apps/web/src/api/me.ts`

- [ ] **Step 1.1: 创建 helper 文件**

写入 `apps/web/src/api/me.ts`:

```ts
import type { Visit, Pin } from '@pop/shared-types';
import dayjs from 'dayjs';
import { fetchVisits } from './visits';
import { fetchPins } from './pins';

/**
 * F1 当日动作 / F2 我的条目 共用的客户端聚合层。
 *
 * 注:V0 阶段直接拉全集后客户端过滤;visits / pins 总量小(<100 条),
 * 性能可接受。规模扩大(>1000 条)后再加后端 /me 聚合 endpoint。
 */

export interface MyItems {
  visits: Visit[];
  pins: Pin[];
}

export async function fetchMyAllItems(currentUserId: string): Promise<MyItems> {
  const [v, p] = await Promise.all([fetchVisits(), fetchPins()]);
  return {
    visits: v.data.filter((x) => x.visitorId === currentUserId),
    pins: p.data.filter((x) => x.createdBy === currentUserId),
  };
}

export async function fetchMyTodayItems(currentUserId: string): Promise<MyItems> {
  const all = await fetchMyAllItems(currentUserId);
  const start = dayjs().startOf('day');
  return {
    visits: all.visits.filter((x) => dayjs(x.createdAt).isAfter(start)),
    pins: all.pins.filter((x) => dayjs(x.createdAt).isAfter(start)),
  };
}
```

- [ ] **Step 1.2: typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: PASS, 0 errors.

- [ ] **Step 1.3: commit**

```bash
git add apps/web/src/api/me.ts
git commit -m "feat(me): client-side aggregator for F1/F2 (G6)"
```

---

## Task 2: F1 TodayPanel

**Files:**
- Create: `apps/web/src/components/me/TodayPanel.tsx`

- [ ] **Step 2.1: 写 TodayPanel**

写入 `apps/web/src/components/me/TodayPanel.tsx`:

```tsx
import { Card, Empty, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, Pin } from '@pop/shared-types';
import { fetchMyTodayItems } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

const VISIT_STATUS_TAG: Record<Visit['status'], { color: string; label: string }> = {
  planned: { color: 'blue', label: '计划' },
  completed: { color: 'green', label: '已拜访' },
  cancelled: { color: 'default', label: '已取消' },
};

const PIN_STATUS_TAG: Record<Pin['status'], { color: string; label: string }> = {
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已完成' },
  aborted: { color: 'default', label: '已终止' },
};

export function TodayPanel() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'today', user?.id],
    queryFn: () => fetchMyTodayItems(user!.id),
    enabled: !!user,
  });

  const visits = data?.visits ?? [];
  const pins = data?.pins ?? [];
  const total = visits.length + pins.length;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          今天 ({dayjs().format('YYYY-MM-DD')})
        </Title>
        <Text type="secondary">你今天新建了 {total} 条条目。</Text>
      </div>

      <Card size="small" title={`今日新建拜访/计划 (${visits.length})`}>
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : visits.length === 0 ? (
          <Empty
            description="今天还没新建拜访或计划"
            imageStyle={{ height: 40 }}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <List
            dataSource={visits}
            size="small"
            renderItem={(v) => {
              const tag = VISIT_STATUS_TAG[v.status];
              return (
                <List.Item>
                  <Space>
                    <Tag color={tag.color}>{tag.label}</Tag>
                    <Text>{v.title ?? v.contactPerson ?? '—'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(v.createdAt).format('HH:mm')}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Card size="small" title={`今日新建图钉 (${pins.length})`}>
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : pins.length === 0 ? (
          <Empty
            description="今天还没新建图钉"
            imageStyle={{ height: 40 }}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <List
            dataSource={pins}
            size="small"
            renderItem={(p) => {
              const tag = PIN_STATUS_TAG[p.status];
              return (
                <List.Item>
                  <Space>
                    <Tag color={tag.color}>{tag.label}</Tag>
                    <Text>{p.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(p.createdAt).format('HH:mm')}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Card size="small" title="今日下载/调用工具 (G1 工具池上线后填充)">
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          属地 GA 在拜访点详情页下载成品文档 / 调用接口的留痕。
          <br />
          依赖 G1 D 模块,目前 G1 未上线。
        </Paragraph>
      </Card>
    </Space>
  );
}
```

- [ ] **Step 2.2: typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: PASS, 0 errors. 如果报 `Pin.title` 或 `Visit.contactPerson` 不存在,把对应字段名核对 `packages/shared-types/src/dtos/{pin,visit}.dto.ts` 后修正。

- [ ] **Step 2.3: commit**

```bash
git add apps/web/src/components/me/TodayPanel.tsx
git commit -m "feat(me): F1 TodayPanel — 当日新建条目 (G6)"
```

---

## Task 3: F2 MyItemsPanel

**Files:**
- Create: `apps/web/src/components/me/MyItemsPanel.tsx`

- [ ] **Step 3.1: 写 MyItemsPanel**

写入 `apps/web/src/components/me/MyItemsPanel.tsx`:

```tsx
import { useState } from 'react';
import { Card, Empty, List, Segmented, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, Pin } from '@pop/shared-types';
import { fetchMyAllItems } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

type Tab = 'visits' | 'pins';

const VISIT_STATUS_TAG: Record<Visit['status'], { color: string; label: string }> = {
  planned: { color: 'blue', label: '计划' },
  completed: { color: 'green', label: '已拜访' },
  cancelled: { color: 'default', label: '已取消' },
};

const PIN_STATUS_TAG: Record<Pin['status'], { color: string; label: string }> = {
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已完成' },
  aborted: { color: 'default', label: '已终止' },
};

function groupBy<T, K extends string>(arr: T[], key: (x: T) => K): Record<K, T[]> {
  return arr.reduce(
    (acc, x) => {
      const k = key(x);
      (acc[k] ??= []).push(x);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function MyItemsPanel() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('visits');

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'all', user?.id],
    queryFn: () => fetchMyAllItems(user!.id),
    enabled: !!user,
  });

  const visits = data?.visits ?? [];
  const pins = data?.pins ?? [];

  const visitGroups = groupBy(visits, (v) => v.status);
  const pinGroups = groupBy(pins, (p) => p.status);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          我的条目
        </Title>
        <Text type="secondary">
          自建拜访 {visits.length} 条 · 自建图钉 {pins.length} 条
        </Text>
      </div>

      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { label: `拜访/计划 (${visits.length})`, value: 'visits' },
          { label: `图钉 (${pins.length})`, value: 'pins' },
        ]}
      />

      {isLoading ? (
        <Card size="small">
          <Text type="secondary">加载中…</Text>
        </Card>
      ) : tab === 'visits' ? (
        visits.length === 0 ? (
          <Card size="small">
            <Empty description="还没自建拜访或计划" />
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {(['planned', 'completed', 'cancelled'] as const).map((s) => {
              const list = visitGroups[s] ?? [];
              if (list.length === 0) return null;
              const tag = VISIT_STATUS_TAG[s];
              return (
                <Card size="small" key={s} title={`${tag.label} (${list.length})`}>
                  <List
                    dataSource={list}
                    size="small"
                    renderItem={(v) => (
                      <List.Item>
                        <Space>
                          <Tag color={tag.color}>{tag.label}</Tag>
                          <Text>{v.title ?? v.contactPerson ?? '—'}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(v.createdAt).format('YYYY-MM-DD')}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              );
            })}
          </Space>
        )
      ) : pins.length === 0 ? (
        <Card size="small">
          <Empty description="还没自建图钉" />
        </Card>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {(['in_progress', 'completed', 'aborted'] as const).map((s) => {
            const list = pinGroups[s] ?? [];
            if (list.length === 0) return null;
            const tag = PIN_STATUS_TAG[s];
            return (
              <Card size="small" key={s} title={`${tag.label} (${list.length})`}>
                <List
                  dataSource={list}
                  size="small"
                  renderItem={(p) => (
                    <List.Item>
                      <Space>
                        <Tag color={tag.color}>{tag.label}</Tag>
                        <Text>{p.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(p.createdAt).format('YYYY-MM-DD')}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            );
          })}
        </Space>
      )}
    </Space>
  );
}
```

- [ ] **Step 3.2: typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: PASS, 0 errors.

- [ ] **Step 3.3: commit**

```bash
git add apps/web/src/components/me/MyItemsPanel.tsx
git commit -m "feat(me): F2 MyItemsPanel — 我的条目分组列表 (G6)"
```

---

## Task 4: F4 MyConsumptionsPanel (stub)

**Files:**
- Create: `apps/web/src/components/me/MyConsumptionsPanel.tsx`

- [ ] **Step 4.1: 写 stub 面板**

写入 `apps/web/src/components/me/MyConsumptionsPanel.tsx`:

```tsx
import { Card, Empty, Space, Typography } from 'antd';
import { palette } from '@/tokens';

const { Title, Paragraph } = Typography;

/**
 * F4 我的消费记录 — G6 阶段 stub。
 *
 * 真实数据依赖 G1 工具池(D 模块)落地后产生的 ToolConsumption 表。
 * G1 上线后:替换为 useQuery 拉 /api/v1/me/consumptions,展示下载/调用记录。
 */
export function MyConsumptionsPanel() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>
          我的消费记录
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          属地 GA 视角:你下载过的成品文档 + 调用过的接口留痕。
        </Paragraph>
      </div>

      <Card size="small">
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <span>暂无消费记录</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                工具池(G1 D 模块)上线后,你下载/调用的工具会在这里留痕。
              </span>
            </Space>
          }
        />
      </Card>
    </Space>
  );
}
```

- [ ] **Step 4.2: typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: PASS, 0 errors.

- [ ] **Step 4.3: commit**

```bash
git add apps/web/src/components/me/MyConsumptionsPanel.tsx
git commit -m "feat(me): F4 MyConsumptionsPanel stub — 等 G1 工具池 (G6)"
```

---

## Task 5: 重构 Me.tsx 接入 3 个新面板

**Files:**
- Modify: `apps/web/src/pages/Me.tsx`

当前状态(参考):4 个 import + `Tabs.items` 三项(profile / notifications / activity)。改造目标:保留 profile,**删除 notifications + activity 两个 stub tab**,加入 today / items / consumptions 三个新 tab。

- [ ] **Step 5.1: 重写 Me.tsx**

完整覆盖 `apps/web/src/pages/Me.tsx`:

```tsx
import { Card, Descriptions, Tabs, Typography } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';
import { TodayPanel } from '@/components/me/TodayPanel';
import { MyItemsPanel } from '@/components/me/MyItemsPanel';
import { MyConsumptionsPanel } from '@/components/me/MyConsumptionsPanel';

const { Title, Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: 'GA 负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

/**
 * 个人工作台 — G6 落地后 4 tab:
 *   today      F1 当日动作
 *   items      F2 我的条目
 *   consumptions F4 我的消费记录(stub,等 G1)
 *   profile    F6 基本资料(原有)
 *
 * F3 我的产出(中台 GA 专用)目前不做(中台 GA 角色虚位,见 spec 2026-05-07)。
 * F5 待办事项 P1,不做。
 */
export function Me() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Card className="glass-panel">
        <Title level={2} style={{ color: palette.primary, marginTop: 0 }}>
          个人工作台
        </Title>
        <Tabs
          defaultActiveKey="today"
          items={[
            {
              key: 'today',
              label: '当日动作',
              children: <TodayPanel />,
            },
            {
              key: 'items',
              label: '我的条目',
              children: <MyItemsPanel />,
            },
            {
              key: 'consumptions',
              label: '我的消费记录',
              children: <MyConsumptionsPanel />,
            },
            {
              key: 'profile',
              label: '基本资料',
              children: (
                <Descriptions column={1}>
                  <Descriptions.Item label="显示名">
                    <Text strong>{user.displayName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="角色">
                    {ROLE_LABEL[user.roleCode] ?? user.roleCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
                </Descriptions>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
```

注意改动:
- 标题"个人中心" → "个人工作台" (跟 PRD §3.7 F 模块名对齐)
- 默认 tab `profile` → `today` (F1 是个人首屏,PRD §3.7 F1 备注)
- 删除 notifications 和 activity 两个 stub tab
- 新增 today / items / consumptions

- [ ] **Step 5.2: typecheck + 全 web 构建检查**

```bash
cd apps/web && npm run typecheck && npm run build
```

Expected: typecheck PASS,build 成功。

- [ ] **Step 5.3: commit**

```bash
git add apps/web/src/pages/Me.tsx
git commit -m "feat(me): integrate F1/F2/F4 panels into Me.tsx (G6)"
```

---

## Task 6: 手动 smoke test (Claude Preview)

**Goal:** 验证 4 个 tab 都能渲染,且 F1/F2 能拉到当前用户的真实 visit/pin 数据。

- [ ] **Step 6.1: 启动 dev server**

```bash
preview_start (let preview tools auto-pick the dev script)
```

如果 preview tools 不自动识别,手动指定:从 monorepo root 跑 `npm run dev --workspace=@pop/web` (或者 `cd apps/web && npm run dev`)。注意 prod API 在 xiaojuenergy.com,本地 dev 通过 Vite proxy 接 prod 或本地 api。

- [ ] **Step 6.2: 登录 + 跳转 /me**

用 sys_admin 或 local_ga 测试账号登录(seed 里有,具体凭证看 `apps/api/src/seeds/`)。登录后:
- 点右上角头像 → "个人中心" → 进入 `/me`
- 默认应停在"当日动作" tab

- [ ] **Step 6.3: 检查 4 个 tab**

| Tab | 期望 |
|---|---|
| 当日动作 | 标题"今天 (YYYY-MM-DD)";如果今天没新建,看到 2 张空 Empty 卡 + 工具 stub 卡;如果今天创建过 visit/pin,看到对应列表 |
| 我的条目 | 顶部 Segmented 切换"拜访/计划 (N)" ↔ "图钉 (N)";按 status 分组卡片显示 |
| 我的消费记录 | 1 张 Empty 卡,描述"工具池(G1 D 模块)上线后..." |
| 基本资料 | 显示名 / 角色 / 邮箱(原 F6 内容) |

- [ ] **Step 6.4: console + network 检查**

- 用 preview_console_logs 看是否有 React warning / 404 / unauthorized
- 用 preview_network 确认 `/api/v1/visits` 和 `/api/v1/pins` 200 返回

- [ ] **Step 6.5: 截图存档**

用 preview_screenshot 截一张"当日动作" tab 截图保存,后面给用户看效果。

---

## Task 7: PR

- [ ] **Step 7.1: push 分支**

```bash
git push -u origin claude/zen-allen-800189
```

- [ ] **Step 7.2: 开 PR**

```bash
gh pr create --title "feat(me): G6 个人工作台 F1/F2/F4 (closes spec 2026-05-07)" --body "$(cat <<'EOF'
## Summary
- 实现 F1 当日动作:今日新建 visit/pin 留痕,工具消费 stub 待 G1
- 实现 F2 我的条目:自建 visit/pin 按 status 分组
- 实现 F4 我的消费记录:stub,等 G1 工具池
- Me.tsx 默认 tab `profile` → `today`,标题改"个人工作台"
- 纯前端,无后端改动,client-side filter

## Test plan
- [x] typecheck pass
- [x] build pass
- [ ] 登录 sys_admin / local_ga 后访问 `/me`,4 个 tab 切换正常
- [ ] 今天创建一条 visit,刷新看 F1 是否显示

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

注意:gh CLI 在本地 Mac 经常 TLS handshake failure(`HANDOFF-gap-2026-05-06.md` §5.2),如果失败用绕过命令:
```bash
env -u HTTPS_PROXY -u https_proxy gh pr create --title "..." --body "..."
```

---

## Out of scope (明确不做)

- ❌ F3 我的产出(中台 GA 专用)— 中台 GA 角色虚位,等 G1 反推后再决定
- ❌ F5 待办事项(图钉/留言)— P1
- ❌ 后端 `/api/v1/me/*` 聚合 endpoint — 先客户端过滤,规模上来再加
- ❌ 移动端版个人工作台 — PRD 没要求,Me.tsx 只在 web 端用
- ❌ F1 工具消费区块的真实数据 — 等 G1 D 模块上线
- ❌ web 端单元测试框架(vitest)搭建 — 项目惯例无,本 plan 不引入

---

## 验证清单(完成时勾)

- [ ] 5 个文件落地(api/me.ts + 3 components + Me.tsx)
- [ ] `npm run typecheck` PASS
- [ ] `npm run build` PASS
- [ ] /me 4 个 tab 都能渲染
- [ ] F1 今日 visit/pin 正确过滤
- [ ] F2 visit/pin 按 status 分组正确
- [ ] F4 stub empty state 文案正确
- [ ] PR 已开
