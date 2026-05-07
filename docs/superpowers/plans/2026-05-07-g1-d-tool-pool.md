# G1+G2+G8 · D 工具池 demo 闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 D 工具池 demo 闭环 —— 中台 GA 一次配工具(成品文档 + 调用接口 + 双模式绑定),属地 GA 在拜访点详情自动看到当地相关工具,接口工具按当地参数化生成定制产物。

**Architecture:** TypeORM migration 建 5 张新表(`tools` STI + `tool_bindings` 双模式 + `tool_consumption_logs`)。NestJS 4 模块:`tools` / `tool-bindings` / `tool-consumptions` / `external-mock`。前端复用现有 antd + react-query 模式,扩 `console/ToolsTab` + `VisitDetailDrawer` + 替换 G6 `MyConsumptionsPanel` stub。OSS 用阿里云 SDK + presigned PUT URL 直传(不过 ECS)。

**Tech Stack:** NestJS 10 + TypeORM 0.3 + PostgreSQL + ali-oss(新增依赖)+ React 18 + antd 5 + react-query

**Spec:** `docs/superpowers/specs/2026-05-07-g1-d-tool-pool-design.md`
**Working branch:** `claude/g1-d-tool-pool` off main `a7a7936`

---

## 重要前置(BLOCKED 等用户提供)

实施 **Task 8 OSS 集成** 之前需要:
1. OSS bucket 名 + 区域(建议香港区跟 ECS 同区)
2. AccessKey ID / Secret(子账号 scope 限本 bucket)
3. Bucket 公网读策略(本 plan 假设**公开读** —— 简单 + 反推 demo 阶段足够)
4. `.env` 改动授权(加 `OSS_*` 4 个变量)

未提供前 Task 1-7 + Task 9(后端)+ 前端 Task 10-12 都可以推进;Task 8 / Task 13(seed 真上传)需要前置满足。

---

## File Structure

| 路径 | 操作 | 职责 |
|---|---|---|
| `apps/api/src/database/migrations/1777600000000-CreateToolPool.ts` | **新** | 5 表 schema + 索引 + check constraint |
| `packages/shared-types/src/enums/tool-type.ts` | **新** | `document` / `interface` |
| `packages/shared-types/src/enums/tool-status.ts` | **新** | `draft` / `published` / `archived` |
| `packages/shared-types/src/enums/tool-taxonomy.ts` | **新** | D11 偷懒枚举 6 项 |
| `packages/shared-types/src/enums/binding-target.ts` | **新** | `pin` / `visit` / `region` |
| `packages/shared-types/src/enums/region-scope.ts` | **新** | `nationwide` / `all_provinces` / `all_cities_in_province` / `all_districts_in_city` / `specific` |
| `packages/shared-types/src/dtos/tool.dto.ts` | **新** | Tool / DocumentTool / InterfaceTool 类型 + Create/Update DTO |
| `packages/shared-types/src/dtos/tool-binding.dto.ts` | **新** | ToolBinding 类型 + Create DTO |
| `packages/shared-types/src/dtos/tool-consumption.dto.ts` | **新** | ToolConsumptionLog 类型 + 列表响应 |
| `packages/shared-types/src/dtos/external-mock.dto.ts` | **新** | D13 mock 请求/响应类型 |
| `apps/api/src/tools/entities/tool.entity.ts` | **新** | TypeORM 实体 |
| `apps/api/src/tools/entities/tool-binding.entity.ts` | **新** | |
| `apps/api/src/tools/entities/tool-consumption-log.entity.ts` | **新** | |
| `apps/api/src/tools/dtos/*.dto.ts` | **新** | Create/Update class-validator DTOs |
| `apps/api/src/tools/tools.module.ts` | **新** | NestJS 模块装配 |
| `apps/api/src/tools/tools.service.ts` | **新** | CRUD + 状态机 |
| `apps/api/src/tools/tools.controller.ts` | **新** | API endpoints |
| `apps/api/src/tools/bindings.service.ts` | **新** | ToolBinding CRUD |
| `apps/api/src/tools/cascading-match.service.ts` | **新** | 4.5.6 算法 |
| `apps/api/src/tools/consumption.service.ts` | **新** | 消费日志 写 + 查 |
| `apps/api/src/tools/oss.service.ts` | **新** | ali-oss 封装(presigned URL) |
| `apps/api/src/tools/__tests__/*.spec.ts` | **新** | service 单测(visits 模式) |
| `apps/api/src/external-mock/external-mock.module.ts` | **新** | D13 假外部系统模块 |
| `apps/api/src/external-mock/external-mock.controller.ts` | **新** | mock + fake static file |
| `apps/api/src/external-mock/external-mock.service.ts` | **新** | region 感知 mock 逻辑 |
| `apps/api/src/external-mock/__tests__/external-mock.service.spec.ts` | **新** | |
| `apps/api/src/app.module.ts` | **改** | 注册 ToolsModule + ExternalMockModule |
| `apps/api/src/seeds/tool-pool.seeder.ts` | **新** | 8 工具 seed(含 fake file 上传) |
| `apps/api/src/seeds/seeder.service.ts` | **改**(若存在)| 加 ToolPool seeder 调用 |
| `apps/web/src/api/tools.ts` | **新** | 前端 API helper |
| `apps/web/src/api/me.ts` | **改** | 加 `fetchMyConsumptions()` |
| `apps/web/src/pages/console/ToolsTab.tsx` | **改**(替换 stub)| 中台 ToolsTab 实体 |
| `apps/web/src/pages/console/ConsumptionTab.tsx` | **改**(替换 stub)| D12 中台消费明细 |
| `apps/web/src/components/tools/ToolFormModal.tsx` | **新** | 创建/编辑 modal |
| `apps/web/src/components/tools/ToolBindingPicker.tsx` | **新** | 绑定选择器(具体点 + 泛地域) |
| `apps/web/src/components/tools/ToolListInDrawer.tsx` | **新** | 属地 visit drawer 用 "可用工具" 区块 |
| `apps/web/src/components/VisitDetailDrawer.tsx` | **改** | 集成 ToolListInDrawer |
| `apps/web/src/components/me/MyConsumptionsPanel.tsx` | **改**(替换 G6 stub)| F4 真实数据 |
| `apps/api/.env.example` | **改** | 加 `OSS_*` 4 个变量样板 |
| `package.json` (api) | **改** | 加 `ali-oss` 依赖 |

---

## Task 1: Migration — 5 表 schema

**Files:**
- Create: `apps/api/src/database/migrations/1777600000000-CreateToolPool.ts`

- [ ] **Step 1.1: 创建 migration 文件**

参考 `1777500000000-CreatePolicies.ts` 的 raw SQL 模式。完整内容:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * G1 工具池 demo 闭环
 *
 * - tool_type / tool_status / tool_taxonomy / binding_target / region_scope 5 个 enum
 * - tools 表(STI:type discriminator)
 * - tool_bindings 表(双模式:具体点 OR 泛地域)
 * - tool_consumption_logs 表
 *
 * 约束:
 * - tools.file_url 仅 type='document' 可有
 * - tool_bindings target_type 决定 pin_id/visit_id/region_code 哪个非空
 */
export class CreateToolPool1777600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== Enums =====
    await queryRunner.query(`CREATE TYPE "tool_type" AS ENUM ('document', 'interface');`);
    await queryRunner.query(`CREATE TYPE "tool_status" AS ENUM ('draft', 'published', 'archived');`);
    await queryRunner.query(
      `CREATE TYPE "tool_taxonomy" AS ENUM ('ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other');`,
    );
    await queryRunner.query(`CREATE TYPE "binding_target" AS ENUM ('pin', 'visit', 'region');`);
    await queryRunner.query(
      `CREATE TYPE "region_scope" AS ENUM ('nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific');`,
    );

    // ===== tools =====
    await queryRunner.query(`
      CREATE TABLE "tools" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "tool_type" NOT NULL,
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT NULL,
        "taxonomy_tag" "tool_taxonomy" NOT NULL,
        "status" "tool_status" NOT NULL DEFAULT 'draft',
        "creator_id" UUID NOT NULL REFERENCES "users"("id"),
        "file_url" VARCHAR(500) NULL,
        "param_template" JSONB NULL,
        "response_mapping" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "ck_tools_type_fields" CHECK (
          (type = 'document' AND file_url IS NOT NULL AND param_template IS NULL)
          OR (type = 'interface' AND param_template IS NOT NULL AND file_url IS NULL)
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tools_creator" ON "tools"("creator_id");`);
    await queryRunner.query(`CREATE INDEX "idx_tools_status_type" ON "tools"("status", "type");`);

    // ===== tool_bindings =====
    await queryRunner.query(`
      CREATE TABLE "tool_bindings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tool_id" UUID NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
        "target_type" "binding_target" NOT NULL,
        "pin_id" UUID NULL REFERENCES "pins"("id") ON DELETE CASCADE,
        "visit_id" UUID NULL REFERENCES "visits"("id") ON DELETE CASCADE,
        "region_code" VARCHAR(8) NULL,
        "region_scope_tag" "region_scope" NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "ck_tool_bindings_target" CHECK (
          (target_type = 'pin' AND pin_id IS NOT NULL AND visit_id IS NULL AND region_code IS NULL)
          OR (target_type = 'visit' AND visit_id IS NOT NULL AND pin_id IS NULL AND region_code IS NULL)
          OR (target_type = 'region' AND region_scope_tag IS NOT NULL AND pin_id IS NULL AND visit_id IS NULL)
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_tool" ON "tool_bindings"("tool_id");`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_pin" ON "tool_bindings"("pin_id") WHERE pin_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_visit" ON "tool_bindings"("visit_id") WHERE visit_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_region" ON "tool_bindings"("region_code") WHERE region_code IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "idx_tool_bindings_scope" ON "tool_bindings"("region_scope_tag") WHERE region_scope_tag IS NOT NULL;`);

    // ===== tool_consumption_logs =====
    await queryRunner.query(`
      CREATE TABLE "tool_consumption_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tool_id" UUID NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
        "consumer_id" UUID NOT NULL REFERENCES "users"("id"),
        "consumed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "context_pin_id" UUID NULL REFERENCES "pins"("id") ON DELETE SET NULL,
        "context_visit_id" UUID NULL REFERENCES "visits"("id") ON DELETE SET NULL,
        "context_region_code" VARCHAR(8) NULL,
        "interface_response" JSONB NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tcl_consumer_time" ON "tool_consumption_logs"("consumer_id", "consumed_at" DESC);`);
    await queryRunner.query(`CREATE INDEX "idx_tcl_tool" ON "tool_consumption_logs"("tool_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tool_consumption_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tool_bindings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tools";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "region_scope";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "binding_target";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_taxonomy";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tool_type";`);
  }
}
```

- [ ] **Step 1.2: 跑 migration 并验证**

```bash
cd apps/api && npm run migration:run
```

Expected: 1 个新 migration 跑完无报错。

```bash
psql "$DATABASE_URL" -c "\d tools" -c "\d tool_bindings" -c "\d tool_consumption_logs"
```
预期 3 张表的字段 + check constraint 都在位。如果本地没 psql,跳过这步,通过 Step 1.3 的 typecheck 间接确认。

- [ ] **Step 1.3: build api 验证**

```bash
cd apps/api && npm run build
```
Expected: 0 errors.

- [ ] **Step 1.4: commit**

```bash
git add apps/api/src/database/migrations/1777600000000-CreateToolPool.ts
git commit -m "feat(db): G1 工具池 5 表 migration (tools / bindings / consumption logs)"
```

---

## Task 2: shared-types — enums + DTOs

**Files:**
- Create: `packages/shared-types/src/enums/{tool-type,tool-status,tool-taxonomy,binding-target,region-scope}.ts`
- Create: `packages/shared-types/src/dtos/tool.dto.ts`
- Create: `packages/shared-types/src/dtos/tool-binding.dto.ts`
- Create: `packages/shared-types/src/dtos/tool-consumption.dto.ts`
- Create: `packages/shared-types/src/dtos/external-mock.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 2.1: 写 5 个 enum 文件**

每个文件单独一个 const enum-like + type 导出。例如 `tool-type.ts`:
```ts
export const ToolType = { Document: 'document', Interface: 'interface' } as const;
export type ToolType = (typeof ToolType)[keyof typeof ToolType];
```

`tool-status.ts`:
```ts
export const ToolStatus = { Draft: 'draft', Published: 'published', Archived: 'archived' } as const;
export type ToolStatus = (typeof ToolStatus)[keyof typeof ToolStatus];
```

`tool-taxonomy.ts`:
```ts
export const ToolTaxonomy = {
  PptTemplate: 'ppt_template',
  TalkParamRef: 'talk_param_ref',
  LocalData: 'local_data',
  CooperationTemplate: 'cooperation_template',
  PolicyInterpretation: 'policy_interpretation',
  Other: 'other',
} as const;
export type ToolTaxonomy = (typeof ToolTaxonomy)[keyof typeof ToolTaxonomy];
```

`binding-target.ts`:
```ts
export const BindingTarget = { Pin: 'pin', Visit: 'visit', Region: 'region' } as const;
export type BindingTarget = (typeof BindingTarget)[keyof typeof BindingTarget];
```

`region-scope.ts`:
```ts
export const RegionScope = {
  Nationwide: 'nationwide',
  AllProvinces: 'all_provinces',
  AllCitiesInProvince: 'all_cities_in_province',
  AllDistrictsInCity: 'all_districts_in_city',
  Specific: 'specific',
} as const;
export type RegionScope = (typeof RegionScope)[keyof typeof RegionScope];
```

- [ ] **Step 2.2: 写 DTO 文件**

`tool.dto.ts`:
```ts
import type { ToolType } from '../enums/tool-type';
import type { ToolStatus } from '../enums/tool-status';
import type { ToolTaxonomy } from '../enums/tool-taxonomy';

export interface Tool {
  id: string;
  type: ToolType;
  title: string;
  description: string | null;
  taxonomyTag: ToolTaxonomy;
  status: ToolStatus;
  creatorId: string;
  fileUrl: string | null;
  paramTemplate: Record<string, unknown> | null;
  responseMapping: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDocumentToolRequestDto {
  type: 'document';
  title: string;
  description?: string;
  taxonomyTag: ToolTaxonomy;
  fileUrl: string; // 前端先调 /tools/upload-url 拿 OSS object URL,再传这里
}

export interface CreateInterfaceToolRequestDto {
  type: 'interface';
  title: string;
  description?: string;
  taxonomyTag: ToolTaxonomy;
  paramTemplate: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
}

export type CreateToolRequestDto = CreateDocumentToolRequestDto | CreateInterfaceToolRequestDto;

export interface UpdateToolRequestDto {
  title?: string;
  description?: string | null;
  taxonomyTag?: ToolTaxonomy;
  fileUrl?: string;
  paramTemplate?: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
}

export interface UploadUrlResponseDto {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}
```

`tool-binding.dto.ts`:
```ts
import type { BindingTarget } from '../enums/binding-target';
import type { RegionScope } from '../enums/region-scope';

export interface ToolBinding {
  id: string;
  toolId: string;
  targetType: BindingTarget;
  pinId: string | null;
  visitId: string | null;
  regionCode: string | null;
  regionScopeTag: RegionScope | null;
  createdAt: string;
}

export type CreateBindingRequestDto =
  | { targetType: 'pin'; pinId: string }
  | { targetType: 'visit'; visitId: string }
  | { targetType: 'region'; regionCode: string | null; regionScopeTag: RegionScope };
// regionCode null 仅在 regionScopeTag='nationwide' 时合法
```

`tool-consumption.dto.ts`:
```ts
import type { Tool } from './tool.dto';

export interface ToolConsumptionLog {
  id: string;
  toolId: string;
  consumerId: string;
  consumedAt: string;
  contextPinId: string | null;
  contextVisitId: string | null;
  contextRegionCode: string | null;
  interfaceResponse: Record<string, unknown> | null;
}

/** F4 列表/per-tool 列表共用 */
export interface ConsumptionLogWithTool extends ToolConsumptionLog {
  tool: Pick<Tool, 'id' | 'title' | 'type' | 'taxonomyTag'>;
}
```

`external-mock.dto.ts`:
```ts
export interface MockInvokeRequestDto {
  regionCode: string;
  themeCode?: string;
  configKey?: string;
}

export interface MockInvokeResponseDto {
  downloadUrl: string;
  summary: string;
  params: Record<string, string>;
  generatedAt: string;
}
```

- [ ] **Step 2.3: 在 `packages/shared-types/src/index.ts` 加导出**

打开文件,在合适的位置(跟其他 enum/dto 导出并列)加:
```ts
export * from './enums/tool-type';
export * from './enums/tool-status';
export * from './enums/tool-taxonomy';
export * from './enums/binding-target';
export * from './enums/region-scope';
export * from './dtos/tool.dto';
export * from './dtos/tool-binding.dto';
export * from './dtos/tool-consumption.dto';
export * from './dtos/external-mock.dto';
```

- [ ] **Step 2.4: build shared-types + typecheck**

```bash
cd packages/shared-types && npm run build
cd ../../apps/api && npm run build
cd ../web && npm run typecheck
```
全部 PASS。

- [ ] **Step 2.5: commit**

```bash
git add packages/shared-types/
git commit -m "feat(types): G1 tool / binding / consumption / external-mock DTOs + enums"
```

---

## Task 3: Tool entities + module skeleton

**Files:**
- Create: `apps/api/src/tools/entities/tool.entity.ts`
- Create: `apps/api/src/tools/entities/tool-binding.entity.ts`
- Create: `apps/api/src/tools/entities/tool-consumption-log.entity.ts`
- Create: `apps/api/src/tools/tools.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 3.1: 写 3 个 entity**

参考 `apps/api/src/visits/entities/visit.entity.ts` 的样式(Entity / Index / Column / ManyToOne / DeleteDateColumn 等)。

`tool.entity.ts`:
```ts
import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { ToolType, ToolStatus, ToolTaxonomy } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('tools')
@Index(['creatorId'])
@Index(['status', 'type'])
export class ToolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['document', 'interface'], enumName: 'tool_type' })
  type!: ToolType;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other'], enumName: 'tool_taxonomy', name: 'taxonomy_tag' })
  taxonomyTag!: ToolTaxonomy;

  @Column({ type: 'enum', enum: ['draft', 'published', 'archived'], enumName: 'tool_status', default: 'draft' })
  status!: ToolStatus;

  @Column({ type: 'uuid', name: 'creator_id' })
  creatorId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'creator_id' })
  creator?: UserEntity;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'file_url' })
  fileUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'param_template' })
  paramTemplate!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'response_mapping' })
  responseMapping!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
```

`tool-binding.entity.ts`:
```ts
import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BindingTarget, RegionScope } from '@pop/shared-types';
import { ToolEntity } from './tool.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';

@Entity('tool_bindings')
@Index(['toolId'])
@Index(['regionCode'])
export class ToolBindingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tool_id' })
  toolId!: string;

  @ManyToOne(() => ToolEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool?: ToolEntity;

  @Column({ type: 'enum', enum: ['pin', 'visit', 'region'], enumName: 'binding_target', name: 'target_type' })
  targetType!: BindingTarget;

  @Column({ type: 'uuid', nullable: true, name: 'pin_id' })
  pinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin?: PinEntity;

  @Column({ type: 'uuid', nullable: true, name: 'visit_id' })
  visitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit?: VisitEntity;

  @Column({ type: 'varchar', length: 8, nullable: true, name: 'region_code' })
  regionCode!: string | null;

  @Column({ type: 'enum', enum: ['nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific'], enumName: 'region_scope', nullable: true, name: 'region_scope_tag' })
  regionScopeTag!: RegionScope | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

`tool-consumption-log.entity.ts`:
```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ToolEntity } from './tool.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';

@Entity('tool_consumption_logs')
@Index(['consumerId', 'consumedAt'])
@Index(['toolId'])
export class ToolConsumptionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tool_id' })
  toolId!: string;

  @ManyToOne(() => ToolEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool?: ToolEntity;

  @Column({ type: 'uuid', name: 'consumer_id' })
  consumerId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'consumer_id' })
  consumer?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'consumed_at' })
  consumedAt!: Date;

  @Column({ type: 'uuid', nullable: true, name: 'context_pin_id' })
  contextPinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'context_pin_id' })
  contextPin?: PinEntity;

  @Column({ type: 'uuid', nullable: true, name: 'context_visit_id' })
  contextVisitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'context_visit_id' })
  contextVisit?: VisitEntity;

  @Column({ type: 'varchar', length: 8, nullable: true, name: 'context_region_code' })
  contextRegionCode!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'interface_response' })
  interfaceResponse!: Record<string, unknown> | null;
}
```

- [ ] **Step 3.2: 写 module skeleton(暂只注册 entities)**

`apps/api/src/tools/tools.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity]),
  ],
  providers: [],
  controllers: [],
  exports: [],
})
export class ToolsModule {}
```

- [ ] **Step 3.3: 在 app.module.ts 注册 ToolsModule**

打开 `apps/api/src/app.module.ts`,加 `ToolsModule` 的 import + `imports` 数组(参考 VisitsModule / PinsModule 的注册位置)。

- [ ] **Step 3.4: build api**

```bash
cd apps/api && npm run build
```
PASS。

- [ ] **Step 3.5: commit**

```bash
git add apps/api/src/tools/ apps/api/src/app.module.ts
git commit -m "feat(api): G1 ToolsModule skeleton + 3 entities"
```

---

## Task 4: Tools CRUD service + controller (D1-D5)

**Files:**
- Create: `apps/api/src/tools/dtos/create-tool.dto.ts`
- Create: `apps/api/src/tools/dtos/update-tool.dto.ts`
- Create: `apps/api/src/tools/tools.service.ts`
- Create: `apps/api/src/tools/tools.controller.ts`
- Create: `apps/api/src/tools/__tests__/tools.service.spec.ts`
- Modify: `apps/api/src/tools/tools.module.ts`

- [ ] **Step 4.1: 写 class-validator DTO**

`apps/api/src/tools/dtos/create-tool.dto.ts`:
```ts
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ToolType, ToolTaxonomy } from '@pop/shared-types';

export class CreateToolDto {
  @IsEnum(['document', 'interface'])
  type!: ToolType;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other'])
  taxonomyTag!: ToolTaxonomy;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsObject()
  @IsOptional()
  paramTemplate?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  responseMapping?: Record<string, unknown>;
}
```

`update-tool.dto.ts`:
```ts
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ToolTaxonomy } from '@pop/shared-types';

export class UpdateToolDto {
  @IsString() @MaxLength(100) @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string | null;
  @IsEnum(['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other']) @IsOptional() taxonomyTag?: ToolTaxonomy;
  @IsString() @IsOptional() fileUrl?: string;
  @IsObject() @IsOptional() paramTemplate?: Record<string, unknown>;
  @IsObject() @IsOptional() responseMapping?: Record<string, unknown>;
}
```

- [ ] **Step 4.2: 写 service 单测(TDD,参考 `visits.service.spec.ts` 模式)**

`apps/api/src/tools/__tests__/tools.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ToolsService } from '../tools.service';
import { ToolEntity } from '../entities/tool.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
});

const centralUser: AuthenticatedUser = {
  id: 'u-central',
  username: 'central1',
  displayName: '中台 GA 1',
  email: 'c@x.com',
  roleCode: UserRoleCode.CentralGa,
};

describe('ToolsService.create', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: getRepositoryToken(ToolEntity), useValue: repo },
      ],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('document 类型必须有 fileUrl', async () => {
    await expect(
      svc.create({ type: 'document', title: 'X', taxonomyTag: 'ppt_template' } as any, centralUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('interface 类型必须有 paramTemplate', async () => {
    await expect(
      svc.create({ type: 'interface', title: 'X', taxonomyTag: 'ppt_template' } as any, centralUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('document 创建成功 status=draft creator=current user', async () => {
    const out = await svc.create(
      { type: 'document', title: 'V2G 谈参', taxonomyTag: 'talk_param_ref', fileUrl: 'https://oss/x.pdf' } as any,
      centralUser,
    );
    expect(out.status).toBe('draft');
    expect(out.creatorId).toBe('u-central');
  });
});

describe('ToolsService.update', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: getRepositoryToken(ToolEntity), useValue: repo },
      ],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('非 creator 改不了', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'someone-else', type: 'document' });
    await expect(
      svc.update('t1', { title: 'new' }, centralUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creator 可以改', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', type: 'document' });
    repo.save.mockImplementation((x) => Promise.resolve(x));
    const out = await svc.update('t1', { title: 'new' }, centralUser);
    expect(out.title).toBe('new');
  });

  it('找不到工具抛 NotFound', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.update('t1', { title: 'x' }, centralUser)).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 4.3: 跑测试(应该 FAIL)**

```bash
cd apps/api && npm test -- tools.service.spec
```
Expected: FAIL — `ToolsService` not found / methods undefined。

- [ ] **Step 4.4: 写最小实现 `apps/api/src/tools/tools.service.ts`**

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';
import type { AuthenticatedUser, ToolStatus, ToolType } from '@pop/shared-types';

interface ListFilter {
  status?: ToolStatus;
  type?: ToolType;
  creatorId?: string;
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(ToolEntity) private readonly repo: Repository<ToolEntity>,
  ) {}

  async create(dto: CreateToolDto, user: AuthenticatedUser): Promise<ToolEntity> {
    if (dto.type === 'document' && !dto.fileUrl) {
      throw new BadRequestException('document 类型必须提供 fileUrl');
    }
    if (dto.type === 'interface' && !dto.paramTemplate) {
      throw new BadRequestException('interface 类型必须提供 paramTemplate');
    }
    const ent = this.repo.create({
      type: dto.type,
      title: dto.title,
      description: dto.description ?? null,
      taxonomyTag: dto.taxonomyTag,
      status: 'draft',
      creatorId: user.id,
      fileUrl: dto.type === 'document' ? dto.fileUrl! : null,
      paramTemplate: dto.type === 'interface' ? dto.paramTemplate! : null,
      responseMapping: dto.type === 'interface' ? dto.responseMapping ?? null : null,
    });
    return this.repo.save(ent);
  }

  async findOne(id: string): Promise<ToolEntity> {
    const t = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException(`Tool ${id} not found`);
    return t;
  }

  async list(filter: ListFilter): Promise<ToolEntity[]> {
    const where: any = { deletedAt: IsNull() };
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.creatorId) where.creatorId = filter.creatorId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async update(id: string, dto: UpdateToolDto, user: AuthenticatedUser): Promise<ToolEntity> {
    const t = await this.findOne(id);
    if (t.creatorId !== user.id) {
      throw new ForbiddenException('只能修改自己创建的工具');
    }
    Object.assign(t, {
      title: dto.title ?? t.title,
      description: dto.description !== undefined ? dto.description : t.description,
      taxonomyTag: dto.taxonomyTag ?? t.taxonomyTag,
      fileUrl: dto.fileUrl !== undefined ? dto.fileUrl : t.fileUrl,
      paramTemplate: dto.paramTemplate !== undefined ? dto.paramTemplate : t.paramTemplate,
      responseMapping: dto.responseMapping !== undefined ? dto.responseMapping : t.responseMapping,
    });
    return this.repo.save(t);
  }
}
```

- [ ] **Step 4.5: 写 controller `apps/api/src/tools/tools.controller.ts`**

```ts
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser, ToolStatus, ToolType } from '@pop/shared-types';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';

@Controller('tools')
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  @Get()
  async list(
    @Query('status') status?: ToolStatus,
    @Query('type') type?: ToolType,
    @Query('creatorId') creatorId?: string,
  ) {
    return { data: await this.service.list({ status, type, creatorId }) };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { data: await this.service.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateToolDto, @CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.create(dto, user) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateToolDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user) };
  }
}
```

- [ ] **Step 4.6: 注册 service + controller 到 module**

修改 `tools.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity]),
  ],
  providers: [ToolsService],
  controllers: [ToolsController],
  exports: [ToolsService],
})
export class ToolsModule {}
```

- [ ] **Step 4.7: 跑测试 + build PASS**

```bash
cd apps/api && npm test -- tools.service.spec && npm run build
```

- [ ] **Step 4.8: commit**

```bash
git add apps/api/src/tools/
git commit -m "feat(api): G1 Tools CRUD (D1-D5) + creator-only edit + 类型字段约束"
```

---

## Task 5: 状态机 (D6) + bindings (D10)

**Files:**
- Create: `apps/api/src/tools/bindings.service.ts`
- Create: `apps/api/src/tools/dtos/create-binding.dto.ts`
- Create: `apps/api/src/tools/__tests__/bindings.service.spec.ts`
- Create: `apps/api/src/tools/__tests__/tools.state-machine.spec.ts`
- Modify: `apps/api/src/tools/tools.service.ts` — 加 `publish/archive/restore` 方法
- Modify: `apps/api/src/tools/tools.controller.ts` — 加状态机 + bindings endpoints
- Modify: `apps/api/src/tools/tools.module.ts` — 加 BindingsService

- [ ] **Step 5.1: 写状态机测试**

`tools.state-machine.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ToolsService } from '../tools.service';
import { ToolEntity } from '../entities/tool.entity';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const centralUser: AuthenticatedUser = { id: 'u-central', username: 'c', displayName: 'C', email: 'c@x', roleCode: UserRoleCode.CentralGa };

describe('ToolsService 状态机', () => {
  let svc: ToolsService;
  let repo: any;

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn((x) => Promise.resolve(x)) };
    const module = await Test.createTestingModule({
      providers: [ToolsService, { provide: getRepositoryToken(ToolEntity), useValue: repo }],
    }).compile();
    svc = module.get(ToolsService);
  });

  it('publish: draft → published', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'draft' });
    const out = await svc.publish('t1', centralUser);
    expect(out.status).toBe('published');
  });

  it('publish: 非 draft 拒绝', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'published' });
    await expect(svc.publish('t1', centralUser)).rejects.toThrow(BadRequestException);
  });

  it('archive: published → archived', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'published' });
    const out = await svc.archive('t1', centralUser);
    expect(out.status).toBe('archived');
  });

  it('archive: draft 拒绝', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'draft' });
    await expect(svc.archive('t1', centralUser)).rejects.toThrow(BadRequestException);
  });

  it('restore: archived → published', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'u-central', status: 'archived' });
    const out = await svc.restore('t1', centralUser);
    expect(out.status).toBe('published');
  });

  it('非 creator 不能改状态', async () => {
    repo.findOne.mockResolvedValue({ id: 't1', creatorId: 'other', status: 'draft' });
    await expect(svc.publish('t1', centralUser)).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 5.2: 在 ToolsService 加状态机方法**

打开 `tools.service.ts`,在 `update` 方法后加:
```ts
async publish(id: string, user: AuthenticatedUser): Promise<ToolEntity> {
  return this.transition(id, user, 'draft', 'published');
}

async archive(id: string, user: AuthenticatedUser): Promise<ToolEntity> {
  return this.transition(id, user, 'published', 'archived');
}

async restore(id: string, user: AuthenticatedUser): Promise<ToolEntity> {
  return this.transition(id, user, 'archived', 'published');
}

private async transition(
  id: string,
  user: AuthenticatedUser,
  from: ToolStatus,
  to: ToolStatus,
): Promise<ToolEntity> {
  const t = await this.findOne(id);
  if (t.creatorId !== user.id) {
    throw new ForbiddenException('只能修改自己创建的工具');
  }
  if (t.status !== from) {
    throw new BadRequestException(`状态机:${from} → ${to} 不允许 (current=${t.status})`);
  }
  t.status = to;
  return this.repo.save(t);
}
```

跑 `npm test -- tools.state-machine.spec` 应 PASS。

- [ ] **Step 5.3: bindings DTO**

`apps/api/src/tools/dtos/create-binding.dto.ts`:
```ts
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { BindingTarget, RegionScope } from '@pop/shared-types';

export class CreateBindingDto {
  @IsEnum(['pin', 'visit', 'region'])
  targetType!: BindingTarget;

  @IsUUID() @IsOptional() pinId?: string;
  @IsUUID() @IsOptional() visitId?: string;
  @IsString() @IsOptional() regionCode?: string | null;
  @IsEnum(['nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific'])
  @IsOptional()
  regionScopeTag?: RegionScope;
}
```

- [ ] **Step 5.4: bindings 测试**

`apps/api/src/tools/__tests__/bindings.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BindingsService } from '../bindings.service';
import { ToolBindingEntity } from '../entities/tool-binding.entity';

describe('BindingsService.create', () => {
  let svc: BindingsService;
  let repo: any;

  beforeEach(async () => {
    repo = { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ ...x, id: 'b1' })), find: jest.fn(), delete: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [BindingsService, { provide: getRepositoryToken(ToolBindingEntity), useValue: repo }],
    }).compile();
    svc = module.get(BindingsService);
  });

  it('pin 模式必须有 pinId', async () => {
    await expect(svc.create('t1', { targetType: 'pin' } as any)).rejects.toThrow(BadRequestException);
  });

  it('visit 模式必须有 visitId', async () => {
    await expect(svc.create('t1', { targetType: 'visit' } as any)).rejects.toThrow(BadRequestException);
  });

  it('region 模式必须有 regionScopeTag', async () => {
    await expect(svc.create('t1', { targetType: 'region', regionCode: '110000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('region nationwide regionCode 可空', async () => {
    const out = await svc.create('t1', { targetType: 'region', regionScopeTag: 'nationwide' } as any);
    expect(out.regionScopeTag).toBe('nationwide');
    expect(out.regionCode).toBeNull();
  });

  it('region specific 必须有 regionCode', async () => {
    await expect(
      svc.create('t1', { targetType: 'region', regionScopeTag: 'specific' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('pin 模式正常创建', async () => {
    const out = await svc.create('t1', { targetType: 'pin', pinId: 'p1' } as any);
    expect(out.pinId).toBe('p1');
    expect(out.toolId).toBe('t1');
  });
});
```

- [ ] **Step 5.5: 写 BindingsService**

`apps/api/src/tools/bindings.service.ts`:
```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { CreateBindingDto } from './dtos/create-binding.dto';

@Injectable()
export class BindingsService {
  constructor(
    @InjectRepository(ToolBindingEntity) private readonly repo: Repository<ToolBindingEntity>,
  ) {}

  async create(toolId: string, dto: CreateBindingDto): Promise<ToolBindingEntity> {
    if (dto.targetType === 'pin' && !dto.pinId) throw new BadRequestException('pin 模式必须提供 pinId');
    if (dto.targetType === 'visit' && !dto.visitId) throw new BadRequestException('visit 模式必须提供 visitId');
    if (dto.targetType === 'region') {
      if (!dto.regionScopeTag) throw new BadRequestException('region 模式必须提供 regionScopeTag');
      if (dto.regionScopeTag !== 'nationwide' && !dto.regionCode) {
        throw new BadRequestException('region scope 非 nationwide 时必须提供 regionCode');
      }
    }
    const ent = this.repo.create({
      toolId,
      targetType: dto.targetType,
      pinId: dto.targetType === 'pin' ? dto.pinId! : null,
      visitId: dto.targetType === 'visit' ? dto.visitId! : null,
      regionCode: dto.targetType === 'region' ? (dto.regionCode ?? null) : null,
      regionScopeTag: dto.targetType === 'region' ? dto.regionScopeTag! : null,
    });
    return this.repo.save(ent);
  }

  async listByTool(toolId: string): Promise<ToolBindingEntity[]> {
    return this.repo.find({ where: { toolId }, order: { createdAt: 'ASC' } });
  }

  async delete(bindingId: string): Promise<void> {
    await this.repo.delete(bindingId);
  }
}
```

- [ ] **Step 5.6: controller 加 endpoints**

打开 `tools.controller.ts`,加:
```ts
// constructor 加 BindingsService
constructor(
  private readonly service: ToolsService,
  private readonly bindings: BindingsService,
) {}

@Post(':id/publish')
async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return { data: await this.service.publish(id, user) };
}

@Post(':id/archive')
async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return { data: await this.service.archive(id, user) };
}

@Post(':id/restore')
async restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return { data: await this.service.restore(id, user) };
}

@Get(':id/bindings')
async listBindings(@Param('id') id: string) {
  return { data: await this.bindings.listByTool(id) };
}

@Post(':id/bindings')
async addBinding(@Param('id') id: string, @Body() dto: CreateBindingDto) {
  return { data: await this.bindings.create(id, dto) };
}

@Delete(':id/bindings/:bid')
async deleteBinding(@Param('bid') bid: string) {
  await this.bindings.delete(bid);
  return { ok: true };
}
```
注意加 `Delete` 到 import:`import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';`。
注意加 `CreateBindingDto` import。

- [ ] **Step 5.7: module 注册 BindingsService**

`tools.module.ts` providers/exports 加 `BindingsService`。

- [ ] **Step 5.8: 跑全部测试 + build**

```bash
cd apps/api && npm test -- tools && npm run build
```
全 PASS。

- [ ] **Step 5.9: commit**

```bash
git add apps/api/src/tools/
git commit -m "feat(api): G1 状态机 (D6 publish/archive/restore) + bindings (D10)"
```

---

## Task 6: 级联匹配 (G2 / 4.5.6 算法)

**Files:**
- Create: `apps/api/src/tools/cascading-match.service.ts`
- Create: `apps/api/src/tools/__tests__/cascading-match.service.spec.ts`
- Modify: `apps/api/src/tools/tools.controller.ts` — 加 `GET /tools/by-point`
- Modify: `apps/api/src/tools/tools.module.ts` — 加 CascadingMatchService

- [ ] **Step 6.1: 写 cascading-match 测试**

`apps/api/src/tools/__tests__/cascading-match.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CascadingMatchService } from '../cascading-match.service';
import { ToolEntity } from '../entities/tool.entity';
import { ToolBindingEntity } from '../entities/tool-binding.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';
import { PinEntity } from '../../pins/entities/pin.entity';

describe('CascadingMatchService.matchByVisit', () => {
  let svc: CascadingMatchService;
  let toolsRepo: any;
  let bindingsRepo: any;
  let visitsRepo: any;
  let pinsRepo: any;

  beforeEach(async () => {
    toolsRepo = { find: jest.fn() };
    bindingsRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    visitsRepo = { findOne: jest.fn() };
    pinsRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CascadingMatchService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolBindingEntity), useValue: bindingsRepo },
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
      ],
    }).compile();
    svc = module.get(CascadingMatchService);
  });

  it('上海长宁区 visit:级联匹配 含 全国 / 全省 / 全市 / 全区 / 区码 / visit 直绑',
    async () => {
      visitsRepo.findOne.mockResolvedValue({
        id: 'v1', provinceCode: '310000', cityCode: '310100', districtCode: '310105',
      });
      // mock bindings query: 返回 6 条 (各模式各 1)
      bindingsRepo.find.mockResolvedValue([
        { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
        { id: 'b2', toolId: 't2', targetType: 'region', regionScopeTag: 'all_provinces', regionCode: '310000' },
        { id: 'b3', toolId: 't3', targetType: 'region', regionScopeTag: 'all_cities_in_province', regionCode: '310000' },
        { id: 'b4', toolId: 't4', targetType: 'region', regionScopeTag: 'all_districts_in_city', regionCode: '310100' },
        { id: 'b5', toolId: 't5', targetType: 'region', regionScopeTag: 'specific', regionCode: '310105' },
        { id: 'b6', toolId: 't6', targetType: 'visit', visitId: 'v1' },
      ]);
      toolsRepo.find.mockResolvedValue([
        { id: 't1', title: 'A', taxonomyTag: 'policy_interpretation', status: 'published', createdAt: new Date() },
        { id: 't2', title: 'B', taxonomyTag: 'policy_interpretation', status: 'published', createdAt: new Date() },
        { id: 't3', title: 'C', taxonomyTag: 'talk_param_ref', status: 'published', createdAt: new Date() },
        { id: 't4', title: 'D', taxonomyTag: 'talk_param_ref', status: 'published', createdAt: new Date() },
        { id: 't5', title: 'E', taxonomyTag: 'local_data', status: 'published', createdAt: new Date() },
        { id: 't6', title: 'F', taxonomyTag: 'local_data', status: 'published', createdAt: new Date() },
      ]);

      const result = await svc.matchByVisit('v1');
      // 6 工具,3 个 group
      const totalTools = Object.values(result.groups).reduce((a, b) => a + b.length, 0);
      expect(totalTools).toBe(6);
      // policy_interpretation group 含 t1, t2
      expect(result.groups.policy_interpretation.map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    });

  it('去重:同一 tool 多 binding 命中只保留一条', async () => {
    visitsRepo.findOne.mockResolvedValue({ id: 'v1', provinceCode: '310000', cityCode: null, districtCode: null });
    bindingsRepo.find.mockResolvedValue([
      { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
      { id: 'b2', toolId: 't1', targetType: 'visit', visitId: 'v1' },
    ]);
    toolsRepo.find.mockResolvedValue([
      { id: 't1', title: 'A', taxonomyTag: 'other', status: 'published', createdAt: new Date() },
    ]);
    const result = await svc.matchByVisit('v1');
    const all = Object.values(result.groups).flat();
    expect(all.length).toBe(1);
  });

  it('过滤:archived/draft 工具不出现', async () => {
    visitsRepo.findOne.mockResolvedValue({ id: 'v1', provinceCode: '310000' });
    bindingsRepo.find.mockResolvedValue([
      { id: 'b1', toolId: 't1', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
      { id: 'b2', toolId: 't2', targetType: 'region', regionScopeTag: 'nationwide', regionCode: null },
    ]);
    toolsRepo.find.mockResolvedValue([
      { id: 't1', title: 'Pub', status: 'published', taxonomyTag: 'other', createdAt: new Date() },
      // t2 为 archived,toolsRepo.find 在 service 内会用 status=published 过滤
    ]);
    const result = await svc.matchByVisit('v1');
    const all = Object.values(result.groups).flat();
    expect(all.map((t) => t.id)).toEqual(['t1']);
  });
});
```

- [ ] **Step 6.2: 跑测试 — 应 FAIL**

```bash
cd apps/api && npm test -- cascading-match.service.spec
```

- [ ] **Step 6.3: 写 CascadingMatchService**

`apps/api/src/tools/cascading-match.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolBindingEntity } from './entities/tool-binding.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import type { ToolTaxonomy } from '@pop/shared-types';

interface RegionContext {
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
}

interface MatchResult {
  groups: Record<ToolTaxonomy, ToolEntity[]>;
}

const SCOPE_PRECISION: Record<string, number> = {
  district_specific: 4,
  city_specific: 3,
  province_specific: 2,
  all_districts_in_city: 3,
  all_cities_in_province: 2,
  all_provinces: 1,
  nationwide: 0,
};

@Injectable()
export class CascadingMatchService {
  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolBindingEntity) private readonly bindingsRepo: Repository<ToolBindingEntity>,
    @InjectRepository(VisitEntity) private readonly visitsRepo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
  ) {}

  async matchByVisit(visitId: string): Promise<MatchResult> {
    const visit = await this.visitsRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException(`Visit ${visitId} not found`);
    const ctx: RegionContext = {
      provinceCode: visit.provinceCode ?? null,
      cityCode: (visit as any).cityCode ?? null,
      districtCode: (visit as any).districtCode ?? null,
    };
    return this.match(ctx, { visitId });
  }

  async matchByPin(pinId: string): Promise<MatchResult> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);
    const ctx: RegionContext = {
      provinceCode: (pin as any).provinceCode ?? null,
      cityCode: (pin as any).cityCode ?? null,
      districtCode: (pin as any).districtCode ?? null,
    };
    return this.match(ctx, { pinId });
  }

  private async match(
    ctx: RegionContext,
    targetIds: { visitId?: string; pinId?: string },
  ): Promise<MatchResult> {
    // 1. 拉所有候选 binding(含具体点 + 泛地域 + 区码命中)
    const bindings = await this.bindingsRepo.find({
      where: this.buildBindingFilters(ctx, targetIds),
    });

    // 2. 抽 toolId,去重
    const toolIdSet = new Set(bindings.map((b) => b.toolId));
    if (toolIdSet.size === 0) return { groups: {} as any };

    // 3. 拉 published 工具
    const tools = await this.toolsRepo.find({
      where: { id: In([...toolIdSet]), status: 'published', deletedAt: IsNull() },
    });

    // 4. 对每个 tool 选最高精度的 binding(用于排序)
    const toolToBestPrecision = new Map<string, number>();
    for (const b of bindings) {
      const p = this.precisionOf(b);
      const cur = toolToBestPrecision.get(b.toolId) ?? -1;
      if (p > cur) toolToBestPrecision.set(b.toolId, p);
    }

    // 5. 分组 + 排序
    const groups: Record<string, ToolEntity[]> = {};
    for (const t of tools) {
      (groups[t.taxonomyTag] ??= []).push(t);
    }
    for (const tag of Object.keys(groups)) {
      groups[tag].sort((a, b) => {
        const pa = toolToBestPrecision.get(a.id) ?? 0;
        const pb = toolToBestPrecision.get(b.id) ?? 0;
        if (pa !== pb) return pb - pa; // 精度降序
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // createdAt 降序
      });
    }

    return { groups: groups as any };
  }

  private buildBindingFilters(ctx: RegionContext, ids: { visitId?: string; pinId?: string }): any[] {
    const filters: any[] = [];
    if (ids.visitId) filters.push({ visitId: ids.visitId });
    if (ids.pinId) filters.push({ pinId: ids.pinId });
    // region: nationwide
    filters.push({ targetType: 'region', regionScopeTag: 'nationwide' });
    // region: all_provinces (regionCode = current province)
    if (ctx.provinceCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'all_provinces', regionCode: ctx.provinceCode });
      filters.push({ targetType: 'region', regionScopeTag: 'all_cities_in_province', regionCode: ctx.provinceCode });
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.provinceCode });
    }
    if (ctx.cityCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'all_districts_in_city', regionCode: ctx.cityCode });
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.cityCode });
    }
    if (ctx.districtCode) {
      filters.push({ targetType: 'region', regionScopeTag: 'specific', regionCode: ctx.districtCode });
    }
    return filters;
  }

  private precisionOf(b: ToolBindingEntity): number {
    if (b.targetType !== 'region') return SCOPE_PRECISION.district_specific; // pin/visit 视为最高精度
    const tag = b.regionScopeTag!;
    return SCOPE_PRECISION[tag] ?? 0;
  }
}
```

- [ ] **Step 6.4: 在 module 注册**

`tools.module.ts`:
```ts
import { VisitEntity } from '../visits/entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CascadingMatchService } from './cascading-match.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ToolEntity, ToolBindingEntity, ToolConsumptionLogEntity,
      VisitEntity, PinEntity,
    ]),
  ],
  providers: [ToolsService, BindingsService, CascadingMatchService],
  controllers: [ToolsController],
  exports: [ToolsService, BindingsService, CascadingMatchService],
})
export class ToolsModule {}
```

- [ ] **Step 6.5: controller 加 by-point endpoint**

```ts
constructor(
  private readonly service: ToolsService,
  private readonly bindings: BindingsService,
  private readonly cascading: CascadingMatchService,
) {}

@Get('by-point')
async byPoint(@Query('visitId') visitId?: string, @Query('pinId') pinId?: string) {
  if (visitId) return { data: await this.cascading.matchByVisit(visitId) };
  if (pinId) return { data: await this.cascading.matchByPin(pinId) };
  return { data: { groups: {} } };
}
```
注意:这个 endpoint 必须放在 `:id` 等 param 路由之前(NestJS 路由顺序),否则 `by-point` 会被解析成 id。

- [ ] **Step 6.6: 跑测 + build**

```bash
cd apps/api && npm test -- cascading-match.service.spec && npm run build
```

- [ ] **Step 6.7: commit**

```bash
git add apps/api/src/tools/
git commit -m "feat(api): G2 级联匹配 (4.5.6 算法 + by-point endpoint)"
```

---

## Task 7: D13 假外部系统 (G8)

**Files:**
- Create: `apps/api/src/external-mock/external-mock.module.ts`
- Create: `apps/api/src/external-mock/external-mock.service.ts`
- Create: `apps/api/src/external-mock/external-mock.controller.ts`
- Create: `apps/api/src/external-mock/__tests__/external-mock.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` — 注册 ExternalMockModule

- [ ] **Step 7.1: 写 service 测试**

`apps/api/src/external-mock/__tests__/external-mock.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ExternalMockService } from '../external-mock.service';

describe('ExternalMockService.invoke', () => {
  let svc: ExternalMockService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExternalMockService],
    }).compile();
    svc = module.get(ExternalMockService);
  });

  it('上海(310000)V2G:返回含上海字样', () => {
    const r = svc.invoke({ regionCode: '310000', themeCode: 'v2g' });
    expect(r.summary).toContain('上海');
    expect(r.summary).toContain('V2G');
    expect(r.params.region).toBe('310000');
    expect(r.downloadUrl).toMatch(/310000.*v2g/);
  });

  it('未知 region:fallback "全国"', () => {
    const r = svc.invoke({ regionCode: '999999', themeCode: 'storage' });
    expect(r.summary).toMatch(/全国|未知地域/);
  });

  it('configKey + region 都计入返回 params', () => {
    const r = svc.invoke({ regionCode: '110000', themeCode: 'storage', configKey: 'k1' });
    expect(r.params).toEqual(expect.objectContaining({ region: '110000', theme: 'storage' }));
  });
});
```

- [ ] **Step 7.2: 写 service**

`apps/api/src/external-mock/external-mock.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { MockInvokeRequestDto, MockInvokeResponseDto } from '@pop/shared-types';

const PROVINCE_NAMES: Record<string, string> = {
  '110000': '北京',
  '120000': '天津',
  '310000': '上海',
  '500000': '重庆',
  '320000': '江苏',
  '330000': '浙江',
  '440000': '广东',
  '510000': '四川',
  '610000': '陕西',
  '370000': '山东',
  '420000': '湖北',
  '430000': '湖南',
  '410000': '河南',
};

const THEME_NAMES: Record<string, string> = {
  v2g: 'V2G',
  vpp: '虚拟电厂',
  charging: '充电基础设施',
  storage: '新型储能',
  electricity_market: '电力市场',
};

@Injectable()
export class ExternalMockService {
  invoke(req: MockInvokeRequestDto): MockInvokeResponseDto {
    const provinceName = PROVINCE_NAMES[req.regionCode] ?? '全国';
    const themeName = THEME_NAMES[req.themeCode ?? ''] ?? (req.themeCode ?? '通用');
    const ts = new Date().toISOString();
    return {
      downloadUrl: `/api/v1/external/mock/files/${req.regionCode}-${req.themeCode ?? 'general'}.pdf`,
      summary: `${provinceName} ${themeName} 定制谈参 v0.1 - 自动生成于 ${ts}`,
      params: { region: req.regionCode, theme: req.themeCode ?? 'general' },
      generatedAt: ts,
    };
  }
}
```

- [ ] **Step 7.3: 写 controller**

`apps/api/src/external-mock/external-mock.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExternalMockService } from './external-mock.service';
import type { MockInvokeRequestDto } from '@pop/shared-types';

@Controller('external/mock')
export class ExternalMockController {
  constructor(private readonly svc: ExternalMockService) {}

  @Post(':configKey')
  invoke(@Param('configKey') configKey: string, @Body() body: MockInvokeRequestDto) {
    return { data: this.svc.invoke({ ...body, configKey }) };
  }

  @Get('files/:filename')
  fakeFile(@Param('filename') filename: string, @Res() res: Response) {
    // 返回一段固定文本(伪造 PDF 占位)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(`%PDF-1.4\n% Mock external system fake file: ${filename}\n%%EOF\n`));
  }
}
```

- [ ] **Step 7.4: 写 module**

```ts
import { Module } from '@nestjs/common';
import { ExternalMockController } from './external-mock.controller';
import { ExternalMockService } from './external-mock.service';

@Module({
  controllers: [ExternalMockController],
  providers: [ExternalMockService],
  exports: [ExternalMockService],
})
export class ExternalMockModule {}
```

注册到 `app.module.ts` `imports` 数组。

- [ ] **Step 7.5: 跑测 + build + 手测 endpoint**

```bash
cd apps/api && npm test -- external-mock.service.spec && npm run build
# 启动 dev,curl 验证
npm run dev:api &
sleep 3
curl -X POST http://localhost:3001/api/v1/external/mock/k1 -H "Content-Type: application/json" -d '{"regionCode":"310000","themeCode":"v2g"}'
curl http://localhost:3001/api/v1/external/mock/files/310000-v2g.pdf -o /tmp/mock.pdf && file /tmp/mock.pdf
kill %1
```
预期:第 1 个 curl 返回含 "上海 V2G" 的 JSON;第 2 个返回的文件 file 命令识别为 PDF document。

- [ ] **Step 7.6: commit**

```bash
git add apps/api/src/external-mock/ apps/api/src/app.module.ts
git commit -m "feat(api): G8 D13 假外部系统 (region 感知 mock + fake PDF serve)"
```

---

## Task 8: OSS 集成 (presigned URL)

**Files:**
- Modify: `apps/api/package.json` — 加 `ali-oss` 依赖
- Create: `apps/api/src/tools/oss.service.ts`
- Create: `apps/api/src/tools/__tests__/oss.service.spec.ts`
- Modify: `apps/api/src/tools/tools.controller.ts` — 加 `POST /tools/upload-url`
- Modify: `apps/api/src/tools/tools.module.ts` — provider OssService
- Modify: `apps/api/.env.example` — 加 OSS_* 4 变量样板

> **BLOCKED 提醒**:实施这个 task 之前确认用户已提供:bucket 名 / 区域 / AK / SK / 公网读策略 / .env 改动授权。如果未提供,把 task 留 PENDING,跳过去做 Task 9-12 前端,最后再回来。

- [ ] **Step 8.1: 安装 ali-oss**

```bash
cd apps/api && npm install ali-oss && npm install -D @types/ali-oss
```

- [ ] **Step 8.2: 写 OssService 测试**

`apps/api/src/tools/__tests__/oss.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { OssService } from '../oss.service';

describe('OssService.generateUploadUrl', () => {
  let svc: OssService;

  beforeEach(async () => {
    process.env.OSS_REGION = 'oss-cn-hongkong';
    process.env.OSS_BUCKET = 'pop-test';
    process.env.OSS_ACCESS_KEY_ID = 'test-ak';
    process.env.OSS_ACCESS_KEY_SECRET = 'test-sk';
    const module = await Test.createTestingModule({ providers: [OssService] }).compile();
    svc = module.get(OssService);
  });

  it('返回 PUT URL + objectKey + publicUrl', () => {
    const r = svc.generateUploadUrl('test.pdf', 'application/pdf');
    expect(r.objectKey).toMatch(/^tools\/.+test\.pdf$/);
    expect(r.uploadUrl).toContain('oss-cn-hongkong');
    expect(r.uploadUrl).toContain('Signature=');
    expect(r.publicUrl).toBe(`https://pop-test.oss-cn-hongkong.aliyuncs.com/${r.objectKey}`);
  });
});
```

- [ ] **Step 8.3: 写 OssService**

`apps/api/src/tools/oss.service.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OSS from 'ali-oss';
import { v7 as uuidv7 } from 'uuidv7';
import type { UploadUrlResponseDto } from '@pop/shared-types';

@Injectable()
export class OssService {
  private readonly client: OSS | null;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.bucket = process.env.OSS_BUCKET ?? '';
    this.region = process.env.OSS_REGION ?? '';
    const ak = process.env.OSS_ACCESS_KEY_ID ?? '';
    const sk = process.env.OSS_ACCESS_KEY_SECRET ?? '';
    this.client =
      this.bucket && this.region && ak && sk
        ? new OSS({ region: this.region, accessKeyId: ak, accessKeySecret: sk, bucket: this.bucket })
        : null;
  }

  generateUploadUrl(filename: string, contentType: string): UploadUrlResponseDto {
    if (!this.client) {
      throw new InternalServerErrorException('OSS 未配置 — 检查 OSS_* 环境变量');
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const objectKey = `tools/${uuidv7()}_${safeName}`;
    const uploadUrl = this.client.signatureUrl(objectKey, {
      method: 'PUT',
      'Content-Type': contentType,
      expires: 600, // 10 分钟有效
    });
    const publicUrl = `https://${this.bucket}.${this.region}.aliyuncs.com/${objectKey}`;
    return { uploadUrl, objectKey, publicUrl };
  }
}
```

- [ ] **Step 8.4: controller 加 endpoint**

```ts
@Post('upload-url')
async uploadUrl(@Body() body: { filename: string; contentType: string }) {
  return { data: this.oss.generateUploadUrl(body.filename, body.contentType) };
}
```
注意 `:id` 路由后面加,且 `upload-url` 需要在 `:id/*` 之前,否则会被吃成 id。简单做法:把这个 endpoint 路径换为 `/api/v1/tools/upload-url` (NestJS 自动按声明顺序路由,声明在 `:id` GET 之前即可)。

constructor 加 `OssService`。

- [ ] **Step 8.5: 注册到 module + .env.example**

`tools.module.ts` providers 加 `OssService`。

`apps/api/.env.example`(创建或追加):
```
OSS_REGION=oss-cn-hongkong
OSS_BUCKET=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
```

- [ ] **Step 8.6: 跑测 + build**

```bash
cd apps/api && npm test -- oss.service.spec && npm run build
```

- [ ] **Step 8.7: commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/tools/oss.service.ts apps/api/src/tools/__tests__/oss.service.spec.ts apps/api/src/tools/tools.controller.ts apps/api/src/tools/tools.module.ts apps/api/.env.example
git commit -m "feat(api): G1 OSS presigned URL endpoint (Q2 file storage)"
```

---

## Task 9: 消费日志 endpoints (D7/D8 + F4 + D12)

**Files:**
- Create: `apps/api/src/tools/consumption.service.ts`
- Create: `apps/api/src/tools/__tests__/consumption.service.spec.ts`
- Modify: `apps/api/src/tools/tools.controller.ts` — 加 `download/invoke/me-consumptions/per-tool consumptions`
- Modify: `apps/api/src/tools/tools.module.ts` — provider ConsumptionService

- [ ] **Step 9.1: 写 service 测试**

`apps/api/src/tools/__tests__/consumption.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsumptionService } from '../consumption.service';
import { ToolEntity } from '../entities/tool.entity';
import { ToolConsumptionLogEntity } from '../entities/tool-consumption-log.entity';
import { ExternalMockService } from '../../external-mock/external-mock.service';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

const localUser: AuthenticatedUser = {
  id: 'u-local', username: 'l', displayName: 'L', email: 'l@x', roleCode: UserRoleCode.LocalGa,
};

describe('ConsumptionService.download', () => {
  let svc: ConsumptionService;
  let toolsRepo: any;
  let logsRepo: any;

  beforeEach(async () => {
    toolsRepo = { findOne: jest.fn() };
    logsRepo = { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ ...x, id: 'l1' })) };
    const module = await Test.createTestingModule({
      providers: [
        ConsumptionService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolConsumptionLogEntity), useValue: logsRepo },
        { provide: ExternalMockService, useValue: { invoke: jest.fn() } },
      ],
    }).compile();
    svc = module.get(ConsumptionService);
  });

  it('document 下载:写日志 + 返回 fileUrl', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', fileUrl: 'https://oss/x.pdf', status: 'published' });
    const r = await svc.download('t1', localUser, { contextVisitId: 'v1' });
    expect(r.fileUrl).toBe('https://oss/x.pdf');
    expect(logsRepo.save).toHaveBeenCalled();
  });

  it('interface 工具不能 download', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'interface', status: 'published' });
    await expect(svc.download('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });

  it('archived 工具不能 download', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', status: 'archived' });
    await expect(svc.download('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });
});

describe('ConsumptionService.invoke', () => {
  let svc: ConsumptionService;
  let toolsRepo: any;
  let logsRepo: any;
  let mock: any;

  beforeEach(async () => {
    toolsRepo = { findOne: jest.fn() };
    logsRepo = { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ ...x, id: 'l1' })) };
    mock = { invoke: jest.fn().mockReturnValue({ summary: 'X', downloadUrl: '/y', params: {}, generatedAt: 'now' }) };
    const module = await Test.createTestingModule({
      providers: [
        ConsumptionService,
        { provide: getRepositoryToken(ToolEntity), useValue: toolsRepo },
        { provide: getRepositoryToken(ToolConsumptionLogEntity), useValue: logsRepo },
        { provide: ExternalMockService, useValue: mock },
      ],
    }).compile();
    svc = module.get(ConsumptionService);
  });

  it('interface 调用:走 mock + 写日志含 response', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'interface', status: 'published', paramTemplate: { region: 'auto' } });
    const r = await svc.invoke('t1', localUser, { contextRegionCode: '310000' });
    expect(mock.invoke).toHaveBeenCalledWith(expect.objectContaining({ regionCode: '310000' }));
    expect(r.response.summary).toBe('X');
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ interfaceResponse: r.response }));
  });

  it('document 工具不能 invoke', async () => {
    toolsRepo.findOne.mockResolvedValue({ id: 't1', type: 'document', status: 'published' });
    await expect(svc.invoke('t1', localUser, {})).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 9.2: 写 ConsumptionService**

`apps/api/src/tools/consumption.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ToolEntity } from './entities/tool.entity';
import { ToolConsumptionLogEntity } from './entities/tool-consumption-log.entity';
import { ExternalMockService } from '../external-mock/external-mock.service';
import type { AuthenticatedUser, ConsumptionLogWithTool, MockInvokeResponseDto } from '@pop/shared-types';

interface ContextDto {
  contextPinId?: string;
  contextVisitId?: string;
  contextRegionCode?: string;
}

@Injectable()
export class ConsumptionService {
  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolConsumptionLogEntity) private readonly logsRepo: Repository<ToolConsumptionLogEntity>,
    private readonly mock: ExternalMockService,
  ) {}

  async download(toolId: string, user: AuthenticatedUser, ctx: ContextDto): Promise<{ fileUrl: string }> {
    const t = await this.assertConsumable(toolId);
    if (t.type !== 'document') throw new BadRequestException('只有 document 类工具可下载');
    await this.writeLog(t.id, user.id, ctx);
    return { fileUrl: t.fileUrl! };
  }

  async invoke(toolId: string, user: AuthenticatedUser, ctx: ContextDto): Promise<{ response: MockInvokeResponseDto }> {
    const t = await this.assertConsumable(toolId);
    if (t.type !== 'interface') throw new BadRequestException('只有 interface 类工具可调用');
    const themeCode = (t.paramTemplate as any)?.themeCode ?? undefined;
    const response = this.mock.invoke({
      regionCode: ctx.contextRegionCode ?? '',
      themeCode,
    });
    await this.writeLog(t.id, user.id, ctx, response);
    return { response };
  }

  async listForUser(userId: string): Promise<ConsumptionLogWithTool[]> {
    const logs = await this.logsRepo.find({
      where: { consumerId: userId },
      relations: ['tool'],
      order: { consumedAt: 'DESC' },
      take: 200,
    });
    return logs.map((l) => ({
      id: l.id,
      toolId: l.toolId,
      consumerId: l.consumerId,
      consumedAt: l.consumedAt.toISOString(),
      contextPinId: l.contextPinId,
      contextVisitId: l.contextVisitId,
      contextRegionCode: l.contextRegionCode,
      interfaceResponse: l.interfaceResponse,
      tool: l.tool ? {
        id: l.tool.id, title: l.tool.title, type: l.tool.type, taxonomyTag: l.tool.taxonomyTag,
      } : { id: l.toolId, title: '(已删)', type: 'document', taxonomyTag: 'other' },
    }));
  }

  async listForTool(toolId: string): Promise<ToolConsumptionLogEntity[]> {
    return this.logsRepo.find({
      where: { toolId },
      order: { consumedAt: 'DESC' },
      take: 500,
    });
  }

  private async assertConsumable(toolId: string): Promise<ToolEntity> {
    const t = await this.toolsRepo.findOne({ where: { id: toolId, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException(`Tool ${toolId} not found`);
    if (t.status !== 'published') throw new BadRequestException(`工具状态为 ${t.status},不可消费`);
    return t;
  }

  private async writeLog(
    toolId: string,
    consumerId: string,
    ctx: ContextDto,
    interfaceResponse?: MockInvokeResponseDto,
  ): Promise<ToolConsumptionLogEntity> {
    const ent = this.logsRepo.create({
      toolId,
      consumerId,
      contextPinId: ctx.contextPinId ?? null,
      contextVisitId: ctx.contextVisitId ?? null,
      contextRegionCode: ctx.contextRegionCode ?? null,
      interfaceResponse: interfaceResponse ?? null,
    });
    return this.logsRepo.save(ent);
  }
}
```

- [ ] **Step 9.3: controller 加 endpoints**

```ts
constructor(
  private readonly service: ToolsService,
  private readonly bindings: BindingsService,
  private readonly cascading: CascadingMatchService,
  private readonly oss: OssService,
  private readonly consumption: ConsumptionService,
) {}

@Post(':id/download')
async download(
  @Param('id') id: string,
  @Body() ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string },
  @CurrentUser() user: AuthenticatedUser,
) {
  return { data: await this.consumption.download(id, user, ctx) };
}

@Post(':id/invoke')
async invoke(
  @Param('id') id: string,
  @Body() ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string },
  @CurrentUser() user: AuthenticatedUser,
) {
  return { data: await this.consumption.invoke(id, user, ctx) };
}

@Get(':id/consumptions')
async listToolConsumptions(@Param('id') id: string) {
  return { data: await this.consumption.listForTool(id) };
}
```

加一个独立 `me-consumptions.controller.ts` 路由 `/me/consumptions`(避免跟 `/tools/:id/consumptions` 冲突):

`apps/api/src/tools/me-consumptions.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@pop/shared-types';
import { ConsumptionService } from './consumption.service';

@Controller('me')
export class MeConsumptionsController {
  constructor(private readonly consumption: ConsumptionService) {}

  @Get('consumptions')
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.consumption.listForUser(user.id) };
  }
}
```

- [ ] **Step 9.4: module 注册**

`tools.module.ts` controllers 加 `MeConsumptionsController`,providers 加 `ConsumptionService`,imports 加 `ExternalMockModule`:
```ts
import { ExternalMockModule } from '../external-mock/external-mock.module';
// imports: 加 ExternalMockModule
controllers: [ToolsController, MeConsumptionsController],
providers: [ToolsService, BindingsService, CascadingMatchService, OssService, ConsumptionService],
```

- [ ] **Step 9.5: 测 + build**

```bash
cd apps/api && npm test -- consumption.service.spec && npm run build
```

- [ ] **Step 9.6: commit**

```bash
git add apps/api/src/tools/
git commit -m "feat(api): G1 消费日志 (D7/D8/D12) + F4 列表 + 自挂 mock"
```

---

## Task 10: 前端 — 中台 GA ToolsTab

**Files:**
- Create: `apps/web/src/api/tools.ts`
- Modify: `apps/web/src/api/me.ts` — 加 `fetchMyConsumptions()`
- Create: `apps/web/src/components/tools/ToolFormModal.tsx`
- Create: `apps/web/src/components/tools/ToolBindingPicker.tsx`
- Modify: `apps/web/src/pages/console/ToolsTab.tsx` — 替换 stub

- [ ] **Step 10.1: 写 api/tools.ts**

```ts
import type { Tool, CreateToolRequestDto, UpdateToolRequestDto, ToolBinding,
  CreateBindingRequestDto, UploadUrlResponseDto, ConsumptionLogWithTool,
  MockInvokeResponseDto, ToolStatus, ToolType } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const j = async (r: Response) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'tool api fail');
  return r.json();
};

export async function fetchTools(opts?: { status?: ToolStatus; type?: ToolType; creatorId?: string }) {
  const p = new URLSearchParams();
  if (opts?.status) p.set('status', opts.status);
  if (opts?.type) p.set('type', opts.type);
  if (opts?.creatorId) p.set('creatorId', opts.creatorId);
  const q = p.toString() ? `?${p}` : '';
  return j(await fetch(`/api/v1/tools${q}`, { headers: authHeaders() })) as Promise<{ data: Tool[] }>;
}

export async function createTool(dto: CreateToolRequestDto) {
  return j(await fetch('/api/v1/tools', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  })) as Promise<{ data: Tool }>;
}

export async function updateTool(id: string, dto: UpdateToolRequestDto) {
  return j(await fetch(`/api/v1/tools/${id}`, {
    method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  })) as Promise<{ data: Tool }>;
}

export async function publishTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/publish`, { method: 'POST', headers: authHeaders() })); }
export async function archiveTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/archive`, { method: 'POST', headers: authHeaders() })); }
export async function restoreTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/restore`, { method: 'POST', headers: authHeaders() })); }

export async function listBindings(toolId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings`, { headers: authHeaders() })) as Promise<{ data: ToolBinding[] }>;
}
export async function addBinding(toolId: string, dto: CreateBindingRequestDto) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  }));
}
export async function deleteBinding(toolId: string, bindingId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings/${bindingId}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function getUploadUrl(filename: string, contentType: string) {
  return j(await fetch('/api/v1/tools/upload-url', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType }),
  })) as Promise<{ data: UploadUrlResponseDto }>;
}

export async function fetchToolsByPoint(opts: { visitId?: string; pinId?: string }) {
  const p = new URLSearchParams();
  if (opts.visitId) p.set('visitId', opts.visitId);
  if (opts.pinId) p.set('pinId', opts.pinId);
  return j(await fetch(`/api/v1/tools/by-point?${p}`, { headers: authHeaders() })) as Promise<{ data: { groups: Record<string, Tool[]> } }>;
}

export async function downloadTool(toolId: string, ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string }) {
  return j(await fetch(`/api/v1/tools/${toolId}/download`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })) as Promise<{ data: { fileUrl: string } }>;
}

export async function invokeTool(toolId: string, ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string }) {
  return j(await fetch(`/api/v1/tools/${toolId}/invoke`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })) as Promise<{ data: { response: MockInvokeResponseDto } }>;
}

export async function fetchToolConsumptions(toolId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/consumptions`, { headers: authHeaders() }));
}

// 给 me.ts 用
export async function fetchMyConsumptions(): Promise<{ data: ConsumptionLogWithTool[] }> {
  return j(await fetch('/api/v1/me/consumptions', { headers: authHeaders() }));
}
```

- [ ] **Step 10.2: api/me.ts 增加 reexport**

打开 `apps/web/src/api/me.ts`,在底部加:
```ts
export { fetchMyConsumptions } from './tools';
```

- [ ] **Step 10.3: 写 ToolBindingPicker**

`apps/web/src/components/tools/ToolBindingPicker.tsx`:
```tsx
import { Button, Card, Select, Space, Tag, Typography } from 'antd';
import type { CreateBindingRequestDto, RegionScope } from '@pop/shared-types';
import { useState } from 'react';

const { Text } = Typography;

const SCOPE_LABEL: Record<RegionScope, string> = {
  nationwide: '全国',
  all_provinces: '全省',
  all_cities_in_province: '全市',
  all_districts_in_city: '全区',
  specific: '指定地域',
};

export interface PendingBinding extends CreateBindingRequestDto {
  /** 临时 id,用于 UI key + 删除 */
  _tmpId: string;
}

interface Props {
  bindings: PendingBinding[];
  onChange: (bindings: PendingBinding[]) => void;
}

/** 创建工具时的绑定选择器 — 简化版,只支持泛地域 */
export function ToolBindingPicker({ bindings, onChange }: Props) {
  const [scope, setScope] = useState<RegionScope>('nationwide');
  const [regionCode, setRegionCode] = useState<string>('');

  const add = () => {
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next: PendingBinding =
      scope === 'nationwide'
        ? { _tmpId: tmpId, targetType: 'region', regionScopeTag: 'nationwide', regionCode: null }
        : { _tmpId: tmpId, targetType: 'region', regionScopeTag: scope, regionCode };
    if (scope !== 'nationwide' && !regionCode) return;
    onChange([...bindings, next]);
    setRegionCode('');
  };

  const remove = (id: string) => onChange(bindings.filter((b) => b._tmpId !== id));

  return (
    <Card size="small" title="绑定" style={{ marginTop: 12 }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap>
          <Select
            value={scope}
            onChange={setScope}
            options={(Object.keys(SCOPE_LABEL) as RegionScope[]).map((s) => ({ value: s, label: SCOPE_LABEL[s] }))}
            style={{ width: 140 }}
          />
          {scope !== 'nationwide' && (
            <input
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="region_code (省/市/区码)"
              style={{ width: 220, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          )}
          <Button onClick={add}>加绑定</Button>
        </Space>
        <Space wrap>
          {bindings.length === 0 && <Text type="secondary">还没加绑定</Text>}
          {bindings.map((b) => {
            const label = b.targetType === 'region'
              ? `${SCOPE_LABEL[(b as any).regionScopeTag]}${(b as any).regionCode ? ` ${(b as any).regionCode}` : ''}`
              : b.targetType;
            return (
              <Tag key={b._tmpId} closable onClose={(e) => { e.preventDefault(); remove(b._tmpId); }}>
                {label}
              </Tag>
            );
          })}
        </Space>
      </Space>
    </Card>
  );
}
```

- [ ] **Step 10.4: 写 ToolFormModal**

`apps/web/src/components/tools/ToolFormModal.tsx`:
```tsx
import { useState } from 'react';
import { Form, Input, Modal, Radio, Select, Space, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ToolType, ToolTaxonomy } from '@pop/shared-types';
import { addBinding, createTool, getUploadUrl } from '@/api/tools';
import { ToolBindingPicker, type PendingBinding } from './ToolBindingPicker';

const { Text } = Typography;
const { Dragger } = Upload;

const TAXONOMY: { value: ToolTaxonomy; label: string }[] = [
  { value: 'ppt_template', label: 'PPT 模板' },
  { value: 'talk_param_ref', label: '谈参参考' },
  { value: 'local_data', label: '地方数据' },
  { value: 'cooperation_template', label: '合作模板' },
  { value: 'policy_interpretation', label: '政策解读' },
  { value: 'other', label: '其他' },
];

interface Props { open: boolean; onClose: () => void; }

export function ToolFormModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [type, setType] = useState<ToolType>('document');
  const [bindings, setBindings] = useState<PendingBinding[]>([]);
  const [fileUrl, setFileUrl] = useState<string>('');

  const create = useMutation({
    mutationFn: async (vals: any) => {
      const dto = type === 'document'
        ? { type: 'document' as const, title: vals.title, description: vals.description, taxonomyTag: vals.taxonomyTag, fileUrl }
        : { type: 'interface' as const, title: vals.title, description: vals.description, taxonomyTag: vals.taxonomyTag,
            paramTemplate: JSON.parse(vals.paramTemplate || '{}'), responseMapping: vals.responseMapping ? JSON.parse(vals.responseMapping) : undefined };
      const tool = await createTool(dto as any);
      // 顺序加 bindings
      for (const b of bindings) {
        const { _tmpId, ...rest } = b;
        await addBinding(tool.data.id, rest);
      }
      return tool.data;
    },
    onSuccess: () => {
      message.success('已创建(draft 状态,记得 publish)');
      qc.invalidateQueries({ queryKey: ['tools'] });
      onClose();
      form.resetFields(); setBindings([]); setFileUrl('');
    },
    onError: (e) => message.error(`创建失败: ${(e as Error).message}`),
  });

  const beforeUpload = async (file: File) => {
    const r = await getUploadUrl(file.name, file.type || 'application/octet-stream');
    const put = await fetch(r.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    if (!put.ok) { message.error('上传 OSS 失败'); return Upload.LIST_IGNORE; }
    setFileUrl(r.data.publicUrl);
    message.success('文件已上传 OSS');
    return Upload.LIST_IGNORE;
  };

  return (
    <Modal title="新建工具" open={open} onCancel={onClose} onOk={() => form.submit()}
      okText="保存" cancelText="取消" width={720} confirmLoading={create.isPending}>
      <Radio.Group value={type} onChange={(e) => setType(e.target.value)} style={{ marginBottom: 16 }}>
        <Radio.Button value="document">成品文档</Radio.Button>
        <Radio.Button value="interface">调用接口</Radio.Button>
      </Radio.Group>
      <Form form={form} layout="vertical" onFinish={create.mutate}>
        <Form.Item label="名称" name="title" rules={[{ required: true, max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item label="taxonomy" name="taxonomyTag" rules={[{ required: true }]}>
          <Select options={TAXONOMY} />
        </Form.Item>
        {type === 'document' ? (
          <Form.Item label="文件" required>
            <Dragger beforeUpload={beforeUpload} maxCount={1} multiple={false}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>{fileUrl ? '已上传 ✓' : '拖拽或点击上传(PPT / PDF / Excel)'}</p>
            </Dragger>
            {fileUrl && <Text type="secondary" style={{ fontSize: 11 }}>{fileUrl}</Text>}
          </Form.Item>
        ) : (
          <>
            <Form.Item label="param_template (JSON,如 {&quot;themeCode&quot;:&quot;v2g&quot;})" name="paramTemplate" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="response_mapping (JSON, 可空)" name="responseMapping">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}
      </Form>
      <ToolBindingPicker bindings={bindings} onChange={setBindings} />
    </Modal>
  );
}
```

- [ ] **Step 10.5: 替换 ToolsTab stub**

`apps/web/src/pages/console/ToolsTab.tsx`:
```tsx
import { useState } from 'react';
import { Button, Segmented, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tool, ToolStatus } from '@pop/shared-types';
import { archiveTool, fetchTools, publishTool, restoreTool } from '@/api/tools';
import { ToolFormModal } from '@/components/tools/ToolFormModal';

const { Text } = Typography;

const STATUS_TAG: Record<ToolStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'gold', label: '已下架' },
};

const TYPE_LABEL: Record<'document' | 'interface', string> = {
  document: '成品文档',
  interface: '调用接口',
};

export function ToolsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ToolStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const list = useQuery({
    queryKey: ['tools', statusFilter],
    queryFn: () => fetchTools(statusFilter === 'all' ? {} : { status: statusFilter }),
  });

  const op = (fn: (id: string) => Promise<unknown>, label: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { message.success(`${label}成功`); qc.invalidateQueries({ queryKey: ['tools'] }); },
      onError: (e) => message.error(`${label}失败: ${(e as Error).message}`),
    });

  const pubMut = op(publishTool, '发布');
  const archMut = op(archiveTool, '下架');
  const restMut = op(restoreTool, '恢复');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { label: '全部', value: 'all' },
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
            { label: '已下架', value: 'archived' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建工具</Button>
      </Space>
      <Table<Tool>
        rowKey="id"
        dataSource={list.data?.data ?? []}
        loading={list.isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '名称', dataIndex: 'title', key: 'title', ellipsis: true },
          { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: 'document' | 'interface') => TYPE_LABEL[t] },
          { title: 'taxonomy', dataIndex: 'taxonomyTag', key: 'tax', width: 140 },
          {
            title: '状态', dataIndex: 'status', key: 'status', width: 100,
            render: (s: ToolStatus) => { const t = STATUS_TAG[s]; return <Tag color={t.color}>{t.label}</Tag>; },
          },
          {
            title: '操作', key: 'op', width: 220,
            render: (_, t) => (
              <Space>
                {t.status === 'draft' && <Button size="small" onClick={() => pubMut.mutate(t.id)}>发布</Button>}
                {t.status === 'published' && <Button size="small" onClick={() => archMut.mutate(t.id)}>下架</Button>}
                {t.status === 'archived' && <Button size="small" onClick={() => restMut.mutate(t.id)}>恢复</Button>}
              </Space>
            ),
          },
        ]}
      />
      <ToolFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Space>
  );
}
```

- [ ] **Step 10.6: typecheck + build**

```bash
cd apps/web && npm run typecheck && npm run build
```

- [ ] **Step 10.7: commit**

```bash
git add apps/web/src/api/tools.ts apps/web/src/api/me.ts apps/web/src/components/tools/ apps/web/src/pages/console/ToolsTab.tsx
git commit -m "feat(web): G1 中台 ToolsTab — 列表 + 创建 modal + OSS 上传 + 绑定 + 状态机"
```

---

## Task 11: 前端 — 属地 visit drawer "可用工具" 区块 (B15)

**Files:**
- Create: `apps/web/src/components/tools/ToolListInDrawer.tsx`
- Modify: `apps/web/src/components/VisitDetailDrawer.tsx` — 集成

- [ ] **Step 11.1: 写 ToolListInDrawer**

`apps/web/src/components/tools/ToolListInDrawer.tsx`:
```tsx
import { Button, Card, Collapse, Empty, List, Modal, Space, Tag, Typography, message } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Tool, MockInvokeResponseDto } from '@pop/shared-types';
import { downloadTool, fetchToolsByPoint, invokeTool } from '@/api/tools';
import { useState } from 'react';

const { Text, Paragraph } = Typography;

const TAX_LABEL: Record<string, string> = {
  ppt_template: 'PPT 模板',
  talk_param_ref: '谈参参考',
  local_data: '地方数据',
  cooperation_template: '合作模板',
  policy_interpretation: '政策解读',
  other: '其他',
};

interface Props {
  visitId?: string;
  pinId?: string;
  contextRegionCode?: string;
}

export function ToolListInDrawer({ visitId, pinId, contextRegionCode }: Props) {
  const [mockResult, setMockResult] = useState<MockInvokeResponseDto | null>(null);
  const q = useQuery({
    queryKey: ['tools', 'by-point', visitId, pinId],
    queryFn: () => fetchToolsByPoint({ visitId, pinId }),
    enabled: !!(visitId || pinId),
  });

  const dl = useMutation({
    mutationFn: (toolId: string) => downloadTool(toolId, { contextVisitId: visitId, contextPinId: pinId, contextRegionCode }),
    onSuccess: (r) => { window.open(r.data.fileUrl, '_blank'); },
    onError: (e) => message.error(`下载失败: ${(e as Error).message}`),
  });

  const inv = useMutation({
    mutationFn: (toolId: string) => invokeTool(toolId, { contextVisitId: visitId, contextPinId: pinId, contextRegionCode }),
    onSuccess: (r) => setMockResult(r.data.response),
    onError: (e) => message.error(`调用失败: ${(e as Error).message}`),
  });

  const groups = q.data?.data.groups ?? {};
  const totalTools = Object.values(groups).reduce((a, b) => a + b.length, 0);

  if (q.isLoading) return <Text type="secondary">加载工具…</Text>;
  if (totalTools === 0) return <Empty description="该点暂无可用工具" imageStyle={{ height: 36 }} />;

  return (
    <>
      <Collapse defaultActiveKey={Object.keys(groups)} ghost size="small"
        items={Object.entries(groups).map(([tag, tools]) => ({
          key: tag,
          label: <Text strong>{TAX_LABEL[tag] ?? tag} ({tools.length})</Text>,
          children: (
            <List
              dataSource={tools as Tool[]}
              size="small"
              renderItem={(t) => (
                <List.Item
                  actions={t.type === 'document'
                    ? [<Button size="small" key="dl" loading={dl.isPending} onClick={() => dl.mutate(t.id)}>下载</Button>]
                    : [<Button size="small" key="inv" loading={inv.isPending} onClick={() => inv.mutate(t.id)}>调用</Button>]}
                >
                  <Space>
                    <Tag color={t.type === 'document' ? 'blue' : 'purple'}>{t.type === 'document' ? '文档' : '接口'}</Tag>
                    <Text>{t.title}</Text>
                  </Space>
                </List.Item>
              )}
            />
          ),
        }))}
      />
      <Modal title="调用结果" open={!!mockResult} onCancel={() => setMockResult(null)} onOk={() => setMockResult(null)} cancelButtonProps={{ style: { display: 'none' } }}>
        {mockResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph>{mockResult.summary}</Paragraph>
            <Card size="small" title="参数"><Text code>{JSON.stringify(mockResult.params, null, 2)}</Text></Card>
            <Button type="link" href={mockResult.downloadUrl} target="_blank">下载假定制 PDF</Button>
          </Space>
        )}
      </Modal>
    </>
  );
}
```

- [ ] **Step 11.2: 集成到 VisitDetailDrawer**

打开 `apps/web/src/components/VisitDetailDrawer.tsx`,在主内容区加一个 section(放在评论区上面):

```tsx
import { ToolListInDrawer } from '@/components/tools/ToolListInDrawer';

// ... 在合适位置
<Card size="small" title="可用工具" style={{ marginTop: 12 }}>
  <ToolListInDrawer
    visitId={visit.id}
    contextRegionCode={visit.districtCode || visit.cityCode || visit.provinceCode || undefined}
  />
</Card>
```

注意:实际 visit 字段名以现有 entity 为准,如果 districtCode/cityCode 字段不存在,只传 provinceCode。

- [ ] **Step 11.3: typecheck + build**

```bash
cd apps/web && npm run typecheck && npm run build
```

- [ ] **Step 11.4: commit**

```bash
git add apps/web/src/components/tools/ToolListInDrawer.tsx apps/web/src/components/VisitDetailDrawer.tsx
git commit -m "feat(web): G2 visit drawer 加可用工具区块 + 下载/调用 (B15)"
```

---

## Task 12: 前端 — F4 wire up + ConsumptionTab

**Files:**
- Modify: `apps/web/src/components/me/MyConsumptionsPanel.tsx` — 替换 G6 stub
- Modify: `apps/web/src/pages/console/ConsumptionTab.tsx` — 替换 stub

- [ ] **Step 12.1: 替换 MyConsumptionsPanel**

`apps/web/src/components/me/MyConsumptionsPanel.tsx`:
```tsx
import { Card, Collapse, Empty, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ConsumptionLogWithTool } from '@pop/shared-types';
import { fetchMyConsumptions } from '@/api/me';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

export function MyConsumptionsPanel() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'consumptions', user?.id],
    queryFn: fetchMyConsumptions,
    enabled: !!user,
  });

  const items = data?.data ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0, color: palette.primary }}>我的消费记录</Title>
        <Text type="secondary">你下载过的成品文档 + 调用过的接口工具留痕(共 {items.length} 条)</Text>
      </div>

      <Card size="small">
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : items.length === 0 ? (
          <Empty description="还没有消费记录" />
        ) : (
          <List
            dataSource={items}
            size="small"
            renderItem={(it: ConsumptionLogWithTool) => (
              <List.Item>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={it.tool.type === 'document' ? 'blue' : 'purple'}>{it.tool.type === 'document' ? '下载' : '调用'}</Tag>
                    <Text strong>{it.tool.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(it.consumedAt).format('YYYY-MM-DD HH:mm')}</Text>
                  </Space>
                  {it.interfaceResponse && (
                    <Collapse ghost size="small" items={[{
                      key: 'r', label: '查看返回',
                      children: <Paragraph code style={{ fontSize: 12 }}>{JSON.stringify(it.interfaceResponse, null, 2)}</Paragraph>,
                    }]} />
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
```

- [ ] **Step 12.2: 替换 ConsumptionTab**

`apps/web/src/pages/console/ConsumptionTab.tsx`:
```tsx
import { Card, Empty, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchTools } from '@/api/tools';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

/**
 * D12 中台 GA 消费排行 — MVP 简化版:
 * 列出自己创建的所有工具 + 各自的消费数(不做时间序列图,YAGNI)。
 * 依赖未实现:per-tool consumption 数 — 现版本先按 fetchTools 拿列表,
 * 真正的 count 留给后续(本 task 只把 stub 替换为可读列表)。
 */
export function ConsumptionTab() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['tools', 'mine', user?.id],
    queryFn: () => fetchTools({ creatorId: user?.id }),
    enabled: !!user,
  });

  const tools = data?.data ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ marginTop: 0, color: palette.primary }}>我的工具消费明细</Title>
      <Text type="secondary">中台 GA 视角:看自己工具的消费情况</Text>
      <Card size="small">
        {isLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : tools.length === 0 ? (
          <Empty description="你还没有创建工具" />
        ) : (
          <Table
            rowKey="id"
            dataSource={tools}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: '名称', dataIndex: 'title', key: 'title', ellipsis: true },
              { title: '类型', dataIndex: 'type', key: 'type', width: 100,
                render: (t: string) => <Tag color={t === 'document' ? 'blue' : 'purple'}>{t === 'document' ? '文档' : '接口'}</Tag> },
              { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
              { title: '创建', dataIndex: 'createdAt', key: 'created', width: 160,
                render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
            ]}
          />
        )}
      </Card>
    </Space>
  );
}
```

- [ ] **Step 12.3: typecheck + build**

```bash
cd apps/web && npm run typecheck && npm run build
```

- [ ] **Step 12.4: commit**

```bash
git add apps/web/src/components/me/MyConsumptionsPanel.tsx apps/web/src/pages/console/ConsumptionTab.tsx
git commit -m "feat(web): G1 F4 真实消费记录 wire up + ConsumptionTab 替换 stub"
```

---

## Task 13: Seed — 8 工具(含 fake 文件上传 OSS)

**Files:**
- Create: `apps/api/src/seeds/tool-pool.seeder.ts`
- Modify: `apps/api/src/seeds/seeder.service.ts` 或 `seeds.module.ts`(看现有结构)

> **BLOCKED 提醒**:本 task 上传 fake PDF/Excel 到 OSS,要求 OSS 凭证已配置。如果没配,可以跳过 OSS 上传环节,改 seed 时让 fileUrl 指向 `/api/v1/external/mock/files/{tool}-seed.pdf`(走假外部系统的 fake static),demo 还能跑。

- [ ] **Step 13.1: 看 seeds 模块结构**

```bash
ls /Users/shaoziyuan/政策大图/.claude/worktrees/g1-d-tool-pool/apps/api/src/seeds/
```
找到现有 seeder 模式(如 `gov-orgs.seeder.ts`),mirroring。

- [ ] **Step 13.2: 写 ToolPoolSeederService**

`apps/api/src/seeds/tool-pool.seeder.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolEntity } from '../tools/entities/tool.entity';
import { ToolBindingEntity } from '../tools/entities/tool-binding.entity';
import { UserEntity } from '../users/entities/user.entity';

interface SeedTool {
  type: 'document' | 'interface';
  title: string;
  description: string;
  taxonomyTag: 'policy_interpretation' | 'talk_param_ref' | 'cooperation_template' | 'local_data';
  fileUrl?: string;
  paramTemplate?: Record<string, unknown>;
}

const SEED_TOOLS: SeedTool[] = [
  { type: 'document', title: 'V2G 政策对接谈参 v1.pdf', description: '面向地方政府的 V2G 政策落地谈参参考', taxonomyTag: 'talk_param_ref', fileUrl: '/api/v1/external/mock/files/v2g-talk-param.pdf' },
  { type: 'interface', title: 'V2G 政策分析', description: '按地域返回当地 V2G 政策快览', taxonomyTag: 'policy_interpretation', paramTemplate: { themeCode: 'v2g' } },
  { type: 'document', title: '虚拟电厂 EPC 模板.xlsx', description: '虚拟电厂项目 EPC 工作分解模板', taxonomyTag: 'cooperation_template', fileUrl: '/api/v1/external/mock/files/vpp-epc-template.xlsx' },
  { type: 'interface', title: '充电桩选址分析', description: '按地域生成充电桩选址建议', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'charging' } },
  { type: 'document', title: '新型储能政策解读 v1.pdf', description: '新型储能国家级政策汇编', taxonomyTag: 'policy_interpretation', fileUrl: '/api/v1/external/mock/files/storage-policy.pdf' },
  { type: 'interface', title: '储能项目可行性分析', description: '按地域生成储能项目可行性报告', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'storage' } },
  { type: 'document', title: '电力市场拓展手册 v1.pdf', description: '电力市场拓展实操手册', taxonomyTag: 'cooperation_template', fileUrl: '/api/v1/external/mock/files/em-handbook.pdf' },
  { type: 'interface', title: '电力交易分析', description: '按地域生成电力交易市场参考', taxonomyTag: 'local_data', paramTemplate: { themeCode: 'electricity_market' } },
];

@Injectable()
export class ToolPoolSeederService {
  private readonly log = new Logger(ToolPoolSeederService.name);

  constructor(
    @InjectRepository(ToolEntity) private readonly toolsRepo: Repository<ToolEntity>,
    @InjectRepository(ToolBindingEntity) private readonly bindingsRepo: Repository<ToolBindingEntity>,
    @InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async seed(): Promise<void> {
    const existing = await this.toolsRepo.count();
    if (existing > 0) {
      this.log.log(`tools 已有 ${existing} 条,跳过 seed`);
      return;
    }
    const sysadmin = await this.usersRepo.findOne({ where: { username: 'sysadmin' } });
    if (!sysadmin) {
      this.log.warn('未找到 sysadmin,跳过 tool seed');
      return;
    }

    for (const t of SEED_TOOLS) {
      const tool = await this.toolsRepo.save(this.toolsRepo.create({
        type: t.type,
        title: t.title,
        description: t.description,
        taxonomyTag: t.taxonomyTag,
        status: 'published',
        creatorId: sysadmin.id,
        fileUrl: t.fileUrl ?? null,
        paramTemplate: t.paramTemplate ?? null,
        responseMapping: null,
      }));
      await this.bindingsRepo.save(this.bindingsRepo.create({
        toolId: tool.id, targetType: 'region', regionScopeTag: 'nationwide', regionCode: null,
      }));
    }
    this.log.log(`已 seed ${SEED_TOOLS.length} 个工具(全部 nationwide 绑定)`);
  }
}
```

- [ ] **Step 13.3: 注册到 seeds module**

打开 `apps/api/src/seeds/seeds.module.ts`(或类似文件),加 ToolPoolSeederService:
```ts
TypeOrmModule.forFeature([..., ToolEntity, ToolBindingEntity]),
providers: [..., ToolPoolSeederService],
```
在 main seed 调用处加 `await this.toolPoolSeeder.seed()`。

- [ ] **Step 13.4: 测 seed**

```bash
cd apps/api
# 启 api,如果配了 seedOnBoot,seed 会自动跑;否则手动:
# 在 main.ts 找到 seed 调用入口,跑一遍
npm run dev &
sleep 5
curl -s http://localhost:3001/api/v1/tools | jq '.data | length'  # 期望 8
kill %1
```

- [ ] **Step 13.5: commit**

```bash
git add apps/api/src/seeds/
git commit -m "feat(seed): G1 8 工具 seed (5 主题 / doc + interface 混合 / nationwide)"
```

---

## Task 14: Smoke + PR

- [ ] **Step 14.1: 启动 dev server,登录验证**

```bash
# 在 worktree 根 dir
preview_start vite-dev
preview_start api-dev
# 登录 sysadmin/pop2026,fetch /api/v1/auth/login
```

- [ ] **Step 14.2: 中台 ToolsTab 验证**

- 登录后点 "工作台" → 找到 Tools tab(或 `/console/tools`)
- 确认看到 8 个 seed 工具,全部 published
- 点 "新建工具" 按钮,弹 modal
- 切换 "成品文档" / "调用接口" 两个 tab,字段切换正确
- 试上传一个文件(若 OSS 凭证已配),看 OSS URL 是否回填
- 加 binding(选 nationwide / all_provinces 各一)
- 提交 → 列表多 1 条 draft 状态
- 点 "发布" → 状态变 published
- 点 "下架" → archived;再 "恢复" → published

- [ ] **Step 14.3: 属地 visit drawer 工具区块验证**

- 切到属地行动大盘
- 点击一个 visit/pin → drawer 弹出
- 验证 "可用工具" 区块出现,显示 seed 8 工具(因为全 nationwide 绑定)
- 点一个 document 类:看是否打开 fileUrl 新窗口
- 点一个 interface 类:看是否弹"调用结果" modal,含省名定制文案

- [ ] **Step 14.4: F4 验证**

- 切到 `/me` → 我的消费记录 tab
- 看 Step 14.3 的下载/调用记录是否出现
- interface 记录可展开看 mock response

- [ ] **Step 14.5: console ConsumptionTab 验证**

- console → 消费排行 tab
- 看 sysadmin 创建的 8 工具列表

- [ ] **Step 14.6: 控制台无关键 error**

`preview_console_logs --level error`,只允许:
- React Router future flag warnings(预存)
- 可能的 antd deprecation warnings(无所谓)

不允许:404 / 500 / unhandled exception。

- [ ] **Step 14.7: 截图存档**

`preview_screenshot` 截图存:
- 中台 ToolsTab 列表
- 创建 modal
- 属地 visit drawer 工具区块
- F4 消费记录

- [ ] **Step 14.8: 推 + 开 PR**

```bash
git push -u origin claude/g1-d-tool-pool
env -u HTTPS_PROXY -u https_proxy gh pr create --title "feat(tools): G1+G2+G8 D 工具池 demo 闭环" --body "..."
```

PR body 包含:
- Summary:G1 demo 集 + G2 级联 + G8 mock 全套落地
- 改动文件清单(高粒度)
- BLOCKED 提醒(若 OSS 凭证未配)
- Test plan
- Out of scope

---

## Out of scope(明确不做)

- ❌ D14 工具搜索 / D15 预览(P1)
- ❌ D16 全员热度榜 / D17 真接入 / D18 采纳弃用 / D19 版本历史 / D20 跨人协作
- ❌ F3 我的产出(实际就是 ToolsTab 在 owner 视角)
- ❌ G12 决策层水印
- ❌ pin drawer 也加可用工具(本 plan 只做 visit drawer;pin drawer 接同一组件后续即可)
- ❌ ConsumptionTab 的真实"消费数 count"列(本 plan 只把 stub 换成自己工具列表;count 留待 D12 加深)
- ❌ AppShell 加 "我的工具" / "工具池" 菜单入口(用户访问 `/console/tools` 即可,菜单调整另起)

---

## 验证清单(全部 task 完成时勾)

- [ ] 14 个 task 全 commit
- [ ] migration 跑通
- [ ] api 测试全 PASS
- [ ] api build PASS
- [ ] web typecheck + build PASS
- [ ] OSS 凭证已配(若 Q2=B 真上 OSS)
- [ ] dev server 4 个 demo 流程跑通(中台 / 属地 / F4 / ConsumptionTab)
- [ ] console 无关键 error
- [ ] PR 已开
