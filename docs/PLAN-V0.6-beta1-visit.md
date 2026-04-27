# V0.6 β.1 Visit 真业务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V0.5 c2 (PR #5) 的 mock 散点替换为真 Visit 数据,完成 β.1 Visit CRUD 端到端业务实体闭环(后端 entity + migration + 4 API + seed 32 条 + 前端工作台 tab + 大盘抽屉)。

**Architecture:** NestJS 后端新增 visits 模块(entity / service / controller / 2 个 migration),GeoJSON cities 工具加载 30 普通省 GeoJSON + 4 直辖市 hardcode 到内存 Map(供 POST/PUT 自动填 lng/lat)。React 前端在 V0.3 已挂的 `/console/visits` 路由替换 StubCard 为真表格 + 录入/编辑 Modal,大盘 MapCanvas 删 mock-heatmap 改用 react-query 拿真 Visit 数据,大盘抽屉显示可编辑详情 + 演示文档下载。c2 的 mock-heatmap.ts + loadAllCities() 整段砍。

**Tech Stack:** NestJS 10 + TypeORM 0.3(已用)/ PostgreSQL native enum / @tanstack/react-query (已用) / AntD 5 / 已有 V0.3 layout 骨架 + V0.4-V0.5 大盘视觉骨架。

**测试策略**(对齐用户偏好 + spec §9):**不写 unit test**,每 task verify 通过 typecheck + curl(后端)/ 浏览器实测(前端);跟 V0.1-V0.5 demo 阶段一致。

**Commit 策略**:每 task 独立 commit(便于失败回滚),所有 task 完成后 reset --soft 6304b6a 单一 squash commit 推 PR(对齐 c2 流程)。

---

## File Structure

**新增**(15 个文件):
- `packages/shared-types/src/dtos/visit.dto.ts` — Visit 类型 + DTO + VisitStatusColor union
- `apps/api/src/visits/entities/visit.entity.ts` — Visit TypeORM entity
- `apps/api/src/visits/dtos/create-visit.dto.ts` — class-validator DTO
- `apps/api/src/visits/dtos/update-visit.dto.ts` — class-validator DTO(限制不可改省/市)
- `apps/api/src/visits/visits.module.ts` — NestJS module
- `apps/api/src/visits/visits.controller.ts` — 4 端点 + cities 端点
- `apps/api/src/visits/visits.service.ts` — repo + GeoJSON 自动填 lng/lat
- `apps/api/src/lib/geojson-cities.ts` — Promise.all 加载 30 普通省 + 4 直辖市 hardcode
- `apps/api/src/database/migrations/1745500000003-AddVisitsTable.ts` — visits 表 + visit_color enum
- `apps/api/src/database/migrations/1745500000004-SeedDemoVisits.ts` — 32 条 demo Visit
- `apps/web/public/demo/policy-sample.txt` — 模拟「主线政策汇编」
- `apps/web/public/demo/briefing-sample.txt` — 模拟「谈参参考」
- `apps/web/public/demo/data-sample.txt` — 模拟「地方数据整合」
- `apps/web/src/components/VisitFormModal.tsx` — 录入/编辑共用 Modal
- `apps/web/src/components/VisitDetailDrawer.tsx` — 大盘抽屉(可编辑 + 演示下载)

**修改**(7 个文件):
- `packages/shared-types/src/index.ts` — re-export visit.dto
- `apps/api/src/app.module.ts` — 注册 VisitsModule
- `apps/api/src/main.ts` — bootstrap 时 await loadGeoJsonCities()
- `apps/web/src/pages/console/VisitsTab.tsx` — 替换 StubCard 为真表格
- `apps/web/src/components/MapCanvas.tsx` — 移除 mock,改 react-query
- `apps/web/src/pages/MapShell.tsx` — 加 selectedVisitId state + 抽屉 + 文案
- `apps/web/src/lib/china-map.ts` — 删 loadAllCities()

**删除**(1 个文件):
- `apps/web/src/lib/mock-heatmap.ts` — c2 占位完成历史使命

---

## Pre-flight

- [ ] **Step 1: 确认 worktree 状态**

```bash
git status                           # 应该 clean
git log --oneline -3                 # 应该 135de1b (spec) → 6cc4a98 (c2) → ...
git branch --show-current            # claude/quirky-kapitsa-3f2faf
```

- [ ] **Step 2: 确认 npm install 完整**

```bash
ls node_modules/.bin/tsc            # 应该存在
```

如不存在:`npm install`

- [ ] **Step 3: 基线 typecheck 干净**

```bash
npm run typecheck --workspace=@pop/web
npm run typecheck --workspace=@pop/api
```

预期:两个都 pass(只有 `tsc --noEmit` 输出,无错误)

---

## Task 1: shared-types · 加 visit.dto.ts

**Files:**
- Create: `packages/shared-types/src/dtos/visit.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1.1: 创建 visit.dto.ts**

Path: `packages/shared-types/src/dtos/visit.dto.ts`

```typescript
/**
 * Visit · 拜访记录(PRD §3.3 B2 + §4.3.4)
 *
 * MVP β.1 范围(SPEC-V0.6-beta1-visit §1):
 * - 7 业务字段 + 4 地理(lng/lat 后端从 GeoJSON 查 city center 自动填)
 * - color 仅 red/yellow/green(blue 是 PlanPoint 蓝点,留 β.3)
 * - 不挂 contact_id(K3 双轨,留 γ K 模块)/ related_themes(c3 政策主题)/
 *   plan_point_id(蓝点 β.3)
 */

export type VisitStatusColor = 'red' | 'yellow' | 'green';

export interface Visit {
  id: string;
  // 业务 7 字段
  visit_date: string;                  // YYYY-MM-DD
  department: string;
  contact_person: string;
  contact_title: string | null;
  outcome_summary: string;
  color: VisitStatusColor;
  follow_up: boolean;
  // 地理 4 字段
  province_code: string;
  city_name: string;
  lng: number;
  lat: number;
  // 系统
  visitor_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitInput {
  visit_date: string;
  department: string;
  contact_person: string;
  contact_title?: string;
  outcome_summary: string;
  color: VisitStatusColor;
  follow_up: boolean;
  province_code: string;
  city_name: string;
}

export interface UpdateVisitInput {
  visit_date?: string;
  department?: string;
  contact_person?: string;
  contact_title?: string | null;
  outcome_summary?: string;
  color?: VisitStatusColor;
  follow_up?: boolean;
  // 不允许改 province_code / city_name —— 改了会动 lng/lat 影响散点位置
}

export interface CityListResponse {
  data: Array<{
    province_code: string;
    province_name: string;
    cities: Array<{ name: string }>;
  }>;
}
```

- [ ] **Step 1.2: 改 index.ts 加 re-export**

Modify `packages/shared-types/src/index.ts`,追加一行:

```typescript
export * from './dtos/visit.dto';
```

完整文件应为:
```typescript
export * from './enums/role';
export * from './enums/visit-color';
export * from './dtos/health.dto';
export * from './dtos/auth.dto';
export * from './dtos/visit.dto';
```

- [ ] **Step 1.3: 验证 shared-types 编译**

```bash
npm run typecheck --workspace=@pop/shared-types
```

预期:pass

- [ ] **Step 1.4: 验证 web/api 能拿到新类型**

```bash
npm run typecheck --workspace=@pop/web
npm run typecheck --workspace=@pop/api
```

预期:两个都 pass(新类型暂无 caller,但 import 路径可解析即可)

- [ ] **Step 1.5: Commit**

```bash
git add packages/shared-types/src/dtos/visit.dto.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): 加 Visit dto + VisitStatusColor"
```

---

## Task 2: API · Visit entity

**Files:**
- Create: `apps/api/src/visits/entities/visit.entity.ts`

- [ ] **Step 2.1: 创建 entity 文件**

Path: `apps/api/src/visits/entities/visit.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { VisitStatusColor } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Visit · 拜访记录(PRD §3.3 B2)
 *
 * MVP β.1:7 业务 + 4 地理 + visitor_id FK to users + 系统时间戳
 * Color 走自定义 PG enum visit_color (red/yellow/green),
 * 跟 shared-types/enums/visit-color.ts(4 档,含 blue 占位)解耦,
 * 因为 blue 是 PlanPoint 蓝点(β.3),Visit 表不存 blue。
 */
@Entity('visits')
@Index(['visitorId'])
@Index(['provinceCode'])
@Index(['visitDate'])
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 业务字段(7)
  @Column({ type: 'date', name: 'visit_date' })
  visitDate!: string;

  @Column({ type: 'varchar', length: 128 })
  department!: string;

  @Column({ type: 'varchar', length: 64, name: 'contact_person' })
  contactPerson!: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_title' })
  contactTitle!: string | null;

  @Column({ type: 'text', name: 'outcome_summary' })
  outcomeSummary!: string;

  @Column({ type: 'enum', enum: ['red', 'yellow', 'green'], enumName: 'visit_color' })
  color!: VisitStatusColor;

  @Column({ type: 'boolean', default: false, name: 'follow_up' })
  followUp!: boolean;

  // 地理字段(4)
  @Column({ type: 'varchar', length: 6, name: 'province_code' })
  provinceCode!: string;

  @Column({ type: 'varchar', length: 64, name: 'city_name' })
  cityName!: string;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  // 系统字段
  @Column({ type: 'uuid', name: 'visitor_id' })
  visitorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visitor_id' })
  visitor?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2.2: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass(entity 文件能找到 UserEntity import + VisitStatusColor)

- [ ] **Step 2.3: Commit**

```bash
git add apps/api/src/visits/entities/visit.entity.ts
git commit -m "feat(api): 加 VisitEntity TypeORM"
```

---

## Task 3: API · AddVisitsTable migration

**Files:**
- Create: `apps/api/src/database/migrations/1745500000003-AddVisitsTable.ts`

- [ ] **Step 3.1: 创建 migration 文件**

Path: `apps/api/src/database/migrations/1745500000003-AddVisitsTable.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 加 visits 表(PRD §3.3 B2,SPEC-V0.6-beta1-visit §2)
 *
 * - visit_color enum:仅 red/yellow/green(blue 是 PlanPoint 蓝点,β.3)
 * - visits 表:7 业务 + 4 地理 + visitor_id FK + 时间戳
 * - 索引:visitor_id / province_code / visit_date(常用查询)
 */
export class AddVisitsTable1745500000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // visit_color enum
    await queryRunner.query(
      `CREATE TYPE "visit_color" AS ENUM ('red', 'yellow', 'green');`,
    );

    // visits 表
    await queryRunner.query(`
      CREATE TABLE "visits" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "visit_date" DATE NOT NULL,
        "department" VARCHAR(128) NOT NULL,
        "contact_person" VARCHAR(64) NOT NULL,
        "contact_title" VARCHAR(64) NULL,
        "outcome_summary" TEXT NOT NULL,
        "color" "visit_color" NOT NULL,
        "follow_up" BOOLEAN NOT NULL DEFAULT FALSE,
        "province_code" VARCHAR(6) NOT NULL,
        "city_name" VARCHAR(64) NOT NULL,
        "lng" DOUBLE PRECISION NOT NULL,
        "lat" DOUBLE PRECISION NOT NULL,
        "visitor_id" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_visits_visitor"
          FOREIGN KEY ("visitor_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_visits_visitor_id" ON "visits"("visitor_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_visits_province_code" ON "visits"("province_code");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_visits_visit_date" ON "visits"("visit_date");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "visits";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "visit_color";`);
  }
}
```

- [ ] **Step 3.2: 跑 migration**

```bash
npm run migration:run --workspace=@pop/api
```

预期输出含:`Migration AddVisitsTable1745500000003 has been executed successfully.`

- [ ] **Step 3.3: 验证表创建**

```bash
psql postgresql://pop:pop_dev_password@localhost:5432/pop \
  -c "\d visits" \
  -c "SELECT typname FROM pg_type WHERE typname = 'visit_color';"
```

预期:`visits` 表显示 14 列;`visit_color` enum type 存在

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/src/database/migrations/1745500000003-AddVisitsTable.ts
git commit -m "feat(api): migration AddVisitsTable + visit_color enum"
```

---

## Task 4: API · GeoJSON cities 工具

**Files:**
- Create: `apps/api/src/lib/geojson-cities.ts`

- [ ] **Step 4.1: 创建工具文件**

Path: `apps/api/src/lib/geojson-cities.ts`

```typescript
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * GeoJSON cities 内存查表(SPEC-V0.6-beta1-visit §3 + §10)
 *
 * 启动时一次性加载 30 普通省的 GeoJSON 提取地级市 center,
 * 4 直辖市(北京/上海/天津/重庆)hardcode(直辖市 GeoJSON 是区级而非市级)。
 *
 * 资产位置:apps/web/public/geojson/provinces/<adcode>.json
 *   monorepo 跨包访问,从 apps/api/src/lib 走 ../../../web/public/geojson/
 */

const GEOJSON_DIR = join(__dirname, '../../../web/public/geojson/provinces');

interface CityCenter {
  lng: number;
  lat: number;
  province_name: string;
}

interface CityFeature {
  properties: {
    name: string;
    center?: [number, number];
    centroid?: [number, number];
    parent?: { adcode: number };
  };
}

interface CityGeoJsonFC {
  features: CityFeature[];
}

const cityCenterMap = new Map<string, CityCenter>();
const provinceCityListMap = new Map<string, { province_name: string; cities: string[] }>();

/** 直辖市 hardcode(province GeoJSON 是区级,不含「北京市」整体 entry) */
const MUNICIPALITIES: Array<{ code: string; name: string; lng: number; lat: number }> = [
  { code: '110000', name: '北京市', lng: 116.41995, lat: 40.18994 },
  { code: '120000', name: '天津市', lng: 117.347043, lat: 39.288036 },
  { code: '310000', name: '上海市', lng: 121.438737, lat: 31.072559 },
  { code: '500000', name: '重庆市', lng: 107.8839, lat: 30.067297 },
];

const MUNICIPALITY_CODES = new Set(MUNICIPALITIES.map((m) => m.code));

/** 启动时调用,加载所有省的市 center */
export async function loadGeoJsonCities(): Promise<void> {
  if (cityCenterMap.size > 0) return; // idempotent

  // 1) 直辖市 hardcode
  for (const m of MUNICIPALITIES) {
    cityCenterMap.set(`${m.code}_${m.name}`, {
      lng: m.lng,
      lat: m.lat,
      province_name: m.name,
    });
    provinceCityListMap.set(m.code, {
      province_name: m.name,
      cities: [m.name],
    });
  }

  // 2) 普通省:从 GeoJSON 提取
  const files = await readdir(GEOJSON_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const code = file.replace('.json', '');
    if (MUNICIPALITY_CODES.has(code)) continue;
    if (!/^\d{6}$/.test(code)) continue;

    try {
      const raw = await readFile(join(GEOJSON_DIR, file), 'utf-8');
      const geo = JSON.parse(raw) as CityGeoJsonFC;
      const cities: string[] = [];
      let provinceName = '';

      for (const f of geo.features) {
        const center = f.properties.center ?? f.properties.centroid;
        if (!center) continue;
        const cityName = f.properties.name;
        cityCenterMap.set(`${code}_${cityName}`, {
          lng: center[0],
          lat: center[1],
          province_name: '', // 后填
        });
        cities.push(cityName);
      }

      // 反查省名:从 parent.adcode 等,但 child feature 里 parent 字段就是省。
      // 简化:从 china.json seed 出来的 province name 反查,或 fallback 到 file 名。
      // V0.1 SeedRegions migration 已 seed 省名到 regions 表 — 但这是 startup,不查 DB。
      // 兜底:用 ECharts china.json 的省名(同样硬编码或按 file 名约定)。
      // 简化方案:provinceCityListMap 的 province_name 从 SeedRegions migration 的
      // PROVINCES 数组提取(在本工具内 hardcode 一份对照表)。
      provinceName = lookupProvinceName(code);

      // 回填 cityCenterMap.province_name
      for (const cityName of cities) {
        const entry = cityCenterMap.get(`${code}_${cityName}`);
        if (entry) entry.province_name = provinceName;
      }
      provinceCityListMap.set(code, { province_name: provinceName, cities });
    } catch (err) {
      console.warn(`[geojson-cities] 加载 ${file} 失败,跳过`, err);
    }
  }
}

/** province_code → province_name(从 SeedRegions PROVINCES 数组提取的 hardcoded 表) */
const PROVINCE_NAMES: Record<string, string> = {
  '110000': '北京市', '120000': '天津市', '130000': '河北省', '140000': '山西省',
  '150000': '内蒙古自治区', '210000': '辽宁省', '220000': '吉林省', '230000': '黑龙江省',
  '310000': '上海市', '320000': '江苏省', '330000': '浙江省', '340000': '安徽省',
  '350000': '福建省', '360000': '江西省', '370000': '山东省', '410000': '河南省',
  '420000': '湖北省', '430000': '湖南省', '440000': '广东省', '450000': '广西壮族自治区',
  '460000': '海南省', '500000': '重庆市', '510000': '四川省', '520000': '贵州省',
  '530000': '云南省', '540000': '西藏自治区', '610000': '陕西省', '620000': '甘肃省',
  '630000': '青海省', '640000': '宁夏回族自治区', '650000': '新疆维吾尔自治区',
  '710000': '台湾省', '810000': '香港特别行政区', '820000': '澳门特别行政区',
};

function lookupProvinceName(code: string): string {
  return PROVINCE_NAMES[code] ?? code;
}

/** POST/PUT/seed 用:province_code + city_name → lng/lat */
export function lookupCityCenter(provinceCode: string, cityName: string): { lng: number; lat: number } | null {
  const entry = cityCenterMap.get(`${provinceCode}_${cityName}`);
  if (!entry) return null;
  return { lng: entry.lng, lat: entry.lat };
}

/** GET /api/v1/cities 用:列出所有省 + 市 */
export function listAllProvincesCities(): Array<{
  province_code: string;
  province_name: string;
  cities: Array<{ name: string }>;
}> {
  const out: Array<{
    province_code: string;
    province_name: string;
    cities: Array<{ name: string }>;
  }> = [];
  for (const [code, info] of provinceCityListMap.entries()) {
    out.push({
      province_code: code,
      province_name: info.province_name,
      cities: info.cities.map((name) => ({ name })),
    });
  }
  out.sort((a, b) => a.province_code.localeCompare(b.province_code));
  return out;
}
```

- [ ] **Step 4.2: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/src/lib/geojson-cities.ts
git commit -m "feat(api): geojson-cities 工具(30 普通省 GeoJSON + 4 直辖市 hardcode)"
```

---

## Task 5: API · Visits service / DTOs / controller / module

**Files:**
- Create: `apps/api/src/visits/dtos/create-visit.dto.ts`
- Create: `apps/api/src/visits/dtos/update-visit.dto.ts`
- Create: `apps/api/src/visits/visits.service.ts`
- Create: `apps/api/src/visits/visits.controller.ts`
- Create: `apps/api/src/visits/visits.module.ts`

- [ ] **Step 5.1: 创建 create-visit.dto.ts**

Path: `apps/api/src/visits/dtos/create-visit.dto.ts`

```typescript
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVisitDto {
  @IsDateString()
  visit_date!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  contact_person!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contact_title?: string;

  @IsString()
  @IsNotEmpty()
  outcome_summary!: string;

  @IsEnum(['red', 'yellow', 'green'])
  color!: 'red' | 'yellow' | 'green';

  @IsBoolean()
  follow_up!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  province_code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  city_name!: string;
}
```

- [ ] **Step 5.2: 创建 update-visit.dto.ts**

Path: `apps/api/src/visits/dtos/update-visit.dto.ts`

```typescript
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** 不允许改 province_code / city_name —— 改了会动 lng/lat 影响散点位置 */
export class UpdateVisitDto {
  @IsOptional() @IsDateString() visit_date?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional() @IsString() @MaxLength(64) contact_person?: string;
  @IsOptional() @IsString() @MaxLength(64) contact_title?: string | null;
  @IsOptional() @IsString() outcome_summary?: string;
  @IsOptional() @IsEnum(['red', 'yellow', 'green']) color?: 'red' | 'yellow' | 'green';
  @IsOptional() @IsBoolean() follow_up?: boolean;
}
```

- [ ] **Step 5.3: 创建 visits.service.ts**

Path: `apps/api/src/visits/visits.service.ts`

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
  ) {}

  list(): Promise<VisitEntity[]> {
    return this.repo.find({ order: { visitDate: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<VisitEntity> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`Visit ${id} not found`);
    return v;
  }

  async create(dto: CreateVisitDto, visitorId: string): Promise<VisitEntity> {
    const center = lookupCityCenter(dto.province_code, dto.city_name);
    if (!center) {
      throw new BadRequestException(
        `未知的 province_code/city_name: ${dto.province_code}/${dto.city_name}`,
      );
    }
    const visit = this.repo.create({
      visitDate: dto.visit_date,
      department: dto.department,
      contactPerson: dto.contact_person,
      contactTitle: dto.contact_title ?? null,
      outcomeSummary: dto.outcome_summary,
      color: dto.color,
      followUp: dto.follow_up,
      provinceCode: dto.province_code,
      cityName: dto.city_name,
      lng: center.lng,
      lat: center.lat,
      visitorId,
    });
    return this.repo.save(visit);
  }

  async update(id: string, dto: UpdateVisitDto): Promise<VisitEntity> {
    const v = await this.findOne(id);
    if (dto.visit_date !== undefined) v.visitDate = dto.visit_date;
    if (dto.department !== undefined) v.department = dto.department;
    if (dto.contact_person !== undefined) v.contactPerson = dto.contact_person;
    if (dto.contact_title !== undefined) v.contactTitle = dto.contact_title;
    if (dto.outcome_summary !== undefined) v.outcomeSummary = dto.outcome_summary;
    if (dto.color !== undefined) v.color = dto.color;
    if (dto.follow_up !== undefined) v.followUp = dto.follow_up;
    return this.repo.save(v);
  }
}
```

- [ ] **Step 5.4: 创建 visits.controller.ts**

Path: `apps/api/src/visits/visits.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { listAllProvincesCities } from '../lib/geojson-cities';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

/**
 * Visit API(SPEC-V0.6-beta1-visit §3)
 * 全部走 sys_admin 全权(JWT auth + CASL `sys_admin manage all`)
 */
@Controller('visits')
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  async list() {
    const data = await this.service.list();
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user.id) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return { data: await this.service.update(id, dto) };
  }
}

/** 单独 controller:GET /api/v1/cities 列出所有省+市(前端 cascading 下拉用) */
@Controller('cities')
export class CitiesController {
  @Get()
  list() {
    return { data: listAllProvincesCities() };
  }
}
```

- [ ] **Step 5.5: 创建 visits.module.ts**

Path: `apps/api/src/visits/visits.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { VisitsController, CitiesController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitEntity])],
  controllers: [VisitsController, CitiesController],
  providers: [VisitsService],
})
export class VisitsModule {}
```

- [ ] **Step 5.6: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass

注意:`AuthenticatedUser` 类型从 `@pop/shared-types` 取 — 检查是否已 export。如未,在此 task 内顺手在 `packages/shared-types/src/index.ts` 加一行 `export * from './dtos/auth.dto'` 应该已有。如还缺类型,看 V0.2 commit 加的认证类型。

- [ ] **Step 5.7: Commit**

```bash
git add apps/api/src/visits/
git commit -m "feat(api): VisitsService + Controller + DTO + Module(4 端点 + cities)"
```

---

## Task 6: API · 注册 VisitsModule + main.ts 启动加载 GeoJSON

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 6.1: app.module.ts 加 VisitsModule import**

Modify `apps/api/src/app.module.ts`:

在 import 块加:
```typescript
import { VisitsModule } from './visits/visits.module';
```

在 imports 数组追加 `VisitsModule`(在 RegionsModule 后):
```typescript
    DatabaseModule,
    CaslModule,
    UsersModule,
    AuthModule,
    HealthModule,
    RegionsModule,
    VisitsModule,
```

- [ ] **Step 6.2: main.ts 启动加载 GeoJSON**

Modify `apps/api/src/main.ts`:

在 `import { AppModule }` 下加:
```typescript
import { loadGeoJsonCities } from './lib/geojson-cities';
```

在 `bootstrap()` 函数内,`NestFactory.create` 之前加:
```typescript
  await loadGeoJsonCities();
```

完整 bootstrap() 应为:
```typescript
async function bootstrap(): Promise<void> {
  await loadGeoJsonCities();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  // ... 其余不变
}
```

- [ ] **Step 6.3: typecheck + 起 dev 验证**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass

```bash
npm run dev:api
```

预期 stdout:
- `POP API listening on http://localhost:3001/api/v1`
- 无 GeoJSON 加载错误

如有 `[geojson-cities] 加载 xxx.json 失败` warning,检查路径(从 `apps/api/src/lib/geojson-cities.ts` 到 `apps/web/public/geojson/provinces` 是 `../../../web/public/geojson/provinces`)。

启动后 Ctrl+C 停 dev server。

- [ ] **Step 6.4: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): 注册 VisitsModule + bootstrap 加载 GeoJSON cities"
```

---

## Task 7: API · SeedDemoVisits migration

**Files:**
- Create: `apps/api/src/database/migrations/1745500000004-SeedDemoVisits.ts`

- [ ] **Step 7.1: 创建 migration 文件**

Path: `apps/api/src/database/migrations/1745500000004-SeedDemoVisits.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed 32 条 demo Visit(SPEC-V0.6-beta1-visit §4)
 *
 * 优先 8 城市 × 3 条 = 24:广州/深圳/北京/成都/南京/苏州/青岛/杭州
 * 其他 8 城市 × 1 条 = 8:西安/武汉/天津/重庆/沈阳/济南/合肥/福州
 * 总 32 条
 *
 * - color hash 切档:50% green / 30% yellow / 20% red
 * - visitor_id 分散在 5 个 demo 用户(V0.2 已 seed)
 * - visit_date 随机近 90 天内
 *
 * Idempotent:跑前清空 visits 表(MVP 简化;生产 migration 不可清表)
 */

interface CitySeed {
  province_code: string;
  city_name: string;
  lng: number;
  lat: number;
  count: number;
}

const CITY_SEEDS: CitySeed[] = [
  // 优先 8 × 3 = 24
  { province_code: '440000', city_name: '广州市', lng: 113.280637, lat: 23.125178, count: 3 },
  { province_code: '440000', city_name: '深圳市', lng: 114.085947, lat: 22.547, count: 3 },
  { province_code: '110000', city_name: '北京市', lng: 116.41995, lat: 40.18994, count: 3 },
  { province_code: '510000', city_name: '成都市', lng: 104.065735, lat: 30.659462, count: 3 },
  { province_code: '320000', city_name: '南京市', lng: 118.767413, lat: 32.041544, count: 3 },
  { province_code: '320000', city_name: '苏州市', lng: 120.619585, lat: 31.299379, count: 3 },
  { province_code: '370000', city_name: '青岛市', lng: 120.355173, lat: 36.082982, count: 3 },
  { province_code: '330000', city_name: '杭州市', lng: 120.15507, lat: 30.274085, count: 3 },
  // 其他 8 × 1 = 8
  { province_code: '610000', city_name: '西安市', lng: 108.948024, lat: 34.263161, count: 1 },
  { province_code: '420000', city_name: '武汉市', lng: 114.305393, lat: 30.593099, count: 1 },
  { province_code: '120000', city_name: '天津市', lng: 117.347043, lat: 39.288036, count: 1 },
  { province_code: '500000', city_name: '重庆市', lng: 107.8839, lat: 30.067297, count: 1 },
  { province_code: '210000', city_name: '沈阳市', lng: 123.429096, lat: 41.796767, count: 1 },
  { province_code: '370000', city_name: '济南市', lng: 117.000923, lat: 36.675807, count: 1 },
  { province_code: '340000', city_name: '合肥市', lng: 117.283042, lat: 31.86119, count: 1 },
  { province_code: '350000', city_name: '福州市', lng: 119.306239, lat: 26.075302, count: 1 },
];

const DEPARTMENTS = ['经发局', '商务局', '工信局', '科技局', '发改委', '招商局', '人社局', '行政审批局'];
const THEMES = ['专精特新培育', '数字经济促进', '外贸稳增长', '人才安居补贴', '绿色低碳转型', '双招双引专项'];

function hashStr(s: string, salt: number): number {
  let h = salt >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) >>> 0) + s.charCodeAt(i);
  return h >>> 0;
}

function pickColor(seed: number): 'red' | 'yellow' | 'green' {
  const v = seed % 100;
  if (v < 50) return 'green';
  if (v < 80) return 'yellow';
  return 'red';
}

function randomDateWithin90Days(seed: number): string {
  const offsetDays = seed % 90;
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export class SeedDemoVisits1745500000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 拿 5 demo 用户 id(V0.2 SeedDemoUsers 已 seed)
    const userRows = await queryRunner.query(
      `SELECT "id" FROM "users" WHERE "username" IN ('sysadmin', 'lead', 'pmo', 'local_ga', 'central_ga') ORDER BY "username";`,
    );
    if (userRows.length === 0) {
      throw new Error('SeedDemoVisits 依赖 SeedDemoUsers,先跑前面的 migration');
    }
    const userIds: string[] = userRows.map((r: { id: string }) => r.id);

    // 清空 visits(idempotent)
    await queryRunner.query(`DELETE FROM "visits";`);

    // 生成 32 条
    let globalIdx = 0;
    for (const c of CITY_SEEDS) {
      for (let i = 0; i < c.count; i++) {
        const seed = `${c.city_name}_${i}`;
        const colorSeed = hashStr(seed, 23);
        const dateSeed = hashStr(seed, 41);
        const deptSeed = hashStr(seed, 53);
        const themeSeed = hashStr(seed, 67);
        const userSeed = hashStr(seed, 79);

        const department = DEPARTMENTS[deptSeed % DEPARTMENTS.length];
        const theme = THEMES[themeSeed % THEMES.length];
        const color = pickColor(colorSeed);
        const visitDate = randomDateWithin90Days(dateSeed);
        const visitorId = userIds[userSeed % userIds.length];
        const followUp = (hashStr(seed, 89) % 100) < 30;

        await queryRunner.query(
          `INSERT INTO "visits"
           ("visit_date", "department", "contact_person", "contact_title",
            "outcome_summary", "color", "follow_up",
            "province_code", "city_name", "lng", "lat", "visitor_id")
           VALUES ($1, $2, $3, $4, $5, $6::visit_color, $7, $8, $9, $10, $11, $12);`,
          [
            visitDate,
            department,
            `${'王李张刘陈杨黄周'[globalIdx % 8]}处长`,
            '部门负责人',
            `与${c.city_name}${department}对接「${theme}」主题落地情况`,
            color,
            followUp,
            c.province_code,
            c.city_name,
            c.lng,
            c.lat,
            visitorId,
          ],
        );
        globalIdx++;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "visits";`);
  }
}
```

- [ ] **Step 7.2: 跑 migration**

```bash
npm run migration:run --workspace=@pop/api
```

预期:`Migration SeedDemoVisits1745500000004 has been executed successfully.`

- [ ] **Step 7.3: 验证 32 条数据**

```bash
psql postgresql://pop:pop_dev_password@localhost:5432/pop -c \
  "SELECT province_code, city_name, color, COUNT(*) FROM visits GROUP BY 1,2,3 ORDER BY 1,2;"
```

预期:16 城市数据,8 个 count=3 + 8 个 count=1 = 32

- [ ] **Step 7.4: Commit**

```bash
git add apps/api/src/database/migrations/1745500000004-SeedDemoVisits.ts
git commit -m "feat(api): seed 32 条 demo Visit(8 优先城市 ×3 + 8 其他 ×1)"
```

---

## Task 8: API 端到端验证

无文件改动,仅手动 curl 验证。

- [ ] **Step 8.1: 起 dev server**

```bash
npm run dev:api
```

预期:`POP API listening on http://localhost:3001/api/v1`,无 error

- [ ] **Step 8.2: 用 sysadmin 登录拿 token**

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sysadmin"}'
```

记录 `access_token` 字段值。后续 `export TOKEN=...`。

- [ ] **Step 8.3: GET /visits 列表**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/visits | jq '.data | length'
```

预期:`32`

- [ ] **Step 8.4: GET /cities**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/cities \
  | jq '.data | length, .data[0]'
```

预期:`34`(34 省级);第一个对象包含 `province_code` / `province_name` / `cities`

- [ ] **Step 8.5: POST /visits 创建一条**

```bash
curl -X POST http://localhost:3001/api/v1/visits \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visit_date":"2026-04-26",
    "department":"测试部门",
    "contact_person":"测试人",
    "outcome_summary":"e2e 验证",
    "color":"green",
    "follow_up":false,
    "province_code":"330000",
    "city_name":"杭州市"
  }' | jq
```

预期:`data.id` 是新 UUID,`data.lng ≈ 120.155`,`data.lat ≈ 30.274`

- [ ] **Step 8.6: PUT /visits/:id 更新**

用 Step 8.5 返回的 `data.id`:

```bash
curl -X PUT http://localhost:3001/api/v1/visits/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome_summary":"e2e 已编辑"}' | jq '.data.outcome_summary'
```

预期:`"e2e 已编辑"`

- [ ] **Step 8.7: GET /visits/:id 详情**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/visits/<id> | jq '.data.outcome_summary'
```

预期:`"e2e 已编辑"`

- [ ] **Step 8.8: 清理测试数据(回到 32 条)**

```bash
psql postgresql://pop:pop_dev_password@localhost:5432/pop -c "DELETE FROM visits WHERE outcome_summary = 'e2e 已编辑';"
```

确认 `SELECT COUNT(*) FROM visits;` 回到 32。

- [ ] **Step 8.9: 停 dev server**

Ctrl+C 停 `npm run dev:api`。

- [ ] **Step 8.10: 无文件改动 → 跳过 commit**

API 端验证完成,可以进入前端 task。

---

## Task 9: Web · 演示文档 3 个 .txt

**Files:**
- Create: `apps/web/public/demo/policy-sample.txt`
- Create: `apps/web/public/demo/briefing-sample.txt`
- Create: `apps/web/public/demo/data-sample.txt`

- [ ] **Step 9.1: 创建 policy-sample.txt**

Path: `apps/web/public/demo/policy-sample.txt`

```
================================================================
主线政策汇编(演示文档 · 占位)
================================================================

文档编号:POP-DEMO-POLICY-001
版本:V0.6 β.1 演示版
更新日期:2026-04-26
来源:政策大图(POP)演示数据,非真实政策

----------------------------------------------------------------
一、专精特新中小企业培育政策
----------------------------------------------------------------

1.1 总体目标
推动中小企业向专业化、精细化、特色化、新颖化方向发展,培育一批
具有核心竞争力的「小巨人」企业。到 2026 年累计培育国家级专精
特新「小巨人」企业 10000 家。

1.2 重点支持方向
- 工业「四基」领域:核心基础零部件、关键基础材料、先进基础工艺
- 制造业短板补链强链
- 数字化、绿色化转型
- 产业链协同创新

1.3 申报条件
- 在工业和信息化领域深耕主营业务 3 年以上
- 上年度研发投入占营业收入 5% 以上
- 主营业务收入 1 亿元以上(部分行业可适当放宽)

----------------------------------------------------------------
二、数字经济促进政策
----------------------------------------------------------------

2.1 工业互联网平台培育
2.2 关键核心技术攻关
2.3 数字化车间 / 智能工厂建设
2.4 数据要素市场化配置改革

(占位内容,完整版见正式政策文件)

================================================================
本文档为政策大图(POP)V0.6 β.1 演示用占位文件
非真实政策文件,仅供 stakeholder demo 时展示「相关工具」下载交互
================================================================
```

- [ ] **Step 9.2: 创建 briefing-sample.txt**

Path: `apps/web/public/demo/briefing-sample.txt`

```
================================================================
谈参参考(演示文档 · 占位)
================================================================

文档编号:POP-DEMO-BRIEFING-001
版本:V0.6 β.1 演示版
更新日期:2026-04-26

----------------------------------------------------------------
一、谈话重点(按行业 / 政策主题分类)
----------------------------------------------------------------

【主线 1:专精特新培育】
- 关键问句:贵市目前认定的国家级 / 省级专精特新企业数量?
- 数据支撑:全省同档城市平均水平 = X 家
- 关注:认定名单公示 / 培育库管理 / 后续扶持政策衔接

【主线 2:数字经济】
- 关键问句:工业互联网平台覆盖企业数 / 上云率?
- 数据支撑:省级标杆案例 / 国家级试点
- 关注:数据基础设施 / 算力中心 / 标识解析体系

【主线 3:招商引资】
- 关键问句:本年度新签约亿元以上项目数?
- 数据支撑:项目数 / 投资额 / 转化率
- 关注:产业链补链强链 / 总部经济 / 跨境招商

----------------------------------------------------------------
二、常见问题准备
----------------------------------------------------------------

(占位内容,完整版见正式谈参文档)

================================================================
本文档为政策大图(POP)V0.6 β.1 演示用占位文件
非真实谈参,仅供 stakeholder demo 时展示「相关工具」下载交互
================================================================
```

- [ ] **Step 9.3: 创建 data-sample.txt**

Path: `apps/web/public/demo/data-sample.txt`

```
================================================================
地方数据整合(演示文档 · 占位)
================================================================

文档编号:POP-DEMO-DATA-001
版本:V0.6 β.1 演示版
更新日期:2026-04-26

----------------------------------------------------------------
一、目标地区核心数据(2026 Q1)
----------------------------------------------------------------

GDP 总量:XXXX 亿元(同比 +X.X%)
规上工业增加值:XX.X% 增长
固定资产投资:同比 +X.X%
社会消费品零售总额:XXX 亿元
进出口总额:XXX 亿元(同比 +X.X%)

----------------------------------------------------------------
二、产业结构
----------------------------------------------------------------

第一产业:XX.X%
第二产业:XX.X%(其中工业 XX.X%)
第三产业:XX.X%

战略性新兴产业:增加值占规上工业比重 XX.X%
高技术制造业:增加值同比 +XX.X%

----------------------------------------------------------------
三、重点企业 / 重点项目清单
----------------------------------------------------------------

(占位列表,完整版见数据整合系统)

================================================================
本文档为政策大图(POP)V0.6 β.1 演示用占位文件
非真实数据,仅供 stakeholder demo 时展示「相关工具」下载交互
================================================================
```

- [ ] **Step 9.4: 验证 vite 能服务这些静态文件**

```bash
npm run dev:web
```

打开浏览器访问 `http://localhost:5173/demo/policy-sample.txt`

预期:浏览器显示 .txt 内容(或触发下载)

- [ ] **Step 9.5: Commit**

```bash
git add apps/web/public/demo/
git commit -m "feat(web): 加 3 份演示文档 .txt(供大盘抽屉相关工具下载)"
```

---

## Task 10: Web · VisitFormModal 组件

**Files:**
- Create: `apps/web/src/components/VisitFormModal.tsx`

- [ ] **Step 10.1: 创建组件文件**

Path: `apps/web/src/components/VisitFormModal.tsx`

```typescript
import { useEffect, useMemo } from 'react';
import { Form, Input, Modal, Select, DatePicker, Radio, Switch, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type {
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  CityListResponse,
} from '@pop/shared-types';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑场景:传入现有 Visit;录入场景:undefined */
  editing?: Visit;
}

interface FormValues {
  visit_date: dayjs.Dayjs;
  province_code: string;
  city_name: string;
  department: string;
  contact_person: string;
  contact_title: string;
  outcome_summary: string;
  color: 'red' | 'yellow' | 'green';
  follow_up: boolean;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', {
    headers: { Authorization: `Bearer ${localStorage.getItem('pop_token')}` },
  });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function VisitFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({ label: p.province_name, value: p.province_code })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('province_code', form);
  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.province_code === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  // 录入/编辑 reset
  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue({
        visit_date: dayjs(editing.visit_date),
        province_code: editing.province_code,
        city_name: editing.city_name,
        department: editing.department,
        contact_person: editing.contact_person,
        contact_title: editing.contact_title ?? '',
        outcome_summary: editing.outcome_summary,
        color: editing.color,
        follow_up: editing.follow_up,
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({
        visit_date: dayjs(),
        color: 'green',
        follow_up: false,
      });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const token = localStorage.getItem('pop_token');
      if (editing) {
        const body: UpdateVisitInput = {
          visit_date: values.visit_date.format('YYYY-MM-DD'),
          department: values.department,
          contact_person: values.contact_person,
          contact_title: values.contact_title || null,
          outcome_summary: values.outcome_summary,
          color: values.color,
          follow_up: values.follow_up,
        };
        const r = await fetch(`/api/v1/visits/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('update fail');
      } else {
        const body: CreateVisitInput = {
          visit_date: values.visit_date.format('YYYY-MM-DD'),
          department: values.department,
          contact_person: values.contact_person,
          contact_title: values.contact_title || undefined,
          outcome_summary: values.outcome_summary,
          color: values.color,
          follow_up: values.follow_up,
          province_code: values.province_code,
          city_name: values.city_name,
        };
        const r = await fetch(`/api/v1/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('create fail');
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['visits'] });
      onClose();
    },
    onError: (err) => {
      message.error(`保存失败: ${(err as Error).message}`);
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑拜访' : '新建拜访'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => mutation.mutate(v)}
      >
        <Form.Item label="拜访日期" name="visit_date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="省" name="province_code" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing}
            onChange={() => form.setFieldsValue({ city_name: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>

        <Form.Item label="市" name="city_name" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>

        <Form.Item label="对接部门" name="department" rules={[{ required: true, max: 128 }]}>
          <Input maxLength={128} />
        </Form.Item>

        <Form.Item label="对接人" name="contact_person" rules={[{ required: true, max: 64 }]}>
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item label="对接人职务" name="contact_title">
          <Input maxLength={64} placeholder="可选" />
        </Form.Item>

        <Form.Item label="产出描述" name="outcome_summary" rules={[{ required: true }]}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="green">绿(常规)</Radio>
            <Radio value="yellow">黄(层级提升)</Radio>
            <Radio value="red">红(紧急)</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="后续跟进" name="follow_up" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 10.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass

- [ ] **Step 10.3: Commit**

```bash
git add apps/web/src/components/VisitFormModal.tsx
git commit -m "feat(web): VisitFormModal(录入 + 编辑共用 · 省+市级联)"
```

---

## Task 11: Web · VisitsTab 替换 StubCard

**Files:**
- Modify: `apps/web/src/pages/console/VisitsTab.tsx`

- [ ] **Step 11.1: 替换为完整实现**

Path: `apps/web/src/pages/console/VisitsTab.tsx`(完全重写)

```typescript
import { useState } from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@pop/shared-types';
import { VisitFormModal } from '@/components/VisitFormModal';

const { Title } = Typography;

const COLOR_TAG: Record<Visit['color'], { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'red', label: '紧急' },
};

async function fetchVisits(): Promise<{ data: Visit[] }> {
  const r = await fetch('/api/v1/visits', {
    headers: { Authorization: `Bearer ${localStorage.getItem('pop_token')}` },
  });
  if (!r.ok) throw new Error('visits fetch fail');
  return r.json();
}

export function VisitsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['visits'], queryFn: fetchVisits });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | undefined>(undefined);

  const visits = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>拜访清单 ({visits.length})</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
        >
          新建拜访
        </Button>
      </Space>

      <Table
        dataSource={visits}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '拜访日期', dataIndex: 'visit_date', width: 110, sorter: (a, b) => a.visit_date.localeCompare(b.visit_date), defaultSortOrder: 'descend' },
          { title: '省·市', width: 180, render: (_, r) => `${r.city_name}` },
          { title: '对接人', dataIndex: 'contact_person', width: 100 },
          {
            title: '产出描述',
            dataIndex: 'outcome_summary',
            ellipsis: true,
            render: (v: string) => v.length > 30 ? v.slice(0, 30) + '…' : v,
          },
          {
            title: '颜色',
            dataIndex: 'color',
            width: 100,
            render: (c: Visit['color']) => <Tag color={COLOR_TAG[c].color}>{COLOR_TAG[c].label}</Tag>,
          },
          {
            title: '操作',
            width: 80,
            render: (_, r) => (
              <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
                编辑
              </Button>
            ),
          },
        ]}
      />

      <VisitFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
```

- [ ] **Step 11.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass

- [ ] **Step 11.3: 浏览器实测**

起 dev 双服务:
```bash
npm run dev:api      # 终端 1
npm run dev:web      # 终端 2
```

访问 `http://localhost:5173/login`,sysadmin 登录(直接点 sysadmin 卡片),自动跳到 `/console/visits`(sysadmin 默认 tab 看 §dashboard,但 local_ga 是 visits;为了测,直接改地址栏到 `/console/visits`)

预期:
- 显示「拜访清单 (32)」标题
- 表格 32 行(分页 20/页,2 页)
- 默认按日期 desc 排
- 点「新建拜访」→ Modal 弹,选省→市联动 → 填表保存 → 列表刷新含新条
- 点任意行「编辑」→ Modal prefilled → 改 outcome_summary → 保存 → 列表更新

- [ ] **Step 11.4: 停 dev server**

Ctrl+C 停两个 dev。

- [ ] **Step 11.5: Commit**

```bash
git add apps/web/src/pages/console/VisitsTab.tsx
git commit -m "feat(web): VisitsTab 替换 StubCard 为真表格 + 录入 + 编辑"
```

---

## Task 12: Web · VisitDetailDrawer 组件

**Files:**
- Create: `apps/web/src/components/VisitDetailDrawer.tsx`

- [ ] **Step 12.1: 创建组件**

Path: `apps/web/src/components/VisitDetailDrawer.tsx`

```typescript
import { useEffect } from 'react';
import {
  Button, DatePicker, Divider, Drawer, Form, Input,
  Radio, Space, Spin, Switch, Tag, Typography, message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, UpdateVisitInput } from '@pop/shared-types';
import { palette } from '@/tokens';

const { Text } = Typography;
const { TextArea } = Input;

const COLOR_TAG: Record<Visit['color'], { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'red', label: '紧急' },
};

const DEMO_TOOLS = [
  { name: '主线政策汇编.txt', file: '/demo/policy-sample.txt' },
  { name: '谈参参考.txt', file: '/demo/briefing-sample.txt' },
  { name: '地方数据整合.txt', file: '/demo/data-sample.txt' },
];

interface Props {
  visitId: string | null;
  onClose: () => void;
}

interface FormValues {
  visit_date: dayjs.Dayjs;
  department: string;
  contact_person: string;
  contact_title: string;
  outcome_summary: string;
  color: Visit['color'];
  follow_up: boolean;
}

async function fetchVisit(id: string): Promise<{ data: Visit }> {
  const r = await fetch(`/api/v1/visits/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('pop_token')}` },
  });
  if (!r.ok) throw new Error('visit detail fetch fail');
  return r.json();
}

export function VisitDetailDrawer({ visitId, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => fetchVisit(visitId as string),
    enabled: !!visitId,
  });

  const visit = data?.data;

  useEffect(() => {
    if (visit) {
      form.setFieldsValue({
        visit_date: dayjs(visit.visit_date),
        department: visit.department,
        contact_person: visit.contact_person,
        contact_title: visit.contact_title ?? '',
        outcome_summary: visit.outcome_summary,
        color: visit.color,
        follow_up: visit.follow_up,
      });
    }
  }, [visit, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body: UpdateVisitInput = {
        visit_date: values.visit_date.format('YYYY-MM-DD'),
        department: values.department,
        contact_person: values.contact_person,
        contact_title: values.contact_title || null,
        outcome_summary: values.outcome_summary,
        color: values.color,
        follow_up: values.follow_up,
      };
      const r = await fetch(`/api/v1/visits/${visitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pop_token')}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('save fail');
    },
    onSuccess: () => {
      message.success('已保存');
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Drawer
      title={
        visit ? (
          <Space>
            <span>{visit.visit_date}</span>
            <Tag color={COLOR_TAG[visit.color].color}>{COLOR_TAG[visit.color].label}</Tag>
            <Text type="secondary" style={{ fontSize: 13 }}>{visit.city_name}</Text>
          </Space>
        ) : '加载中…'
      }
      placement="right"
      width={420}
      open={!!visitId}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
            保存
          </Button>
        </Space>
      }
    >
      {isLoading || !visit ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
            <Form.Item label="拜访日期" name="visit_date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="对接部门" name="department" rules={[{ required: true }]}>
              <Input maxLength={128} />
            </Form.Item>
            <Form.Item label="对接人" name="contact_person" rules={[{ required: true }]}>
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="对接人职务" name="contact_title">
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="产出描述" name="outcome_summary" rules={[{ required: true }]}>
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="green">绿</Radio>
                <Radio value="yellow">黄</Radio>
                <Radio value="red">红</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="后续跟进" name="follow_up" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Text strong style={{ color: palette.primary, fontSize: 13 }}>相关工具</Text>
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
              {DEMO_TOOLS.map((t) => (
                <a key={t.file} href={t.file} download>
                  <Button block icon={<DownloadOutlined />} style={{ textAlign: 'left' }}>
                    {t.name}
                  </Button>
                </a>
              ))}
            </Space>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              占位文档,演示用 · B15 工具级联留 V0.7
            </Text>
          </div>
        </>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 12.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass

- [ ] **Step 12.3: Commit**

```bash
git add apps/web/src/components/VisitDetailDrawer.tsx
git commit -m "feat(web): VisitDetailDrawer(可编辑详情 + 演示文档下载)"
```

---

## Task 13: Web · MapCanvas 改造(移除 mock,接 react-query)

**Files:**
- Modify: `apps/web/src/components/MapCanvas.tsx`

- [ ] **Step 13.1: 完全重写 MapCanvas.tsx**

新增 prop `onVisitClick`,移除 mock,改 react-query 拿 visits。完整文件:

```typescript
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Slider, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@pop/shared-types';
import {
  loadChinaMap,
  loadProvinceMap,
  provinceNameToCode,
} from '@/lib/china-map';
import { palette } from '@/tokens';

interface Props {
  /** 当前下钻到的省份 adcode;null / undefined = 全国视图 */
  provinceCode?: string | null;
  /** 切换下钻;null 表示回全国 */
  onProvinceChange?: (code: string | null) => void;
  /** 通用 region click 回调(下钻 / 省内点击都触发) */
  onRegionClick?: (info: {
    level: 'country' | 'province';
    code: string | null;
    name: string;
  }) => void;
  /** β.1 新增:点击 Visit 散点回调,传 visit.id */
  onVisitClick?: (visitId: string) => void;
}

interface LoadedInfo {
  key: string;
  name: string;
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_DEFAULT = 1.2;

const COLOR_HEX: Record<Visit['color'], string> = {
  red: palette.visit.red,
  yellow: palette.visit.yellow,
  green: palette.visit.green,
};
const COLOR_LABEL: Record<Visit['color'], string> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
};

const STATUS_LEGEND = [
  { color: palette.visit.red, label: '紧急' },
  { color: palette.visit.yellow, label: '层级提升' },
  { color: palette.visit.green, label: '常规' },
  { color: palette.visit.blue, label: '计划未执行(蓝点 β.3)' },
];

async function fetchVisits(): Promise<{ data: Visit[] }> {
  const r = await fetch('/api/v1/visits', {
    headers: { Authorization: `Bearer ${localStorage.getItem('pop_token')}` },
  });
  if (!r.ok) throw new Error('visits fetch fail');
  return r.json();
}

export function MapCanvas({ provinceCode, onProvinceChange, onRegionClick, onVisitClick }: Props) {
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);
  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT);

  // β.1:从 API 拿真 Visit 数据
  const { data: visitsData } = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
    staleTime: 30_000,
  });
  const visits = visitsData?.data ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setZoom(ZOOM_DEFAULT);
    const task: Promise<LoadedInfo> = provinceCode
      ? loadProvinceMap(provinceCode).then((geo) => ({
          key: `province_${provinceCode}`,
          name: geo.features[0]?.properties?.name ?? '省份',
        }))
      : loadChinaMap().then(() => ({ key: 'china', name: '中国' }));
    task
      .then((info) => { if (!cancelled) setLoaded(info); })
      .catch((err) => { console.error('[MapCanvas] geo load error', err); });
    return () => { cancelled = true; };
  }, [provinceCode]);

  const scatterData = useMemo(() =>
    visits
      .filter((v) => !provinceCode || v.province_code === provinceCode)
      .map((v) => ({
        value: [v.lng, v.lat, 1],
        itemStyle: { color: COLOR_HEX[v.color] },
        name: `${v.city_name} · ${v.visit_date} · ${COLOR_LABEL[v.color]}`,
        visitId: v.id,
      })),
    [visits, provinceCode],
  );

  const option = useMemo(() => {
    if (!loaded) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: (p: { name?: string }) => p.name ?? '' },
      geo: {
        map: loaded.key,
        zoom,
        roam: false,
        label: {
          show: !provinceCode,
          fontSize: 10,
          color: 'rgba(139, 163, 199, 0.55)',
        },
        itemStyle: {
          areaColor: 'rgba(13, 31, 53, 0.85)',
          borderColor: 'rgba(0, 212, 255, 0.28)',
          borderWidth: 0.8,
          shadowColor: 'rgba(0, 212, 255, 0.15)',
          shadowBlur: 8,
        },
        emphasis: {
          label: { show: true, color: '#e6f4ff', fontWeight: 600, fontSize: 11 },
          itemStyle: {
            areaColor: 'rgba(0, 212, 255, 0.18)',
            borderColor: palette.primary,
            borderWidth: 1.5,
          },
        },
        select: { disabled: true },
      },
      series: [
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          symbolSize: provinceCode ? 14 : 8,
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            opacity: 0.95,
          },
          data: scatterData,
          z: 5,
        },
      ],
    };
  }, [loaded, provinceCode, zoom, scatterData]);

  const onEvents = {
    click: (params: { componentType?: string; name?: string; data?: { visitId?: string } }) => {
      if (params.componentType === 'series' && params.data?.visitId) {
        onVisitClick?.(params.data.visitId);
        return;
      }
      if (params.componentType !== 'geo' || !params.name) return;
      const name = params.name;
      if (!provinceCode) {
        const code = provinceNameToCode(name);
        if (code) {
          onProvinceChange?.(code);
          onRegionClick?.({ level: 'country', code, name });
        }
      } else {
        onRegionClick?.({ level: 'province', code: null, name });
      }
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 55% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 55%), #0a1628',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
        backgroundSize: '56px 56px', pointerEvents: 'none', opacity: 0.7,
      }} />

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      )}

      {/* 「返回全国」按钮 */}
      {provinceCode && loaded && (
        <Space style={{ position: 'absolute', top: 16, left: 332, zIndex: 5 }}>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => onProvinceChange?.(null)}>
            返回全国
          </Button>
          <span style={{
            padding: '6px 14px', borderRadius: 8,
            background: palette.bgPanel, border: `1px solid ${palette.border}`,
            color: palette.primary, fontWeight: 600, fontSize: 13,
          }}>
            {loaded.name}
          </span>
        </Space>
      )}

      {/* 4 色 legend(底部居中)*/}
      {loaded && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 5,
          padding: '12px 24px', background: palette.bgPanel, border: `1px solid ${palette.border}`,
          borderRadius: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', gap: 28, alignItems: 'center', fontSize: 14, color: palette.textBase,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        }}>
          {STATUS_LEGEND.map((s) => (
            <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: s.color, boxShadow: `0 0 6px ${s.color}`,
              }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* 右侧 zoom slider */}
      {loaded && (
        <div style={{
          position: 'absolute', right: 28, top: 80, zIndex: 6,
          padding: '12px 8px', background: palette.bgPanel, border: `1px solid ${palette.border}`,
          borderRadius: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        }}>
          <span style={{ fontSize: 11, color: palette.textMuted }}>{Math.round(zoom * 100)}%</span>
          <div style={{ height: 220 }}>
            <Slider
              vertical min={ZOOM_MIN} max={ZOOM_MAX} step={0.1}
              value={zoom}
              onChange={(v) => setZoom(typeof v === 'number' ? v : ZOOM_DEFAULT)}
              tooltip={{ formatter: (v) => `${Math.round((v ?? 1) * 100)}%` }}
            />
          </div>
          <Button type="text" size="small" onClick={() => setZoom(ZOOM_DEFAULT)}
            style={{ fontSize: 11, color: palette.textMuted, padding: '0 4px', height: 22 }}>
            复位
          </Button>
        </div>
      )}

      {loaded && option && (
        <ReactECharts option={option} notMerge style={{ width: '100%', height: '100%' }} onEvents={onEvents} />
      )}
    </div>
  );
}
```

- [ ] **Step 13.2: typecheck(可能因 mock-heatmap 还在但已未引用而 unused warning,后续 task 删)**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass(MapCanvas 已不再 import mock-heatmap / loadAllCities,但文件还存在 — 不报 error)

- [ ] **Step 13.3: Commit**

```bash
git add apps/web/src/components/MapCanvas.tsx
git commit -m "refactor(web): MapCanvas 接 react-query 真 Visit 数据(去 mock)"
```

---

## Task 14: Web · MapShell 加 selectedVisitId state + 抽屉

**Files:**
- Modify: `apps/web/src/pages/MapShell.tsx`

- [ ] **Step 14.1: 改文件**

Modify `apps/web/src/pages/MapShell.tsx`:

import 加:
```typescript
import { VisitDetailDrawer } from '@/components/VisitDetailDrawer';
```

state 加:
```typescript
const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
```

MapCanvas 调用加 prop:
```typescript
<MapCanvas
  provinceCode={currentProvinceCode}
  onProvinceChange={setCurrentProvinceCode}
  onVisitClick={setSelectedVisitId}
/>
```

把现有 `<Drawer ... />`(占位)替换成:
```typescript
<VisitDetailDrawer visitId={selectedVisitId} onClose={() => setSelectedVisitId(null)} />
```

文案末行更新:
```typescript
{isPolicy
  ? '· 涂层勾选(多层级联)\n· 时间维度\n· (c3 待接 · C4/C8 涂层)'
  : '· 时间窗口\n· 区划筛选\n· 角色筛选\n· (β.1 真数据 · 32 条 seed Visit)'}
```

(可选)删除原 `<Drawer>` 相关 state(`drawerOpen` / `setDrawerOpen`)— 但 ➕📌 按钮的 onClick 仍指向 `setDrawerOpen(true)`,需要决策怎么处理。临时保留(不动 ➕📌 行为,c2 现状是点了打开占位抽屉,β.1 不接 Pin 暂留 mock 行为)。

简化:`drawerOpen` state 留着,原占位抽屉移到 ➕📌 触发的副作用(留 stub 不动)。VisitDetailDrawer 是新加的,跟 visitId 联动,与 ➕📌 解耦。

最终 MapShell.tsx 完整结构(关键段):

```typescript
export function MapShell() {
  const location = useLocation();
  const isPolicy = location.pathname === '/map/policy';
  const [drawerOpen, setDrawerOpen] = useState(false);  // ➕📌 占位用,β.2 替换
  const [siderOpen, setSiderOpen] = useState(true);
  const [currentProvinceCode, setCurrentProvinceCode] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  return (
    <div style={{...}}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas
          provinceCode={currentProvinceCode}
          onProvinceChange={setCurrentProvinceCode}
          onVisitClick={setSelectedVisitId}
        />
      </div>
      {/* 浮玻璃左面板 + 把手 + ➕📌 按钮(原代码不动) */}
      ...

      {/* 大盘 Visit 详情抽屉(β.1 新加) */}
      <VisitDetailDrawer
        visitId={selectedVisitId}
        onClose={() => setSelectedVisitId(null)}
      />

      {/* ➕📌 触发的占位抽屉(β.2 接 Pin 时替换) */}
      <Drawer title="新增 Pin / 蓝点(占位)" placement="right" width={400}
        open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Paragraph>
          ➕📌 浮动按钮触发占位 — β.2 接 Pin 实体后替换
        </Paragraph>
      </Drawer>

      <Outlet />
    </div>
  );
}
```

- [ ] **Step 14.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass

- [ ] **Step 14.3: Commit**

```bash
git add apps/web/src/pages/MapShell.tsx
git commit -m "feat(web): MapShell 接 VisitDetailDrawer + 文案 β.1 真数据"
```

---

## Task 15: Web · 删 mock-heatmap.ts + china-map.ts 删 loadAllCities

**Files:**
- Delete: `apps/web/src/lib/mock-heatmap.ts`
- Modify: `apps/web/src/lib/china-map.ts`

- [ ] **Step 15.1: 删 mock-heatmap.ts**

```bash
rm apps/web/src/lib/mock-heatmap.ts
```

- [ ] **Step 15.2: 改 china-map.ts 删 loadAllCities + allCitiesCache 相关代码**

打开 `apps/web/src/lib/china-map.ts`,删除以下段:

1. `let allCitiesCache: GeoJsonFC['features'] | null = null;` 这一行
2. `loadAllCities()` 整个 export function

保留 `loadChinaMap` / `loadProvinceMap` / `provinceNameToCode` 等其他所有内容不动。

- [ ] **Step 15.3: typecheck 应 pass(MapCanvas 已不引用 mock-heatmap / loadAllCities)**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass(无 unresolved import)

- [ ] **Step 15.4: Commit**

```bash
git add apps/web/src/lib/china-map.ts
git rm apps/web/src/lib/mock-heatmap.ts
git commit -m "refactor(web): 删 c2 mock-heatmap + loadAllCities(β.1 接真后弃用)"
```

---

## Task 16: 端到端浏览器实测 + Squash + PR

无文件改动(除非实测发现 bug)。

- [ ] **Step 16.1: 起 dev 双服务**

```bash
npm run dev:api      # 终端 1
npm run dev:web      # 终端 2
```

- [ ] **Step 16.2: sysadmin 登录**

访问 `http://localhost:5173/login`,sysadmin 进。

- [ ] **Step 16.3: /map/local 大盘验证**

点 Logo 跳到 `/map/local`,预期:
- 35 region 暗色描边 + 32 个真 Visit 散点(分布在 16 城市,8 优先城市更密)
- 散点颜色:大部分绿、部分黄、少量红
- 4 色 legend 在底部居中(第 4 项「计划未执行」是 β.3 蓝点占位,本轮 0 个蓝点)
- 右侧 zoom slider 默认 120%
- 点北京散点 → 右抽屉打开,显示该 Visit 详情(7 字段表单)
- 改 outcome_summary → 保存 → 抽屉关 + 列表/散点刷新(react-query invalidate)
- 抽屉底部 3 个「相关工具」按钮 → 点击触发 .txt 下载

- [ ] **Step 16.4: 下钻验证**

点广东省 → 下钻 → 仅显示广东省的 Visit 散点(广州 3 + 深圳 3 = 6 点)
点「返回全国」→ 回全国

- [ ] **Step 16.5: /console/visits 工作台验证**

地址栏改到 `/console/visits`,预期:
- 标题「拜访清单 (32)」
- 表格 32 行,默认按日期 desc 排,分页 20/页
- 「新建拜访」按钮 → Modal → 选省→市联动 → 填表 → 保存 → 列表第一行新条 + 大盘多一个散点
- 任意行「编辑」→ Modal prefilled → 改 → 保存 → 列表 + 大盘同步刷新

- [ ] **Step 16.6: 回归验证(V0.4 c1 + V0.5 c2 不退化)**

- 浮玻璃左面板 + 把手 < / > 仍正常
- ➕📌 圆按钮位置不变,点击仍弹「新增 Pin / 蓝点(占位)」抽屉(β.2 接真前的 stub)
- 顶栏「属地⇄政策」切换仍只在 ① 显示
- Logo 仍跳 `/map/local`
- `/console/dashboard` `/admin/users` `/me` 各打开无报错

- [ ] **Step 16.7: 删除 8.5 验证残留(如有)**

如 Task 8 e2e 创建的 1 条 Visit 还在,删除回到 32 条:
```bash
psql postgresql://pop:pop_dev_password@localhost:5432/pop \
  -c "DELETE FROM visits WHERE outcome_summary IN ('e2e 验证','e2e 已编辑');"
```

- [ ] **Step 16.8: 停 dev server**

Ctrl+C 两个终端。

- [ ] **Step 16.9: Squash 全部 task commits → 单一**

```bash
git log --oneline 6304b6a..HEAD     # 应该有 ~15 个 task commits + spec commit + c2 commit
git reset --soft 6304b6a            # HEAD 回 main 基线
git status                          # 应显示所有改动 staged
git commit -m "feat: V0.6 β.1 Visit 真业务 + V0.5 c2 散点骨架(spec/plan 一并)"
```

注意:这一步会 squash 包括 c2 (PR #5 已开)+ spec/plan + β.1 全部改动。这意味着 PR #5 失效(c2 commit hash 变),需要 close PR #5 + 重开 PR #6 包含全部。

或者更安全的策略:**squash 仅 β.1 部分**(从 spec commit 之后开始):
```bash
git reset --soft 135de1b     # 回到 spec commit(c2 + spec/plan 保留)
git commit -m "feat: V0.6 β.1 Visit 真业务(端到端 · 32 seed + CRUD + 大盘抽屉)"
```

这样保留 c2 (PR #5) + spec + plan 各自独立 commit,β.1 单 commit。最终 history:
- main = 6304b6a
- + c2 (6cc4a98)
- + spec (135de1b)
- + plan (本 commit)
- + β.1 squashed (新)

四段 commit 结构清晰,推 PR #6 包含 β.1 一段(base = c2 if PR #5 merged,否则 base = main 含 plan/spec/c2 全部)。

实际推 PR 时:
- 如 PR #5 已 merge:本 PR base = main,只含 spec/plan/β.1 三段
- 如 PR #5 未 merge:本 PR base = main,含 c2 + spec + plan + β.1 四段

- [ ] **Step 16.10: 推 + 开 PR**

```bash
git push origin claude/quirky-kapitsa-3f2faf
```

(branch 已上次 push 过,直接 push 即可,会包含新 commits)

```bash
gh pr create --base main --title "feat: V0.6 β.1 Visit 真业务(端到端)" --body "..."
```

PR body 模板见下方。

---

## PR Body 模板(Step 16.10 用)

```markdown
## Summary

V0.6 β.1 · Visit 真业务端到端闭环。继 V0.5 c2(PR #5)的散点视觉骨架后,
把 mock 数据替换为真 Visit CRUD,完成第一个业务实体闭环。

对齐 PRD §3.3 三个 P0:
- B1 (L446) 属地热力图渲染 — 真 Visit 散点
- B2 (L447) 拜访点(红/黄/绿)
- B11 (L456) 编辑(工作台 + 大盘抽屉双入口)

## 实现要点

### 后端(NestJS + TypeORM + PostgreSQL)

- `apps/api/src/visits/` — Entity / Service / Controller / Module
- `apps/api/src/lib/geojson-cities.ts` — 启动时加载 30 普通省 GeoJSON +
  4 直辖市 hardcode,POST/PUT 自动填 lng/lat
- 2 个 migration:`AddVisitsTable` (+ `visit_color` PG enum red/yellow/green)、
  `SeedDemoVisits` (32 条 demo:8 优先城市 ×3 + 8 其他 ×1)
- 4 端点:`GET/POST/PUT /api/v1/visits` + `GET /api/v1/cities`(前端
  cascading 下拉用)

### 前端(React + react-query + AntD)

- `apps/web/src/pages/console/VisitsTab.tsx` — 替换 V0.3 StubCard 为
  真表格 + 录入/编辑 Modal(省+市级联)
- `apps/web/src/components/VisitFormModal.tsx` — 录入/编辑共用
- `apps/web/src/components/VisitDetailDrawer.tsx` — 大盘抽屉
  (可编辑详情 + 3 个演示文档下载)
- `apps/web/src/components/MapCanvas.tsx` — 改 react-query 拿真 Visit,
  scatter click 派发 visitId
- `apps/web/src/pages/MapShell.tsx` — 加 selectedVisitId state + 接抽屉
- `apps/web/public/demo/*.txt` — 3 份演示文档占位

### c2 mock 清理

- 删 `apps/web/src/lib/mock-heatmap.ts` 整文件(c2 占位完成历史使命)
- 删 `apps/web/src/lib/china-map.ts` 中的 `loadAllCities()`

## 不含(留 V0.6 后续 / V0.7+)

- β.2 Pin/图钉(下个 PR)
- β.3 蓝点 PlanPoint + 状态流转
- γ K 模块(GovOrg/GovContact)
- c3 政策大盘涂层
- B11 「仅自己编辑」CASL 真矩阵 / B14 筛选 / B12 H5 / B15 工具级联真接 / delete

## Test plan

- [x] typecheck pass(api + web)
- [x] migration:run 跑通,32 条 seed 入库
- [x] 4 端点 curl 验证(list/detail/POST/PUT)
- [x] /map/local 大盘 32 散点显示 + 点击 → 抽屉 + 编辑保存
- [x] /console/visits 表格 + 录入/编辑 Modal
- [x] 下钻到省后仅显示该省 Visit
- [x] 演示文档 3 个 .txt 可下载
- [x] V0.4 c1 + V0.5 c2 视觉骨架不退化(浮玻璃 / 把手 / ➕📌 / Slider / Legend / Logo / 顶栏切换)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review Checklist

- ✅ Spec coverage:
  - §1 这一轮做什么 → Pre-flight + 全文 task
  - §2 数据模型 → Task 1 (shared-types) + Task 2 (entity) + Task 3 (migration)
  - §3 后端 API → Task 4 (geojson-cities) + Task 5 (service/controller/dto/module) + Task 6 (注册 + bootstrap)
  - §4 seed 数据 → Task 7 (SeedDemoVisits migration)
  - §5 工作台 tab → Task 10 (Form Modal) + Task 11 (VisitsTab)
  - §6 大盘改造 → Task 13 (MapCanvas) + Task 14 (MapShell)
  - §7 演示文档 → Task 9
  - §8 c2 mock 清理 → Task 15
  - §9 工程细节 → 散落各 task verify steps
  - §10 验证 → Task 8 (API e2e) + Task 16 (端到端浏览器实测)
  - §11 工作量 + worktree → Task 16 squash 策略
- ✅ Placeholder scan:无 TBD / TODO / "implement later" / "similar to Task N"
- ✅ Type consistency:VisitStatusColor 全文统一(shared-types union + entity enum + DTO IsEnum 三处都是 'red'|'yellow'|'green')
- ✅ Method signatures:`generateScatterPoints` 已删(Task 15);`fetchVisits` / `fetchCities` / `fetchVisit` signature 一致
