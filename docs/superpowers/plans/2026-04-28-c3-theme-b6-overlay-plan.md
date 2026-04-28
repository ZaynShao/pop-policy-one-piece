# c3 政策主题 + B6 涂层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让中台 GA 在工作台维护政策主题 + 触发外部分析 mock 拉取覆盖清单 + 发布;让所有用户在 `/map/policy` 大盘勾选涂层(1-3 层叠加),按地图层级自动渲染色块/点。

**Architecture:** 新建 `themes` + `theme_coverage` 两表(1:N CASCADE),状态机 `draft ↔ published ↔ archived`(对称 Pin)。后端 mock 纯函数确定性生成 ~13-19 条覆盖 / 主题。前端复用 PinsTab 的 Segmented 双视图 + PinDetailDrawer 的状态切换模式;MapCanvas 在现有 visit/pin scatter 基础上加 themeOverlays(geo visualMap + city/district scatter)按 currentProvinceCode 自动切层级。

**Tech Stack:** NestJS 10 + TypeORM 0.3 + PostgreSQL + Jest;React 18 + Vite + antd 5 + react-query 5 + ECharts 5。

**Spec:** `docs/superpowers/specs/2026-04-28-c3-theme-b6-overlay-design.md`

**Branch:** `claude/c3-theme-b6-overlay`(已切自 `claude/pin-recycle-bin`)

---

## File Structure

**新建后端**(11)
```
apps/api/src/themes/entities/theme.entity.ts
apps/api/src/themes/entities/theme-coverage.entity.ts
apps/api/src/themes/dtos/create-theme.dto.ts
apps/api/src/themes/dtos/update-theme.dto.ts
apps/api/src/themes/themes.controller.ts
apps/api/src/themes/themes.service.ts
apps/api/src/themes/coverage.service.ts
apps/api/src/themes/mock-policy-analysis.ts
apps/api/src/themes/themes.module.ts
apps/api/src/themes/__tests__/themes.service.spec.ts
apps/api/src/database/migrations/{ts1}-CreateThemes.ts
apps/api/src/database/migrations/{ts2}-SeedDemoThemes.ts
```

**修改后端**(1)
- `apps/api/src/app.module.ts`(挂 ThemesModule)

**新建前端**(8)
```
apps/web/src/api/themes.ts
apps/web/src/pages/console/ThemesTab.tsx
apps/web/src/components/ThemeFormModal.tsx
apps/web/src/components/ThemeDetailDrawer.tsx
packages/shared-types/src/enums/theme-template.ts
packages/shared-types/src/enums/theme-status.ts
packages/shared-types/src/enums/theme-region-level.ts
packages/shared-types/src/dtos/theme.dto.ts
```

**修改前端**(3)
- `apps/web/src/components/MapCanvas.tsx`(加 themeOverlays prop)
- `apps/web/src/pages/MapShell.tsx`(/map/policy 涂层选择器)
- `packages/shared-types/src/index.ts`(re-export)

---

## Task 1:shared-types Theme 枚举 + DTO

**Files:**
- Create: `packages/shared-types/src/enums/theme-template.ts`
- Create: `packages/shared-types/src/enums/theme-status.ts`
- Create: `packages/shared-types/src/enums/theme-region-level.ts`
- Create: `packages/shared-types/src/dtos/theme.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1.1: 写 `theme-template.ts`**

```typescript
/**
 * 政策主题模板(PRD §2.4 场景 3 拍板)
 * - main 主线政策:main_value 语义=区覆盖数(1-50 范围)
 * - risk 核心风险:main_value 语义=政诉数(10-200 范围)
 */
export type ThemeTemplate = 'main' | 'risk';

export const THEME_TEMPLATE_LABEL: Record<ThemeTemplate, string> = {
  main: '主线政策',
  risk: '核心风险',
};
```

- [ ] **Step 1.2: 写 `theme-status.ts`**

```typescript
/**
 * 政策主题状态机(对称 Pin):
 *   draft ↔ published ↔ archived
 *   draft → published 校验 coverage 至少 1 条
 *   archived 不出现在涂层选择器但可恢复(unarchive)
 */
export type ThemeStatus = 'draft' | 'published' | 'archived';
```

- [ ] **Step 1.3: 写 `theme-region-level.ts`**

```typescript
/** 涂层覆盖记录的行政区划层级(对应 region_code 6 位) */
export type ThemeRegionLevel = 'province' | 'city' | 'district';
```

- [ ] **Step 1.4: 写 `theme.dto.ts`**

```typescript
import type { ThemeTemplate } from '../enums/theme-template';
import type { ThemeStatus } from '../enums/theme-status';
import type { ThemeRegionLevel } from '../enums/theme-region-level';

export interface Theme {
  id: string;
  title: string;
  template: ThemeTemplate;
  keywords: string[];
  regionScope: string | null;
  status: ThemeStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ThemeCoverage {
  id: string;
  themeId: string;
  regionCode: string;
  regionLevel: ThemeRegionLevel;
  mainValue: number;
  extraData: Record<string, unknown> | null;
  lastFetchedAt: string;
}

export interface ThemeWithCoverage extends Theme {
  coverage: ThemeCoverage[];
}

export interface CreateThemeInput {
  title: string;
  template: ThemeTemplate;
  keywords?: string[];
  regionScope?: string;
}

export interface UpdateThemeInput {
  title?: string;
  keywords?: string[];
  regionScope?: string | null;
  // 不接受 status / template / publishedAt(状态切走专用 endpoint;模板创建后不可改)
}
```

- [ ] **Step 1.5: 改 `packages/shared-types/src/index.ts` 加 re-export**

找到现有 export 列表,在合适位置追加:

```typescript
export * from './enums/theme-template';
export * from './enums/theme-status';
export * from './enums/theme-region-level';
export * from './dtos/theme.dto';
```

- [ ] **Step 1.6: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -10
```

期望:0 error。

- [ ] **Step 1.7: commit**

```bash
git add packages/shared-types/src/enums/theme-template.ts packages/shared-types/src/enums/theme-status.ts packages/shared-types/src/enums/theme-region-level.ts packages/shared-types/src/dtos/theme.dto.ts packages/shared-types/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared-types): Theme + ThemeCoverage enums + DTOs

- ThemeTemplate (main / risk)
- ThemeStatus (draft / published / archived)
- ThemeRegionLevel (province / city / district)
- Theme / ThemeCoverage / ThemeWithCoverage / Create/UpdateThemeInput

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2:DB Migration — themes + theme_coverage 建表

**Files:**
- Create: `apps/api/src/database/migrations/{epochMs}-CreateThemes.ts`

- [ ] **Step 2.1: 写 migration**

文件名用当前时间戳(参考 V0.6 #9 的 `1777310000000-AddPinSoftDelete.ts`)。生成命令:

```bash
echo "$(date +%s)000-CreateThemes.ts"
```

文件内容(替换 timestamp 占位):

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateThemes{TIMESTAMP} implements MigrationInterface {
  name = 'CreateThemes{TIMESTAMP}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."theme_template" AS ENUM ('main', 'risk')`);
    await queryRunner.query(`CREATE TYPE "public"."theme_status" AS ENUM ('draft', 'published', 'archived')`);
    await queryRunner.query(`CREATE TYPE "public"."theme_region_level" AS ENUM ('province', 'city', 'district')`);

    await queryRunner.query(`
      CREATE TABLE "themes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(100) NOT NULL,
        "template" "public"."theme_template" NOT NULL,
        "keywords" text[] NOT NULL DEFAULT '{}',
        "region_scope" text,
        "status" "public"."theme_status" NOT NULL DEFAULT 'draft',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_themes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_themes_status" ON "themes" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_themes_created_by" ON "themes" ("created_by")`);
    await queryRunner.query(`ALTER TABLE "themes" ADD CONSTRAINT "FK_themes_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE "theme_coverage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "theme_id" uuid NOT NULL,
        "region_code" varchar(6) NOT NULL,
        "region_level" "public"."theme_region_level" NOT NULL,
        "main_value" double precision NOT NULL,
        "extra_data" jsonb,
        "last_fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_theme_coverage" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_theme" ON "theme_coverage" ("theme_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_theme_coverage_region" ON "theme_coverage" ("region_code")`);
    await queryRunner.query(`ALTER TABLE "theme_coverage" ADD CONSTRAINT "FK_theme_coverage_theme" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "theme_coverage" DROP CONSTRAINT "FK_theme_coverage_theme"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_region"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_theme_coverage_theme"`);
    await queryRunner.query(`DROP TABLE "theme_coverage"`);

    await queryRunner.query(`ALTER TABLE "themes" DROP CONSTRAINT "FK_themes_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_themes_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_themes_status"`);
    await queryRunner.query(`DROP TABLE "themes"`);

    await queryRunner.query(`DROP TYPE "public"."theme_region_level"`);
    await queryRunner.query(`DROP TYPE "public"."theme_status"`);
    await queryRunner.query(`DROP TYPE "public"."theme_template"`);
  }
}
```

- [ ] **Step 2.2: 跑 migration**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/api && npm run migration:run 2>&1 | tail -15
```

期望:`Migration CreateThemes{TIMESTAMP} has been executed successfully.`

- [ ] **Step 2.3: psql 验证表 + index**

```bash
psql -U pop -d pop -c "\d themes" 2>&1 | head -20
psql -U pop -d pop -c "\d theme_coverage" 2>&1 | head -15
```

期望:看到 themes / theme_coverage 表 + 各 3 个 index + FK。

- [ ] **Step 2.4: commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/api/src/database/migrations/*-CreateThemes.ts
git commit -m "$(cat <<'EOF'
feat(api): DB migration · themes + theme_coverage 表 + index + FK

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3:Theme entities + mock-policy-analysis 纯函数

**Files:**
- Create: `apps/api/src/themes/entities/theme.entity.ts`
- Create: `apps/api/src/themes/entities/theme-coverage.entity.ts`
- Create: `apps/api/src/themes/mock-policy-analysis.ts`

- [ ] **Step 3.1: 写 `theme.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ThemeTemplate, ThemeStatus } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';
import { ThemeCoverageEntity } from './theme-coverage.entity';

@Entity('themes')
@Index(['status'])
@Index(['createdBy'])
export class ThemeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({
    type: 'enum',
    enum: ['main', 'risk'],
    enumName: 'theme_template',
  })
  template!: ThemeTemplate;

  @Column({ type: 'text', array: true, default: '{}' })
  keywords!: string[];

  @Column({ type: 'text', nullable: true, name: 'region_scope' })
  regionScope!: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    enumName: 'theme_status',
    default: 'draft',
  })
  status!: ThemeStatus;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  publishedAt!: Date | null;

  @OneToMany(() => ThemeCoverageEntity, (cov) => cov.theme)
  coverage?: ThemeCoverageEntity[];
}
```

- [ ] **Step 3.2: 写 `theme-coverage.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ThemeRegionLevel } from '@pop/shared-types';
import { ThemeEntity } from './theme.entity';

@Entity('theme_coverage')
@Index(['themeId'])
@Index(['regionCode'])
export class ThemeCoverageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'theme_id' })
  themeId!: string;

  @ManyToOne(() => ThemeEntity, (t) => t.coverage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'theme_id' })
  theme?: ThemeEntity;

  @Column({ type: 'varchar', length: 6, name: 'region_code' })
  regionCode!: string;

  @Column({
    type: 'enum',
    enum: ['province', 'city', 'district'],
    enumName: 'theme_region_level',
    name: 'region_level',
  })
  regionLevel!: ThemeRegionLevel;

  @Column({ type: 'double precision', name: 'main_value' })
  mainValue!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'extra_data' })
  extraData!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'last_fetched_at' })
  lastFetchedAt!: Date;
}
```

- [ ] **Step 3.3: 写 `mock-policy-analysis.ts`**

```typescript
import type { ThemeTemplate, ThemeRegionLevel } from '@pop/shared-types';

/** 简单确定性 hash(djb2) — 同 themeId 跨 process 输出一致 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** 用 hash 派生伪随机但确定的 mulberry32 PRNG */
function rngFromSeed(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一些常见省 / 市 region_code 池(简化,demo 够用) */
const PROVINCE_CODES = ['110000', '310000', '440000', '510000', '320000', '330000', '370000', '420000', '430000', '500000', '610000', '350000'];
const CITY_CODES = ['110100', '310100', '440100', '440300', '510100', '510700', '320100', '320500', '330100', '330200', '370100', '420100', '430100', '500100', '610100', '350100'];

export interface MockCoverage {
  regionCode: string;
  regionLevel: ThemeRegionLevel;
  mainValue: number;
  extraData: Record<string, unknown> | null;
}

/**
 * 确定性 mock:同 themeId + template 多次调用结果一致
 * 主线政策(main):main_value 1-50(区覆盖数语义)
 * 核心风险(risk):main_value 10-200(政诉数语义)
 */
export function mockPolicyAnalysis(themeId: string, template: ThemeTemplate): MockCoverage[] {
  const seed = djb2(`${themeId}:${template}`);
  const rng = rngFromSeed(seed);

  const provinceCount = 5 + Math.floor(rng() * 4);  // 5-8
  const cityCount = 8 + Math.floor(rng() * 4);       // 8-11

  const valueRange = template === 'main' ? [1, 50] : [10, 200];
  const valueRand = () => valueRange[0] + Math.floor(rng() * (valueRange[1] - valueRange[0] + 1));

  // 取 provinceCount 个省(确定性洗牌前 N)
  const provinces = [...PROVINCE_CODES]
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, provinceCount)
    .map(({ c }) => c);

  // 取 cityCount 个市(同模式)
  const cities = [...CITY_CODES]
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, cityCount)
    .map(({ c }) => c);

  const out: MockCoverage[] = [];
  for (const code of provinces) {
    out.push({
      regionCode: code,
      regionLevel: 'province',
      mainValue: valueRand(),
      extraData: template === 'risk' ? { complaintCount: valueRand() * 2 } : null,
    });
  }
  for (const code of cities) {
    out.push({
      regionCode: code,
      regionLevel: 'city',
      mainValue: valueRand(),
      extraData: template === 'risk' ? { complaintCount: valueRand() * 2 } : null,
    });
  }
  return out;
}
```

- [ ] **Step 3.4: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -8
```

期望:0 error。

- [ ] **Step 3.5: commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/api/src/themes/entities/ apps/api/src/themes/mock-policy-analysis.ts
git commit -m "$(cat <<'EOF'
feat(api): Theme + ThemeCoverage TypeORM entities + mockPolicyAnalysis 确定性纯函数

mockPolicyAnalysis(themeId, template):
- djb2 hash → mulberry32 PRNG,同输入同输出
- 5-8 个 province + 8-11 个 city,共 ~13-19 条
- main_value 范围:main 模板 1-50,risk 模板 10-200

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4:Themes service + jest TDD(状态机 + RBAC)

**Files:**
- Create: `apps/api/src/themes/themes.service.ts`
- Create: `apps/api/src/themes/dtos/create-theme.dto.ts`
- Create: `apps/api/src/themes/dtos/update-theme.dto.ts`
- Create: `apps/api/src/themes/__tests__/themes.service.spec.ts`

- [ ] **Step 4.1: 写 `dtos/create-theme.dto.ts`**

```typescript
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ThemeTemplate } from '@pop/shared-types';

export class CreateThemeDto {
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsEnum(['main', 'risk'])
  template!: ThemeTemplate;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  regionScope?: string;
}
```

- [ ] **Step 4.2: 写 `dtos/update-theme.dto.ts`**

```typescript
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  regionScope?: string | null;
}
```

- [ ] **Step 4.3: 写 `themes.service.ts`(skeleton:list / findOne / create / update / publish / archive / unarchive)**

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { CreateThemeDto } from './dtos/create-theme.dto';
import { UpdateThemeDto } from './dtos/update-theme.dto';
import {
  UserRoleCode,
  type AuthenticatedUser,
  type ThemeStatus,
} from '@pop/shared-types';

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

const ALLOWED_TRANSITIONS: Record<ThemeStatus, ThemeStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published'],   // unarchive 直接复活到 published
};

function requireWriteRole(user: AuthenticatedUser): void {
  if (!THEME_WRITE_ALLOWED_ROLES.has(user.roleCode)) {
    throw new ForbiddenException('只有管理员/中台 GA 可以维护政策主题');
  }
}

@Injectable()
export class ThemesService {
  constructor(
    @InjectRepository(ThemeEntity) private readonly repo: Repository<ThemeEntity>,
    @InjectRepository(ThemeCoverageEntity) private readonly coverageRepo: Repository<ThemeCoverageEntity>,
  ) {}

  async list(opts?: { status?: ThemeStatus | 'all' }): Promise<ThemeEntity[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');
    if (opts?.status === 'all') {
      // 不加 where
    } else if (opts?.status === 'archived') {
      qb.where('t.status = :s', { s: 'archived' });
    } else if (opts?.status) {
      qb.where('t.status = :s', { s: opts.status });
    } else {
      // 默认排除 archived
      qb.where('t.status != :s', { s: 'archived' });
    }
    return qb.getMany();
  }

  async findOneWithCoverage(id: string): Promise<ThemeEntity & { coverage: ThemeCoverageEntity[] }> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Theme ${id} not found`);
    const coverage = await this.coverageRepo.find({ where: { themeId: id }, order: { mainValue: 'DESC' } });
    return Object.assign(t, { coverage });
  }

  async create(dto: CreateThemeDto, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const theme = this.repo.create({
      title: dto.title,
      template: dto.template,
      keywords: dto.keywords ?? [],
      regionScope: dto.regionScope ?? null,
      status: 'draft',
      createdBy: currentUser.id,
      publishedAt: null,
    });
    return this.repo.save(theme);
  }

  async update(id: string, dto: UpdateThemeDto, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (dto.title !== undefined) prev.title = dto.title;
    if (dto.keywords !== undefined) prev.keywords = dto.keywords;
    if (dto.regionScope !== undefined) prev.regionScope = dto.regionScope;
    return this.repo.save(prev);
  }

  async publish(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (!ALLOWED_TRANSITIONS[prev.status].includes('published')) {
      throw new BadRequestException(`不允许 ${prev.status} → published`);
    }
    const coverageCount = await this.coverageRepo.count({ where: { themeId: id } });
    if (coverageCount < 1) {
      throw new BadRequestException('发布前必须先拉取覆盖清单');
    }
    prev.status = 'published';
    prev.publishedAt = new Date();
    return this.repo.save(prev);
  }

  async archive(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (!ALLOWED_TRANSITIONS[prev.status].includes('archived')) {
      throw new BadRequestException(`不允许 ${prev.status} → archived`);
    }
    prev.status = 'archived';
    return this.repo.save(prev);
  }

  async unarchive(id: string, currentUser: AuthenticatedUser): Promise<ThemeEntity> {
    requireWriteRole(currentUser);
    const prev = await this.repo.findOne({ where: { id } });
    if (!prev) throw new NotFoundException(`Theme ${id} not found`);
    if (prev.status !== 'archived') {
      throw new BadRequestException(`只有 archived 主题可恢复`);
    }
    prev.status = 'published';
    return this.repo.save(prev);
  }
}
```

- [ ] **Step 4.4: 写 `__tests__/themes.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThemesService } from '../themes.service';
import { ThemeEntity } from '../entities/theme.entity';
import { ThemeCoverageEntity } from '../entities/theme-coverage.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: x.id ?? 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const userOf = (roleCode: UserRoleCode): AuthenticatedUser => ({
  id: 'u1', username: 'test', displayName: 'Test', email: 't@x', roleCode,
});

describe('ThemesService', () => {
  let svc: ThemesService;
  let themesRepo: any;
  let coverageRepo: any;

  beforeEach(async () => {
    themesRepo = mockRepo();
    coverageRepo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ThemesService,
        { provide: getRepositoryToken(ThemeEntity), useValue: themesRepo },
        { provide: getRepositoryToken(ThemeCoverageEntity), useValue: coverageRepo },
      ],
    }).compile();
    svc = module.get(ThemesService);
  });

  describe('create', () => {
    it('forces status=draft and assigns createdBy', async () => {
      const out = await svc.create(
        { title: 'X', template: 'main' },
        userOf(UserRoleCode.CentralGa),
      );
      expect(out.status).toBe('draft');
      expect(out.createdBy).toBe('u1');
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.create({ title: 'X', template: 'main' }, userOf(UserRoleCode.LocalGa)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('publish', () => {
    it('rejects if coverage=0', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      coverageRepo.count.mockResolvedValue(0);
      await expect(
        svc.publish('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(/发布前必须先拉取覆盖清单/);
    });

    it('publishes if coverage>=1', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      coverageRepo.count.mockResolvedValue(5);
      const out = await svc.publish('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('published');
      expect(out.publishedAt).toBeInstanceOf(Date);
    });

    it('throws 403 for local_ga', async () => {
      await expect(
        svc.publish('t1', userOf(UserRoleCode.LocalGa)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 if status is archived', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'archived' });
      await expect(
        svc.publish('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive / unarchive', () => {
    it('archive published → archived', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      const out = await svc.archive('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('archived');
    });

    it('archive draft → 400', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await expect(
        svc.archive('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });

    it('unarchive archived → published', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'archived' });
      const out = await svc.unarchive('t1', userOf(UserRoleCode.SysAdmin));
      expect(out.status).toBe('published');
    });

    it('unarchive draft → 400', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await expect(
        svc.unarchive('t1', userOf(UserRoleCode.SysAdmin)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneWithCoverage', () => {
    it('throws 404 if not found', async () => {
      themesRepo.findOne.mockResolvedValue(null);
      await expect(svc.findOneWithCoverage('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns theme with coverage array', async () => {
      themesRepo.findOne.mockResolvedValue({ id: 't1', title: 'X' });
      coverageRepo.find.mockResolvedValue([{ id: 'c1', themeId: 't1' }]);
      const out = await svc.findOneWithCoverage('t1');
      expect(out.coverage).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 4.5: 跑 jest**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/api && npx jest themes 2>&1 | tail -10
```

期望:`Tests: 11 passed, 11 total`(本 task 单文件 11 tests)。

- [ ] **Step 4.6: 整体 typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -8
```

期望:0 error。

- [ ] **Step 4.7: commit**

```bash
git add apps/api/src/themes/themes.service.ts apps/api/src/themes/dtos/ apps/api/src/themes/__tests__/
git commit -m "$(cat <<'EOF'
feat(api): ThemesService 状态机 + RBAC + 11 jest tests

- list 默认排除 archived,?status= 切到指定状态
- create 强制 status=draft,RBAC 校验
- publish 校验 coverage>=1
- archive/unarchive 状态机校验
- 11 jest tests 覆盖 happy / 403 / 404 / 400 路径

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5:Coverage service(fetch-coverage 事务)

**Files:**
- Create: `apps/api/src/themes/coverage.service.ts`

- [ ] **Step 5.1: 写 `coverage.service.ts`**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { mockPolicyAnalysis } from './mock-policy-analysis';

@Injectable()
export class CoverageService {
  constructor(
    @InjectRepository(ThemeEntity) private readonly themesRepo: Repository<ThemeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 重新拉取覆盖清单 — 事务内 DELETE existing + INSERT new(覆盖语义)
   * archived 状态主题禁止拉取
   */
  async fetchCoverage(themeId: string): Promise<ThemeCoverageEntity[]> {
    const theme = await this.themesRepo.findOne({ where: { id: themeId } });
    if (!theme) throw new NotFoundException(`Theme ${themeId} not found`);
    if (theme.status === 'archived') {
      throw new BadRequestException('已归档主题不能拉取覆盖');
    }

    const mockData = mockPolicyAnalysis(themeId, theme.template);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ThemeCoverageEntity, { themeId });
      const rows = mockData.map((m) =>
        manager.create(ThemeCoverageEntity, {
          themeId,
          regionCode: m.regionCode,
          regionLevel: m.regionLevel,
          mainValue: m.mainValue,
          extraData: m.extraData,
        }),
      );
      const saved = await manager.save(rows);
      return saved;
    });
  }
}
```

- [ ] **Step 5.2: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -5
```

期望:0 error。

- [ ] **Step 5.3: commit**

```bash
git add apps/api/src/themes/coverage.service.ts
git commit -m "$(cat <<'EOF'
feat(api): CoverageService.fetchCoverage 事务内 DELETE + INSERT (覆盖语义)

调用 mockPolicyAnalysis 生成新数据,在事务中:
1. DELETE existing coverage by themeId
2. INSERT new rows
确保单次拉取的原子性,避免中间态污染。

archived 状态主题禁止拉取(400)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6:Themes controller + module + 挂载到 AppModule

**Files:**
- Create: `apps/api/src/themes/themes.controller.ts`
- Create: `apps/api/src/themes/themes.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 6.1: 写 `themes.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser, type ThemeStatus } from '@pop/shared-types';
import { ThemesService } from './themes.service';
import { CoverageService } from './coverage.service';
import { CreateThemeDto } from './dtos/create-theme.dto';
import { UpdateThemeDto } from './dtos/update-theme.dto';

@Controller('themes')
export class ThemesController {
  constructor(
    private readonly service: ThemesService,
    private readonly coverage: CoverageService,
  ) {}

  @Get()
  async list(@Query('status') status?: ThemeStatus | 'all') {
    const data = await this.service.list({ status });
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOneWithCoverage(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateThemeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user) };
  }

  @Post(':id/fetch-coverage')
  async fetchCoverage(@Param('id') id: string) {
    const coverage = await this.coverage.fetchCoverage(id);
    return { data: coverage };
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.publish(id, user) };
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.archive(id, user) };
  }

  @Post(':id/unarchive')
  async unarchive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.unarchive(id, user) };
  }
}
```

- [ ] **Step 6.2: 写 `themes.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { CoverageService } from './coverage.service';

@Module({
  imports: [TypeOrmModule.forFeature([ThemeEntity, ThemeCoverageEntity])],
  controllers: [ThemesController],
  providers: [ThemesService, CoverageService],
})
export class ThemesModule {}
```

- [ ] **Step 6.3: 改 `apps/api/src/app.module.ts` 挂 ThemesModule**

Read 现有 `app.module.ts`,找 `imports: [...]` 数组里 PinsModule / VisitsModule / CommentsModule 等的位置,加 ThemesModule:

```typescript
import { ThemesModule } from './themes/themes.module';

// imports: [..., ThemesModule]
```

- [ ] **Step 6.4: typecheck + 重启服务**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed && npm run typecheck --workspaces --if-present 2>&1 | tail -5
sleep 4 && curl -s http://localhost:3001/api/v1/health
```

期望:typecheck 0 error,health ok(ts-node-dev 自动 restart)。

- [ ] **Step 6.5: e2e curl 验证 5 路径**

```bash
TOKEN_CG=$(curl -sX POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"central_ga"}' | jq -r .accessToken)
TOKEN_LG=$(curl -sX POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"local_ga"}' | jq -r .accessToken)

echo "--- [1] central_ga POST /themes (期望 status=draft) ---"
NEW_T=$(curl -sX POST -H "Authorization: Bearer $TOKEN_CG" -H "Content-Type: application/json" \
  -d '{"title":"e2e 测试主题","template":"main","keywords":["test","e2e"]}' \
  http://localhost:3001/api/v1/themes | jq -r '.data | {id,status,template,createdBy}')
echo "$NEW_T"
T_ID=$(echo "$NEW_T" | jq -r .id)

echo "--- [2] central_ga POST /:id/fetch-coverage (期望返 coverage 数组 ~13-19) ---"
curl -sX POST -H "Authorization: Bearer $TOKEN_CG" "http://localhost:3001/api/v1/themes/$T_ID/fetch-coverage" | jq '.data | length'

echo "--- [3] central_ga POST /:id/publish (期望 status=published) ---"
curl -sX POST -H "Authorization: Bearer $TOKEN_CG" "http://localhost:3001/api/v1/themes/$T_ID/publish" | jq '.data | {id,status,publishedAt}'

echo "--- [4] local_ga POST /themes (期望 403) ---"
curl -sX POST -H "Authorization: Bearer $TOKEN_LG" -H "Content-Type: application/json" \
  -d '{"title":"X","template":"main"}' -w "\nHTTP=%{http_code}\n" \
  http://localhost:3001/api/v1/themes | head -3

echo "--- [5] central_ga POST /:id/publish 但 coverage=0 测试(创新主题不拉取直接发布)---"
NEW_T2=$(curl -sX POST -H "Authorization: Bearer $TOKEN_CG" -H "Content-Type: application/json" \
  -d '{"title":"无 coverage 测试","template":"risk"}' \
  http://localhost:3001/api/v1/themes | jq -r '.data.id')
curl -sX POST -H "Authorization: Bearer $TOKEN_CG" -w "\nHTTP=%{http_code}\n" \
  "http://localhost:3001/api/v1/themes/$NEW_T2/publish" | head -3

echo "--- 清理 ---"
psql -U pop -d pop -c "DELETE FROM themes WHERE id IN ('$T_ID', '$NEW_T2');" 2>&1
```

期望(逐项):
- [1] status=draft, template=main
- [2] coverage 数组长度 13-19(5-8 + 8-11)
- [3] status=published, publishedAt 不空
- [4] HTTP=403,文案「只有管理员/中台 GA」
- [5] HTTP=400,文案「发布前必须先拉取覆盖清单」

- [ ] **Step 6.6: commit**

```bash
git add apps/api/src/themes/themes.controller.ts apps/api/src/themes/themes.module.ts apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): ThemesController + ThemesModule + 挂载到 AppModule

8 个 endpoint:
  GET /themes(?status= 筛选)
  GET /themes/:id(含 coverage)
  POST /themes
  PUT /themes/:id
  POST /themes/:id/fetch-coverage
  POST /themes/:id/publish
  POST /themes/:id/archive
  POST /themes/:id/unarchive

curl e2e 5 路径全过(create/fetch/publish + RBAC 403 + publish 缺 coverage 400)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7:Seed migration — 2 个 published 主题 + mock coverage

**Files:**
- Create: `apps/api/src/database/migrations/{epochMs}-SeedDemoThemes.ts`

- [ ] **Step 7.1: 写 seed migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDemoThemes{TIMESTAMP} implements MigrationInterface {
  name = 'SeedDemoThemes{TIMESTAMP}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const userRows = await queryRunner.query(
      `SELECT id FROM users WHERE username = 'central_ga' LIMIT 1`,
    );
    if (userRows.length === 0) {
      console.warn('[seed] central_ga 用户不存在,跳过 themes seed');
      return;
    }
    const cgId: string = userRows[0].id;

    // Theme 1: 智能网联汽车 主线政策
    const t1Result = await queryRunner.query(
      `INSERT INTO themes (title, template, keywords, region_scope, status, created_by, published_at)
       VALUES ('智能网联汽车主线政策', 'main', ARRAY['智能网联','自动驾驶','车路协同'], '全国 + 重点示范区',
               'published', $1, NOW())
       RETURNING id`,
      [cgId],
    );
    const t1Id: string = t1Result[0].id;

    // Theme 1 coverage: 5 省 + 8 市
    const t1Coverage: Array<[string, string, number]> = [
      ['110000', 'province', 12], ['310000', 'province', 18], ['440000', 'province', 25],
      ['510000', 'province', 22], ['320000', 'province', 15],
      ['110100', 'city', 8], ['310100', 'city', 14], ['440100', 'city', 18],
      ['440300', 'city', 16], ['510100', 'city', 20], ['510700', 'city', 9],
      ['320100', 'city', 11], ['320500', 'city', 7],
    ];
    for (const [code, level, value] of t1Coverage) {
      await queryRunner.query(
        `INSERT INTO theme_coverage (theme_id, region_code, region_level, main_value)
         VALUES ($1, $2, $3, $4)`,
        [t1Id, code, level, value],
      );
    }

    // Theme 2: 数据安全 核心风险
    const t2Result = await queryRunner.query(
      `INSERT INTO themes (title, template, keywords, region_scope, status, created_by, published_at)
       VALUES ('数据安全核心风险', 'risk', ARRAY['数据出境','个人信息保护','跨境流通'], '全国',
               'published', $1, NOW())
       RETURNING id`,
      [cgId],
    );
    const t2Id: string = t2Result[0].id;

    // Theme 2 coverage: 6 省 + 10 市
    const t2Coverage: Array<[string, string, number, object]> = [
      ['110000', 'province', 85, { complaintCount: 170 }],
      ['310000', 'province', 120, { complaintCount: 240 }],
      ['440000', 'province', 95, { complaintCount: 190 }],
      ['510000', 'province', 60, { complaintCount: 120 }],
      ['320000', 'province', 75, { complaintCount: 150 }],
      ['330000', 'province', 50, { complaintCount: 100 }],
      ['110100', 'city', 65, { complaintCount: 130 }],
      ['310100', 'city', 90, { complaintCount: 180 }],
      ['310101', 'district', 30, { complaintCount: 60 }],
      ['440100', 'city', 70, { complaintCount: 140 }],
      ['440300', 'city', 55, { complaintCount: 110 }],
      ['510100', 'city', 45, { complaintCount: 90 }],
      ['320100', 'city', 60, { complaintCount: 120 }],
      ['330100', 'city', 40, { complaintCount: 80 }],
      ['350100', 'city', 35, { complaintCount: 70 }],
      ['420100', 'city', 30, { complaintCount: 60 }],
    ];
    for (const [code, level, value, extra] of t2Coverage) {
      await queryRunner.query(
        `INSERT INTO theme_coverage (theme_id, region_code, region_level, main_value, extra_data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [t2Id, code, level, value, JSON.stringify(extra)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM themes WHERE title IN ('智能网联汽车主线政策', '数据安全核心风险')`);
    // theme_coverage 自动 CASCADE
  }
}
```

- [ ] **Step 7.2: 跑 migration**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/api && npm run migration:run 2>&1 | tail -10
```

- [ ] **Step 7.3: psql 验证 seed**

```bash
psql -U pop -d pop -tAc "SELECT title, template, status, array_length(keywords, 1) FROM themes ORDER BY title;"
psql -U pop -d pop -tAc "SELECT t.title, COUNT(c.*) AS coverage_count FROM themes t LEFT JOIN theme_coverage c ON c.theme_id=t.id GROUP BY t.title ORDER BY t.title;"
```

期望:看到 2 行 themes / coverage 数 13 + 16 = 29 条。

- [ ] **Step 7.4: commit**

```bash
git add apps/api/src/database/migrations/*-SeedDemoThemes.ts
git commit -m "$(cat <<'EOF'
feat(api): seed 2 个 published 主题 + 29 条 coverage(智能网联 13 + 数据安全 16)

demo 一开就能在 /map/policy 看到涂层:
- 智能网联汽车主线政策(main):5 省 + 8 市
- 数据安全核心风险(risk):6 省 + 10 市(含 1 区级)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8:前端 api/themes.ts 集中 fetcher

**Files:**
- Create: `apps/web/src/api/themes.ts`

- [ ] **Step 8.1: 写文件**

```typescript
import type {
  Theme,
  ThemeCoverage,
  ThemeWithCoverage,
  CreateThemeInput,
  UpdateThemeInput,
  ThemeStatus,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

async function jsonOrThrow<T>(r: Response, fallbackMsg: string): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? fallbackMsg);
  }
  return r.json();
}

export async function fetchThemes(opts?: { status?: ThemeStatus | 'all' }): Promise<{ data: Theme[] }> {
  const q = opts?.status ? `?status=${opts.status}` : '';
  const r = await fetch(`/api/v1/themes${q}`, { headers: authHeaders() });
  return jsonOrThrow(r, 'themes fetch fail');
}

export async function fetchTheme(id: string): Promise<{ data: ThemeWithCoverage }> {
  const r = await fetch(`/api/v1/themes/${id}`, { headers: authHeaders() });
  return jsonOrThrow(r, 'theme fetch fail');
}

export async function postTheme(input: CreateThemeInput): Promise<Theme> {
  const r = await fetch(`/api/v1/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'theme create fail');
  return j.data;
}

export async function putTheme(id: string, input: UpdateThemeInput): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'theme update fail');
  return j.data;
}

export async function fetchCoverage(id: string): Promise<ThemeCoverage[]> {
  const r = await fetch(`/api/v1/themes/${id}/fetch-coverage`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: ThemeCoverage[] }>(r, 'fetch coverage fail');
  return j.data;
}

export async function publishTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'publish fail');
  return j.data;
}

export async function archiveTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'archive fail');
  return j.data;
}

export async function unarchiveTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/unarchive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'unarchive fail');
  return j.data;
}
```

- [ ] **Step 8.2: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

- [ ] **Step 8.3: commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/web/src/api/themes.ts
git commit -m "$(cat <<'EOF'
feat(web): apps/web/src/api/themes.ts(fetchThemes / fetchTheme / postTheme / putTheme / fetchCoverage / publish / archive / unarchive)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9:ThemesTab + ThemeFormModal + ThemeDetailDrawer

**Files:**
- Create: `apps/web/src/pages/console/ThemesTab.tsx`
- Create: `apps/web/src/components/ThemeFormModal.tsx`
- Create: `apps/web/src/components/ThemeDetailDrawer.tsx`

⚠️ 这是 T9 最大组件 task,~3 个文件 ~400 行。先 Read PinsTab + ThemeFormModal + ThemeDetailDrawer 的现有 PinsTab 样板做参考。

- [ ] **Step 9.1: Read 参考文件**

- 看 `apps/web/src/pages/console/PinsTab.tsx`(Segmented + 双 useQuery 模板)
- 看 `apps/web/src/components/PinFormModal.tsx`(antd Form + useMutation 模板)
- 看 `apps/web/src/components/PinDetailDrawer.tsx`(详情 + 状态切换按钮组模板)

- [ ] **Step 9.2: 写 `ThemeFormModal.tsx`**

```typescript
import { useEffect } from 'react';
import { Form, Input, Modal, Radio, Select, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  THEME_TEMPLATE_LABEL,
  type Theme,
  type ThemeTemplate,
  type CreateThemeInput,
  type UpdateThemeInput,
} from '@pop/shared-types';
import { postTheme, putTheme } from '@/api/themes';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Theme;
}

interface FormValues {
  title: string;
  template: ThemeTemplate;
  keywords: string[];
  regionScope?: string;
}

export function ThemeFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        template: editing.template,
        keywords: editing.keywords ?? [],
        regionScope: editing.regionScope ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ template: 'main', keywords: [] });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const input: UpdateThemeInput = {
          title: values.title,
          keywords: values.keywords,
          regionScope: values.regionScope || null,
        };
        return putTheme(editing.id, input);
      } else {
        const input: CreateThemeInput = {
          title: values.title,
          template: values.template,
          keywords: values.keywords,
          regionScope: values.regionScope,
        };
        return postTheme(input);
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['themes'] });
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑政策主题' : '新建政策主题'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="模板" name="template" rules={[{ required: true }]}>
          <Radio.Group disabled={!!editing}>
            <Radio value="main">{THEME_TEMPLATE_LABEL.main}</Radio>
            <Radio value="risk">{THEME_TEMPLATE_LABEL.risk}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
          <Input maxLength={100} placeholder="比如:智能网联汽车主线政策" />
        </Form.Item>
        <Form.Item label="关键词" name="keywords">
          <Select mode="tags" placeholder="按回车添加,如:数据出境 / 个保法" />
        </Form.Item>
        <Form.Item label="地域范围" name="regionScope">
          <Input placeholder="可选,如:全国 / 长三角 / 粤港澳大湾区" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 9.3: 写 `ThemeDetailDrawer.tsx`**

```typescript
import { Button, Descriptions, Drawer, Empty, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudDownloadOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  THEME_TEMPLATE_LABEL,
  UserRoleCode,
  type ThemeStatus,
  type ThemeRegionLevel,
} from '@pop/shared-types';
import { archiveTheme, fetchCoverage, fetchTheme, publishTheme, unarchiveTheme } from '@/api/themes';
import { useAuthStore } from '@/stores/auth';

const { Text } = Typography;

const STATUS_TAG: Record<ThemeStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'default', label: '已归档' },
};

const LEVEL_LABEL: Record<ThemeRegionLevel, string> = {
  province: '省级',
  city: '市级',
  district: '区级',
};

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

interface Props {
  themeId: string | null;
  onClose: () => void;
}

export function ThemeDetailDrawer({ themeId, onClose }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canWrite = currentUser ? THEME_WRITE_ALLOWED_ROLES.has(currentUser.roleCode) : false;

  const { data, isLoading } = useQuery({
    queryKey: ['theme', themeId],
    queryFn: () => fetchTheme(themeId as string),
    enabled: !!themeId,
  });

  const theme = data?.data;

  const fetchCovMut = useMutation({
    mutationFn: () => fetchCoverage(themeId as string),
    onSuccess: () => {
      message.success('覆盖清单已更新');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`拉取失败: ${(err as Error).message}`),
  });

  const publishMut = useMutation({
    mutationFn: () => publishTheme(themeId as string),
    onSuccess: () => {
      message.success('已发布');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`发布失败: ${(err as Error).message}`),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveTheme(themeId as string),
    onSuccess: () => {
      message.success('已归档');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`归档失败: ${(err as Error).message}`),
  });

  const unarchiveMut = useMutation({
    mutationFn: () => unarchiveTheme(themeId as string),
    onSuccess: () => {
      message.success('已恢复');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`恢复失败: ${(err as Error).message}`),
  });

  return (
    <Drawer
      title={
        theme ? (
          <Space>
            <Text strong style={{ fontSize: 15 }}>{theme.title}</Text>
            <Tag color={STATUS_TAG[theme.status].color}>{STATUS_TAG[theme.status].label}</Tag>
          </Space>
        ) : '加载中…'
      }
      placement="right"
      width={520}
      open={!!themeId}
      onClose={onClose}
      destroyOnClose
    >
      {isLoading || !theme ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          {canWrite && (
            <Space style={{ marginBottom: 16 }} wrap>
              {theme.status !== 'archived' && (
                <Button
                  icon={<CloudDownloadOutlined />}
                  loading={fetchCovMut.isPending}
                  onClick={() => fetchCovMut.mutate()}
                >
                  {theme.coverage.length > 0 ? '重新拉取覆盖' : '拉取覆盖清单'}
                </Button>
              )}
              {theme.status === 'draft' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={publishMut.isPending}
                  disabled={theme.coverage.length === 0}
                  onClick={() => publishMut.mutate()}
                >
                  发布
                </Button>
              )}
              {theme.status === 'published' && (
                <Button
                  danger
                  icon={<InboxOutlined />}
                  loading={archiveMut.isPending}
                  onClick={() => archiveMut.mutate()}
                >
                  归档
                </Button>
              )}
              {theme.status === 'archived' && (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={unarchiveMut.isPending}
                  onClick={() => unarchiveMut.mutate()}
                >
                  恢复发布
                </Button>
              )}
            </Space>
          )}

          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="模板">{THEME_TEMPLATE_LABEL[theme.template]}</Descriptions.Item>
            <Descriptions.Item label="关键词">
              {theme.keywords.length > 0
                ? theme.keywords.map((k) => <Tag key={k}>{k}</Tag>)
                : <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="地域范围">
              {theme.regionScope ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="发布时间">
              {theme.publishedAt ? theme.publishedAt.replace('T', ' ').slice(0, 16) : <Text type="secondary">—</Text>}
            </Descriptions.Item>
          </Descriptions>

          <Text strong>覆盖清单 ({theme.coverage.length})</Text>
          <Table
            size="small"
            style={{ marginTop: 8 }}
            dataSource={theme.coverage}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无覆盖记录,点上方「拉取覆盖清单」" /> }}
            columns={[
              { title: '区划码', dataIndex: 'regionCode' as const, width: 100 },
              {
                title: '层级',
                dataIndex: 'regionLevel' as const,
                width: 80,
                render: (l: ThemeRegionLevel) => LEVEL_LABEL[l],
              },
              {
                title: '主属性值',
                dataIndex: 'mainValue' as const,
                width: 100,
                sorter: (a, b) => a.mainValue - b.mainValue,
                defaultSortOrder: 'descend' as const,
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 9.4: 写 `ThemesTab.tsx`**

```typescript
import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { THEME_TEMPLATE_LABEL, UserRoleCode, type Theme, type ThemeStatus, type ThemeTemplate } from '@pop/shared-types';
import { fetchThemes } from '@/api/themes';
import { ThemeFormModal } from '@/components/ThemeFormModal';
import { ThemeDetailDrawer } from '@/components/ThemeDetailDrawer';
import { useAuthStore } from '@/stores/auth';

const { Title } = Typography;

const STATUS_TAG: Record<ThemeStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'default', label: '已归档' },
};

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

type View = 'active' | 'archived';

export function ThemesTab() {
  const currentUser = useAuthStore((s) => s.user);
  const canWrite = currentUser ? THEME_WRITE_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [view, setView] = useState<View>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Theme | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useQuery({
    queryKey: ['themes', 'active'],
    queryFn: () => fetchThemes(),
  });

  const archived = useQuery({
    queryKey: ['themes', 'archived'],
    queryFn: () => fetchThemes({ status: 'archived' }),
  });

  const activeThemes = active.data?.data ?? [];
  const archivedThemes = archived.data?.data ?? [];
  const currentList = view === 'active' ? activeThemes : archivedThemes;
  const currentLoading = view === 'active' ? active.isLoading : archived.isLoading;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>政策主题管理 ({currentList.length})</Title>
        {canWrite && view === 'active' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(undefined); setModalOpen(true); }}
          >
            新建主题
          </Button>
        )}
      </Space>

      <Segmented<View>
        style={{ marginBottom: 16 }}
        value={view}
        onChange={setView}
        options={[
          { label: `活跃 (${activeThemes.length})`, value: 'active' },
          { label: `归档 (${archivedThemes.length})`, value: 'archived' },
        ]}
      />

      <Table
        dataSource={currentList}
        rowKey="id"
        loading={currentLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title' as const,
            ellipsis: true,
            render: (t: string, r: Theme) => (
              <a onClick={() => setSelectedId(r.id)}>{t}</a>
            ),
          },
          {
            title: '模板',
            dataIndex: 'template' as const,
            width: 110,
            render: (tpl: ThemeTemplate) => THEME_TEMPLATE_LABEL[tpl],
          },
          {
            title: '状态',
            dataIndex: 'status' as const,
            width: 100,
            render: (s: ThemeStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>,
          },
          {
            title: '关键词',
            dataIndex: 'keywords' as const,
            ellipsis: true,
            render: (kws: string[]) => kws.length > 0
              ? kws.slice(0, 3).map((k) => <Tag key={k}>{k}</Tag>)
              : '—',
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt' as const,
            width: 170,
            sorter: (a: Theme, b: Theme) => a.createdAt.localeCompare(b.createdAt),
            defaultSortOrder: 'descend' as const,
            render: (v: string) => v.replace('T', ' ').slice(0, 16),
          },
          ...(canWrite ? [{
            title: '操作',
            width: 80,
            render: (_: unknown, r: Theme) => (
              <Button size="small" type="link" onClick={() => { setEditing(r); setModalOpen(true); }}>
                编辑
              </Button>
            ),
          }] : []),
        ]}
      />

      <ThemeFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <ThemeDetailDrawer themeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
```

- [ ] **Step 9.5: 把 ThemesTab 接到 console 路由**

Read `apps/web/src/lib/console-tabs.ts` 看现有 tab key=themes 的 path,然后 Read `apps/web/src/App.tsx`(或路由配置)看 console 子路由是怎么挂的。把 ThemesTab 接进去 — 通常是在 console 的 `<Route>` 列表里加:

```typescript
import { ThemesTab } from '@/pages/console/ThemesTab';
// ...
<Route path="themes" element={<ThemesTab />} />
```

⚠️ 实际接入位置因路由结构而异,implementer 找出正确位置(看 PinsTab 是怎么挂的,对齐)。

- [ ] **Step 9.6: typecheck + 浏览器实测**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

浏览器(controller 验):
- 用 sysadmin 登录 → /console/themes → 看到 Segmented `[活跃 (2) | 归档 (0)]` + 2 行 seed 主题
- 点行的「智能网联汽车主线政策」标题 → ThemeDetailDrawer 弹出 → 显示 13 条覆盖

- [ ] **Step 9.7: commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/web/src/pages/console/ThemesTab.tsx apps/web/src/components/ThemeFormModal.tsx apps/web/src/components/ThemeDetailDrawer.tsx
# 还要 add console 路由文件(implementer 找出后)
git commit -m "$(cat <<'EOF'
feat(web): ThemesTab + ThemeFormModal + ThemeDetailDrawer (政策主题管理)

- ThemesTab:Segmented 双视图 [活跃 / 归档],按 RBAC 显示「+新建」/「编辑」
- ThemeFormModal:模板 Radio + 关键词 tags 输入
- ThemeDetailDrawer:Descriptions + 覆盖 Table + 状态切换按钮组
  · 拉取覆盖(loading)/ 发布(校验 coverage>=1)/ 归档 / 恢复

复用 PinsTab/PinDetailDrawer 模式,RBAC 写权限 sys_admin/central_ga。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10:MapCanvas 加 themeOverlays 渲染层

**Files:**
- Modify: `apps/web/src/components/MapCanvas.tsx`

⚠️ MapCanvas 是 ECharts 关键组件。涂层渲染插入到现有 visit/pin scatter series **之前**(确保 visit/pin 在最上层)。

- [ ] **Step 10.1: 先 Read MapCanvas.tsx 确认 series 结构**

记下:
- 现有 series 数量(应 2 个:visits + pins)
- option 整体形态(geo + series 数组)
- visualMap 是否已有(估计没有,要新加)

- [ ] **Step 10.2: 改 props 接受 themeOverlays**

文件顶部 interface Props 加:

```typescript
import type { ThemeCoverage } from '@pop/shared-types';

interface Props {
  // ... 现有 props
  themeOverlays?: ThemeOverlay[];   // 新加
}

export interface ThemeOverlay {
  themeId: string;
  themeTitle: string;
  template: 'main' | 'risk';
  coverage: ThemeCoverage[];
}
```

- [ ] **Step 10.3: option 计算加 overlay series + visualMap**

在现有 useMemo 计算 option 的地方,在 `series: [...]` 数组前面 prepend overlay series。逻辑:

```typescript
// 按 currentProvinceCode 决定 region_level filter
// 全国层 (provinceCode=null):
//   province → 进 visualMap geo(背景色块)
//   city → scatter,size by mainValue
// 省级层 (provinceCode 不为 null):
//   city → 色块(分别 visualMap)— 但 ECharts 单 visualMap 限制,简化为 scatter 大点
//   district → scatter 小点

const overlaySeries = (themeOverlays ?? []).flatMap((overlay, idx) => {
  const opacity = 0.8 - idx * 0.2;  // 多层叠加用透明度区分:0.8 / 0.6 / 0.4
  const isProvinceLayer = !provinceCode;
  const filterLevel = isProvinceLayer ? 'city' : 'district';
  const points = overlay.coverage.filter((c) => c.regionLevel === filterLevel);

  // 简化:只用 scatter,size by mainValue,不用 visualMap geo(避免单 instance 多 visualMap 冲突)
  // 实际 demo 视觉:同坐标多层叠加靠透明度 + 不同色相区分
  const colorByTemplate = overlay.template === 'main' ? '#1677ff' : '#ff4d4f';
  return [{
    name: `涂层:${overlay.themeTitle}`,
    type: 'scatter' as const,
    coordinateSystem: 'geo' as const,
    geoIndex: 0,
    z: 3,
    data: points.map((c) => ({
      name: `${overlay.themeTitle} · ${c.regionCode}`,
      // regionCode 转坐标:用 regionCenters lookup(后端提供 / 前端 mock)
      // 简化:这里假设 coverage 行直接带 lng/lat — 实际后端没带,需要 regionCode → lng/lat 解析
      // 见 Step 10.4 处理 regionCode lookup
      value: regionCodeToLngLat(c.regionCode),
      mainValue: c.mainValue,
    })).filter((d) => d.value !== null),
    symbolSize: (val: any, params: any) => {
      const v = params?.data?.mainValue ?? 1;
      return Math.max(8, Math.min(40, v * 0.8));
    },
    itemStyle: { color: colorByTemplate, opacity },
  }];
});

// 然后 series: [...overlaySeries, /* 现有 visits scatter */, /* 现有 pins scatter */]
```

- [ ] **Step 10.4: 加 regionCodeToLngLat 工具**

⚠️ regionCode → lng/lat 是难点。最简单方案:

新建 `apps/web/src/lib/region-centers.ts`(纯前端 lookup 表,从 GeoJSON center 抽出);
或者更简单,直接用 visit 的 city center mock(因为 seed 用的城市重叠):

```typescript
// 简化版:复用现有 city center lookup(不存在的话,从 GeoJSON 文件加载)
// 文件已有 / 项目结构:apps/web/public/geojson/* 各省 GeoJSON
// 但 build 时计算 center 太重,demo 阶段可以先加几个 hardcode

const REGION_CENTERS: Record<string, [number, number]> = {
  '110000': [116.405285, 39.904989],   // 北京
  '310000': [121.472644, 31.231706],   // 上海
  '440000': [113.280637, 23.125178],   // 广东
  '510000': [104.065735, 30.659462],   // 四川
  '320000': [118.767413, 32.041544],   // 江苏
  '330000': [120.153576, 30.287459],   // 浙江
  '370000': [117.000923, 36.675807],   // 山东
  '420000': [114.298572, 30.584355],   // 湖北
  '430000': [112.982279, 28.19409],    // 湖南
  '500000': [106.504962, 29.533155],   // 重庆
  '610000': [108.948024, 34.263161],   // 陕西
  '350000': [119.306239, 26.075302],   // 福建
  '110100': [116.405285, 39.904989],   // 北京市辖区(同省级)
  '310100': [121.472644, 31.231706],   // 上海市辖区
  '310101': [121.4737, 31.2304],       // 黄浦区
  '440100': [113.280637, 23.125178],   // 广州市
  '440300': [114.085947, 22.547],      // 深圳市
  '510100': [104.065735, 30.659462],   // 成都市
  '510700': [104.679004, 31.467449],   // 绵阳市
  '320100': [118.767413, 32.041544],   // 南京市
  '320500': [120.585315, 31.298886],   // 苏州市
  '330100': [120.153576, 30.287459],   // 杭州市
  '330200': [121.549792, 29.868388],   // 宁波市
  '370100': [117.000923, 36.675807],   // 济南市
  '420100': [114.298572, 30.584355],   // 武汉市
  '430100': [112.982279, 28.19409],    // 长沙市
  '500100': [106.504962, 29.533155],   // 重庆市辖区
  '610100': [108.948024, 34.263161],   // 西安市
  '350100': [119.306239, 26.075302],   // 福州市
};

export function regionCodeToLngLat(code: string): [number, number] | null {
  return REGION_CENTERS[code] ?? null;
}
```

把这个 helper 写到 MapCanvas.tsx 里,或者 extract 到 `apps/web/src/lib/region-centers.ts`(更好)。

- [ ] **Step 10.5: typecheck**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

- [ ] **Step 10.6: commit**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/web/src/components/MapCanvas.tsx apps/web/src/lib/region-centers.ts
git commit -m "$(cat <<'EOF'
feat(web): MapCanvas 加 themeOverlays prop + regionCode → lng/lat 渲染

- 新 props themeOverlays: ThemeOverlay[]
- 按 currentProvinceCode 自动切层级(全国层 city / 省级层 district)
- 多层叠加用透明度区分(0.8/0.6/0.4)
- 模板色:main 蓝 / risk 红
- regionCode → lng/lat 用前端 lookup 表(28 个常用 region center)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11:MapShell 加涂层选择器

**Files:**
- Modify: `apps/web/src/pages/MapShell.tsx`

- [ ] **Step 11.1: Read 现有 MapShell.tsx 看 isPolicy 分支**

确认:
- 左面板 isPolicy 分支显示什么
- MapCanvas 现有 props 怎么传

- [ ] **Step 11.2: 改 MapShell 加 selectedThemeIds state + 涂层选择器 + 注入 themeOverlays 到 MapCanvas**

```typescript
import { useEffect, useState } from 'react';
// ... 现有 imports
import { Select } from 'antd';   // 已有 Button,补 Select
import { useQuery } from '@tanstack/react-query';
import { fetchThemes, fetchTheme } from '@/api/themes';
import type { Theme, ThemeWithCoverage } from '@pop/shared-types';

// 在组件内部 state 现有 useState 之后追加:
const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

// 拉 published themes for 选择器 options
const publishedThemes = useQuery({
  queryKey: ['themes', 'published'],
  queryFn: () => fetchThemes({ status: 'published' }),
  enabled: isPolicy,   // 只有政策大盘进时才拉
});

// 拉选中的每个 theme 完整信息(含 coverage)
const themeOverlaysData = useQuery({
  queryKey: ['theme-overlays', selectedThemeIds],
  queryFn: async () => {
    if (selectedThemeIds.length === 0) return [];
    const fetched = await Promise.all(selectedThemeIds.map((id) => fetchTheme(id)));
    return fetched.map((r) => r.data);
  },
  enabled: isPolicy && selectedThemeIds.length > 0,
});

const themeOverlays = (themeOverlaysData.data ?? []).map((t: ThemeWithCoverage) => ({
  themeId: t.id,
  themeTitle: t.title,
  template: t.template,
  coverage: t.coverage,
}));
```

在左面板 isPolicy 分支(当前是 Paragraph 占位)替换为:

```tsx
{isPolicy ? (
  <>
    <Paragraph style={{ color: palette.textMuted, fontSize: 12, marginBottom: 8 }}>
      涂层勾选(最多 3 层叠加)
    </Paragraph>
    <Select
      mode="multiple"
      maxCount={3}
      placeholder="选择政策主题涂层"
      value={selectedThemeIds}
      onChange={setSelectedThemeIds}
      options={(publishedThemes.data?.data ?? []).map((t: Theme) => ({
        label: t.title,
        value: t.id,
      }))}
      style={{ width: '100%' }}
      maxTagCount="responsive"
    />
  </>
) : (
  <Paragraph style={{ color: palette.textMuted, fontSize: 12, whiteSpace: 'pre-line' }}>
    {`· 时间窗口\n· 区划筛选\n· 角色筛选\n· (β.1 32 Visit + β.2 3 Pin · 形状区分)`}
  </Paragraph>
)}
```

把 `themeOverlays={themeOverlays}` 传给 `<MapCanvas>`:

```tsx
<MapCanvas
  provinceCode={currentProvinceCode}
  onProvinceChange={setCurrentProvinceCode}
  onVisitClick={setSelectedVisitId}
  onPinClick={setSelectedPinId}
  themeOverlays={isPolicy ? themeOverlays : undefined}
/>
```

- [ ] **Step 11.3: typecheck + 浏览器验证**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed/apps/web && npm run typecheck 2>&1 | tail -5
```

期望:0 error。

浏览器:
- 切到 /map/policy → 看到左面板涂层选择器,下拉显示 2 个 seed 主题
- 勾选 1 个 → 大盘出现散点(蓝色 / 红色 by template)
- 勾选 2 个 → 多色散点叠加
- 切回 /map/local → 涂层消失(themeOverlays={undefined})

- [ ] **Step 11.4: commit**

```bash
git add apps/web/src/pages/MapShell.tsx
git commit -m "$(cat <<'EOF'
feat(web): MapShell /map/policy 加涂层选择器 + 注入 themeOverlays 到 MapCanvas

- antd Select multi mode maxCount=3,options 来自 fetchThemes({status:'published'})
- selectedThemeIds 触发 themeOverlays 拉取(每个 theme 含 coverage)
- /map/local 不传 themeOverlays(只在 isPolicy 时启用)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12:e2e 浏览器主流程 + push + PR

**Files:** 无文件改动,纯 e2e 验证 + 集成。

- [ ] **Step 12.1: 浏览器走完整 8 步主流程**

```
[0] central_ga 登录 → 工作台「政策主题管理」 tab
[1] 看到 2 条 seed published 主题 + Segmented [活跃 (2) | 归档 (0)]
[2] +新建主题 → 模板「主线政策」+ 标题「e2e 测试主题」+ 关键词 tags → 保存
    → 列表 +1 行(状态 草稿,关键词 Tag)
[3] 点击新主题标题 → ThemeDetailDrawer → 「拉取覆盖清单」按钮(显示「拉取覆盖清单」文案)
    → 按钮 loading 后,Coverage Table 13-19 行
[4] 「发布」按钮(原本 disabled 因 coverage=0)→ 现在可点 → 点击 → 状态 published
    → Drawer Tag 切「已发布」
[5] 切到 /map/policy → 左面板涂层选择器 → 选「e2e 测试主题」+「智能网联汽车主线政策」
    → 大盘多个蓝色散点(双层叠加)
[6] 点击地图任一省下钻 → currentProvinceCode 切到省级 → 涂层自动切层级
    (注:实际可能 demo 中下钻范围内 district 数据少,可能视觉变化不明显 — 接受)
[7] 切回 /map/local → 涂层消失,visit/pin scatter 正常
[8] 退出登录 → 用 local_ga 登录 → /console/themes → 看到 3 行主题(只读),无「+新建」无「编辑」
    → /map/policy → 涂层选择器仍可用(读权限全开)
```

`preview_screenshot` 留 5 张证关键帧(步骤 1 / 3 / 5 / 7 / 8)。

- [ ] **Step 12.2: console_logs 检查**

```javascript
// preview_console_logs({ level: 'error' })
```

期望:只有已知 antd v5 弃用警告,无新功能 error。

- [ ] **Step 12.3: 回归保护检查**

```
- /console/visits 拜访清单(V0.6 β.3)显示正常 ✅
- /console/pins 图钉清单 + 回收站(Pin 回收站 #10)显示正常 ✅
- 大盘 /map/local visit/pin scatter 渲染正常 ✅
```

- [ ] **Step 12.4: 整体 typecheck + jest + build**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
npm run typecheck --workspaces --if-present 2>&1 | tail -5
cd apps/api && npx jest --silent 2>&1 | tail -5
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
cd apps/web && npm run build 2>&1 | tail -5
```

期望:typecheck 0 / jest 36 passed(原 25 + 新 11)/ web build OK。

- [ ] **Step 12.5: push + PR**

⚠️ Push 是 user-visible action,**先确认用户拍**再做。

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git push -u origin claude/c3-theme-b6-overlay
gh pr create --title "feat: V0.7 · c3 政策主题 + B6 涂层" --body "$(cat <<'EOF'
## Summary

PRD §1.4 中台 GA 角色 + §2.4 场景 3 + §6 涂层规则真落地。

- themes + theme_coverage 双表(1:N CASCADE),状态机 draft↔published↔archived
- `mockPolicyAnalysis` 确定性纯函数生成 ~13-19 条覆盖
- 工作台「政策主题管理」tab(Segmented 双视图 + 编辑 + 状态切换)
- /map/policy 左面板涂层选择器(antd Select multi maxCount=3)
- MapCanvas 加 themeOverlays prop,按 currentProvinceCode 自动切层级
- RBAC:写权限 sys_admin/central_ga,其他角色只读
- seed 2 个 published 主题 + 29 条 coverage,demo 一开就能看到涂层

依赖:基于 #10 (Pin 回收站) 分支起,先 merge #10 再 merge 本期更顺。

## Test plan

- [x] 后端 36 个 jest 全过(原 25 + 新 11)
- [x] curl 5 路径 RBAC e2e 全过(create/fetch/publish + 403/400)
- [x] 浏览器 8 步主流程 + RBAC 验证 + 回归保护
- [x] typecheck + build 0 error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 覆盖**:

| Spec 决策 | Task | 状态 |
|---|---|---|
| 数据模型 themes + theme_coverage | T2 | ✅ |
| 状态机 draft↔published↔archived | T4(service) | ✅ |
| 模板 main/risk | T1 (enum) + T4 (entity) | ✅ |
| mock-policy-analysis | T3 | ✅ |
| 涂层 1-3 层 | T11(maxCount=3) | ✅ |
| 渲染规则按层级 | T10 | ✅ |
| RBAC 写权限 | T4(service) + T11(前端隐藏) | ✅ |
| seed 2 个 published | T7 | ✅ |
| archived 默认排除 | T4(list 默认 != archived) | ✅ |
| coverage 重新拉取覆盖语义 | T5(事务 DELETE+INSERT) | ✅ |
| 发布前 coverage>=1 校验 | T4(publish) + T9(disabled 按钮) | ✅ |
| RBAC 错误路径 4 个 | T6 e2e curl Step 6.5 | ✅(部分,jest 已覆盖剩余路径) |
| 用户场景 8 步 | T12 Step 12.1 | ✅ |

**Coverage 完整,无遗漏**。

**2. Placeholder scan**: 全文搜「TBD」「TODO」「fill in」「TBD」 — 0。
- T9 Step 9.5 「implementer 找出正确位置(看 PinsTab 是怎么挂的,对齐)」 — 这是「安全护栏」(实际位置看代码现状),不是 placeholder。

**3. Type consistency**:
- `Theme / ThemeCoverage / ThemeWithCoverage` 在 T1 定义,T8 fetcher 引用,T9 组件引用 — 一致 ✓
- `THEME_TEMPLATE_LABEL` 在 T1 export,T9 引用 — 一致 ✓
- `THEME_WRITE_ALLOWED_ROLES` 在 T4(后端 service) 和 T9(前端 ThemeDetailDrawer) + T9 ThemesTab 各定义同名 Set,对齐 V0.6 #9 模式 ✓
- `mockPolicyAnalysis` T3 实现,T5 引用 — 一致 ✓
- `regionCodeToLngLat` T10 实现 + 引用 — 一致 ✓
- `ThemeOverlay` interface T10 export,T11 import 引用 — 一致 ✓

**4. 已知边界**:
- T10 涂层渲染简化为统一 scatter(没用 ECharts visualMap geo),demo 视觉够用,实际 PRD 期望的 province 色块需 V0.7+ 完善
- T11 themeOverlays 多 useQuery 调用(每选一主题 +1 fetch),N 主题 N 请求,3 层叠加上限 = 最多 3 个 fetch,可接受
- T12 Step 12.1 [6] 下钻视觉变化不明显接受 — 需要 demo 时调整截图选择

---

## Plan complete

**Saved to:** `docs/superpowers/plans/2026-04-28-c3-theme-b6-overlay-plan.md`

**预计:12 commits / 4-6 小时**

| # | Task | 估时 | 难度 |
|---|---|---|---|
| 1 | shared-types | 15min | 低 |
| 2 | DB migration | 15min | 低 |
| 3 | entities + mock | 30min | 中 |
| 4 | service + jest | 45min | 中 |
| 5 | coverage service | 20min | 低 |
| 6 | controller + module | 30min | 中 |
| 7 | seed migration | 20min | 低 |
| 8 | api fetcher | 15min | 低 |
| 9 | ThemesTab + Form + Drawer | 90min | 高 |
| 10 | MapCanvas overlay | 60min | 高 |
| 11 | MapShell selector | 30min | 中 |
| 12 | e2e + push | 30min | 低 |
