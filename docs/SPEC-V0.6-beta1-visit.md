# SPEC · V0.6 β.1 Visit 真业务

> **Status**:Design 已通过(2026-04-26 brainstorm 收口),待 writing-plans
> **基线**:`main = 6304b6a`(V0.4 c1) + PR #5(V0.5 c2)= 大盘视觉骨架
> **范围**:V0.6 β · Pin/Visit 真业务的第一块(Visit 实体 + API + 工作台 tab + 大盘真数据)
> **预估**:~1.5-2 人日
> **不在本 spec 范围**:β.2 Pin/图钉、β.3 蓝点状态机、γ K 模块、c3 政策涂层

---

## 1 · 这一轮做什么、为什么

V0.5 c2(PR #5)落地了大盘视觉骨架(R2-① 真地图 + 32 mock 散点 + 比例尺 slider + 4 色 legend),散点是 mock 假数据。

**β.1 把 mock 替换为真 Visit 数据**,同时实现工作台「拜访清单」tab 的 CRUD 能力,完成第一个端到端业务实体闭环 — **大盘从假数据变真实拜访点**(stakeholder demo 杀手锏)。

**对齐 PRD §3.3 三个 P0**:
- B1 (L446) 属地热力图渲染 — 散点密度真数据
- B2 (L447) 拜访点(红/黄/绿)— 真状态色
- B11 (L456) 拜访条目编辑 — 工作台 + 大盘抽屉双入口编辑

**不对齐**(留 V0.7+ / 其他子项):
- B11 「仅自己编辑」权限约束 — 留 V0.7 接 CASL
- B14 筛选 / B12 H5 / B15 工具级联真接 — 留 V0.7
- contact_id(K3 双轨)— 留 γ K 模块
- related_themes — 留 c3 政策主题
- 蓝点(PlanPoint)+ 状态流转 — 留 β.3
- 图钉(Pin)— 留 β.2

---

## 2 · 数据模型

### Visit 实体(`apps/api/src/entities/visit.entity.ts`,新增)

```typescript
@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn('uuid') id: string;

  // 业务字段(7)
  @Column({ type: 'date' }) visit_date: string;          // YYYY-MM-DD
  @Column() department: string;                           // 对接部门
  @Column() contact_person: string;                       // 对接人姓名
  @Column({ nullable: true }) contact_title: string;     // 对接人职务
  @Column({ type: 'text' }) outcome_summary: string;     // 产出描述
  @Column({ type: 'enum', enum: ['red', 'yellow', 'green'] }) color: 'red' | 'yellow' | 'green';
  @Column({ default: false }) follow_up: boolean;        // 是否需后续跟进

  // 地理字段(4)— 录入只填 province_code + city_name,后端从 GeoJSON 查 lng/lat
  @Column() province_code: string;                        // 110000 / 320000 / ...
  @Column() city_name: string;                            // 北京市 / 苏州市 / ...
  @Column({ type: 'float' }) lng: number;
  @Column({ type: 'float' }) lat: number;

  // 系统字段
  @Column() visitor_id: string;                           // FK to users(id)
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
```

**为什么 color 只有 red/yellow/green,没有 blue?**
PRD §3.3 L447 B2 明确「拜访点(红/黄/绿)」— blue 是 B3 蓝点(PlanPoint),属 β.3 范围,不是 Visit。

**为什么不存 region_id 外键挂 Region 表?**
V0.1 只 seed 了 35 省级 Region。本轮挂市级,但市级 Region 没建。改为 `province_code + city_name` 字符串冗余,跟 GeoJSON 直接对得上,不动 V0.1 schema。

### 共享类型(`packages/shared-types/src/visit.ts`,新增)

```typescript
export type VisitColor = 'red' | 'yellow' | 'green';

export interface Visit {
  id: string;
  visit_date: string;
  department: string;
  contact_person: string;
  contact_title: string | null;
  outcome_summary: string;
  color: VisitColor;
  follow_up: boolean;
  province_code: string;
  city_name: string;
  lng: number;
  lat: number;
  visitor_id: string;
  created_at: string;
  updated_at: string;
}

export type CreateVisitDto = Omit<Visit,
  'id' | 'lng' | 'lat' | 'visitor_id' | 'created_at' | 'updated_at'
>;

export type UpdateVisitDto = Partial<Omit<CreateVisitDto, 'province_code' | 'city_name'>>;
// 不允许改省/市:改了会动 lng/lat 影响散点位置;后续真要改让用户删了重建
```

---

## 3 · 后端 API

### 端点(`apps/api/src/visits/visits.controller.ts`,新增)

```
GET    /api/visits           列表(全部,无筛选;V0.7+ 加 B14)
GET    /api/visits/:id       单条详情
POST   /api/visits           创建(visitor_id 后端从 JWT 取)
PUT    /api/visits/:id       更新(不可改省/市)
```

**权限**:全部走 sys_admin 全权(对齐 V0.2 现状,CASL 真矩阵留 V0.7)。

**delete 不做**:审计场景下 visit 删除应该 soft delete + audit log,设计不完整,留 V0.7。

### GeoJSON 查询工具(`apps/api/src/lib/geojson-cities.ts`,新增)

启动时一次性加载 34 省 GeoJSON 到 NestJS 服务内存:

```typescript
// 数据来源:apps/web/public/geojson/provinces/*.json(c1 已就位)
// 但后端读路径需要从仓库结构反查,或者复制一份到 apps/api/data/

interface CityCenter { lng: number; lat: number }
const cityCenterMap = new Map<string, CityCenter>(); // key = `${province_code}_${city_name}`

export async function loadGeoJsonCities(): Promise<void> {
  // Promise.all fetch/读 34 省 GeoJSON,提取每个 feature 的 (parent.adcode, name, center)
  // 填充 cityCenterMap
}

export function lookupCityCenter(provinceCode: string, cityName: string): CityCenter | null {
  return cityCenterMap.get(`${provinceCode}_${cityName}`) ?? null;
}
```

**实施细节**:GeoJSON 文件目前在 `apps/web/public/geojson/`(供前端 fetch),后端要么:
- 方案 A:复制一份到 `apps/api/data/geojson/`(简单,但文件冗余)
- 方案 B:后端启动时 fetch 自己 dev 端口(不可行,启动时 web 不一定起)
- 方案 C:用 Node `fs` 读 monorepo 相对路径 `../web/public/geojson/`(简单,跨 workspace 访问 OK)
- **决策**:方案 C(monorepo 内文件复用,无冗余)

**POST/PUT 行为**:
- 收到 `province_code + city_name` → 调 `lookupCityCenter` → 自动填 `lng/lat`
- 查不到 → 400 错(前端 Cascader 应该只列存在的城市,理论上不会触发)

### Migration

`npm run migration:generate AddVisits` 生成 visits 表 migration(TypeORM,V0.1 已用)。

---

## 4 · seed 数据

### `apps/api/src/seed/seed-visits.ts`(新增)

启动时若 visits 表空,塞 **32 条 demo Visit**:

| 优先级 | 城市 | 条数 |
|---|---|---|
| 优先 8 城市 × 3 条 = 24 | 广州 / 深圳 / 北京 / 成都 / 南京 / 苏州 / 青岛 / 杭州 | 24 |
| 其他 8 城市 × 1 条 = 8 | 西安 / 武汉 / 天津 / 重庆 / 沈阳 / 济南 / 合肥 / 福州 | 8 |
| **总** | | **32** |

每条:
- `color` hash 切档:50% green / 30% yellow / 20% red(贴合业务直觉,绿最多 / 红最少最显眼)
- `visitor_id` 分散到 5 个 demo 用户(V0.2 已 seed)
- `visit_date` 随机近 90 天内
- `outcome_summary` 用 mock 模板:`「与{department}对接{theme}」`
- `lng/lat` 从 GeoJSON 查市 center(同 POST 的逻辑)

**为什么 seed 不做 E2E 测试**:demo 性质,seed 内容随时调,不是产品行为。

---

## 5 · 前端工作台「拜访清单」tab

### `apps/web/src/pages/console/Visits.tsx`(替换 V0.3 StubCard 占位)

**布局**:
- 顶部「+ 新建拜访」按钮(右上)
- AntD Table:
  - 列:**拜访日期 / 省·市 / 对接人 / outcome_summary(截 30 字)/ color tag(红黄绿)/ 操作(编辑)**
  - 默认按 `visit_date desc` 排序
  - 分页 20 条/页

**录入 / 编辑 Modal**(共用 `VisitFormModal.tsx` 组件):
- 字段(顺序):
  1. 拜访日期(DatePicker)
  2. **省下拉**(Select,固定 34 省)→ change 后触发市下拉重置
  3. **市下拉**(Select,选完省后从 GeoJSON 加载市列表)
  4. 对接部门(Input)
  5. 对接人姓名(Input)
  6. 对接人职务(Input)
  7. 产出描述(TextArea)
  8. 颜色(Radio.Group · 红/黄/绿三档)
  9. 是否需后续跟进(Switch)
- 「保存」按钮 → POST/PUT → 列表 react-query invalidate 刷新

**注意**:用 AntD `Cascader` 单控件做省+市级联也可以,但 Cascader 的 options 要预先一次性加载所有市(34 省 × 平均 13 市 = ~440 项),数据量大;两个独立 `Select` + 选省后懒加载市更轻量。

---

## 6 · 前端大盘 R2-① 改动

### `apps/web/src/components/MapCanvas.tsx`

- 删除 `import { generateScatterPoints, ... } from '@/lib/mock-heatmap'`
- 删除 `import { loadAllCities } from '@/lib/china-map'`
- 加 `import { useQuery } from '@tanstack/react-query'`
- 加 `import { type Visit, type VisitColor } from '@pop/shared-types'`
- 全国级 + 省下钻 `scatter` data 都改为读 react-query Visit 数据
- ScatterDatum 扩展:`name` 留 tooltip(`{city} · {date} · {status}`)、新增 `visitId` 字段挂 visit.id(click 拿)

```typescript
const { data: visits = [] } = useQuery({
  queryKey: ['visits'],
  queryFn: () => fetch('/api/visits').then(r => r.json()),
});

const scatter = useMemo(() =>
  visits
    // 省下钻态过滤:仅显示该省的 Visit
    .filter(v => !provinceCode || v.province_code === provinceCode)
    .map(v => ({
      value: [v.lng, v.lat, 1],
      itemStyle: { color: VISIT_COLOR[v.color] },
      name: `${v.city_name} · ${v.visit_date} · ${STATUS_LABEL[v.color]}`, // tooltip
      visitId: v.id,                                                          // click 拿
    })),
  [visits, provinceCode]);
```

- 散点 click 事件:从 `params.data.visitId` 拿(不是 `params.name`),通过新 prop `onVisitClick(visitId)` 回调向上传到 MapShell
- 删除当前的「mock-related」逻辑(loadAllCities + generateScatterPoints + featuresToSeeds)

### `apps/web/src/pages/MapShell.tsx`

- 加 state `[selectedVisitId, setSelectedVisitId] = useState<string | null>(null)`
- MapCanvas 加 prop `onVisitClick={setSelectedVisitId}`
- 右抽屉 `open={!!selectedVisitId}`,内容渲染 `<VisitDetailDrawer visitId={selectedVisitId} />`
- 左面板末行文案 `(c2 假数据 · ...)` → `(β.1 真数据 · 32 条 seed Visit)`

### 新组件:`apps/web/src/components/VisitDetailDrawer.tsx`

- props: `{ visitId: string | null; onClose: () => void }`
- 数据:`useQuery(['visit', visitId], fetch /api/visits/:id)`
- 布局:
  - **Header**:Visit 拜访日期 + color tag(红黄绿)
  - **Body** = **可编辑表单**(用户拍 · 抽屉支持编辑):
    - 7 业务字段(同 VisitFormModal,但不含省/市 — 改了会动 lng/lat 影响散点位置)
    - 「保存」按钮 → PUT /visits/:id → invalidate `['visits']` + `['visit', visitId]`
  - **底部「相关工具」section**:3 个演示文档下载按钮
    ```tsx
    <a href="/demo/policy-sample.txt" download>
      <Button icon={<DownloadOutlined />}>主线政策汇编.txt</Button>
    </a>
    ```

---

## 7 · 演示文档(`apps/web/public/demo/`,新增)

3 份占位文件:
- `policy-sample.txt` — 标题「主线政策汇编」,内容 ~50 行 mock 文字(模拟政策摘要,如「专精特新中小企业培育政策」段落)
- `briefing-sample.txt` — 标题「谈参参考」,内容 ~50 行(模拟谈话要点)
- `data-sample.txt` — 标题「地方数据整合」,内容 ~50 行(模拟数据列表)

**为什么 .txt 不 .pdf**:省 PDF 生成依赖。如果 stakeholder demo 期待更正式视觉,后续 commit 手工准备 .pdf 放同目录、改 href 即可。

**这一轮不调接口、不真生成**:`<a href download>` 直接触发浏览器下载本地静态文件。

---

## 8 · c2 mock 清理(同一 commit)

c2 (PR #5) 的 mock 模块完成历史使命,β.1 一并删:
- 删 `apps/web/src/lib/mock-heatmap.ts` 整文件
- 删 `apps/web/src/lib/china-map.ts` 中的 `loadAllCities()` 函数(只 c2 用)
- **保留** `loadChinaMap()` / `loadProvinceMap()` / `provinceNameToCode()`(地图渲染必需,β.1 仍依赖)

c2 commit message 已写明「V0.6 β 落地后此模块替换」,不算翻车。

---

## 9 · 工程细节

| 项 | 选择 | 理由 |
|---|---|---|
| Migration | `npm run migration:generate AddVisits` | V0.1 已用 TypeORM migration 流程,跟现有一致 |
| 前端数据获取 | `@tanstack/react-query`(V0.1 已装) | QueryClient 已挂在 main.tsx |
| 类型共享 | `packages/shared-types/src/visit.ts` | 跟 user.ts 同风格,前后端复用 Visit/Color/Dto |
| GeoJSON 读取 | 后端 fs 读 `../web/public/geojson/`(monorepo 相对路径) | 复用 c1 已有资产,无文件冗余 |
| 环境变量 | 无新增 | β.1 不引入新 secret |
| 测试 | 无 | demo 阶段,跟 V0.1-V0.5 不写测试一致 |

---

## 10 · 验证(end-to-end)

1. **typecheck**:`npm run typecheck --workspace=@pop/web` + `--workspace=@pop/api` 都过
2. **migration**:`npm run migration:run` 跑过,visits 表创建
3. **seed**:dev server 起,首次启动 seed 32 条 Visit
4. **后端 API**:`curl /api/visits` 返回 32 条;POST 创建 1 条新 Visit;PUT 改一条字段;详情 GET 拿到完整对象
5. **大盘 `/map/local`**:
   - 散点显示 32 个真 Visit 点(不再 mock)
   - 颜色分布:大部分绿 / 少量黄 / 极少红
   - 点击任意散点 → 右抽屉打开 + 显示该 Visit 详情 + 7 字段表单可编辑
   - 编辑后保存 → 抽屉关 + 列表 + 大盘散点同步刷新
   - 抽屉底部「相关工具」3 按钮 → 点击触发本地 .txt 下载
   - 8 优先城市(广州/深圳/北京/成都/南京/苏州/青岛/杭州)散点更密集
6. **下钻到省**(如点北京)→ 仅显示该省 Visit 散点(过滤 `province_code === '110000'`)
7. **工作台 `/console/visits`**:
   - 表格显示 32 条,默认按 visit_date desc
   - 「+ 新建拜访」→ Modal → 填表 → 保存 → 列表第一行新条目 + 大盘多一个散点
   - 列表「编辑」→ Modal prefilled → 改 outcome_summary → 保存 → 列表 + 大盘同步刷新
8. **回归**:V0.4 c1 + V0.5 c2 视觉骨架(浮玻璃左面板 / Logo / 顶栏 / ➕📌 / Slider 比例尺 / 4 色 legend / 顶栏「属地⇄政策」切换)全部不退化

---

## 11 · 工作量 + worktree

- **后端**:0.5d(entity + migration + 4 controller endpoints + GeoJSON 工具 + seed)
- **前端**:1d(Visits.tsx + VisitFormModal.tsx + VisitDetailDrawer.tsx + MapCanvas/MapShell 改造)
- **mock 清理 + 验证**:0.3d
- **总**:~1.8d

**worktree 策略**:复用当前 `claude/quirky-kapitsa-3f2faf`(PR #5 还没 merge,β.1 在其上叠 commit)。最终 β.1 单 commit 推 PR #6 → main(c2 已通过 PR #5 进 main 后再开 PR;若 PR #5 还没 merge,β.1 PR 的 base 设为 c2 commit,merge 后 rebase)。

---

## 12 · 不在本 spec 范围(留后续)

- **β.2 Pin/图钉**:Pin 实体 + 状态机 + 工作台「图钉清单」tab + 大盘 ➕📌 接真接口
- **β.3 蓝点 PlanPoint**:实体 + 状态流转(蓝→红/黄/绿)+ 大盘蓝点显示 + 录入触发 Visit create
- **γ K 模块**:GovOrg + GovContact 实体,Visit.contact_id 接入(K3 双轨)
- **c3 政策大盘涂层**:C4/C8 涂层渲染 + 色块映射公式
- **V0.7+ Visit 增强**:B14 筛选、B12 H5、B15 工具级联真接、CASL 真矩阵、delete 软删 + audit log
