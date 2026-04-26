# 政策 One Piece · 项目交接文档

> 目的：让任何一次新对话（包括新的 Claude 会话）在 5 分钟内拿到所有关键上下文，进入正式设计阶段。
> 读完后，用户通常会直接说"继续"，你就继续基于下方"下一步"推进。

---

## 1. 项目一句话

**政策 One Piece（属地政策大地图）** —— 为公司 GA（Government Affairs，政府事务）团队搭建的可视化工作平台：全国/省级热力图 + 属地拜访工作记录 + 主线政策覆盖可视化 + 图钉项目管理 + 拓展工具包。

服务对象（PRD 0.3 定稿）:
- **GA 团队**:负责人 + PMO(管理视角)、属地 GA(一线录入/用工具包/**不按行政区划硬隔离**)、中台 GA(维护政策与工具包)、系统管理员
- **公司决策层**:**非系统用户** —— 不直接使用本系统,由 GA 负责人通过线下汇报 / 导出截图服务

---

## 2. 核心约束（会影响所有决策）

### 合作方式（关键）
- 用户要求**批判性伙伴**模式：疑惑、矛盾、偏离目标、低效时 **先停下探讨，再执行**；允许否认用户。
- 不要为了听话而忽略看到的问题。发现问题 → 1-2 句陈述 + 替代建议 + 等判断。

### 开发资源
- **一个人 + AI 辅助**。任何技术选型都要最小化复杂度，用成熟方案。

### 阶段策略（当前）
- **第一阶段已完成：演示原型**（见 §4）。目的是给决策层看"形态"，让项目立项。
- **现在进入正式设计阶段**：不再是 demo，而是要规划真正的产品设计和开发路径。

### 部署与合规
- 暂未确定（内网 / 公有云 / SaaS）。一期纯前端可独立跑。
- 需要二期前决定：数据敏感度、LLM 走公司内部网关还是外部 API、政策知识库接口规范与对接负责人。

---

## 3. 产品功能全集（用户最初提出的设想）

### 3.1 地图底座
- 全国热力图，可缩放切换；点击省份下钻到省级，点外围返回全国。
- 省级→市→区三级展示。

### 3.2 属地大盘
- 属地 GA 拜访后录入：部门、对接人、产出描述、颜色分级
- **颜色语义**：
  - 🟢 绿 = 常规维护
  - 🟡 黄 = 层级提升 / 发现有价值政策信息
  - 🔴 红 = 需立即执行 / 不可控风险
  - 🔵 蓝 = 计划（未执行）
- 语音一键录入：ASR → LLM 解析为结构化字段（二期）
- 过去一周/一月表单修订：标记不完整记录，一键批量编辑

### 3.3 政策大盘
- 核心主线政策清单（左侧可勾选）
- 省级：覆盖的地市→色块，覆盖的区→点
- 全国：覆盖的省→色块，覆盖的市→点（点大小按覆盖区数量）
- 政策来源：政策知识库接口 + 中台 GA 人工维护

### 3.4 工具包
- **来源**：
  - PPT / 拜访函（中台 GA 上传）
  - 地方数据一张纸（当地合作加油站/充电桩/总用电规模，接口 + 脚本整合）
  - 拜访谈参（LLM + 政策知识库生成，二期推进）
- **重点项目图钉**（PMO 维护）：周会/月会的攻关事项；留言板记录进展；状态流转 active/done/cancelled（中止需与负责人确认）
- **总览与导航**：
  - 计划蓝点 → 工具包推送（计划发邮箱）→ 推进后点蓝点描述进展 → 蓝点变正常色
  - 按人 review 周进展 → "一周战报"生成；负责人/PMO 可看全员，个人看个人，一键生成周报正文

### 3.5 后端工作台
- 权限配置：角色 CRUD、图钉/工具箱增删权限、编辑他人数据权限
- 个人信息：昵称、头像、邮箱
- 拓展清单：按区域+时间筛选
- 历史工具包：生成记录留痕
- 工具箱配置：文档/工具上传、谈参工具接口

### 3.6 前端布局（已实现）
- 顶栏左：Logo；中：[属地大盘 | 政策大盘]；右：工作台入口、头像
- 左侧：核心主线政策清单（仅政策大盘显示）
- 中间：热力图
- 右下：➕ 新增点、📌 新增图钉（有权限者）

### 3.7 后期
- 中台 GA 功能维护深化
- 监管大盘接入
- 外包功能探讨

---

## 4. 原型已完成状态（2026-04-21 完成，04-22 完成美化）

**位置**：本仓库 `src/`(纯前端,`npm run dev` 即跑)

### 技术栈（一期实际用的）
- Vite 5 + React 18 + TypeScript
- Ant Design 5（暗色算法 + 青色主色 `#00d4ff`）
- ECharts 5 + echarts-for-react
- Zustand（状态管理）+ React Router 6
- 数据层：localStorage + mock JSON（**`src/api/` 目录预留用于二期换真实 HTTP**）
- 地图数据：34 个省 + 1 个全国，阿里 DataV GeoJSON 离线放在 `public/geojson/`

### 已实现的交互
1. **假登录**：6 个预设角色（属地 GA×2、PMO、负责人、中台 GA、决策层）
2. **地图下钻**：点省份→省级地图；"返回全国"按钮
3. **属地大盘**：彩色散点（红点用 `effectScatter` 脉动）、图钉
4. **政策大盘**：勾选政策 → 色块覆盖 + 区级散点（尺寸映射覆盖数）
5. **➕ 新增拜访**：省/市/区 Cascader + 部门 + 状态 + 颜色 + 政策多选 + 内容
6. **📌 新建图钉**：仅 PMO/负责人可见；留言板；状态流转
7. **拓展清单**：筛选（省份+时间+只看我的+不完整）、CSV 导出、一键修订提示
8. **工作台四页**：清单/成员/工具箱（二期占位）/历史（二期占位）

### 视觉风格（已定稿）
- 深蓝径向渐变底 + 青色网格线
- 玻璃拟态面板（`.glass-panel`，backdrop-filter blur）
- 青色辉光标题 `.glow-title`
- DEMO 徽章在顶栏
- 右上 **StatsPanel**（动态统计）、左下 **TopRankPanel**（热度/覆盖 TOP 排行）
- 点位、色块、按钮统一青色辉光（shadowBlur）

### 种子数据
- 8 条拜访（覆盖浙/粤/沪/苏/京等）
- 2 个图钉（深圳 V2G、杭州储能并网）
- 5 条主线政策（风光储、绿电消纳、充电下乡、新基建补贴、V2G）
- 精简版省市区坐标在 `src/mock/regions.ts`

### 关键文件速查
- 完整规划（一/二/三期）：`.claude/plans/zh-one-piece-gleaming-aurora.md`（在用户 home 目录下）
- 类型定义：`src/types/index.ts`
- 地图核心：`src/components/map/MapCanvas.tsx`
- 状态：`src/stores/{auth,map,visit,pin,policy}Store.ts`
- Dev 调试：`window.__zop.{map, visits, pins}`（可直接调 store action）

---

## 5. 一期未做、二期往后要做的

- 真实后端（Node.js/NestJS 倾向）、真登录、真权限系统
- PostgreSQL + Redis + 对象存储
- 工具包上传/下载、地方数据一张纸脚本整合
- ASR（语音录入）+ LLM（谈参生成、周报生成）
- 政策知识库接口对接
- 计划蓝点 → 邮件推送工具包 → 消费后转正常色的完整闭环
- 图钉留言 WebSocket 实时推送
- 中台 GA 政策覆盖维护界面
- 监管大盘接入、外包协作

---

## 6. 决策记录（Decision Log）

| 日期 | 决策 | 背景 |
|---|---|---|
| 2026-04-20 | 产品立项：为 GA 团队做可视化工作平台 | 用户主动提出需求 |
| 2026-04-21 | 技术栈 React + NestJS，单人+AI，演示优先 | 用户选择（AskUserQuestion） |
| 2026-04-21 | 一期不做后端，localStorage 跑原型 | 演示优先策略 |
| 2026-04-22 | 视觉风格：深色数据仪表盘 + 青色主色 | 用户贴了参考图（上海乡镇商机热力图 DEMO） |
| 2026-04-22 | 进入正式设计阶段 | 原型 + 风格已定，用于交流立项 |
| 2026-04-22 | 启动双轨 PRD 协作流程 | 主目的元学习:看 AI 无约束时的揣测边界 |
| 2026-04-22 | 用户版 PRD 第 0、1 章定稿 | 跨章 review 后删除"决策层"角色 |
| 2026-04-23 | 属地 GA 权限基线修订(1.3):不按行政区划硬隔离 | 第 2 章场景 1 暴露了 1.3 与实际组织架构(业务划分交叉)的冲突 |
| 2026-04-23 | 用户版 PRD 第 2 章场景 1(属地 GA 一天开工)定稿 | 衍生出 G14-G17 数据模型悬案 + F5 智能推荐候选 |
| 2026-04-23 | **工具包 → 工具** 术语替换(统一使用"工具",分两类:成品文档 / 调用接口)| 场景 2 暴露术语模糊 |
| 2026-04-23 | **废弃"政策档案"概念**,改用"政策主题 + 外部工具返回的覆盖清单" | 场景 2 暴露原模型与实际工作流不符 |
| 2026-04-23 | 用户版 PRD 第 2 章场景 2(中台 GA 维护工具)、场景 3(中台 GA 维护政策主题)定稿 | G14 随之关闭;衍生 G18-G21 + F6 |
| 2026-04-23 | **涂层渲染规则固化**(初稿进场景 3 脚注 s3-2):1 主题 = 1 涂层,按地图层级自动渲染,用户端不做 UI 选择 | 否决我早先的"UI 层自由切换"建议 |
| 2026-04-23 | PMO 角色弱化为"负责人的一双手",与负责人权限/场景接近 | 用户指令:PMO 实际更偏操作执行,不做独立战略判断 |
| 2026-04-23 | 用户版 PRD 第 2 章全 5 个场景定稿(场景 4 合并负责人+PMO,场景 5 系统管理员),**第 2 章完结** | 新增 G22-G24 + F7;场景 4/5 都做轻量化 |
| 2026-04-23 | 第 3 章 A 模块(地图底座)定稿 | 市/区独立底图、关注区配置明确不做;新增 A6 缩放控件 |
| 2026-04-23 | 第 3 章 B 模块(属地行动大盘)定稿 | 新增 B15 点详情页工具加载(P0);图钉完整状态机升 P0;H5 录入升 P0;衍生 G25-G27(工具级联匹配、区统称、泛地域绑定) |
| 2026-04-23 | 第 3 章 C 模块(政策方向大盘)定稿 | C5 持久化勾选状态 + MVP 单选;C8 固化点大小规则(一市覆盖区数);衍生 G28 多涂层叠加二期 |
| 2026-04-23 | **第 3 章 D-J 模块"偷懒版"完稿** | 用户授权:按 Claude 判断快速出清单;每个模块标 ⚠️ 待后续 review 迭代;项目完成后需回来重做 |
| 2026-04-23 | 第 3 章 3.末 MVP 范围总览定稿,**第 3 章完结** | 48 个 P0 功能点全景;工作量粗估 16-22 周(不含 F6 真外部接入) |
| 2026-04-23 | **第 4 章(核心数据模型)完结** | 混合版:User/Role/Region/Pin/Comment/PlanPoint/Visit/PolicyTheme/ParamTemplate/CoverageItem/Tool/DocumentTool/InterfaceTool/ToolBinding/ToolConsumptionLog/级联匹配算法 全部正式定稿;AuditLog/周观测/ExportRecord 偷懒版;兑现 13 个 G 项(G15-G27),仍余 G4/G9/G12/G13/G28 留后续章节 |
| 2026-04-23 夜 | **AI 版 sub-agent 补启动**(止损式兑现 T2) | 双轨机制本应在用户版第 2 章后 spawn,实际拖到第 4 章后才 spawn;brief 输出路径改到 worktree + 禁止清单加 `.claude/` 全目录防 MEMORY.md 泄题;产出 `docs/PRD-ai-led.md`,实体命名与用户版差异大(GovOrg/GovContact/Opportunity/Engagement 等),D4 字段命名差异已爆 |
| 2026-04-23 夜 | **第 5 章(权限矩阵)完结** | 偷懒版:5.0 编写约定(角色代号 + 符号 + 全读基线)+ 5.1 主矩阵 × 4 组(基础/属地/政策/工具)+ 5.2 状态变更权限表 + 5.3 特殊操作矩阵 + 5.4 sys_admin 覆盖原则 + F3/F4 升级路径;Comment 手动发言对 local_ga 也开放(多参与方场景);新开 H1(AuditLog 跨角色读)/H2(ExportRecord 跨角色见)/H3(Pin 中止流程化)三悬案,全部留第 7 章 |
| 2026-04-23 夜 | **第 6 章(信息架构与关键流程)完结** | 混合版:6.1-6.4 偷懒(导航树 + 角色首屏 + 页面地图 + 场景 1/3/4/5 的 mermaid 流程图,场景 2 未画指向 3 复用);6.5 色彩规则真决策定稿(属地热力:60 天窗口 × P50/P80 相对百分位 × 4 档青;图钉色深红 #c0392b;政策涂层主线青色系 / 风险红橙 #ff7043 与 F2 耦合;涂层点大小线性 4-20px 归一);6.6 C4 固化正式版 + G28 二期候选原则(6 条,MVP 不拍板);新开 I1(热力 `mode=self` 分工交叉误判)悬案,MVP 压住,留 F 类候选 |
| 2026-04-23 夜 | **第 7 章(非功能需求)完结** | 混合版:7.1 类 1 累积议题 6 项逐项收口(G12 水印+不脱敏+3 年留痕 / H1 MVP 仅 sys_admin / H2 lead 可读 pmo 的 / H3 MVP 不拦 / I1 MVP 两种 mode / 色彩软触发 3 条件);7.2 类 2 常规非功能 8 项偷懒 MVP 默认(首屏 3s / 不定 SLA / SSO / 8h 会话 / Chrome+Edge+Firefox 最新 2 版 / 5xx 1% 告警 / 数据保留 3 年软删 / RTO 4h RPO 1d);**反向修订 3 处**:B9 去"中止需发起人确认"+ 5.1.1 ExportRecord 加 lead 读 pmo + 5.2 去"前端弹框兜底" ✦;新增 F8-F12 候选 5 项入 F 池;本章不开新悬案 |
| 2026-04-23 夜 | **AI 版差异速览产出** | 主对话读完 `docs/PRD-ai-led.md`(768 行),按 D1-D8 产出 `docs/PRD-comparison-notes.md`(365 行,非正式);元学习核心观察:AI 在无约束下高概率往"常规政企 CRM + 热力图版"靠(Opportunity / Engagement / Policy 建档 / SupportRequest / Campaign / GovOrg+GovContact 关键人档案);用户版偏离 5 处(废弃政策建档、废弃中台队列、决策层非系统用户、工具体系差异化、地图元素一等交互);3 个重大角色分歧(PMO 定位 / 属地 GA 硬隔离 / 决策层是否系统用户);3 个 AI 补盲候选(Campaign 跨区域战役 / 月度报告 P1 / 字段级敏感保护);正式对比矩阵建议第 10 章完稿后做 |
| 2026-04-23 夜 | **第 8 章(外部依赖与未决项)完结** | 偷懒版:8.1 外部依赖总表(9 项,3 MVP 必需 / 2 MVP 降级用 / 4 远期 F 类);8.2 MVP 必需对接约定(SSO / 行政区划 / G13 种子数据 5 类 / 公司邮件);8.3 非 MVP 节奏(G20 外部政策分析 / F2 监管源 / IM/OA/HR/LLM);8.4 工程启动前 6 项未决项登记(SSO 协议版本 / 地图底图来源 / 邮件接入 / mock 归属 / 数据存储 / 日志落地);本章不开新悬案 |
| 2026-04-23 夜(重启 session) | **第 9 章(里程碑与分期)完结** | 偷懒版:9.1 分期总览(V0.1 内测 4 周 / V0.5 试点 8 周 / V1.0 GA 8 周 / V1.x 远期 = MVP 20 周中位;入场/出场条件登记);9.2 三期 P0 切分思路(V0.1 录入闭环 / V0.5 真后端+真权限+D 工具 / V1.0 sys_admin+H/I/J);9.3 F1-F12 进池节奏(V1.1 堆:F2/F6/F7/F8/F12/F10;V1.2+ 堆:F1/F3/F4/F5/F9/F11);9.4 工作量粗估 + 5 项风险因子;9.5 G4 / G9 关账(G4 归 F2 V1.1 同期 / G9 留 V0.5 试点窗口);本章不开新悬案 |
| 2026-04-23 夜(重启 session) | **第 10 章(术语表)完结 + 用户版 PRD 正文 11 章全部完结** 🏁 | 机械整理版:15 条词条分 5 组(业务核心 T1-T4 / 地图元素 T5-T8 / 角色定位 T9-T11 / 导出与观测 T12-T13 / 过程标识 T14-T15);10.0 展开三条收录标准(多章混淆 / 用户版重定义废弃 / 与 AI 版分歧必登);备忘箱 4 条全部兑现 + 正文补 11 条;本章不开新悬案;**下一步直接进 T4 对比矩阵(素材全部就绪)** |
| 2026-04-24 凌晨 | **T4 正式对比矩阵完结 + OB 浓缩版同步** 🏁 | T4 `docs/PRD-comparison.md` 8 节(摘要 / 8 维度矩阵 / 3 大角色分歧 / 5 处反 CRM 哲学 / AI 版补盲 / 整合方向 / 元学习 5 题候选答案 / 后续);3 大角色分歧全部保留用户版;4 处 AI 版补盲建议借鉴(F13 Campaign 跨区域战役 / F7 增强为月报 / F2 升级为广义异动 / 关键人档案 V1.0 后评估);元学习 5 题候选答案已写,**待用户填最终版**(用户选 C 路径,先 commit 占位)。OB 浓缩版 `~/Documents/Zayn Main/开发日记/2026-04-23/POP-AI版PRD-设计速读.md`(~200 行,⚡ 标记设计差异,略开发安排) |
| 2026-04-24 凌晨 | **关键人档案融入(K 模块,2026-04-24 决策)** 🆕 | T4 §5 借鉴的"GovContact 关键人档案"概念,2026-04-24 用户决定融入。**采纳变体 7 项决策**:1B GovOrg + GovContact 配套 / 2A 不做字段级保护(沿用 7.1.1 水印)/ 3B Visit 双轨关联(`contact_id` 优先 + `contact_person` 字符串兜底)/ 4 V0.5 试点(8 周可能拖到 9-10)/ 5 不做分层 tier / 6 评分作为 F13(V1.2+)/ 7 不做离职跟踪(仅 status 字段)。**跨章修订 9 处**:第 3 章新增 3.12 K 模块(K1-K6)+ 3.末 P0 全景(48 → 53);第 4 章 4.0 加节号说明 + 4.3.4 Visit 加 contact_id + 新增 4.3.6 GovOrg + GovContact + 4.8 ER 图加节点 + 4.末兑现清单加 K1/K2;第 5 章新增 5.1.5 政府端组;第 6 章 6.1 加关系档案入口 + 6.3 加 4 个页面;第 9 章 9.2 V0.5 加 K 模块 + 9.3 加 F13 + 9.4 加 K 模块塞入风险 + 9.末 兑现清单加;第 10 章 加 T16 政府端档案 + T15 候选分类加 K 类;T4 §5 关键人档案改"采纳变体" / 字段级"维持不采纳";T4 §6 整合方向更新。Campaign 跨区域战役议题待用户后续编号(F13 已被关键人评分占用) |
| 2026-04-24 | **T4 §7 元学习 5 题用户定稿补完 🏁 POP 双轨 PRD 实验完全收官** | 逐题过 + 用户自拟落盘。**5 题核心观点**:(7.1) AI 最意外的揣测不在某一条单项(决策层 / 地域 / SupportRequest),而在整个产品**形式**被 AI 默认为 CRM —— brief 第一句话要钉死产品形式边界;(7.2) Campaign 跨区域战役是真补盲(现模型仅单点实体,缺"多省同一件事"顶层容器),但**放远期不进 MVP** —— 小工具节奏优先,V1.0 真实跑出跨省高频场景再激活;(7.3) 不能让 AI 自由发挥 4 类 —— **0 产品形式边界(最根本前置)** / 1 角色职责 / 2 权限边界 / 3 核心业务哲学;(7.4) 可以让 AI 自由发挥 4 类 —— 字段/状态机 / 非功能数值默认值 / UI 文案 / 技术选型备选清单(仅输入不采用);(7.5) ROI **值但有保留(B)**,下次同类实验压到 1-2h 只做差异速览;**最大遗憾**:AI 在最小 brief 下不会给"绕开标准模板的创意",只会拟合训练分布最常见的模板(本次 = CRM);**元认识**:双轨实验真实价值是"AI 暴露我在反什么 / 原创性在哪",不是"AI 给创意我采纳"。Campaign 新 F 编号留技术架构文档阶段统一排(F13 已被 K6 占用)|
| 2026-04-24 | **技术架构文档 V0 草稿完稿(`docs/TECH-ARCH.md`,偷懒版一把出)** | 基调贴合 §7.1 "小团队工具 · 反 CRM · 单人+AI"。10 章结构:0 编写约定 / 1 前置选型 10 项(4 核心架构 + PRD §8.4 六项)/ 2 系统架构总图(C4 Context + Container mermaid)/ 3 前端(延续一期栈 + 新增 axios + TanStack Query + Zod)/ 4 后端(NestJS + TypeORM + CASL)/ 5 数据层(PostgreSQL + Redis + MinIO + PRD §4 全表映射 + K 模块)/ 6 外部集成 / 7 部署运维(docker-compose 起步)/ 8 安全(水印 / 审计 / 无字段级)/ 9 工程节奏(V0.1 4 周 / V0.5 8 周 / V1.0 8 周 周级任务)/ 10 风险 + 未决项(10 项汇总)+ 末节兑现 T4 §6 剩余 3 处借鉴(Campaign / F7 月报 / F2 异动)。**关键决策**:后端 NestJS 🔷 / DB PostgreSQL+Redis+MinIO 🔷 / ORM TypeORM 🔷 / SSO OIDC 🔷 / 部署私有云+docker-compose 🔷 / 地图沿用一期 DataV GeoJSON ✅ / H5 响应式不单独建子应用 ✅。**10 项 ⚠️ 待公司 IT / 法务拍板**才能进 V0.1 实装:部署形态 / SSO 协议 / LLM 网关 / 地图在线瓦片 / 邮件 SMTP / 数据存储位置 / 日志平台 / CI 平台 / K 模块加密密钥 / ORM 最终选型 |
| 2026-04-24 | **开发策略三拍板 · 进入正式开发** | **拍板 1 · 柔和版重头搭建**:一期 demo 代码(`src/`)整体归档到 `legacy/src/`,不直接扩展;但保留已验证的选择(Vite+React+AntD+ECharts+Zustand 栈)+ 资产(`public/geojson/`)+ 视觉 token(深色+青色 #00d4ff + 玻璃拟态)。**拍板 2 · 界面布局重新设计**:不照抄 demo 初步想法(demo 在 PRD 之前,信息架构、角色、术语多处过期),具体新布局在开发过程中按 PRD §6 + §7.1 反 CRM 基调由 AI 和用户协同拍定,不单独做"设计工具探索 + 多版对比"环节(之前讨论过 Claude Design / 羊皮纸等探索已中止,不追溯)。**拍板 3 · C 路径启动**:用 TECH-ARCH §1 的 🔷 AI 默认值先起 V0.1 Week 1 骨架(monorepo + NestJS + PostgreSQL schema + TypeORM migration),⚠️ 项后续拍板后回来改,愿意接受返工。**本次不留废料**:试探性目录 `public/demo-v2/` 已清理 |

---

## 7. 下一步（从这里继续）

**当前任务**：推进**双轨 PRD 流程**（不是继续写代码）。

### 7.1 双轨 PRD 机制(2026-04-22 启动)

规则见 `docs/dual-prd-protocol.md`。核心要点:
- 用户主导版(主对话逐项写)+ AI 主导版(一次性 spawn sub-agent 独立写)+ 对比矩阵 → 最终整合 PRD
- **主目的是元学习**(看 AI 无约束时会往哪里揣测),不是"做更好的 PRD"
- 时序强约束:**用户版至少完成第 0–2 章,才启动 AI 版**(防污染)

### 7.2 已完成
- ✅ `docs/dual-prd-protocol.md` 定稿
- ✅ `docs/PRD-ai-brief.md` 定稿(给 sub-agent 的最小输入)
- ✅ `docs/PRD-user-led.md` **第 0 章(产品愿景与边界)定稿**(2026-04-22)
- ✅ `docs/PRD-user-led.md` **第 1 章(用户角色与权限大纲)定稿**(2026-04-22 跨章 review + 2026-04-23 属地 GA 权限基线修订)
- ✅ `docs/PRD-user-led.md` **第 2 章全 5 个场景定稿**(2026-04-23):
  - 2.2 场景 1 · 属地 GA 的一天开工
  - 2.3 场景 2 · 中台 GA 维护工具
  - 2.4 场景 3 · 中台 GA 维护政策主题
  - 2.5 场景 4 · 负责人周度 review + 导出(PMO 可代操作,合并场景)
  - 2.6 场景 5 · 系统管理员日常维护
- ✅ `docs/PRD-user-led.md` **第 3 章完稿**(2026-04-23):
  - 3.0 / 3.1 编写约定 + 10 模块分组
  - 3.2-3.4 A / B / C 模块**正式定稿**
  - 3.5-3.11 D / E / F / G / H / I / J ⚠️ **偷懒版完稿**(项目完成后需回来重做)
  - 3.末 MVP 范围总览:48 个 P0 功能点 + P1 候选 + P2/P3/永不做;工作量粗估 16-22 周
- ✅ `docs/PRD-user-led.md` **第 4 章完稿**(2026-04-23,混合版):
  - 4.0 / 4.1 编写约定 + 实体分组总览
  - 4.2 基础实体:User / Role + UserRole / Region(正式);AuditLog(⚠️ 偷懒)
  - 4.3 属地实体:Pin / Comment / PlanPoint / Visit + Pin↔PlanPoint 父子关系(全部正式)
  - 4.4 政策实体:PolicyTheme / ParamTemplate / CoverageItem(正式)
  - 4.5 工具实体:Tool / DocumentTool / InterfaceTool / ToolBinding / ToolConsumptionLog / 4.5.6 级联匹配算法(正式)
  - 4.6 周观测聚合逻辑(⚠️ 偷懒)
  - 4.7 ExportRecord(⚠️ 偷懒)
  - 4.8 ER 图(mermaid)
  - 4.末 兑现 G 项清单:13 项已兑现,5 项留后续
- ✅ `docs/PRD-ai-led.md` **AI 主导版产出**(2026-04-23 夜,sub-agent 一次性产出):覆盖 0-10 章;实体命名差异大(GovOrg / GovContact / Opportunity / Engagement / Task / SupportRequest);文末附"最不确定的 5 个判断点"(PMO 真实定位 / 数据域粒度 / 机密记录 / 决策层自主使用率 / 热力图默认维度);按 §7 强约束 **用户短期内不看**,主对话先看做对比准备
- ✅ `docs/PRD-user-led.md` **第 5 章完稿**(2026-04-23 夜,偷懒版):
  - 5.0 编写约定:角色代号 + 符号 + 全读基线 + 分表思路
  - 5.1 主矩阵 × 4 组(基础 / 属地 / 政策 / 工具)
  - 5.2 状态变更权限表(Pin / PlanPoint / PolicyTheme / Tool)
  - 5.3 特殊操作矩阵(下载 / 调用 / 导出 / 校正 / 归属转移 / 分发 / 审计查看 等)
  - 5.4 sys_admin 覆盖原则 + F3/F4 升级路径
  - 5.末 兑现清单 + 新开 H1-H3 悬案(全部留第 7 章)
- ✅ `docs/PRD-user-led.md` **第 6 章完稿**(2026-04-23 夜,混合版):
  - 6.0 编写约定
  - 6.1 顶层信息架构(导航树)—— 顶栏 / 双大盘 / 工作台 / 管理后台 / 个人中心
  - 6.2 角色首屏映射(5 角色)
  - 6.3 页面地图(12 页面 + 路径示意 + 核心跳转)
  - 6.4 关键业务流程图(场景 1 开工 / 场景 3 主题发布 / 场景 4 review+导出 / 场景 5 数据校正;场景 2 未画)
  - **6.5 双大盘色彩规则真决策定稿**:60 天窗口 / P50/P80 相对百分位分档 / 属地热力青色系 / 图钉深红 / 政策涂层主线青+风险红橙 / 点大小线性 4-20px 归一
  - 6.6 C4 固化正式版 + G28 二期叠加 6 条候选原则(MVP 单选保持)
  - 6.末 兑现清单 + 新开 I1(热力 `mode=self` 分工交叉误判)悬案,留 F 类
- ✅ `docs/PRD-user-led.md` **第 7 章完稿**(2026-04-23 夜,混合版):
  - 7.0 编写约定
  - **7.1 类 1 · 累积议题逐项收口**:
    - 7.1.1 G12 决策层服务安全(右下角半透明水印 / MVP 不脱敏 + P2 可配 / ExportRecord 3 年留痕)
    - 7.1.2 H1 AuditLog(MVP 仅 sys_admin,F8 候选)
    - 7.1.3 H2 ExportRecord(lead 可读 pmo,**反向改 5.1.1**)
    - 7.1.4 H3 Pin 中止(MVP 不拦,**反向改 B9 + 5.2**,F9 候选)
    - 7.1.5 I1 热力 `mode=self`(MVP 两种 mode,F10 候选)
    - 7.1.6 色彩公式实测回调(软触发,3 条件)
  - **7.2 类 2 · 常规非功能**(偷懒版 MVP 默认,8 项):性能 / 可用性 / 登录 / 会话 / 浏览器 / 监测告警 / 数据保留 / 灾备
  - 7.末 兑现清单 + 反向修订 3 处 + F8-F12 候选 5 项入 F 池
- ✅ `docs/PRD-comparison-notes.md` **AI 版差异速览笔记**(2026-04-23 夜,非正式):D1-D8 速览 + 3 大角色分歧 + AI 版补盲候选 3 条 + 用户版差异化 5 强项 + 正式对比矩阵建议在第 10 章完稿后做
- ✅ `docs/PRD-user-led.md` **第 8 章完稿**(2026-04-23 夜,偷懒版):
  - 8.0 编写约定
  - 8.1 外部依赖总表(9 项)
  - 8.2 MVP 必需对接约定:SSO / 行政区划 / G13 种子数据 5 类 / 公司邮件
  - 8.3 非 MVP 后续对接节奏:G20 外部政策分析(F6 真接入)/ F2 监管源 / IM+OA+HR+LLM 远期
  - 8.4 工程启动前 6 项未决项
  - 8.末 兑现清单(G13 / G20 关账)+ 无新悬案
- ✅ `docs/PRD-user-led.md` **第 9 章完稿**(2026-04-23 夜 重启 session,偷懒版):
  - 9.0 编写约定(资源前提 1 人 + AI / 不逐功能点列 / 工程排期归技术架构文档)
  - 9.1 分期总览:V0.1 内测(4 周)/ V0.5 试点(8 周)/ V1.0 GA(8 周)/ V1.x 远期;**MVP 20 周中位 + buffer 后 ~22 周日历**
  - 9.2 三期 P0 切分思路(分组逻辑 + ❌ 不做清单)
  - 9.3 F1-F12 进池节奏:**V1.1 堆** F2/F6/F7/F8/F12/F10 · **V1.2+ 堆** F1/F3/F4/F5/F9/F11
  - 9.4 工作量粗估 + 5 项风险因子(未决项拖延 / 试点反馈膨胀 / F6 schema 返工 / G4 G9 反向扩 / 资源被分流)
  - 9.5 G4 / G9 处置:G4 归 F2 V1.1 同期;G9 留 V0.5 试点反馈窗口
  - 9.末 兑现清单 + 无反向修订 + 无新悬案
- ✅ `docs/PRD-user-led.md` **第 10 章完稿 🏁**(2026-04-23 夜 重启 session,机械整理版):
  - 10.0 编写约定(展开三条收录标准:多章混淆 / 用户版重定义或废弃 / 与 AI 版分歧必登)
  - 10.1 术语表 15 条,分 5 组:
    - 一 · 业务核心(T1 工具 / T2 政策主题 / T3 覆盖清单 / T4 涂层)
    - 二 · 地图元素(T5 "点"5 种语义 + 蓝点转色 / T6 级联匹配 / T7 泛地域绑定 / T8 区统称)
    - 三 · 角色定位(T9 PMO / T10 属地 GA + 硬隔离 / T11 决策层非系统用户 —— 全部标注与 AI 版分歧)
    - 四 · 导出与观测(T12 ExportRecord + 水印 / T13 综合看板 + 三轨信号 + 周观测)
    - 五 · 过程标识(T14 分期 V0.x / T15 候选分类 F/G/H/I)
  - 10.末 兑现备忘箱 4 条 + 正文补 11 条 + 无新悬案
  - **用户版 PRD 正文 11 章全部完结**
- ✅ `docs/PRD-comparison.md` **T4 正式对比矩阵完结 🏁**(2026-04-24 凌晨):
  - 8 节结构:摘要 / 8 维度矩阵 / 3 大角色分歧 / 5 处反 CRM 哲学 / AI 版补盲 / 整合方向 / 元学习 5 题候选答案 / 后续
  - 3 大角色分歧全部保留用户版(PMO 一双手 / 不做地域硬隔离 / 决策层非系统用户)
  - 4 处 AI 版补盲借鉴:**F13 候选 Campaign 跨区域战役**(进 V1.0 后评估)/ **F7 增强为月报**(提到 V1.1)/ **F2 升级为广义异动告警**(F2 落地时扩展)/ **关键人档案 + 字段级权限**(V1.0 后用户调研触发)
  - 元学习 5 题候选答案已写
- ✅ `docs/PRD-comparison.md` **§7 元学习 5 题用户定稿补完 🏁**(2026-04-24):
  - 7.1 AI 最意外的揣测 = **产品形式边界**(AI 默认走 CRM,不是某一条具体揣测错,是整个形式被默认成政企 CRM)
  - 7.2 AI 最受启发的补盲 = **Campaign 跨区域战役**,但**定位远期,不进 MVP**(小工具节奏优先)
  - 7.3 不能让 AI 自由发挥 = **4 类**:产品形式边界(0,最根本) / 角色职责 / 权限边界 / 核心业务哲学
  - 7.4 可以让 AI 自由发挥 = **4 类**:字段/状态机 / 非功能数值默认值 / UI 文案 / 技术选型备选清单(仅输入不采用)
  - 7.5 ROI = **值但有保留(B)**,下次同类实验压到 1-2h 只做差异速览;**最大遗憾**:AI 在最小 brief 下不会给"绕开标准模板的创意",只会拟合训练分布最常见的模板(本次 = CRM);**元认识**:双轨实验真实价值是"AI 暴露我在反什么 / 原创性在哪",不是"AI 给创意我采纳"
- ✅ OB 浓缩版同步(2026-04-24 凌晨):
  - 路径 `~/Documents/Zayn Main/开发日记/2026-04-23/POP-AI版PRD-设计速读.md`(~200 行)
  - 聚焦设计层(0-6 章浓缩),⚡ 标记每处与用户版的设计差异
  - 文末附 AI 自评 5 个不确定判断点 + "给自己 6 个月后的提醒"一句话总结
  - 略掉 7/8/9/10 章(非功能 / 外部依赖 / 里程碑 / 术语表)
  - **不在 git 仓库内,不参与 commit**

### 7.3 当前进度快照(2026-04-24 晚 · 开发策略拍板后)

**POP PRD 阶段完结 🏁** + **TECH-ARCH V0 完稿 🔧** + **开发策略三拍板 · 准备进 V0.1 Week 1 🚀**

| 产物 | 状态 |
|---|---|
| 用户版 PRD 11 章 + K 模块 | ✅ 100%(`docs/PRD-user-led.md`)|
| T4 正式对比矩阵 + §7 用户定稿 | ✅ 完结(`docs/PRD-comparison.md`)|
| 技术架构文档 V0 草稿 | ✅ 完稿(`docs/TECH-ARCH.md`,10 章)|
| AI 版 PRD / 差异速览 / OB 浓缩版 | ✅ 入库 / 归档(开发阶段不再常读) |
| **开发策略三拍板** 🆕 | ✅ **柔和版重头搭建 + 界面重新设计 + C 路径用默认值先起骨架**(决策日志 2026-04-24 晚) |

**备忘箱**:**全部关闭** 🏁

**下一步动作**:**V0.1 Week 1 骨架落地**(不再等 ⚠️ 项公司拍板,用 TECH-ARCH 🔷 默认值先起,后续返工接受):
1. Monorepo 骨架(npm workspaces)
2. 一期 `src/` 整体归档 → `legacy/src/`
3. 新建 `apps/web/`(从 0 搭前端,保留视觉 token + GeoJSON 资产)
4. 新建 `apps/api/`(NestJS + TypeORM + PostgreSQL schema + seed)
5. `packages/shared-types/`(前后端共享 DTO / enum)

### 7.4 下次 session 的 5 分钟入场路径

**Step 1 · 读本 HANDOFF.md**(本文件)—— 当前状态 + 协作规则
**Step 2 · 读 `docs/TECH-ARCH.md`**(技术架构 V0 草稿)—— 工程启动前的全部选型 + 10 项 ⚠️ 待公司拍板清单
**Step 3 · 按需读 `docs/PRD-user-led.md` 任意章节** —— 需求规格源
**Step 4 · 按需读 `docs/PRD-comparison.md`** —— T4 对比矩阵 + §7 元学习 5 题用户定稿
**Step 5 · 不必再读**:`PRD-ai-led.md` / `PRD-comparison-notes.md` / `dual-prd-protocol.md`(除非用户明确问)

### 7.5 下次 session 的入场话术(Claude 的开场)

读完后,先一句话复述:**"POP PRD 全结 + TECH-ARCH V0 完稿 + 开发策略三拍板(柔和版重头搭建 / 界面重新设计 / C 路径 🔷 默认值起骨架)。下一步:V0.1 Week 1 monorepo + NestJS + PostgreSQL schema 落地。"**

然后问用户:**"继续 V0.1 Week 1 骨架落地吗?从 legacy 归档开始,还是你想先调整哪个拍板?"**

### 7.6 V0.1 开发阶段(进行中)

**🚀 开发策略三拍板(2026-04-24 晚):**
1. **柔和版重头搭建** — `src/` → `legacy/src/` 归档;`apps/web/` 新建;保留视觉 token + GeoJSON 资产 + 技术栈选型
2. **界面布局重新设计** — 不照抄 demo(demo 在 PRD 之前,多处术语/角色过期);新布局在开发中按 PRD §6 协同拍定
3. **C 路径 🔷 默认值先起骨架** — 不等公司 IT / 法务拍板 ⚠️ 10 项,返工接受

**V0.1 Week 1 落地清单(当前任务):**
```
1. monorepo 骨架(npm workspaces)
   ├── apps/web/             [新建] 前端从 0 搭
   ├── apps/api/             [新建] NestJS
   ├── packages/shared-types/[新建] 前后端共享
   ├── public/geojson/       [沿用] 地图资产
   └── legacy/src/           [归档] 一期 demo 代码(只读参考)

2. apps/api 脚手架
   ├── NestJS 10 + TypeScript + Node 20
   ├── TypeORM + PostgreSQL schema(PRD §4 全表)
   ├── 假 SSO 登录 + JWT(MVP fallback,V0.5 前换真 OIDC)
   └── 基础 CRUD(Visit / Pin / PlanPoint / Comment)

3. apps/web 脚手架
   ├── Vite + React + TS + AntD 5(暗色算法保留)+ ECharts 5 + Zustand
   ├── 视觉 token 抽出 `tokens.ts`(色值 / 间距 / 玻璃拟态)
   ├── 路由骨架(对齐 PRD §6 页面地图)
   └── axios + TanStack Query 替换一期 localStorage

4. docker-compose.yml(local 开发环境)
   └── postgres + redis + minio
```

**⚠️ 仍待公司 IT / 法务拍板**(V0.1 后到 V0.5 前必须拍完,否则 V0.5 进不去):
部署形态 / SSO 协议 / LLM 网关 / 邮件 SMTP / 数据存储位置 / 日志平台 / CI 平台 / K 模块加密密钥 / 在线瓦片 / ORM 最终锁

**♻️ PRD 偷懒章节**:第 3 章 D-J / 第 4 章 4.6-4.7 / 第 5-9 章偷懒版 —— 开发中按需回炉,不集中回炉

---

### 7.6.进度快照 · V0.1 Week 1 ✅ + V0.2 起步 ✅(2026-04-24 晚 · 单 session 连续 3 轮)

| 里程碑 | 状态 | commit | 内容摘要 |
|---|---|---|---|
| Week 1 前半段 · monorepo 骨架 | ✅ | `38a7d13` | npm workspaces + legacy 归档 + apps/api(NestJS 10 脚手架)+ apps/web(Vite/React/AntD 暗色)+ packages/shared-types + docker-compose.yml(未启动) |
| Week 1 后半段 · 数据层 | ✅ | `5d077e5` | TypeORM 0.3 + User/UserRole/Region entities + Migration 0001 init schema + Migration 0002 seed 35 regions(国家 + 34 省级)+ /regions API + 文档 bug 修复(shared-types `hq_ga`→`central_ga` + TECH-ARCH §5.1 删 `roles`/`users.role`/`users.region_default`) |
| V0.2 起步 · auth 闭环 | ✅ | `49742a5` | fake SSO(无密码 username)+ JWT(HS256 7d)+ JwtStrategy + 全局 JwtAuthGuard + @Public/@CurrentUser + CASL 骨架(sys_admin manage all 占位)+ Migration 0003 seed 5 demo 用户(每角色 1 个)+ 前端 axios 拦截器 + zustand persist + Login 页(sysadmin 置顶全权限)+ ProtectedRoute + Dashboard · 冒烟 12 场景全通 |

**开发期基础设施(偏离 TECH-ARCH,本地折中)**
- 原计划 docker-compose.yml(postgres 15 + redis 7 + minio),本轮未用(Docker 未装)
- 改为 `brew install postgresql@15` 原生跑,redis/minio 跟业务实体一起再装
- `.env` 本地有(不进 git),`.env.example` 在 git 里作为样板

**关键决策日志(2026-04-24 晚,Week 1 → Week 2 起步期间的批判性伙伴对齐)**
- `role_code` 源真相是 PRD §4.2.2(`central_ga`)· TECH-ARCH V0 草稿里 `hq_ga` 是 Claude 自己错,已改
- `users.region_default` / `roles` 表 / `users.role` 冗余 —— TECH-ARCH §5.1 超出 PRD 的设计,全删(PRD 没有,不凭空加)
- Region 用 6 位国标 `code` 作 PK 是 UUID v7 规则的例外(`parent_code` 自引用语义依赖)
- MVP 严格单角色(PRD §4.2.2):`user_roles.user_id` unique constraint DB 层 enforce
- JWT CASL 当前占位逻辑:sys_admin `manage all`,其他 4 角色 `read all` —— 真写权限随 Pin/Visit 实体逐步加,防规则腐烂
- Login 页 sysadmin 置顶标"全权限" —— 开发期跑通业务优先入口(a 方案,2026-04-24 · PRD 角色体系不动)

### 7.7 新机器接手 · 5 分钟上手清单(2026-04-24 晚,用户切新电脑)

**前提**:macOS,已装 Homebrew + Node 20+(本 session 用 Node 25 也 OK)+ git。

```bash
# 1. 克隆 + 进项目
git clone <repo-url> "policy map" && cd "policy map"

# 2. 装 postgres 15(如已装跳过)
brew install postgresql@15
brew services start postgresql@15

# 3. 建 pop 用户 + pop 库(用 Homebrew 默认超级用户 didi 或你的 macOS 用户名)
/opt/homebrew/opt/postgresql@15/bin/psql -d postgres <<EOF
CREATE USER pop WITH PASSWORD 'pop_dev_password' SUPERUSER;
CREATE DATABASE pop OWNER pop;
EOF

# 4. 复制 env(.env 不在 git)
cp .env.example .env
#   默认 DATABASE_URL=postgresql://pop:pop_dev_password@localhost:5432/pop,跟上面 createuser 对齐

# 5. 装依赖(根目录一把装,workspaces 自动 hoist)
npm install

# 6. 跑 migration(3 个:init schema + seed 35 regions + seed 5 demo 用户)
npm run migration:run --workspace=@pop/api
#   成功标志:3 条 "Migration XXX has been executed successfully."

# 7. 起后端(终端 A)
npm run dev:api   # http://localhost:3001/api/v1

# 8. 起前端(终端 B)
npm run dev:web   # http://localhost:5173
```

**冒烟验证(开浏览器 http://localhost:5173):**
- 自动跳 /login,看到 5 角色卡片
- 点"系统管理员 · 开发跑通业务入口"(置顶高亮 + 全权限 Tag)→ 跳 / Dashboard
- Dashboard 显示:用户信息 + "当前是系统管理员 · CASL manage all" 绿色 Alert + API 健康 ok + 省级 Region 34 条

**如果装 postgres 时的 Homebrew 超级用户不是 didi**:
```bash
# 用你本机的 macOS 用户名替代,比如 createuser -U <你的用户名> -s pop
whoami  # 先查
```

**`.claude/settings.local.json` 不在 git**,是 Claude Code 本机持久化数据 —— 新机器不用管。

### 7.8 双轨 PRD 实验全部交付清单(供下次 session 快速定位)

| 产出 | 路径 | 状态 |
|---|---|---|
| 第 5 章权限矩阵 | PRD-user-led.md §5 | ✅ 定稿 |
| 第 6 章信息架构 | PRD-user-led.md §6 | ✅ 定稿,含 6.5 色彩公式(60 天 / P50/P80 / 青+红橙) |
| 第 7 章非功能 | PRD-user-led.md §7 | ✅ 定稿,反向改 3 处(B9 / 5.1.1 / 5.2) |
| 第 8 章外部依赖 | PRD-user-led.md §8 | ✅ 定稿,G13 / G20 关账 |
| 第 9 章里程碑与分期 | PRD-user-led.md §9 | ✅ 定稿,F1-F12 全部进池 + G4 G9 关账 |
| 第 10 章术语表 | PRD-user-led.md §10 | ✅ 定稿 15 条,用户版正文完结 |
| **T4 正式对比矩阵 🏁** | docs/PRD-comparison.md | ✅ 完结,§5 关键人档案改"采纳变体",**§7 元学习 5 题用户定稿(2026-04-24)** |
| **K 模块融入 🆕** | PRD-user-led.md §3.12 / §4.3.6 / §5.1.5 / §6.1 / §6.3 / §9.2 / §9.3 / §10 + T4 §5/§6 | ✅ 跨章修订 9 处(2026-04-24) |
| **§7 元学习 5 题用户定稿 🏁** | docs/PRD-comparison.md §7.1-7.5 | ✅ 2026-04-24 补完(逐题过 + 用户自拟落盘) |
| **技术架构文档 V0 草稿 🔧** 🆕 | docs/TECH-ARCH.md | ✅ 2026-04-24 产出(偷懒版一把出,10 章,~530 行);**10 项 ⚠️ 待公司拍板**(§10.2 汇总) |
| OB 浓缩版(开发日记) | ~/Documents/Zayn Main/开发日记/2026-04-23/POP-AI版PRD-设计速读.md | ✅ 完结(不在 git) |
| AI 版 PRD | docs/PRD-ai-led.md | ✅ 入库(sub-agent 一次性产出) |
| AI 版差异速览笔记 | docs/PRD-comparison-notes.md | ✅ 完整,**不可缩减** |
| 历史 commits | 远程 PR #1 已 merge 到 main(b8d328c);§7 定稿 commit `ec3d69e`;本次 TECH-ARCH V0 + HANDOFF 同步为新 commit | on main |

---

### 7.9 旧 Mac 接手 session 摘要(2026-04-25 凌晨)

> **背景**:用户 2026-04-24 凌晨在原 Mac 启动夜间自治(B+C 路径,Vercel 部署 + 单 Vite app),Claude 跑了 4 个 commit 在 dev/v0.1 分支。用户随后在另一台机器**重新走了完全不同的方向**(monorepo + NestJS + PostgreSQL,见 §7.6),把 dev/v0.1 那 4 个 commit 全部作废。2026-04-25 凌晨用户回到原 Mac,发出 "git线上的最新版本，接着最新版本继续开干" 指令。本节是这次接手 session 的简短摘要,新 session 入场不必读 dev/v0.1 那段历史。

**已做的清理(本 session)**

- ✅ 主目录 `git pull origin main` fast-forward 到 `db4eb21`(用户在另一台机器上的 7 个 commits 全部进 main)
- ✅ 删 `origin/dev/v0.1`(用户夜间废弃的 4 commits)
- ✅ `origin/claude/sad-kalam-a20dee` 本来就不在(只是本地 stale ref,prune 已清)
- ✅ 主目录本地 stale refs `git fetch --prune` 已清

**用户手动清理待做**(在主目录 Claude session 或终端跑)

```bash
git worktree remove .claude/worktrees/sad-kalam-a20dee
git branch -D dev/v0.1
```

理由:本 session Claude 自己在该 worktree 内,删自己会让 cwd 失效 → 留给用户主目录 session 收尾。

**这台 Mac 的环境状态**(对照 §7.7 checklist)

| Step | 项 | 状态 |
|---|---|---|
| 2 | brew install postgresql@15 | ❌ 没装 |
| 3 | createuser pop + createdb pop | ❌ 没建 |
| 4 | cp .env.example .env | ❌ 没 cp(.env.example 在,.env 不在) |
| 5 | npm install | ✅ 已跑(根 node_modules 在,workspaces 已 hoist) |
| 6 | migration:run | ❌ 没跑(依赖 postgres) |
| 7 | dev:api | ❌ 没起 |
| 8 | dev:web | ❌ 没起 |

**新 session 接手 · 第 1 件事 · postgres 环境最后一公里**

新 session 入场后,严格按 §7.7 Step 2-6 跑通,然后 §7.7 Step 7-8 起 dev:api + dev:web 验证。

**重要**:`.claude/settings.local.json`(本机持久化)目前**没有 `Bash(brew *)` / `Bash(psql *)` / `Bash(createuser *)` / `Bash(createdb *)` 许可**(早期用户明确不加 brew install,2026-04-23 凌晨决策)。新 session 启动时若让 Claude 帮跑 §7.7,**先加这 4 条许可**,或 Claude 全程只给命令不执行,由用户手动跑。

**新 session 接手 · 第 2 件事 · 业务方向三选一**

环境跑通后,严格按 §9.2 三选一让用户拍(**Claude 不擅自选**):
- β · Pin + Visit(2-3 天,demo 最招眼)
- γ · K 模块 GovOrg + GovContact(2-3 天)
- δ · 协同拍首屏布局(设计优先)
- 其他

**本接手 session 没有引入任何新代码 / 新文档 / 新决策**。仅清理 + 摸底 + 写本节。dev/v0.1 那 4 个 commit 完全没进 main,文档 / 类型 / Vercel 部署相关全部跟随删除消失,**新 session 不必追溯**。

---

### 7.10 δ 重启决策(2026-04-25 晚 · 全弃 + 加护栏)

**接续 §7.9**。环境最后一公里(brew postgresql / cp .env / npm install hoist / migration:run)已跑通。随后启动 δ 协同拍首屏布局(三选一拍 δ),5 commits 全部落在 PR #2(`claude/loving-burnell-acf19d`,未 merge)上 — **2026-04-25 晚用户复盘后决定全弃**。

**为什么全弃**:R2 协同拍画 5 角色首屏 ASCII 时,把「工作台 sidebar」误画为全局 chrome(大盘视图的 ASCII 也带 sidebar),V0.3 代码继承了这个错(`<Sider>` 在所有视图都渲染),代码跑起来 review 才暴露。事后写过 R3 纠错文档 + 代码 refactor 验证,但**根因是「画 ASCII 前没先约定 chrome / view-local 边界」这个流程缺陷** — 只改代码不改流程,下次还会犯。所以整段 δ 弃,加护栏后从 §7.9 后重启。

**已执行清理(2026-04-25 晚)**:
- PR #2 close,close 评论标明原因
- 远端 `origin/claude/loving-burnell-acf19d` 删
- 本地 worktree `.claude/worktrees/loving-burnell-acf19d` + 本地分支 `claude/loving-burnell-acf19d` 删
- main 始终干净,没有任何 δ 痕迹进 main(本节是 main 上首次出现的 §7.10)

**被弃 5 commits**(供历史追溯;新 session 不必追):

| commit | 内容 |
|---|---|
| `53270bf` | feat(web) V0.3 layout 骨架 + R1/R2 协同拍落盘 + 5 stub 页 |
| `52bf747` | LLM 生图 mockup 实验样张(Gemini Nano Banana) |
| `699cbe1` | fix(web) 真简化中国 GeoJSON 占位地图 `apps/web/src/lib/china-path.ts`(δ v2 真做时可重生) |
| `3ba5764` | LLM 生图 mockup 实验样张(Imagen 4) |
| `e683b2c` | docs(handoff) 旧 §7.10 + `docs/UI-LAYOUT-V0.md`(R1/R2/R3 协同拍纪要) |

**护栏(本节核心 · 新 session 必读)**:

1. **画 ASCII 之前必须先用文字声明 chrome / view-local 边界**。每个组件(顶栏 / sidebar / 抽屉 / 模态)属于全局 chrome 还是某个 view-local 视图,写明再画。PRD §6.1 原文里「工作台 = 独立视图区域」「sidebar 是它的局部组件」是判断源头,**协同拍时核对 PRD 原文,不口头臆断**。
2. **每张 ASCII 顶角必须标视图编号**(视图 ① / ② / ③),view-local 组件**禁止**出现在不属于它的视图里。
3. **代码落地前先文字 review**:ASCII + 文字描述跟 PRD 原文交叉核对完成后再下代码。R2 → V0.3 之间没有这个核对环节,直接出问题。
4. **LLM 生图作 mockup 路径永久放弃**(已二次失败:字段瞎编 + 中文渲染失真)。真 mockup 走 dev + preview headless 截图。

**δ v2 入场动作(下次 session 第 1 件事)**:

1. 起新 worktree(/superpowers:using-git-worktrees)
2. 新建 `docs/UI-LAYOUT-V1.md`(V0 弃,从 V1 起编号)
3. UI-LAYOUT-V1.md **第一节** = 「chrome / view-local 边界声明」(对齐 PRD §6.1 原文)
4. 边界对齐后再开 R1(全局骨架 ASCII)、R2(各视图 ASCII),每张标视图编号
5. R2 完成后再下 V0.3 代码

**重启基准**:`main = 72c69ca`(§7.9 凌晨摘要)= V0.2 闭环(fake SSO + JWT + CASL + 5 角色登录)= 最高已落盘进度。

---

### 7.11 δ v2 闭环 ✅(2026-04-25 晚 · 压速度路径一次过)

**接续 §7.10**。δ v2 在新 worktree `claude/festive-swirles-f59bad`(基于 §7.10 commit `ab052c5`)上执行,4 commits 全部按护栏走通,**未触发任何 R2 v1 翻车类型**(无 view-local 越界 / 无 sidebar 跨视图 / 大盘切换正确 view-context-aware)。

**4 commits 序列**:

| commit | 内容 |
|---|---|
| `d264f02` | docs(layout) UI-LAYOUT-V1 §1 chrome / view-local 边界声明 ✅(护栏 1 落地) |
| `63cd68a` | docs(layout) §2 R1 全局骨架 ASCII(三态 α 标准 / β 大盘 / γ 登录) |
| `8c5d9f8` | docs(layout) §3 R2-①②③④ 各视图 ASCII(压速度一次过)|
| `bdc6efd` | feat(web) V0.3 layout 骨架 · 5 视图 + AppShell + ➕📌 内嵌画布(δ v2 收口) |

**§1 三个 ⚠️ 用户拍法**(2026-04-25 晚):
1. ⚠️1 全局 toast / loading / Modal → 归全局 chrome(AntD portal 默认,§1.1.b)
2. ⚠️2 sys_admin 顶栏「管理后台入口」→ 右侧独立按钮,与「工作台入口」并列
3. ⚠️3 顶栏「大盘切换」→ **view-context-aware**,仅 ① 显示;**Logo 升格为「永远进大地图(`/map/local`)」入口**(对所有角色一致) — δ v2 派生发现 · 首次实施时误读为「§6.2 角色派发」(每个角色不同),导致 sys_admin/lead/pmo/central_ga 点 Logo 永远回不到大地图,V0.3 实测后用户指出,事后修正为永远跳大地图

**R2-① 用户修订**:➕📌 浮动按钮必须 absolute 叠层贴**地图画布内部右下角**,非画布外延空隙(§3.6 第 1.5 条)。

**V0.3 代码 25 个新文件**(`bdc6efd` 详情):
- `layouts/AppShell.tsx`:全局 chrome(顶栏 + Logo 角色派发 + 大盘切换 view-context-aware + sys_admin ⚙ 入口)
- `pages/MapShell.tsx`:R2-① 大盘 layout(双子视图共用,左面板 + 画布占位 + ➕📌 absolute + 右抽屉)
- `pages/Console.tsx`:R2-② 工作台(view-local sidebar = AntD vertical Menu,按角色 visibleTabsForRole 过滤)
- `pages/Admin.tsx`:R2-③ 管理后台(sys_admin guard,非该角色重定向 homeForRole)
- `pages/Me.tsx`:R2-④ 个人中心(水平 Tabs 3 项)
- `pages/console/* × 11` + `pages/admin/* × 6`:用 `components/StubCard.tsx` 包占位
- `lib/role-home.ts` / `lib/console-tabs.ts` / `lib/admin-pages.ts`:三份配置 lib

**preview 实测验证**(sys_admin · localStorage 持久化的 V0.2 登录态,1440x900 viewport):
- `/admin/users` → 顶栏无大盘切换,左菜单 6 项,UsersPage stub 渲染 ✅
- `/map/local` → 顶栏中央 segmented [属地大盘 ⇄ 政策大盘],左面板属地态,➕📌 贴画布右下角 ✅
- `/map/policy` → 切换后左面板变「政策态 · 涂层勾选」(view-context-aware ✅)
- `/console` → 自动跳 `/console/dashboard`(sys_admin 默认),sidebar 10 项 + 关系档案父项 ✅
- `/me` → 水平 Tabs 3 项,顶栏无大盘切换 ✅

**δ v2 vs δ v1 对比**:

| 维度 | δ v1(2026-04-25 早,弃) | δ v2(2026-04-25 晚,过)|
|---|---|---|
| commits | 5 全弃(PR #2 close)| 4 全过(主分支线) |
| ASCII 前边界声明 | ❌ 无,直接画 ASCII | ✅ §1 4 节(chrome/视图/视图组件/反例) |
| R2 翻车点 | ❌ sidebar 误画为全局 chrome | ✅ §1.4 ❌1 钉死 + 实测无越界 |
| 视图编号护栏 | ❌ ASCII 无标 | ✅ R1-α/β/γ + R2-①②③④ 全标 |
| LLM 生图 mockup | ❌ 试 2 次失败 | ✅ 永久弃,走 preview headless 截图 |
| 用户拍 ⚠️ 项 | 0(没意识到) | 3(全局 portal / sys_admin 入口 / 大盘切换语义) |
| V0.3 代码翻车 | ❌ Sider 在所有视图渲染 | ✅ Sider 仅 ② / ➕📌 仅 ① / 大盘切换仅 ① |

**护栏功效复盘**:**画 ASCII 之前先文字声明边界,直接消灭了 R2 翻车类型**。Logo 升格为「回首页」入口这个发现也是 §1 边界讨论时派生出来的 — 单纯画 ASCII 不会暴露。流程缺陷比代码缺陷更值得修。

**当前 main 状态**:`main = ab052c5`(§7.10);`claude/festive-swirles-f59bad = bdc6efd`(δ v2 收口),领先 main 4 commits,可推 PR 合 main 或暂留分支。

**下一步候选**(用户拍):
- α · 推 PR 合 main(δ v2 落 main,V0.3 layout 骨架成主线)
- β · Pin + Visit 真业务(PRD §4.3,在 layout 骨架上接真功能)
- γ · K 模块 GovOrg + GovContact(PRD §4.3.6)
- δ' · 接真地图(35 regions GeoJSON,V0.4 路径,把 R2-① 画布占位换真)
- 其他

---

### 7.11.1 V0.3 实测后视觉打磨 3 轮(2026-04-26 早 · 用户拍 α 推 PR 前最后整理)

V0.3 layout 骨架(`bdc6efd`)落地后,用户在浏览器实测发现 3 个细节,依次修订并 commit。这部分是 §7.11 闭环纪要(`e4ef99a`)**之后**的增补,合入 main 时要带上。

| # | 修订 | 触发(用户原话) | commit |
|---|---|---|---|
| 1 | Logo 行为修正 — 永远跳 `/map/local`(原误读为 §6.2 角色派发,sys_admin / lead / pmo / central_ga 永远回不到大地图,违背 ⚠️3 本意) | "点左上角 logo 进入了工作台,导致我看不到大地图界面" | `8f616af` |
| 2 | R2-① 左面板从 AntD Sider(flex 挤压地图水平空间)→ **absolute 浮动玻璃面板**(地图铺满,面板浮上);➕📌 矩形长条 → **圆形图标按钮**(`shape="circle" size="large"` + Tooltip)| "左侧抽屉应该浮在地图上方,而不是挤压地图,右下角 ➕📌 调整到... 圆图标" | `61b7f94` |
| 3 | R2-① toggle **把手按钮**统一位置 — 抽出为独立 absolute 元素,**始终在面板右边缘外的垂直中间**(`left:296 top:50%`,28×64 矩形右半圆角),展开 < / 收起 >,**位置一致不挪窝** | "抽屉收缩前后展开按钮位置不一致,建议用图3的形式且保持一致" | `09a4cc5` |

**两个流程级教训**(写进护栏,供后续 session):

1. **⚠️ 拍法的口语词必须落具体**:用户说"点 logo 回首页",Claude 解读为 §6.2 角色派发,但用户本意是「永远进大地图」。**「首页」「主页」「默认」这类口语词,实施前必须落成具体路径(对哪些角色跳哪条 URL),否则会变成第二种「流程缺陷」**(δ v1 翻车是 ASCII 前没声明边界;这次是文字拍板有歧义)
2. **可切换组件的 toggle 控件应独立 absolute 定位**:展开/收起切换时控件**不应瞬移**,体感卡顿。把 toggle 抽出为独立元素(不依赖被切换组件的内部布局),让它的物理位置在两个状态下完全相同。这是 UX 标准,也避免了"内部右下"和"屏幕左上"两种位置不一致的实施

**完整 δ v2 commits 序列**(`main = ab052c5` 后,推 PR 时 9 commits 一次合):

```
56fe527 chore(dev) api-dev launch 配置(后续接手便利)
09a4cc5 fix R2-① toggle 把手统一位置 ← 增补 3
61b7f94 fix R2-① 浮玻璃 + 圆形         ← 增补 2
8f616af fix Logo 修正                  ← 增补 1
e4ef99a docs §7.11 闭环纪要(初版)     ← 当时 5 commits 收口
bdc6efd feat V0.3 layout 骨架
8c5d9f8 docs §3 R2-①②③④
63cd68a docs §2 R1 三态
d264f02 docs §1 边界声明
```

**下一步**:推 PR 合 main(本节增补完成)→ V0.4 接真地图(δ' 路径,35 regions GeoJSON,把 R2-① 画布占位换真)。

---

### 7.12 V0.5 c2 闭环 ✅(2026-04-26 · 散点视觉骨架 + 形态 3 次翻车 audit trail)

V0.4 c1 真地图(35 regions ECharts geo)落地后,c2 在地图上叠加散点图层。**形态选型 3 次翻车,8 commits 留 audit trail 后 squash 推 PR #5**:

| 版本 | ECharts 形态 | 问题 | 状态 |
|---|---|---|---|
| c2 v1 | `series.map + visualMap` (region 整块染色 / choropleth) | 用户业务问题点出:PRD §3.3 L446 B1 写明「**按拜访点密度**」,c2 应该是「点」不是「region 染色」 | ❌ revert |
| c2 v2 | `series.heatmap + blur=18` (点扩散 blob) | 糊成一片,且无颜色 — PRD §3.3 L447 B2 拜访点要红/黄/绿 | ❌ 改回 |
| c2 v3 | `series.scatter + itemStyle.color` (离散散点 + 状态色 + legend) | 同时覆盖 B1 密度 + B2 红黄绿 + B3 蓝点 | ✅ |

**用户实测调整 4 轮**(c2 v3 之上叠改):
1. 散点 radius 收紧(全国 0.2°→0.4°→ 收回 0.2°,小省点不出界)
2. 全国级粒度从「省 center 抖动 5 点」→「市级 features 每市 1 点」(loadAllCities Promise.all 34 省 GeoJSON)
3. 比例尺:roam 滚轮 → 右侧 vertical Slider 控件(60-300% step 0.1 + 复位)
4. 数据减半(keepRate 0.5)+ 蓝点每省 ≤2(maxBluePerProvince)+ 全国 size 5px / 省下钻 10px

**8 commits squash 后 PR #5 单 commit**(`6cc4a98`):
```
175a38a feat c2 v1(region 染色 · 错形态)→ revert
77cda1f Revert c2 v1
541e0a6 feat c2 v2(heatmap blob · 错粒度)
b193759 fix c2 v2 视觉打磨
2474a73 feat c2 v3(scatter + 红黄绿蓝 + legend)
bf7173a fix c2 v3 视觉打磨(地图 +20% / roam / legend 居中)
d8e30de fix c2 v3 v2(全国市级粒度 + Slider)
6cc4a98 ← squashed
```

**两个流程级教训**(写进护栏):

1. **「热力图」中文歧义**:PRD「热力图 / 全域热力对比」抽象语义,但 B1 行 L446 明确写「**按拜访点密度**」=「点扩散」,不是「region 染色」。**实施前必须把 PRD 抽象词(热力 / 涂层 / 着色)对齐到 ECharts series 类型具体枚举(`map / heatmap / scatter / lines`)再动手**。
2. **「点」也有歧义**:`series.heatmap`(模糊 blob)vs `series.scatter`(离散点)vs `series.effectScatter`(脉动)。c2 v2 选 heatmap 是因为只对齐了 B1,没追问「业务点是否携带离散语义(状态/类别)」 — 有则 scatter + itemStyle.color,无则 heatmap blur。**追到「业务点是否带颜色/类别」再选 series**。

**PR #5 当前 OPEN**,base = main,head = `claude/quirky-kapitsa-3f2faf`,含 c2 + spec/plan 文档(spec/plan 在 c2 之后追加,§7.13 同 PR)。

---

### 7.13 V0.6 β.1 Visit 真业务闭环 ✅(2026-04-26-27 · brainstorm decompose + 16-task plan + 1 token bug 修复)

c2 视觉骨架(假数据)→ β.1 把 mock 替换为真 Visit CRUD,完成第一个端到端业务实体闭环。

**brainstorm 5 轮拍板**(`docs/SPEC-V0.6-beta1-visit.md`):
- Q1 范围 → A 极简版(7 业务 + 4 地理字段 / 4 API / sys_admin 全权 / 不接 CASL 真矩阵 / 不做 H5/B14/delete)
- Q2 lng/lat 来源 → E 省+市 cascading 下拉,后端 GeoJSON 查 city center 自动填
- Q3 大盘空态 → A seed 32 条 + c2 mock 整段砍
- Q3.1 优先 8 城市 ×3 + 8 其他 ×1 = 32:广州/深圳/北京/成都/南京/苏州/青岛/杭州 + 西安/武汉/天津/重庆/沈阳/济南/合肥/福州
- Q4 大盘散点 click → B 抽屉详情 + **可编辑** + 演示文档 .txt 下载(不调接口)

**writing-plans 16 个 task**(`docs/PLAN-V0.6-beta1-visit.md`,2527 行,每 task 含完整代码 + verify + commit):
- T1 shared-types visit.dto / T2-T7 后端(entity / migration / GeoJSON 工具 / service/controller/dto/module / 注册 / seed)/ T8 API e2e curl / T9-T15 前端(演示文档 / Form Modal / VisitsTab / Detail Drawer / MapCanvas 改造 / MapShell / 删 mock)/ T16 端到端 + squash + PR

**实施 1 个翻车 + 修复**:
- T8 e2e curl 验证用 sysadmin token(direct curl)拿 32 条 OK,但**没测真前端 → 真 API 的端到端 token 流转**
- 用户浏览器实测:大盘 0 散点 / 工作台「拜访清单 (0)」/ console 401 Unauthorized
- 根因:我前端 fetch 用 `localStorage.getItem('pop_token')` 拿 token,但 V0.2 zustand persist key 是 `'pop-auth'`(value 是 JSON 包整个 state)→ 一直拿 null → `Bearer null` → 后端 JWT 拒绝
- 修:加 `apps/web/src/lib/api.ts` 的 `authHeaders()` 用 `useAuthStore.getState().accessToken`,4 处 fetch 全改

**教训**(写进护栏 · 跟 c2 形态翻车同类型):

1. **共享基础设施 idiom 必须先 grep 现有 codebase 再写**(token / persist key / fetch wrapper 这类) — 我假设 `pop_token`,实际 `pop-auth`。**fetch wrapper 这种共享基础设施,task 起步前必须 grep 一下现有 stores/ 的 persist key**。
2. **e2e 验证不能只 curl + DOM**:T8 plan 里的 curl 验证用了 hardcoded token,跳过了「前端 fetch 真实从 localStorage 拿 token 喂请求」的环节。**任何涉及 auth 的 task,e2e 验证必须从浏览器登录 → 跳页面 → 看 Network → 看数据**。

**PR #6 单 commit 推**(`17812e2`,squash 自 18 commits 含主体 + token fix):
- base = `claude/quirky-kapitsa-3f2faf`(PR #5 源)— 只显示 β.1 改动 25 files / +1393 / -400
- 等 PR #5 merge 进 main 后 PR #6 重 base 到 main
- API 4 端点 + cities 端点全 camelCase(对齐 V0.2 user.dto)

---

### 7.14 新 session 入场建议(2026-04-27 凌晨 · β.1 闭环后)

**当前 git 拓扑**:
```
PR #6 (β.1 真业务) · claude/v06-beta1-visit (17812e2)   → base claude/quirky-kapitsa-3f2faf
PR #5 (c2 + spec/plan) · claude/quirky-kapitsa-3f2faf  → base main
                       └ 6cc4a98 c2 squash → 135de1b spec → fa6d206 plan → (本 commit handoff §7.12-7.14)
main · 6304b6a (V0.4 c1 已合)
```

**两个 PR 的 review/merge 顺序**:
1. 先 review/merge PR #5(c2 视觉骨架 + spec/plan/handoff 文档)→ main
2. PR #6 自动 rebase(GitHub UI 提示),重 base 到 main → review/merge

**新 session Claude 入场 5 分钟清单**:

1. **pull main + 看 PR 状态**:`git fetch && gh pr list`
2. **环境**:postgres 已配(brew services list)/ npm install / migration:run(确保 visits 表 + 32 seed 已入库)
3. **跑双 dev**:`npm run dev:api` + `npm run dev:web` → `/login` 选 sysadmin → `/map/local` 看 32 散点
4. **方向选择**:问用户拍以下其中一个
   - **β.2 Pin/图钉**(~1.5d · spec 待写):大盘 ➕📌 接真接口 + 工作台「图钉清单」tab + Pin 状态机
   - **β.3 蓝点 PlanPoint + 状态流转**(~0.5d · 需 β.2 先):蓝→红/黄/绿 录入触发 Visit 自动创建
   - **γ K 模块**(~2d · 独立):GovOrg + GovContact CRUD,Visit.contactId K3 双轨接入
   - **c3 政策大盘涂层**(~2.5d · 等 PRD §6.5-6.6 色彩公式定稿)
   - **V0.7 工程债**:react-query global error handler / CASL 真矩阵 / B14 筛选 / delete soft + audit log

**不要做的事**(沿用 §9.3 + 新增):
- 不要在 β.2/β.3 task 起步前没 grep 共享基础设施(token / persist key / fetch helper / config 等)就假设 idiom — c2 + β.1 已经踩过 3 次形态/命名假设翻车
- 不要替用户拍 ⚠️ 项(色彩公式 / 法务/IT 项)
- 不要在 sys_admin 之外角色加 CASL 写权限(V0.7 集中接真矩阵)

**当前 worktree**:`claude/quirky-kapitsa-3f2faf`(物理路径 `.claude/worktrees/quirky-kapitsa-3f2faf`)。要做 β.2/β.3 时建议:`git checkout -b claude/v06-beta2-pin`(从当前 HEAD 起,等 PR #5/#6 merge 后 rebase 到 main)。

---

## 8. 用户个人协作偏好(覆盖所有项目,不仅本项目)

保存在用户全局记忆:
- `feedback_critical_partner.md`:要求批判性伙伴协作,允许否认用户
- `feedback_demo_first.md`:新项目起步倾向纯前端+假数据跑形态
- `project_zop.md`:本项目的 meta 信息

### 8.1 本项目 session 中累积的协作偏好(2026-04-23)

- **白话优先原则**:用户对**统计 / 工程术语**敏感(本 session 内对"相对百分位 / F 类候选 / mode=self 分工交叉 / MVP"都说过"看不懂")。**第一次解释必须打比方 + 具体例子**,不要上术语;必要时用"固定分数线 vs 按排名分档"这类具体比喻
- **反向修订三地同步**:任何跨章修订(如第 7 章 H2 改 5.1.1 / H3 改 B9 + 5.2)都必须在 PRD 正文 + 备忘箱 + HANDOFF 决策日志**三处**同步,漏一处下次就会出不一致
- **偷懒版节奏**:"草稿一次性出完 → 用户扫审 → 小改 → commit" 是高效节奏(5/6/7/8 章都走了这个);真决策点(如 6.5 色彩 / 7.1 类 1)才需要逐项问
- **每章独立 commit**:避免 mega-commit,便于 reviewer 翻阅和 rollback
- **批判性伙伴要双向**:用户反问 Claude 的隐性动机时(如"为啥你会持续建议休息"),Claude 应该诚实自剖,不是继续只说"为用户好"的版本
- **用户掌握节奏,不被 Claude 推进过度**:每章完结后给明确的"A/B/C 选项"让用户拍板,即使 Claude 倾向某条也不要擅自推进下一章

---

## 9. 给新会话 Claude 的开场建议(2026-04-24 晚 · V0.2 auth 完结后更新)

读完本文档 + `docs/TECH-ARCH.md` 后,**先确认理解,再动手**。

### 9.1 一句话确认理解(最新)

"POP PRD 全结 🏁 + TECH-ARCH V0 完稿 🔧 + **V0.1 Week 1 骨架 ✅ + V0.2 起步 auth 闭环 ✅**(三个 commit:`38a7d13` / `5d077e5` / `49742a5`)。本地 postgres 15 原生跑(非 docker),5 demo 用户 seed 齐,sysadmin 开发期跑通业务入口。下一步:业务实体(Pin/Visit / K 模块 / 首屏布局)三选一。"

### 9.2 默认动作(**新机器接手**)

**Step 1 · 按 §7.7 新机器接手 checklist 把环境搭起来**(postgres / migration / dev:api / dev:web 一把跑通)· 不要跳过验证。

**Step 2 · 问用户下一步方向**(不要擅自选):
- **路径 β · Pin + Visit**(PRD §4.3 · 一期 demo 最招眼功能,工作量 2-3 天)
- **路径 γ · K 模块 GovOrg + GovContact**(PRD §4.3.6 · 2-3 天)
- **路径 δ · 按 PRD §6 协同拍首屏布局**(设计优先,不写代码先对齐产品形态)
- 或者别的(比如用户想先补 PRD §5 CASL 真规则,或者先上 Pin 的 API 后补 UI)

### 9.3 不要做的事

- **不要用 Docker**(本机没装);基础设施走 brew 原生路线。redis / minio 要用时现装
- **不要再发起视觉设计探索 / 多版布局对比 / 设计工具推荐**(2026-04-24 晚已拍板,界面协同拍)
- **不要扩展 legacy/ 里的一期代码** — 归档只读,有用的组件"复制"到 apps/web/ 再改
- **不要替用户拍 TECH-ARCH ⚠️ 项**(公司 IT / 法务拍,V0.5 前必须完成)
- **不要在 sys_admin 之外的角色上随便加 CASL 写权限** —— PRD §5 矩阵逐字段逐角色对过才加,防占位规则腐烂
- **不要改 JWT 策略**(localStorage / 无 refresh / 单 token 7d)—— 这是 MVP fallback,V0.5 真 OIDC 时才换
- 不要缩减 `docs/PRD-comparison-notes.md`(用户明确强调不可压缩)
- 不要在 §7 用户定稿(`PRD-comparison.md §7.1-7.5`)上反向修订
- 不要擅自推进业务实体(Pin / Visit / GovOrg 等),需要用户逐阶段授权
