# K 模块 · 政企机构联系人 (GovOrg + GovContact) 设计

> **状态**:brainstorm 已收口,待 writing-plans 拆任务清单
> **背景**:V0.7 + R2.6 + R2.7 上线后,visits 表的 `department / contactPerson / contactTitle` 是纯 free text — 无法做「成都发改委下属哪些联系人」「张处长上次拜访是什么时候」等聚合分析。K 模块把这块做成可复用的政企机构 + 联系人独立实体。

---

## Context · 为什么做这个

R2.7 上线了语音录入,演示时一口气录 5 条「我去长沙发改委找张处长」,DB 里出来 5 条 visits,每条都有「张处长」+「长沙发改委」的 free text — 但这些 text **没有结构化关联**:工作台看不到「长沙发改委下我们对接过哪些人」「张处长身上有几次拜访」。

K 模块把机构 / 联系人独立成实体,visits 引用它们,补上这层关系。**演示价值**:工作台「机构」/「联系人」tab 能切出政企关系网络,demo 时讲「这是我们和成都市发改委 / 长沙发改委的全部对接历史」会很有说服力。

---

## 核心决策(brainstorm 已逐项拍)

**范围**

1. **范围 A**:GovOrg + GovContact 双表 CRUD + Visit 加 `orgId` / `contactId` 引用。**不做** ContactLog(每次接触打卡)/ tier 自动分层 / 活跃度评分(全部 V0.8+ 推迟)
2. **Visit 字段策略(双轨)**:加 `orgId` / `contactId` 可空字段,**保留** 现有 `department / contactPerson / contactTitle` free text 兜底。Form 上同时显示下拉 + free text,**填了下拉就忽略 free text**(后端逻辑保证)

**Seed 数据**

3. **GovOrg seed 路径 A 地市级 ~676 条**(详见 §4):
   - 国务院 25 部委
   - 31 省级单位 × 7 个核心口(发改/工信/科技/财政/人社/商务/市场监管)
   - 13 独立城市 × 7 口(成都/深圳/长沙/东莞/杭州/郑州/佛山/苏州/武汉/南京/沈阳/青岛/广州)
   - 4 全省覆盖到地级市 × 7 口(湖南 14 / 陕西 10 / 广东 21 / 海南 4)
   - **区/县/县级市靠用户录入时自然积累**

**用户流**

4. **现场新增机构**:VisitFormModal 找不到机构时点「+ 新建机构」开 Modal 现场建,工作台 OrgsTab 同时也有列表 + 编辑能力
5. **GovContact 自动 upsert**:**不预建**。Visit 提交时按 `(name + orgId)` 查重,已有复用 `contactId`,新人 INSERT。**无 orgId 不 upsert**(避免同名混淆)
6. **语音录入兼容**:R2.7 流程不变,后端 LLM 输出 `department` text 后加 fuzzy match GovOrg(全称/简称/包含关系),匹配上填 `orgId`,**匹配不上保留 free text** 等用户回桌面端补关联

---

## §1 数据模型

```sql
-- gov_orgs
CREATE TABLE gov_orgs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(80) NOT NULL,
  short_name      varchar(30),
  province_code   varchar(6) NOT NULL,
  city_name       varchar(50) NOT NULL,
  district_name   varchar(50),                            -- 可空,seed 不到区县
  level           gov_org_level NOT NULL,                 -- enum: national | provincial | municipal | district
  parent_org_id   uuid NULL REFERENCES gov_orgs(id) ON DELETE SET NULL,
  function_tags   text[] DEFAULT '{}',
  address         varchar(200),
  created_by      uuid NULL REFERENCES users(id),         -- NULL 表示系统 seed
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL,
  UNIQUE (province_code, city_name, name) WHERE deleted_at IS NULL
);
CREATE INDEX idx_gov_orgs_province_city ON gov_orgs(province_code, city_name);
CREATE INDEX idx_gov_orgs_short_name ON gov_orgs(short_name);

-- gov_contacts
CREATE TABLE gov_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                varchar(50) NOT NULL,
  gender              varchar(10),
  org_id              uuid NOT NULL REFERENCES gov_orgs(id),
  title               varchar(50) NOT NULL,
  tier                contact_tier NOT NULL DEFAULT 'normal',  -- enum: core | important | normal
  phone               varchar(30),
  wechat              varchar(50),
  preference_notes    text,
  owner_user_id       uuid NOT NULL REFERENCES users(id),
  last_engaged_at     timestamptz,
  created_by          uuid NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL,
  UNIQUE (org_id, name) WHERE deleted_at IS NULL
);
CREATE INDEX idx_gov_contacts_org ON gov_contacts(org_id);
CREATE INDEX idx_gov_contacts_owner ON gov_contacts(owner_user_id);

-- visits 加 2 列
ALTER TABLE visits
  ADD COLUMN org_id     uuid NULL REFERENCES gov_orgs(id) ON DELETE SET NULL,
  ADD COLUMN contact_id uuid NULL REFERENCES gov_contacts(id) ON DELETE SET NULL;
CREATE INDEX idx_visits_org ON visits(org_id);
CREATE INDEX idx_visits_contact ON visits(contact_id);
```

**ON DELETE 策略**

- `gov_orgs` 软删(写 `deleted_at`),硬删不暴露
- `gov_contacts.org_id` 用硬 FK(机构必须存在);软删机构后,联系人不级联,工作台显灰
- `visits.org_id / contact_id` ON DELETE SET NULL — 兜底防硬删

---

## §2 API 端点设计

### 2.1 GovOrg CRUD(`/api/v1/gov-orgs`)

| Method | Path | 用途 | 备注 |
|---|---|---|---|
| GET | `/gov-orgs` | 列表 + 筛选 | query: `provinceCode` / `cityName` / `level` / `search`(name+shortName 模糊)/ `limit`(默认 50) |
| GET | `/gov-orgs/:id` | 详情 | 含 `parent` 展开 |
| POST | `/gov-orgs` | 新建 | VisitFormModal「+新建机构」+ OrgsTab 共用 |
| PATCH | `/gov-orgs/:id` | 编辑 | sys_admin 可改全部;普通 user 只能改自己 createdBy 的 |
| DELETE | `/gov-orgs/:id` | 软删 | 写 `deletedAt`;visits 不级联,等 V0.8 收尾 |

**校验**:`UNIQUE(provinceCode, cityName, name)` 冲突 → 409;`name` maxLength 80;`shortName` maxLength 30;`level` 必填。

### 2.2 GovContact CRUD(`/api/v1/gov-contacts`)

| Method | Path | 用途 | 备注 |
|---|---|---|---|
| GET | `/gov-contacts` | 列表 + 筛选 | query: `orgId` / `search`(name)/ `ownerUserId` / `tier` |
| GET | `/gov-contacts/:id` | 详情 | 含 `org` 展开 |
| POST | `/gov-contacts` | 手动新建 | 工作台 ContactsTab 用;Visit 提交走 auto-upsert(2.3) |
| PATCH | `/gov-contacts/:id` | 编辑 | 改 tier / phone / wechat / preferenceNotes |
| DELETE | `/gov-contacts/:id` | 软删 | 写 `deletedAt` |

**校验**:`UNIQUE(orgId, name)` 冲突 → 409;`orgId` 必填(强制挂机构,避免散点)。

### 2.3 Visit 端点改动(`/api/v1/visits`)

**DTO 加字段**:`orgId?: uuid` `contactId?: uuid`(都可空,沿用 free text 兜底)

**后端 auto-upsert GovContact 逻辑**(POST + PATCH 同):

```
if dto.contactId 给:用现成,跳过
elif dto.contactPerson 给 AND dto.orgId 给:
    existing = findOne({ orgId, name: dto.contactPerson, deletedAt: null })
    if existing: dto.contactId = existing.id
    else: 新建 GovContact{ orgId, name, title=dto.contactTitle||'未填',
                          ownerUserId=req.user.id, createdBy=req.user.id }
                  → dto.contactId = newOne.id
else:
    skip(只存 contactPerson free text;无 orgId 不 upsert)
```

**关键**:upsert 在 visits.service `create` / `update` 里一处实现,事务内,失败回滚。

### 2.4 语音端点改动(`/api/v1/voice/parse-visit`)

**流程不变**(webm → ffmpeg → Aliyun NLS → MiniMax),**LLM 输出后加 fuzzy match**:

```
LLM 返回 { department, contactPerson, ... }
↓
if department AND (provinceCode || ctx.currentProvinceCode):
    candidates = GovOrg.find({ provinceCode, cityName(若有), deletedAt: null })
    match = 优先级匹配:
      1. name === department(全等)
      2. shortName === department
      3. name LIKE %department% AND 候选只有 1 条
    if match: response.parsed.orgId = match.id
    else: orgId = null(保留 free text department)
↓
返回 { transcript, parsed: { ..., orgId, contactId: null } }
```

**关键**:`contactId` **永远不在语音阶段填**,等用户提交 Visit 时后端 auto-upsert(2.3)。

### 2.5 鉴权

- 所有 GovOrg / GovContact endpoint 要登录
- sys_admin 可改全部;普通 user 只能改自己 `createdBy` 的(seed 数据 createdBy=NULL,只 sys_admin 能改)
- 软删只 sys_admin
- Voice fuzzy match 在已登录路径,无新鉴权

---

## §3 前端 UI 改动

### 3.1 工作台新增 2 个 tab

**OrgsTab**(`/console/orgs`)

| 列 | 说明 |
|---|---|
| name + shortName | 主显 |
| level badge | 国务/省/市/区 4 色 |
| provinceCode + cityName | 「广东省 / 深圳市」 |
| 联系人数 | count(gov_contacts WHERE orgId=...) |
| 拜访次数 | count(visits WHERE orgId=...) |
| 操作 | 编辑 / 软删 |

- 表头筛选:省 / 市 / level Select / search(name+shortName)
- 右上角 +新建机构

**ContactsTab**(`/console/contacts`)

| 列 | 说明 |
|---|---|
| name + gender icon | 主显 |
| 所属机构 | 跳 OrgsTab 详情 |
| title | 职务 |
| tier badge | core/important/normal 3 色 |
| 拜访次数 | count(visits WHERE contactId=...) |
| 操作 | 编辑 / 软删 |

- 表头筛选:机构(自动补全)/ tier / search / 我负责的(ownerUserId=me)
- 右上角 +新建联系人

### 3.2 共享 Modal

**GovOrgFormModal**(OrgsTab 新建/编辑 + VisitFormModal 现场新增 共用)
- 字段:`name*` / `shortName` / `provinceCode*`(Select)/ `cityName*` / `districtName` / `level*` / `parentOrgId`(Select 可空)/ `functionTags`(multi)/ `address`
- props 加 `onCreated?: (org) => void` — 现场新增时回填到 VisitFormModal

**GovContactFormModal**(ContactsTab 新建/编辑)
- 字段:`name*` / `gender` / `orgId*`(Select)/ `title*` / `tier`(默认 normal)/ `phone` / `wechat` / `preferenceNotes`(textarea)/ `ownerUserId`(默认当前 user)

### 3.3 VisitFormModal 双轨改造(改动最大)

```
┌─────────────────────────────────┐
│ 机构 (GovOrg)                    │
│ [AutoComplete: 输入搜全国 ▾]     │
│ [+ 新建机构]                      │
│ ☐ 我要纯手动填(找不到/不录入)   │
│   └─ 展开后:[free text 部门名]  │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 联系人                            │
│ [AutoComplete: 按上面 orgId 过滤] │
│ ┌─ 找不到时输入新名字 ─┐         │
│ │ 姓名:[ ] 职务:[ ]   │         │
│ └─────────────────────┘         │
└─────────────────────────────────┘
```

**前端规则**(后端 2.3 防御):
- 选了 GovOrg AutoComplete 项 → 提交带 `orgId`,**free text department 留空**
- 没选只填 free text → 提交 `orgId=null` + `department=text`
- 联系人同理:选了带 `contactId`,没选传 `contactPerson + contactTitle` 后端 upsert

### 3.4 语音返填的视觉反馈(`MobileVisitNewPage.tsx`)

- `parsed.orgId !== null`:AutoComplete 自动选中,字段右侧显蓝色 `🤖 AI 已匹配机构` chip
- `parsed.orgId === null` 但 `parsed.department !== null`:free text 字段填 department + 黄色横幅文案「**⚠ 已识别"XX",但未匹配到机构库,请手动选择或新建**」+ 「☐ 我要纯手动填」自动勾上

### 3.5 详情 Drawer

- OrgsTab 点行 → `GovOrgDetailDrawer`:基本信息 / 编辑 / 「该机构联系人」列表 / 「历史拜访」列表
- ContactsTab 点行 → `GovContactDetailDrawer`:基本信息 / 编辑 / 「拜访该人的历史」列表

### 3.6 端到端 demo 路径

```
[1] 工作台「机构」tab → 676+ 条 seed → 筛"湖南/长沙" → 看到长沙发改委
[2] +新建拜访 → 「机构」搜"长沙发" → 选中 → 省市自动填
[3] 「联系人」按 orgId 过滤搜"张" → 历史的张处长浮出 → 选中
[4] 提交 → visits 行 orgId+contactId 都齐
[5] 移动端语音 → "今天去长沙发改委张处长" → orgId 自动匹配蓝标 + 张处长 free text → 提交时后端 upsert 出新 contact
```

### 3.7 不动的部分

- 大盘 MapCanvas / Pin Drawer / Comment 留言板 — 全不动
- VisitFormModal 其他字段(visitDate/color/outcomeSummary/followUp)— 不动
- 移动端语音录制 + LLM 流程 — 不动,只加返填逻辑

---

## §4 GovOrg seed 生成方案

### 4.1 总量

| 来源 | 计算 | 条数 |
|---|---|---|
| 国务院部委 | 25 | 25 |
| 省级 7 口 × 31 省级单位 | 31 × 7 | 217 |
| 13 独立城市 × 7 口 | 13 × 7 | 91 |
| 湖南全省 14 地级市 × 7 口 | 14 × 7 | 98 |
| 陕西全省 10 地级市 × 7 口 | 10 × 7 | 70 |
| 广东全省 21 地级市 × 7 口 | 21 × 7 | 147 |
| 海南全省 4 地级市 × 7 口 | 4 × 7 | 28 |
| **合计** | | **676** |

> **31 省级单位** = 23 省 + 5 自治区 + 4 直辖市 − 1(去台湾省;港澳特区不录政府机构)

### 4.2 数据源(`apps/api/src/seeds/data/gov-org-source.ts`)

```ts
export const STATE_COUNCIL_DEPTS = [
  { name: '国家发展和改革委员会', shortName: '国家发改委', tags: ['产业','审批'] },
  { name: '工业和信息化部',       shortName: '工信部',     tags: ['工业','数字化'] },
  // ... 共 25 条
];

export const PROVINCIAL_DEPT_TEMPLATE = [
  { suffix: '发展和改革委员会',     short: '发改委',     tags: ['产业','审批'] },
  { suffix: '工业和信息化厅',       short: '工信厅',     tags: ['工业','制造业'] },
  { suffix: '科学技术厅',           short: '科技厅',     tags: ['科技','创新'] },
  { suffix: '财政厅',               short: '财政厅',     tags: ['补贴','资金'] },
  { suffix: '人力资源和社会保障厅', short: '人社厅',     tags: ['人才','就业'] },
  { suffix: '商务厅',               short: '商务厅',     tags: ['招商','外贸'] },
  { suffix: '市场监督管理局',       short: '市场监管局', tags: ['监管','信用'] },
];

export const STANDALONE_CITIES = [
  { provinceCode: '510000', cityName: '成都市' },
  { provinceCode: '440000', cityName: '深圳市' },
  // ... 共 13 条
];

export const FULL_PROVINCES = {
  '430000': ['长沙市','株洲市','湘潭市', /* 14 个 */],
  '610000': ['西安市','铜川市', /* 10 个 */],
  '440000': ['广州市','深圳市', /* 21 个 */],
  '460000': ['海口市','三亚市','三沙市','儋州市'],
};
```

### 4.3 生成脚本(`apps/api/src/seeds/gen-gov-orgs.ts`)

按 §4.1 4 大类循环拼装,直辖市 / 自治区命名特殊处理:
- 北京/上海/天津/重庆:厅 → 局,「北京市发改委」
- 内蒙古/西藏/广西/宁夏/新疆:省 → 自治区,「内蒙古自治区发改委」

输出 `gov-orgs-seed.json`(checked into git)。

### 4.4 字段填充规则

| 字段 | 值 |
|---|---|
| `name` | 全称(如「长沙市发展和改革委员会」) |
| `shortName` | 短称(如「长沙发改委」)— **关键!fuzzy match 主用** |
| `provinceCode` | 6 位省级代码;中央用 `000000` |
| `cityName` | 直辖市/自治区填首府;中央用「北京市」 |
| `districtName` | NULL |
| `level` | national / provincial / municipal |
| `parentOrgId` | NULL(MVP 不建层级) |
| `functionTags` | 模板预填 |
| `address` | NULL |
| `createdBy` | NULL(系统 seed 标识) |

### 4.5 工程落地步骤

1. **Migration 1**:`CreateGovOrgsAndContacts` — 建 2 张表 + indexes + UNIQUE
2. **Migration 2**:`AddOrgIdContactIdToVisits` — visits 加 2 列 + FK ON DELETE SET NULL
3. **Seed 数据生成**:`pnpm tsx apps/api/src/seeds/gen-gov-orgs.ts` → `gov-orgs-seed.json`
4. **Seed 装载**:NestJS `AppModule.onApplicationBootstrap` 检查空表 → 批量 INSERT(单事务)
5. **回滚**:软删通过 `deletedAt`;开发用 `pnpm seed:reset-gov-orgs` 命令清表

### 4.6 风险 & 取舍

- **数据准确性**:程序生成的「XX 市发改委」可能和官方实际名称差点(如有的城市叫"经济发展局")— **接受此误差**,用户回桌面端可改
- **覆盖盲区**:13 独立城市外的「云南/贵州/江苏/浙江...」用户主要靠现场新增机构补
- **去重保护**:UNIQUE 兜底,跑两次 seed 不会爆

---

## §5 错误处理 + 边界

### 5.1 API 层错误码

| 场景 | HTTP | 文案 |
|---|---|---|
| `UNIQUE(provinceCode, cityName, name)` 冲突 | 409 | "该机构已存在" |
| `UNIQUE(orgId, name)` 联系人冲突 | 409 | "该机构下已有同名联系人" |
| 提交的 `orgId` 不存在或已软删 | 400 | "机构不存在或已删除" |
| 提交的 `contactId` 不存在或已软删 | 400 | "联系人不存在或已删除" |
| 普通 user PATCH 别人 createdBy 的机构 | 403 | "无权修改该机构" |
| 普通 user PATCH 别人 ownerUserId 的联系人 | 403 | "无权修改该联系人" |
| 软删 gov_org 时不级联(visits 仍引用)| 200 | 标 deletedAt,visits 行 orgId 保留 |

### 5.2 Visit auto-upsert 边界

| 输入组合 | 处理 |
|---|---|
| `contactId` 给了 + `contactPerson` 也给了 | 取 contactId,忽略 contactPerson |
| `contactId` 给了但实际不存在 | 400 报错(不静默吞) |
| `orgId` 给的是已软删的 | 400「机构已删除」(不允许新拜访挂软删机构) |
| `contactPerson="张 处长"` vs DB 里 `"张处长"` | 提交前 trim + 全角空格转半角,**不做更激进 normalize** |
| PATCH visit 改了 `orgId` 但 `contactId` 仍属旧 org | 自动清空 `contactId`,前端弹 toast「联系人不属于新机构,已清除」 |

### 5.3 语音 fuzzy match 边界

| 场景 | 处理 |
|---|---|
| LLM 返回 department 为空 | 跳过 fuzzy,`orgId=null` |
| 全国 / 全省候选 > 1 条 LIKE 匹配 | **不返回 orgId**(模糊不可靠);保留 free text |
| ctx 无 provinceCode + 用户也没说 | 全国搜不做(太宽);返回 null |
| 匹配到的 org `deletedAt IS NOT NULL` | 视为不存在,继续找下一个 |

### 5.4 前端 UX 边界

| 场景 | 处理 |
|---|---|
| AutoComplete 输入 | debounce 300ms 才发 GET |
| AutoComplete 没结果 | "无匹配 → [+ 新建机构]" 内联按钮 |
| 现场新增机构成功 | Modal 关闭 + 立刻填 orgId 到主 Form;**保留主 Form 已填的其他字段** |
| 语音返填 orgId + 用户清空 free text 部门 | **不清 orgId**(下拉是主)— 用户改下拉到别机构,旧 free text 自动清 |
| 用户勾「☐ 我要纯手动填」 | 自动清已选 orgId(切换排他) |
| 移动端 AutoComplete 列表 | 高度限制 60vh |

### 5.5 数据迁移边界

- 现有 37 条 visits:orgId/contactId 全 NULL,不做回填
- 3 个 pin 关联的 visits:不动
- 生产已跑老 seed:启动 hook 检测 count > 0 → 跳过 INSERT(幂等)

### 5.6 软删交互(2 表共用)

- 默认列表 / AutoComplete:`WHERE deletedAt IS NULL`
- sys_admin OrgsTab 工具栏 `☐ 含已删除` 开关,打开看灰色软删行
- 软删的机构 / 联系人:**不能再用于新拜访**(POST visits 校验)
- 历史拜访引用了软删的:Visit 详情页正常显示机构名 + 灰色 chip「已删除」

### 5.7 性能 / 分页

| 端点 | 分页 |
|---|---|
| GET /gov-orgs | `limit` 默认 50 / max 100;按 cityName + name 排序 |
| GET /gov-contacts | `limit` 默认 50 / max 100;`orgId` 强烈推荐筛后再列 |
| AutoComplete 搜索 | 命中前 10 条 |

### 5.8 不处理的边界(YAGNI)

- 同名不同机构的张处长 fuzzy 区分 — 决策 5/6 已说,无 orgId 不 upsert
- 机构改名后旧拜访的 orgId — TypeORM 自动取最新 name
- 跨 owner 转移联系人 — V0.8
- 批量导入机构(CSV)— 单条 POST 够
- 软删的级联恢复 — V0.8

---

## §6 测试 / 验收 / 工作量

### 6.1 测试策略

**Unit 测试**(关键业务,不测 CRUD 模板)

| 文件 | 重点 |
|---|---|
| `gov-orgs.service.spec.ts` | UNIQUE 冲突 / 软删过滤 / 权限校验 |
| `gov-contacts.service.spec.ts` | UNIQUE 冲突 / orgId 必填 |
| `visits.service.spec.ts` | **auto-upsert contact 6 个分支** + 状态机不动 |
| `voice.service.spec.ts` | **fuzzy match 4 个边界** + 修复 R2.7 broken 单测 |

**e2e 测试**

| 路径 | 测试点 |
|---|---|
| `POST /gov-orgs` 重复 | 409 |
| `POST /gov-contacts` 无 orgId | 400 |
| `POST /visits` 带 orgId+新 contactPerson | 自动 INSERT contact |
| `POST /visits` 同 orgId+已存在 contactPerson | 复用 existing contactId |
| `POST /visits` 仅 contactPerson 无 orgId | 不 upsert,只存 free text |
| `PATCH /visits/:id` 改 orgId | 自动清 contactId |
| `POST /voice/parse-visit` 「长沙发改委」 | 返回 orgId 匹配 |
| `POST /voice/parse-visit` 模糊「发改委」 | orgId=null |

**前端不写自动化测试**(YAGNI,demo 项目用 preview 验证)

### 6.2 端到端验收脚本

```
[A 桌面端]
  1. 登录 → /console → 「机构」tab → ~676 条 → 筛湖南/长沙 → 看长沙发改委
  2. 「联系人」tab → 0 条
  3. +新建拜访 → 机构搜「长沙发」选中 → 联系人输「张处长」+ 职务 → 提交
  4. 「联系人」tab 刷新 → 出现 1 条「张处长 / 长沙发改委 / 处长」← auto-upsert ✓
  5. 再 +新建拜访 → 同长沙发改委 → 联系人 AutoComplete 输「张」→ 张处长浮 → 选中 → 提交
  6. visits 表新行 contactId 复用旧的(SQL 验证)
  7. +新建拜访 → 不选机构 → 勾「我要纯手动填」→ 填「某局」→ 提交 OK,orgId=null ✓

[B 移动端语音]
  8. 手机 /m/visit/new → 录「今天去长沙发改委张处长谈半导体补贴」
  9. 解析回来:机构「🤖 AI 已匹配长沙发改委」蓝标,联系人 free text 张处长
 10. 提交 → DB 验证 orgId 填,contact upsert 出来

[C 错误路径]
 11. POST /gov-orgs 同省市同 name 二次 → 409
 12. POST /visits orgId=不存在 UUID → 400
 13. PATCH /visits 改 orgId → 旧 contactId 自动清 + toast
 14. 普通 user PATCH 别人 createdBy 的机构 → 403

[D OrgsTab CRUD]
 15. 编辑某 seed 机构改 shortName → 保存成功
 16. 软删某机构 → 列表消失;勾「含已删除」→ 灰色显示
 17. 现有拜访引用该软删机构 → 详情页仍显示名字 + 「已删除」chip
```

### 6.3 回归保护

| 模块 | 状态 |
|---|---|
| Pin / Comment / 蓝点 / 大盘 / 32 visits seed | 完全不动 |
| Visit 状态机(planned → completed) | 不动 |
| 语音 ASR + LLM 流程 | 不动,只加 fuzzy match |
| 移动端表单字段 / 滚动到首缺失 | 不动 |
| auth / 双登录 / 会话 | 不动 |

### 6.4 工作量预估(subagent-driven 任务粒度)

| # | Task | 估时 |
|---|---|---|
| 1 | Migration 1+2:gov_orgs / gov_contacts 建表 + visits 加列 | 30m |
| 2 | shared-types:GovOrg / GovContact / 加 visit 字段 | 20m |
| 3 | gov-orgs module:entity / dto / service / controller / module | 60m |
| 4 | gov-contacts module:同上 | 60m |
| 5 | seed 数据生成:13 城市 + 4 全省清单数据文件 + 生成脚本 + 启动 hook | 90m |
| 6 | visits.service auto-upsert contact 逻辑 + 单测覆盖 6 分支 | 60m |
| 7 | voice.service fuzzy match GovOrg + 单测 + 修复 R2.7 broken 单测 | 60m |
| 8 | 前端 OrgsTab + GovOrgFormModal + 详情 Drawer | 120m |
| 9 | 前端 ContactsTab + GovContactFormModal + 详情 Drawer | 90m |
| 10 | VisitFormModal 双轨改造(AutoComplete × 2 + 现场新增 + 「纯手动填」) | 120m |
| 11 | 移动端 MobileVisitNewPage 语音返填视觉反馈 | 30m |
| 12 | 端到端 6.2 脚本 + 修小 bug + commit + push | 60m |

**合计:约 13 小时**(单人 + AI,2-3 工作日)

**任务依赖**:1 → 2 → (3, 4) → 5 → 6 → 7 → 8 → 9 → 10(依赖 3 / 8)→ 11(依赖 7 / 10)→ 12

### 6.5 上线节奏

```
Day 1:Task 1-7(后端全部)→ 本地 API 测试通过
Day 2:Task 8-11(前端全部)→ 桌面 + 移动端 preview 跑过
Day 3:Task 12 端到端 + 部署到 47.238.72.38 → demo 环境验证
```

部署:`pnpm build` → rsync dist + apps/api/dist → `pm2 restart`。Migration 先跑,seed hook 自动 INSERT 676 条。**不需要 downtime**(visits 加 NULL 列向前兼容)。

### 6.6 不在范围(明确推迟)

- 机构层级关系(parentOrgId 实际填充)— V0.7
- ContactLog(每次接触打卡)— V0.8
- 联系人活跃度评分 / Tier 自动调整 — V0.8
- CSV 批量导入机构
- 跨 owner 转移联系人 — V0.8
- 软删恢复 / 级联恢复 — V0.8

---

## 关键文件清单

**后端(改 + 新)**

```
apps/api/src/migrations/{ts}-CreateGovOrgsAndContacts.ts          [新]
apps/api/src/migrations/{ts}-AddOrgIdContactIdToVisits.ts         [新]
apps/api/src/gov-orgs/entities/gov-org.entity.ts                  [新]
apps/api/src/gov-orgs/dto/{create,update,query}-gov-org.dto.ts    [新]
apps/api/src/gov-orgs/gov-orgs.service.ts                         [新]
apps/api/src/gov-orgs/gov-orgs.controller.ts                      [新]
apps/api/src/gov-orgs/gov-orgs.module.ts                          [新]
apps/api/src/gov-contacts/...                                     [新,同结构]
apps/api/src/seeds/data/gov-org-source.ts                         [新]
apps/api/src/seeds/gen-gov-orgs.ts                                [新]
apps/api/src/seeds/gov-orgs-seed.json                             [新,生成产物]
apps/api/src/seeds/gov-orgs-seeder.service.ts                     [新,启动 hook]
apps/api/src/visits/visits.service.ts                             [改:auto-upsert 逻辑]
apps/api/src/visits/dto/{create,update}-visit.dto.ts              [改:加 orgId/contactId]
apps/api/src/visits/entities/visit.entity.ts                      [改:加 orgId/contactId 关联]
apps/api/src/voice/voice.service.ts                               [改:加 fuzzy match]
apps/api/src/voice/voice.service.spec.ts                          [改:修 R2.7 broken + 加 fuzzy 测]
apps/api/src/app.module.ts                                        [改:挂 GovOrgs/GovContacts/Seeder]
```

**前端(改 + 新)**

```
packages/shared-types/src/dtos/gov-org.ts                         [新]
packages/shared-types/src/dtos/gov-contact.ts                     [新]
packages/shared-types/src/enums/gov-org-level.ts                  [新]
packages/shared-types/src/enums/contact-tier.ts                   [新]
packages/shared-types/src/dtos/visit.ts                           [改:加 orgId/contactId]
apps/web/src/api/gov-orgs.ts                                      [新:client]
apps/web/src/api/gov-contacts.ts                                  [新:client]
apps/web/src/components/GovOrgFormModal.tsx                       [新]
apps/web/src/components/GovContactFormModal.tsx                   [新]
apps/web/src/components/GovOrgDetailDrawer.tsx                    [新]
apps/web/src/components/GovContactDetailDrawer.tsx                [新]
apps/web/src/pages/console/OrgsTab.tsx                            [新]
apps/web/src/pages/console/ContactsTab.tsx                        [新]
apps/web/src/components/VisitFormModal.tsx                        [改:双轨 AutoComplete + 现场新增]
apps/web/src/pages/mobile/MobileVisitNewPage.tsx                  [改:语音返填 orgId 视觉反馈]
apps/web/src/pages/console/ConsoleLayout.tsx                      [改:加 2 个 tab 入口]
```

---

## 注意事项 / 复用既有

- **复用 PinFormModal / VisitFormModal 的 antd Form 模式**,保持一致风格
- **复用 react-query** 拉/推 GovOrg / GovContact
- **复用 zustand 'pop-auth' key** 取 token
- **复用 R2.7 prompt.ts 模式**,fuzzy match 在 voice.service.parseVisit 内部加一步
- **复用 regions 表** 取省市数据(seed 生成 + Form Select 都用)
- **保持 visits free text 字段不动**,双轨兼容现有 37 条 + 移动端语音 fallback

---

## 下一步

1. 用户审本 spec(本节)
2. 退出 brainstorm 模式 → 走 superpowers:writing-plans 拆任务清单(预计 12 task / commit)
3. 按 task list 跑 superpowers:subagent-driven-development 实施
