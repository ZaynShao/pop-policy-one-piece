# 政策大盘 P0 — 染色图层设计 spec

**状态:** brainstorm 已收口决策,待 writing-plans 拆任务清单
**日期:** 2026-05-06
**前置条件:** V0.6 β.2.5+β.3 蓝点闭环 + K 模块(机构/联系人) + 语音 token 自动续期 全部已 merge 到 main

---

## Context

V0.6 β.3 + K 模块跑完之后,大盘已经有 pins(项目立项,3 seed)+ visits(拜访点,32 seed)+ 蓝点计划点 + 留言板自动同步。**用户场景的最后一块短板:大盘上看不到「政策」**。

用户提供:**外部 LLM 政策知识库(黑盒)**,输入「某某主题政策的分布」 → 输出该主题下的全国政策列表(含层级、地区、机关、时间、摘要)。

P0 目标:把这层数据接进大盘,让用户做演示时能讲完整故事 — 「成都有 Pin → 成都有拜访 → 成都该主题有 N 条政策」。

---

## 核心决策(brainstorm 已逐项拍)

### 1. 视觉:**只染色,不画色点**(决策瞬间锁定)

**色点的 3 个硬伤:**
1. 政策无明确坐标:「四川省发改委」发的政策,画机关地(成都)还是适用范围(全省)? 语义冲突
2. 跟现有 pins/visits(已 35 个圆点)正面冲突,核心信息被淹
3. 同机构发 50 条堆同一坐标,跟 1 条视觉无差别,信息丢失

**染色 + drawer + 数字标注 + 下钻**已经覆盖所有正经诉求,色点是冗余项。

### 2. 国家级政策不参与染色

国务院/部委政策适用全国,如果加进每省 count → 染色变均匀,失去意义。**单独 badge 在大盘顶部展示**。

### 3. ETL 模式 — 离线 JSON 导入

不实时调 LLM。当前阶段:
- **用户那边 LLM 工具产出 JSON**
- **手动喂给后端**(commit 到 repo 或 POST 到 import 端点 — 待定)
- **后端 import 脚本** → `policies` 表
- **大盘前端**从 DB 渲染

**后期:** 接 OpenClaw(开源爬虫)做定向抓取 + 入库自动化。**当前 P0 不实现**。

### 4. 染色粒度

**双粒度:省级染色(默认)+ 城市级染色(下钻视图)**

- 默认全国地图:省级染色,色深 = 该省政策总数(包含 provincial 级 + 该省下属市 municipal/district 级)
- 用户点击省份下钻 → 切到该省地图 → 城市级染色,色深 = 该市政策数

### 5. 数据 schema 选 T2(染色 + drawer 列表 一次拉完)

T1 太单薄(只 count,drawer 没数据);T3 加 sourceUrl/relevance 但 LLM 可能吐不稳。**T2 是 sweet spot**。

---

## 数据格式规范(交给 LLM 那边)

### 顶层

```ts
{
  fetchedAt: string,    // ISO 8601 时间戳
  topics: Topic[]       // 多主题装一起
}
```

### Topic

```ts
{
  topic: string,                  // 主题名
  national: PolicyItem[],         // 国家级政策(level=national)
  byProvince: ProvinceGroup[],    // 省级政策按省分组
  byCity: CityGroup[]             // 市级及区县级按市分组
}
```

### ProvinceGroup

```ts
{
  provinceCode: string,           // 国标 6 位,如 "510000"
  provinceName: string,           // "四川省" 全称
  policies: PolicyItem[]          // 只放 level=provincial 的
}
```

### CityGroup

```ts
{
  provinceCode: string,           // 该市所属省的国标 6 位
  cityName: string,               // "成都市" 带"市"字
  policies: PolicyItem[]          // 放 level=municipal 和 level=district 的
}
```

### PolicyItem

```ts
{
  title: string,                  // 政策原文标题全称
  issuingOrg: string,             // 发文机构全称
  issueDate: string,              // YYYY-MM-DD;只知道年份用 YYYY-01-01
  level: "national" | "provincial" | "municipal" | "district",
  summary: string                 // 30-80 字一句话摘要,单行
}
```

### 6 条铁律

1. 整体输出纯 JSON,无 markdown 包裹,无前后说明文字
2. 政策互斥分组,不重复:每条只出现在 national / byProvince[*].policies / byCity[*].policies 三处之一
3. provinceCode 严格用国标 6 位
4. 直辖市:北京/天津/上海/重庆 的市级政策归 byCity,该市 provinceCode = 自身代码,cityName 即"北京市"等
5. 空主题:某主题没找到任何政策时,仍要返回该主题对象,三个数组给 `[]`
6. 字段无 null:所有字段必填且非空(空字符串和 null 都不允许 — summary 没把握就写"(暂无摘要)")

---

## Architecture(数据流)

```
[1] 用户 → LLM 工具:「请按格式返回主题 X / Y / Z 的政策分布」
[2] LLM → 用户:JSON 文件
[3] 用户 → 仓库 / API:把 JSON 喂给后端
[4] 后端 import 脚本 → DB:
       policies 表(展开 PolicyItem)
       policy_topics 关联表(主题去重)
[5] 大盘前端:
       GET /api/v1/policies/distribution?topic=半导体补贴
       → { national: count, byProvince: [{code,count}], byCity: [{code,name,count}] }
       渲染省级染色 + 顶部 national badge
[6] 用户点击省份 → drawer:
       GET /api/v1/policies?topic=&provinceCode=
       → 列出该省 policies(provincial + 下属市的 municipal + district)
[7] 用户下钻到省地图 → 城市级染色:
       同 [5] 但用 byCity 维度
```

---

## DB Schema(P0 草案,待 plan 阶段细化)

```sql
CREATE TYPE policy_level AS ENUM ('national', 'provincial', 'municipal', 'district');

CREATE TABLE policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(500) NOT NULL,
  issuing_org varchar(200) NOT NULL,
  issue_date date NOT NULL,
  level policy_level NOT NULL,
  province_code varchar(6) NULL,    -- national 时为 NULL
  city_name varchar(50) NULL,       -- national/provincial 时为 NULL
  summary text NOT NULL,
  source_batch_id uuid NULL,        -- 关联到 import_batches,便于版本回滚
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE policy_topics (
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  topic varchar(100) NOT NULL,
  PRIMARY KEY (policy_id, topic)
);

CREATE INDEX idx_policies_level ON policies(level);
CREATE INDEX idx_policies_province ON policies(province_code);
CREATE INDEX idx_policies_city ON policies(province_code, city_name);
CREATE INDEX idx_policy_topics_topic ON policy_topics(topic);
```

---

## 后端 API(P0 草案)

```
POST  /api/v1/policies/import          ← 上传 JSON,内部解析 + 写表
GET   /api/v1/policies/topics          ← 列出所有 topic(下拉用)
GET   /api/v1/policies/distribution    ← 染色聚合 (?topic=)
GET   /api/v1/policies                 ← drawer 列表 (?topic=&provinceCode=&cityName=)
```

POST /import 校验:
- JSON schema(顶层 + 4 类型 + 6 铁律)
- 互斥分组检测(同 title+issuingOrg 不能在 byProvince 又在 byCity)
- provinceCode 必须在国标 31 个之内
- import 成功返回 batch_id 和统计(各主题各级 count)

---

## 前端组件(P0 草案)

| 组件 | 改 / 新 | 说明 |
|---|---|---|
| `MapShell.tsx` | 改 | 顶部加「图层切换」+ 主题选择器 + national badge |
| `MapCanvas.tsx` | 改 | 加 visualMap 染色逻辑(根据 distribution 数据) |
| `PolicyTopicSelect.tsx` | 新 | 主题下拉,取自 GET /policies/topics |
| `PolicyNationalBadge.tsx` | 新 | 大盘顶部「N 条国家政策」chip |
| `PolicyDrawer.tsx` | 新 | 点击省/市后展示该地区政策列表 |
| `tokens.ts` | 改 | `palette.policy.coloring` 启用染色梯度色 |

---

## 待决问题(plan 阶段再拍)

1. **染色色阶选什么色?** 蓝色(避开 visit 红/橙/黄/绿/灰)还是紫色?
2. **Import 入口:** 文件上传 UI 还是命令行脚本?demo 演示便利性 vs 安全性
3. **多主题如何 layer 叠加?** 用户选 1 个 topic 就染 1 个,还是支持「主题 A + B 取并」?
4. **drawer 政策卡片设计:** 简单 list 还是带排序/筛选?
5. **数据时效性提示:** drawer 顶部要不要标 `fetchedAt`?(避免客户问「这数据多新」)

---

## 关键文件清单(plan 阶段细化)

```
apps/api/src/policies/                                    [新模块]
  ├── entities/policy.entity.ts                           [新]
  ├── entities/policy-topic.entity.ts                     [新]
  ├── dtos/import-policies.dto.ts                         [新]
  ├── dtos/distribution-query.dto.ts                      [新]
  ├── policies.module.ts                                  [新]
  ├── policies.controller.ts                              [新]
  ├── policies.service.ts                                 [新]
  └── import-validator.ts                                 [新:JSON schema 校验]

apps/api/src/migrations/{ts}-CreatePoliciesTables.ts      [新]
apps/api/src/app.module.ts                                [改:挂 PoliciesModule]

packages/shared-types/src/dtos/policy.ts                  [新]
packages/shared-types/src/enums/policy-level.ts           [新]

apps/web/src/api/policies.ts                              [新]
apps/web/src/components/MapShell.tsx                      [改]
apps/web/src/components/MapCanvas.tsx                     [改:visualMap]
apps/web/src/components/PolicyTopicSelect.tsx             [新]
apps/web/src/components/PolicyNationalBadge.tsx           [新]
apps/web/src/components/PolicyDrawer.tsx                  [新]
apps/web/src/lib/tokens.ts                                [改:染色色阶]
```

---

## 注意事项 / 复用既有

- **复用 K 模块的 Beijing-merge-national 模式**(政策染色不需要,但 drawer 列表要 — 北京 drawer 应包含国家级政策)
- **复用 visualMap** — ECharts geo 已经有 visualMap,不重写
- **复用 tokens.ts 色彩体系** — 染色用全新蓝色梯度,跟 visit 红/橙/黄/绿/灰 + pin 红/灰隔离
- **不动 pins / visits / comments / govOrgs / govContacts 等既有表** — 完全独立模块

---

## 下一步

1. 用户用本 spec 跟 LLM 那边对齐数据格式
2. 用户给我第一批 JSON(主题清单待定,LLM 协助梳理)
3. 我 writing-plans 拆任务清单 → subagent-driven-development 实施
