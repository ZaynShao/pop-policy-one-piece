# G1+G2+G8 · D 工具池 demo 闭环 design spec

**状态:** brainstorm 已收口决策,待 writing-plans 拆任务清单
**日期:** 2026-05-07
**前置条件:**
- main HEAD `a7a7936`(G6 merge 后)
- 工作分支 `claude/g1-d-tool-pool`
- 上游 spec:`docs/superpowers/specs/2026-05-07-gap-sequencing-design.md`(G1-G8 重排,本 spec 实施其中 G1 demo 集 + G2 + G8)

---

## Context

`HANDOFF-gap-2026-05-06.md` §2 把 G1 工具池估为 ~25% 大工作量;`2026-05-07-gap-sequencing-design.md` 砍到"demo 闭环"。本 spec 把"砍多深、上传到哪、假系统返回什么"三个范围决策落到具体设计。

**目的(反推角色落位)**:给 GA 负责人 / 公司高层 demo 完整故事 ——
> "中台 GA 一次配工具,一线属地 GA 在每个拜访点自动看到当地相关的成品文档 + 调用接口工具,接口工具按当地参数化生成定制产物(如某省定制谈参)"

中台 GA 这个角色实际虚位(见上游 spec §核心决策 2),系统先成形反推岗位编制。

---

## 核心决策(brainstorm 已逐项拍)

### Q1 = B · 全按 PRD ~8-10 天,4.5.1-4.5.6 完整

**砍 A**(只绑具体点 + 简化级联)和**砍 C**(只做 DocumentTool 跳过接口)都被否。理由:
- 反推 demo 的核心卖点是"中台一次绑定全省自动覆盖",泛地域绑定不能砍
- 接口工具是"参数化生成定制产物"故事的载体,不能砍
- 多花 2-3 天换 demo 可信度,值得

**入选范围:**
- PRD §4.5.1 Tool 共有字段 + 状态机 `draft → published ⇄ archived`
- PRD §4.5.2 DocumentTool 子类(file_url 字段;更新覆盖式不留版本)
- PRD §4.5.3 InterfaceTool 子类(`param_template` + `response_mapping` JSONB)
- PRD §4.5.4 ToolBinding 双模式(具体点 OR 泛地域)
- PRD §4.5.5 ToolConsumptionLog
- PRD §4.5.6 工具 ↔ 点级联匹配完整算法(向上级联 + 排序去重分组)

### Q2 = B · 阿里云 OSS 文件存储

**砍 A**(ECS 本地)被否 —— 用户拍板用 OSS 标准方案。

**实施期 BLOCKED 等用户提供:**
1. OSS bucket 名 + 区域(建议香港区跟 ECS 同区,降跨区带宽费)
2. AccessKey ID / Secret(子账号,scope 限本 bucket;不进 git,只进 prod `.env`)
3. Bucket 公网读策略选择:
   - 选 **公开读** → 下载 URL 直接是 `https://{bucket}.{region}.aliyuncs.com/{key}`,简单
   - 选 **私有 + 签名** → 后端每次下载现签短期 URL(15 分钟过期),更安全
4. **`.env` 改动授权** —— `HANDOFF-gap-2026-05-06.md` §5.3 写"不要改 /opt/pop/.env",本次需要松绑加 `OSS_*` 4 个变量,或用户自己改

**前端上传走 presigned PUT URL 流**:
- 中台 GA 创建工具时,前端先调 `POST /api/v1/tools/upload-url` 拿 presigned URL
- 浏览器直接 PUT 文件到 OSS(不过 ECS,省带宽)
- 拿到 OSS object key,提交工具创建 form 时附带 key

### Q3 = B · D13 假系统地域感知 mock

**砍 A**(固定返回)和 **C**(接真 LLM)都被否。

**Mock 行为**:接收 `{ region_code, theme_code?, configKey? }`,返回:
```json
{
  "downloadUrl": "{prod}/api/v1/external/mock/files/{region_code}-{theme_code}.pdf",
  "summary": "{省名} {主题} 定制谈参 v0.1 - 自动生成于 {timestamp}",
  "params": { "region": "{region_code}", "theme": "{theme_code}" },
  "generatedAt": "{ISO 时间}"
}
```

下载 URL 跳一个 fake static endpoint,返回一段固定 PDF/text 内容(假装是"省定制版"),功能上完整跑通"调用 → 拿到带省名的产物"。

---

## 数据模型(基于 PRD §4.5)

### 5 张新表

#### `tools`(STI:type discriminator)
| 字段 | 类型 | 备注 |
|---|---|---|
| `id` | uuid PK | |
| `type` | enum | `document` / `interface` |
| `title` | varchar(100) | |
| `description` | text nullable | |
| `taxonomy_tag` | enum | PRD §3.5 D11:`ppt_template` / `talk_param_ref` / `local_data` / `cooperation_template` / `policy_interpretation` / `other` |
| `status` | enum | `draft` / `published` / `archived` 默认 `draft` |
| `creator_id` | uuid FK users | |
| `file_url` | varchar(500) nullable | document 专用 — OSS object URL(或 key,看 Q2 公开/签名选择) |
| `param_template` | jsonb nullable | interface 专用 — 描述哪些参数需要由 region 推导 |
| `response_mapping` | jsonb nullable | interface 专用 — mock 返回字段映射(MVP 可固定) |
| `created_at` / `updated_at` / `deleted_at` | timestamp | |

约束:`type='document'` 时 `file_url` 非空;`type='interface'` 时 `param_template` 非空。

#### `tool_bindings`
| 字段 | 类型 | 备注 |
|---|---|---|
| `id` | uuid PK | |
| `tool_id` | uuid FK tools | |
| `target_type` | enum | `pin` / `visit` / `region` |
| `pin_id` | uuid FK pins nullable | target_type=pin 时填 |
| `visit_id` | uuid FK visits nullable | target_type=visit 时填 |
| `region_code` | varchar(8) nullable | target_type=region 时填(可为省/市/区码,或泛地域代码如 `*` 表全国) |
| `region_scope_tag` | enum nullable | target_type=region 时填 — `nationwide` / `all_provinces` / `all_cities_in_province` / `all_districts_in_city` / `specific` |
| `created_at` | timestamp | |

约束:`target_type` 取值决定 `pin_id`/`visit_id`/`region_code` 哪个非空(check constraint)。

#### `tool_consumption_logs`
| 字段 | 类型 | 备注 |
|---|---|---|
| `id` | uuid PK | |
| `tool_id` | uuid FK tools | |
| `consumer_id` | uuid FK users | |
| `consumed_at` | timestamp default now | |
| `context_pin_id` | uuid FK pins nullable | 触发时所在的 pin/visit context |
| `context_visit_id` | uuid FK visits nullable | |
| `context_region_code` | varchar(8) nullable | |
| `interface_response` | jsonb nullable | InterfaceTool 调用时的 mock 响应快照,document 类此字段为空 |

#### 索引
- `tools (creator_id)`,`tools (status, type)`
- `tool_bindings (tool_id)`,`tool_bindings (region_code)`,`tool_bindings (pin_id)`,`tool_bindings (visit_id)`
- `tool_consumption_logs (consumer_id, consumed_at desc)`,`tool_consumption_logs (tool_id)`

### 状态机(PRD §4.5.1)
```
draft ─────publish─────▶ published
                              │
                              │ archive
                              ▼
                          archived
                              │
                              │ restore
                              ▼
                          published
```
仅 creator_id 可改状态(MVP 阶段);archived 工具属地 GA 看不到,但历史消费记录保留。

### 级联匹配算法(PRD §4.5.6)
属地 GA 在某 visit/pin 触发"可用工具"查询时:
1. **向上展开**:从 visit/pin 取 `province_code` / `city_code` / `district_code`(根据点精度)
2. **拉候选 bindings**:
   - 直接绑这个 visit/pin 的 bindings
   - 直接绑 district_code/city_code/province_code 的 bindings
   - 泛地域 bindings:`nationwide` / `all_provinces` / `all_cities_in_province`(按当前省过滤) / `all_districts_in_city`(按当前市过滤)
3. **去重**:同一 tool 多条 binding 命中只留一条
4. **过滤**:tool.status = `published` 且未 deleted_at
5. **排序**:`taxonomy_tag` 分组,组内按 region 精度降序(`district > city > province > nationwide` etc.)+ `tool.created_at` 降序
6. **返回**:按 taxonomy 分组的工具列表

---

## 后端实施(NestJS 模块)

### 4 个新模块
- `tools/` —— Tool CRUD + 状态机 + 绑定管理
- `tool-bindings/` —— ToolBinding CRUD(挂在 tools 里也行,看复杂度;倾向独立模块)
- `tool-consumptions/` —— 消费日志写入 + 个人消费查询
- `external-mock/` —— D13 假外部系统 controller + fake static file serve

### API 完整列表
```
# 中台 GA — 工具管理
POST   /api/v1/tools                       D2/D3 创建(by type,creator = current user)
GET    /api/v1/tools                       D1 列表(creator filter / status filter / type filter)
GET    /api/v1/tools/:id                   详情
PUT    /api/v1/tools/:id                   D4/D5 更新(creator-only)
POST   /api/v1/tools/:id/publish           draft → published
POST   /api/v1/tools/:id/archive           D6 published → archived
POST   /api/v1/tools/:id/restore           archived → published

POST   /api/v1/tools/:id/bindings          D10 加绑(payload: target_type 等)
DELETE /api/v1/tools/:id/bindings/:bid     D10 删绑

# OSS 直传
POST   /api/v1/tools/upload-url            返回 presigned PUT URL + object key

# 属地 GA — 消费触发
POST   /api/v1/tools/:id/download          D7 写日志 + 返回 file_url(供前端跳)
POST   /api/v1/tools/:id/invoke            D8 写日志 + 调 D13 mock + 返回 mock 响应

# 级联匹配(G2 / B15)
GET    /api/v1/tools/by-point?visitId=xxx  | ?pinId=xxx
                                           4.5.6 算法,返回 { groups: { tag: [tool, ...] } }

# 消费日志查询
GET    /api/v1/me/consumptions             F4 当前用户消费记录,时间倒序
GET    /api/v1/tools/:id/consumptions      D12 中台 GA 看自己工具被消费明细

# D13 假外部系统(独立路径,不在 /tools 下)
POST   /api/v1/external/mock/:configKey    入参 { region_code, theme_code? },返回 mock 响应
GET    /api/v1/external/mock/files/:filename  fake static file serve(返回固定 PDF / 文本)
```

### 权限(MVP 角色级)
- `central_ga` / `sys_admin`:tools 完整 CRUD;只能改自己创建的(creator-only)
- `local_ga`:`/tools/:id/download` `/tools/:id/invoke` `/tools/by-point` `/me/consumptions`(自己的)
- `lead` / `pmo`:全部 `tools`/`bindings` 只读 + 看消费明细

---

## 前端实施

### 中台 GA · `/console/tools`(替换现有 stub)
**列表视图:**
- 筛选:状态(draft / published / archived 全部)+ 类型(全部 / 文档 / 接口)
- 表格列:title / type / taxonomy / status / 消费数(D12 sum)/ 操作(发布 / 下架 / 恢复 / 编辑)
- 顶部"新建工具"按钮

**新建/编辑 modal:**
- Tab 切换:"成品文档" / "调用接口"
- 公共字段:title / description / taxonomy_tag(下拉)
- 文档专用:文件上传(走 presigned URL,显示进度)
- 接口专用:`param_template` JSON 编辑 + `response_mapping` JSON 编辑(简易 textarea + JSON 校验)
- "绑定"区(同 modal 内):
  - 多选具体点(visit/pin from 现有列表)
  - 多选泛地域:全国 / 选省 → 全省 / 选省+市 → 全市 / 选省+市+区 → 全区
  - 已加绑定 chip 列表 + 删除按钮

**详情 drawer:**
- 显示完整工具信息 + 当前 bindings 列表 + 消费明细 tab(D12)

### 属地 GA · visit drawer 加"可用工具"区块(B15 / G2)
- 在现有 `VisitDetailDrawer` 加一个"可用工具"区块
- 调 `GET /api/v1/tools/by-point?visitId={id}` 拿级联结果
- UI:按 taxonomy_tag 分组的 Collapse,每条工具一行
  - 文档:[名] [taxonomy 标签] [region 标签] [下载按钮]
  - 接口:[名] [taxonomy 标签] [region 标签] [调用按钮]
- 下载:写日志 + window.open(file_url)
- 调用:写日志 + 调 D13 mock + 弹 modal 显示 mock 响应(摘要 + 假下载链接)

### 属地 GA · F4 wire up
- 替换 G6 `MyConsumptionsPanel` stub 内容
- `useQuery(['me', 'consumptions', user.id], () => fetch /api/v1/me/consumptions)`
- 列表按 `consumed_at desc`,每条:
  - tool_title / type 标签(下载/调用) / consumed_at / context(pin/visit/region 链接)
  - interface 类:expand 看 mock 响应 JSON

### 中台 GA · `console/ConsumptionTab`(替换 stub,D12)
- 中台 GA 看自己工具被消费的明细(总条数 + 时间序列 + 分工具)
- 简单表格 + 按工具/时间过滤;不做复杂图表

---

## 数据 Seed(8 个工具)

| # | 主题 | type | title | binding | mock 响应特征 |
|---|---|---|---|---|---|
| 1 | V2G | document | "V2G 政策对接谈参 v1.pdf" | 全国泛地域 | — |
| 2 | V2G | interface | "V2G 政策分析" | 全国泛地域 | 按 region_code 拼"{省}V2G 政策快览 v0.1" |
| 3 | 虚拟电厂 | document | "虚拟电厂 EPC 模板.xlsx" | 全国泛地域 | — |
| 4 | 充电基础设施 | interface | "充电桩选址分析" | 全国泛地域 | 按 region_code 拼"{省}充电桩选址建议" |
| 5 | 新型储能 | document | "新型储能政策解读 v1.pdf" | 全国泛地域 | — |
| 6 | 新型储能 | interface | "储能项目可行性分析" | 全国泛地域 | 按 region_code 拼"{省}储能项目可行性报告" |
| 7 | 电力市场 | document | "电力市场拓展手册 v1.pdf" | 全国泛地域 | — |
| 8 | 电力市场 | interface | "电力交易分析" | 全国泛地域 | 按 region_code 拼"{省}电力交易市场参考" |

- 全部初始 status = `published`
- 全部 creator_id = sysadmin(临时 — 中台 GA 角色虚位时占位)
- 文档文件:用 AI 生成 1-2 页假 PDF / 假 Excel,真上 OSS,seed 时塞 file_url
- 接口工具的 `response_mapping` MVP 用统一固定 schema

---

## Out of scope(明确不做)

- ❌ D14 工具搜索 / D15 预览(P1)
- ❌ D16 全员热度榜(P2)
- ❌ D17 真接入(P2)
- ❌ D18 调用结果"采纳/弃用"区分(P2)
- ❌ D19 工具版本历史(永不做)
- ❌ D20 跨人协作编辑(P3)
- ❌ F3 我的产出 — 实质就是 ToolsTab 在 owner 视角(creator filter),不另做
- ❌ G12 决策层水印
- ❌ Audit 横切埋点(spec 2026-05-07 已划掉 G5)

---

## 工作量(估)~ 9 天

| 项 | 工作量 |
|---|---|
| 后端 4 模块 + entities + service + 单测 | 3-4 天 |
| 中台 ToolsTab 维护 UI(列表 + 创建 modal + 绑定) | 2 天 |
| 属地 visit drawer "可用工具" 区块 + F4 wire | 1.5 天 |
| OSS presigned URL 集成 | 1 天 |
| D13 region 感知 mock + fake static file serve | 0.5 天 |
| Seed(8 工具 + AI 生成假文件 + 上传)+ ConsumptionTab 替换 | 0.5 天 |
| Smoke + PR | 0.5 天 |

---

## BLOCKED 等用户提供(实施前必须)

1. OSS bucket 名 + 区域(建议香港区)
2. OSS AccessKey ID / Secret(子账号 scope 限本 bucket)
3. Bucket 读策略:**公开读** OR **私有 + 签名 URL**(本 spec 假设公开读简化设计)
4. `.env` 改动授权(加 `OSS_REGION` `OSS_BUCKET` `OSS_ACCESS_KEY_ID` `OSS_ACCESS_KEY_SECRET` 4 个变量)

未提供前 plan 可写好,但实施时阻塞 OSS 相关 task。

---

## 反推执行期 review point(不写进任务)

做完本次 demo 集给负责人讲完后,主动决策——
- 拿到岗位编制 → 继续投入 D14/D15 / D17 真接入
- 没拿到 → 砍住认账,工具池保持当前形态

**不能默认靠惯性继续做 D14/D15。** 这条放执行期口头 check,不进 plan/任务。

---

## 下一步

- [ ] 用户 review 本 spec
- [ ] 转 writing-plans skill,出 G1+G2+G8 实施 plan(预估 6-8 个任务)
