# V0.6 β.2 Pin/图钉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 PRD §3.3 B7(Pin 创建+维护)+ B9(状态机)落地为 Pin 真业务端到端 — 后端 Pin entity + CRUD API + 状态机校验 + 3 条 seed,前端大盘加 pin 形状散点 + ➕📌 触发真表单 + Detail Drawer 状态切换 + 工作台 PinsTab 真表格。B8 留言板 / G16 自动同步 / PlanPoint 留 β.2.5/β.3。

**Architecture:** 完全对齐 β.1 Visit idiom 复用 — 后端 lookupCityCenter 自动填 lng/lat / 前端 authHeaders fetch wrapper / VisitFormModal+VisitDetailDrawer 复制改名为 PinFormModal+PinDetailDrawer + 加状态切换按钮组。状态机校验放 service.update 单端点(in_progress ⇄ completed/aborted,允许重开,不允许 completed↔aborted 直接切)。

**Tech Stack:** NestJS 10 + TypeORM 0.3 + PostgreSQL native enum × 2(`pin_status` / `pin_priority`)/ class-validator / @tanstack/react-query / AntD 5 / ECharts `symbol: 'pin'` 内置图钉形状。

**测试策略**(对齐 β.1):**不写 unit test**,每 task verify 通过 typecheck + curl(后端)/ 浏览器实测(前端);跟 V0.1-β.1 demo 阶段一致。

**Commit 策略**:每 task 独立 commit(便于失败回滚);所有 task 完成后 reset --soft 到 main(c27295a)做单一 squash commit 推 PR(对齐 β.1 流程)。

**关键护栏**(对齐 §7.13 教训):
- 浏览器实测必须从「登录 → 跳页面 → 看 Network → 看数据」完整走一遍,不能只 curl + DOM
- 共享基础设施已 grep 过(authHeaders / lookupCityCenter / VisitFormModal 模板 / MapCanvas series 风格),直接复用
- 命名:DB column snake_case,TypeORM property + DTO + JSON wire 全 camelCase

---

## File Structure

**新增**(11 个文件):
- `packages/shared-types/src/dtos/pin.dto.ts` — Pin 类型 + Create/UpdatePinInput + PinStatus/PinPriority union
- `apps/api/src/pins/entities/pin.entity.ts` — Pin TypeORM entity
- `apps/api/src/pins/dtos/create-pin.dto.ts` — class-validator DTO
- `apps/api/src/pins/dtos/update-pin.dto.ts` — class-validator DTO(限制 provinceCode/cityName 不可改)
- `apps/api/src/pins/pins.module.ts` — NestJS module
- `apps/api/src/pins/pins.controller.ts` — 4 端点(GET list / GET :id / POST / PUT)
- `apps/api/src/pins/pins.service.ts` — repo + GeoJSON 自动填 lng/lat + 状态机校验
- `apps/api/src/database/migrations/1745500000005-AddPinsTable.ts` — pins 表 + 2 enum + 3 索引
- `apps/api/src/database/migrations/1745500000006-SeedDemoPins.ts` — 3 条 demo Pin
- `apps/web/src/components/PinFormModal.tsx` — 录入/编辑共用 Modal
- `apps/web/src/components/PinDetailDrawer.tsx` — 大盘抽屉 + 顶部状态切换按钮组

**修改**(5 个文件):
- `packages/shared-types/src/index.ts` — re-export pin.dto
- `apps/api/src/app.module.ts` — 注册 PinsModule
- `apps/web/src/pages/console/PinsTab.tsx` — 替换 StubCard 为真表格
- `apps/web/src/components/MapCanvas.tsx` — 加 pin scatter series + ['pins'] query + onPinClick prop
- `apps/web/src/pages/MapShell.tsx` — 加 selectedPinId state + pinModalOpen state + 删现有占位抽屉 + 接 PinFormModal/PinDetailDrawer

**删除**(0 个文件):无 mock 要清,β.1 已经把 mock-heatmap.ts 删干净了。

---

## Pre-flight

- [ ] **Step 1: 起新 worktree(从 main / c27295a 起)**

```bash
cd /Users/shaoziyuan/政策大图
git fetch origin --prune
git worktree add .claude/worktrees/v06-beta2-pin -b claude/v06-beta2-pin origin/main
cd .claude/worktrees/v06-beta2-pin
git log --oneline -3
```

预期:
```
c27295a feat: V0.6 β.1 Visit 真业务(端到端 · 32 seed + CRUD + 大盘抽屉) (#6)
9476df1 feat(web): V0.5 c2 · 真地图加假业务散点(B1+B2+B3)+ 比例尺 slider (#5)
6304b6a Merge pull request #4 from ZaynShao/claude/v04-real-map
```

- [ ] **Step 2: 把 SPEC + PLAN 文件 cp 进新 worktree**

```bash
# 从 wizardly worktree(本 plan 写出的地方)拷过来
cp /Users/shaoziyuan/政策大图/.claude/worktrees/wizardly-chandrasekhar-02f02b/docs/SPEC-V0.6-beta2-pin.md docs/
cp /Users/shaoziyuan/政策大图/.claude/worktrees/wizardly-chandrasekhar-02f02b/docs/PLAN-V0.6-beta2-pin.md docs/
git add docs/SPEC-V0.6-beta2-pin.md docs/PLAN-V0.6-beta2-pin.md
git commit -m "docs: V0.6 β.2 Pin SPEC + PLAN(brainstorm + writing-plans 输出)"
```

- [ ] **Step 3: 基线 typecheck 干净**

```bash
npm run typecheck --workspace=@pop/web
npm run typecheck --workspace=@pop/api
npm run typecheck --workspace=@pop/shared-types
```

预期:三个全 pass。

- [ ] **Step 4: postgres 已起 + visits 表 + 32 seed 已落库(β.1 状态延续)**

```bash
psql pop_dev -c "SELECT COUNT(*) FROM visits;"  # 应该 32
psql pop_dev -c "\\dT visit_color"               # 应该 enum red/yellow/green
```

如果不通,检查 brew services 跑 postgres、`npm run migration:run --workspace=@pop/api`。

---

## Task 1: shared-types · 加 pin.dto.ts + index re-export

**Files:**
- Create: `packages/shared-types/src/dtos/pin.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1.1: 写 pin.dto.ts**

```ts
// packages/shared-types/src/dtos/pin.dto.ts
/**
 * Pin · 图钉(PRD §3.3 B7 + §4.3.1)
 *
 * 字段命名:camelCase(对齐 V0.2 user.dto / β.1 visit.dto + NestJS 默认序列化)
 *
 * MVP β.2 范围(SPEC-V0.6-beta2-pin §1):
 * - 9 业务 + 2 地理(lng/lat 后端从 GeoJSON 查 city center 自动填)
 * - status 仅 in_progress/completed/aborted(B9)
 * - 不挂 related_theme_ids(c3 政策主题模块)
 * - 不做 Comment 留言板(B8 → β.2.5)
 */

export type PinStatus = 'in_progress' | 'completed' | 'aborted';
export type PinPriority = 'high' | 'medium' | 'low';

export interface Pin {
  id: string;
  // 业务 9 字段
  title: string;
  description: string | null;
  status: PinStatus;
  abortedReason: string | null;
  closedBy: string | null;
  closedAt: string | null;
  priority: PinPriority;
  // 地理 4 字段(lng/lat 后端自动填)
  provinceCode: string;
  cityName: string;
  lng: number;
  lat: number;
  // 系统
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePinInput {
  title: string;
  description?: string;
  priority?: PinPriority;             // 默认 medium
  provinceCode: string;
  cityName: string;
  // status 创建时强制 in_progress,不接受外部值
  // closed_* / abortedReason 创建时必为空
  // lng/lat 后端自动从 lookupCityCenter 填
}

export interface UpdatePinInput {
  title?: string;
  description?: string | null;
  status?: PinStatus;
  abortedReason?: string | null;
  priority?: PinPriority;
  // 不允许改 provinceCode / cityName(改了会动 lng/lat 影响散点位置)
}
```

- [ ] **Step 1.2: 修 index.ts re-export**

```ts
// packages/shared-types/src/index.ts(新增最后一行)
export * from './enums/role';
export * from './enums/visit-color';
export * from './dtos/health.dto';
export * from './dtos/auth.dto';
export * from './dtos/visit.dto';
export * from './dtos/pin.dto';     // ⭐ 新增
```

- [ ] **Step 1.3: typecheck**

```bash
npm run typecheck --workspace=@pop/shared-types
```

预期:pass(无 error)。

- [ ] **Step 1.4: commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add Pin / CreatePinInput / UpdatePinInput DTOs"
```

---

## Task 2: API · Pin entity

**Files:**
- Create: `apps/api/src/pins/entities/pin.entity.ts`

- [ ] **Step 2.1: 写 entity**

```ts
// apps/api/src/pins/entities/pin.entity.ts
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
import type { PinStatus, PinPriority } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Pin · 图钉(PRD §3.3 B7 / §4.3.1)
 *
 * MVP β.2:9 业务 + 2 地理 + created_by FK to users + 系统时间戳
 * 状态机(B9):in_progress ⇄ completed / aborted,允许重开
 * 编辑权限:β.2 全 sys_admin;V0.7 接 CASL pmo/lead 真矩阵
 */
@Entity('pins')
@Index(['createdBy'])
@Index(['status'])
@Index(['provinceCode'])
export class PinEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 业务字段(9)
  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: ['in_progress', 'completed', 'aborted'],
    enumName: 'pin_status',
    default: 'in_progress',
  })
  status!: PinStatus;

  @Column({ type: 'text', nullable: true, name: 'aborted_reason' })
  abortedReason!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'closed_by' })
  closedBy!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedByUser?: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  @Column({
    type: 'enum',
    enum: ['high', 'medium', 'low'],
    enumName: 'pin_priority',
    default: 'medium',
  })
  priority!: PinPriority;

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
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

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

预期:pass(import 路径都对、UserEntity 找到、PinStatus/PinPriority 从 shared-types resolve)。

- [ ] **Step 2.3: commit**

```bash
git add apps/api/src/pins/entities/
git commit -m "feat(api): add Pin entity with status / priority enums + 3 indexes"
```

---

## Task 3: API · AddPinsTable migration(含 2 enums + 3 索引)

**Files:**
- Create: `apps/api/src/database/migrations/1745500000005-AddPinsTable.ts`

- [ ] **Step 3.1: 写 migration**

```ts
// apps/api/src/database/migrations/1745500000005-AddPinsTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 加 pins 表(PRD §3.3 B7,SPEC-V0.6-beta2-pin §2)
 *
 * - pin_status enum:in_progress / completed / aborted(B9)
 * - pin_priority enum:high / medium / low
 * - pins 表:9 业务 + 4 地理 + created_by FK + 时间戳
 * - 索引:created_by(我的 Pin)/ status / province_code(常用查询)
 */
export class AddPinsTable1745500000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 2 个 enum
    await queryRunner.query(
      `CREATE TYPE "pin_status" AS ENUM ('in_progress', 'completed', 'aborted');`,
    );
    await queryRunner.query(
      `CREATE TYPE "pin_priority" AS ENUM ('high', 'medium', 'low');`,
    );

    // pins 表
    await queryRunner.query(`
      CREATE TABLE "pins" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT NULL,
        "status" "pin_status" NOT NULL DEFAULT 'in_progress',
        "aborted_reason" TEXT NULL,
        "closed_by" UUID NULL,
        "closed_at" TIMESTAMPTZ NULL,
        "priority" "pin_priority" NOT NULL DEFAULT 'medium',
        "province_code" VARCHAR(6) NOT NULL,
        "city_name" VARCHAR(64) NOT NULL,
        "lng" DOUBLE PRECISION NOT NULL,
        "lat" DOUBLE PRECISION NOT NULL,
        "created_by" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_pins_creator"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_pins_closed_by"
          FOREIGN KEY ("closed_by") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_pins_created_by" ON "pins"("created_by");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pins_status" ON "pins"("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pins_province_code" ON "pins"("province_code");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pins";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pin_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pin_priority";`);
  }
}
```

- [ ] **Step 3.2: 跑 migration(只 up,seed 留 Task 7)**

```bash
npm run migration:run --workspace=@pop/api
```

预期 stdout 含 `Migration AddPinsTable1745500000005 has been executed successfully`。

- [ ] **Step 3.3: psql 验证表 + enum + 索引**

```bash
psql pop_dev -c "\\d pins"
psql pop_dev -c "\\dT pin_status"
psql pop_dev -c "\\dT pin_priority"
psql pop_dev -c "SELECT indexname FROM pg_indexes WHERE tablename='pins';"
```

预期:
- `\\d pins` 列出 16 列(id + 9 业务 + 4 地理 + created_by + created_at + updated_at)
- 2 个 enum 各列出 3 个值
- 4 个索引(PK + 3 个 idx_pins_*)

- [ ] **Step 3.4: commit**

```bash
git add apps/api/src/database/migrations/1745500000005-AddPinsTable.ts
git commit -m "feat(api): add pins table migration with pin_status / pin_priority enums"
```

---

## Task 4: API · DTOs(create + update with class-validator)

**Files:**
- Create: `apps/api/src/pins/dtos/create-pin.dto.ts`
- Create: `apps/api/src/pins/dtos/update-pin.dto.ts`

- [ ] **Step 4.1: 写 create-pin.dto.ts**

```ts
// apps/api/src/pins/dtos/create-pin.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';
  // status 不接受外部传 — service 强制初始化为 in_progress

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  provinceCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cityName!: string;
}
```

- [ ] **Step 4.2: 写 update-pin.dto.ts**

```ts
// apps/api/src/pins/dtos/update-pin.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 不允许改 provinceCode / cityName —— 改了会动 lng/lat 影响散点位置
 * 状态机校验在 service.update 里(prev → next 合法性 + aborted_reason 必填校验等)
 */
export class UpdatePinDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsEnum(['in_progress', 'completed', 'aborted'])
  status?: 'in_progress' | 'completed' | 'aborted';
  @IsOptional() @IsString() abortedReason?: string | null;
  @IsOptional() @IsEnum(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';
}
```

- [ ] **Step 4.3: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass。

- [ ] **Step 4.4: commit**

```bash
git add apps/api/src/pins/dtos/
git commit -m "feat(api): add CreatePinDto + UpdatePinDto with class-validator"
```

---

## Task 5: API · PinsService(状态机校验)+ Controller + Module

**Files:**
- Create: `apps/api/src/pins/pins.service.ts`
- Create: `apps/api/src/pins/pins.controller.ts`
- Create: `apps/api/src/pins/pins.module.ts`

- [ ] **Step 5.1: 写 pins.service.ts(含状态机校验,SPEC §3 完整逻辑)**

```ts
// apps/api/src/pins/pins.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { PinEntity } from './entities/pin.entity';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';
import type { PinStatus } from '@pop/shared-types';

/**
 * Pin 状态机合法切换 — PRD §4.3.1 + SPEC §3
 *   in_progress → completed / aborted
 *   completed   → in_progress(重开)
 *   aborted     → in_progress(重开)
 *   completed ↔ aborted 不允许直接切(必须先 reopen)
 */
const ALLOWED_TRANSITIONS: Record<PinStatus, PinStatus[]> = {
  in_progress: ['completed', 'aborted'],
  completed: ['in_progress'],
  aborted: ['in_progress'],
};

@Injectable()
export class PinsService {
  constructor(
    @InjectRepository(PinEntity) private readonly repo: Repository<PinEntity>,
  ) {}

  list(): Promise<PinEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<PinEntity> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Pin ${id} not found`);
    return p;
  }

  async create(dto: CreatePinDto, createdBy: string): Promise<PinEntity> {
    const center = lookupCityCenter(dto.provinceCode, dto.cityName);
    if (!center) {
      throw new BadRequestException(
        `未知的 provinceCode/cityName: ${dto.provinceCode}/${dto.cityName}`,
      );
    }
    const pin = this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      status: 'in_progress',         // 创建时强制
      abortedReason: null,
      closedBy: null,
      closedAt: null,
      priority: dto.priority ?? 'medium',
      provinceCode: dto.provinceCode,
      cityName: dto.cityName,
      lng: center.lng,
      lat: center.lat,
      createdBy,
    });
    return this.repo.save(pin);
  }

  async update(
    id: string,
    dto: UpdatePinDto,
    currentUserId: string,
  ): Promise<PinEntity> {
    const prev = await this.findOne(id);
    const newStatus = (dto.status ?? prev.status) as PinStatus;

    // 状态切换:校验 + 自动维护 closed_* / aborted_reason
    if (newStatus !== prev.status) {
      if (!ALLOWED_TRANSITIONS[prev.status].includes(newStatus)) {
        throw new BadRequestException(
          `非法状态切换:${prev.status} → ${newStatus}`,
        );
      }
      if (newStatus === 'aborted' && !dto.abortedReason) {
        throw new BadRequestException('中止 Pin 必须填写中止原因');
      }
      if (newStatus === 'in_progress') {
        // 重开 — 置空 closed_* / aborted_reason
        prev.closedAt = null;
        prev.closedBy = null;
        prev.abortedReason = null;
      } else {
        // 关闭(completed / aborted)
        prev.closedAt = new Date();
        prev.closedBy = currentUserId;
        prev.abortedReason = newStatus === 'aborted'
          ? (dto.abortedReason ?? null)
          : null;
      }
      prev.status = newStatus;
    }

    // 业务字段 patch(provinceCode / cityName 不接受改 — UpdatePinDto 已限制)
    if (dto.title !== undefined) prev.title = dto.title;
    if (dto.description !== undefined) prev.description = dto.description;
    if (dto.priority !== undefined) prev.priority = dto.priority;

    return this.repo.save(prev);
  }
}
```

- [ ] **Step 5.2: 写 pins.controller.ts**

```ts
// apps/api/src/pins/pins.controller.ts
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { PinsService } from './pins.service';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';

/**
 * Pin API(SPEC-V0.6-beta2-pin §3)
 * 全部走 sys_admin 全权(JWT auth + CASL `sys_admin manage all`)
 * 状态机校验在 service.update,UpdatePinDto 不接受 provinceCode/cityName 改
 */
@Controller('pins')
export class PinsController {
  constructor(private readonly service: PinsService) {}

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
    @Body() dto: CreatePinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.create(dto, user.id) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.update(id, dto, user.id) };
  }
}
```

- [ ] **Step 5.3: 写 pins.module.ts**

```ts
// apps/api/src/pins/pins.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinEntity } from './entities/pin.entity';
import { PinsController } from './pins.controller';
import { PinsService } from './pins.service';

@Module({
  imports: [TypeOrmModule.forFeature([PinEntity])],
  controllers: [PinsController],
  providers: [PinsService],
})
export class PinsModule {}
```

- [ ] **Step 5.4: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass。

- [ ] **Step 5.5: commit**

```bash
git add apps/api/src/pins/
git commit -m "feat(api): add PinsService (state machine validation) + Controller + Module"
```

---

## Task 6: API · 注册 PinsModule + 端到端 curl 验证

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 6.1: 注册 PinsModule**

在 `apps/api/src/app.module.ts` 找 `import { VisitsModule }` 那一行(已存在),下面加:

```ts
import { PinsModule } from './pins/pins.module';
```

然后在 imports 数组末尾(VisitsModule 后面)加:

```ts
imports: [
  // ... 其他 modules ...
  VisitsModule,
  PinsModule,            // ⭐ 新增
],
```

- [ ] **Step 6.2: typecheck**

```bash
npm run typecheck --workspace=@pop/api
```

预期:pass。

- [ ] **Step 6.3: 起 dev:api(后台或新 terminal)**

```bash
npm run dev:api
```

或用 preview tools(若已有 .claude/launch.json):`mcp__Claude_Preview__preview_start({ name: 'api-dev' })`。

预期:启动 log 含
```
PinsController {/api/v1/pins}:
Mapped {/api/v1/pins, GET} route
Mapped {/api/v1/pins/:id, GET} route
Mapped {/api/v1/pins, POST} route
Mapped {/api/v1/pins/:id, PUT} route
Nest application successfully started
```

- [ ] **Step 6.4: 拿 sysadmin token**

```bash
TOKEN=$(curl -sS -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"sysadmin","password":"sysadmin123"}' \
  | jq -r '.data.accessToken')
echo "$TOKEN" | head -c 30 && echo "..."
```

预期:输出 token 前 30 字符。

- [ ] **Step 6.5: GET /api/v1/pins(空列表)**

```bash
curl -sS http://localhost:3001/api/v1/pins -H "Authorization: Bearer $TOKEN" | jq
```

预期:`{"data":[]}`(seed 还没跑,Task 7 才跑 seed)。

- [ ] **Step 6.6: POST /api/v1/pins(创建一条测试 Pin)**

```bash
PIN_ID=$(curl -sS -X POST http://localhost:3001/api/v1/pins \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "测试 Pin",
    "description": "curl e2e 验证",
    "priority": "high",
    "provinceCode": "510000",
    "cityName": "成都市"
  }' | jq -r '.data.id')
echo "Created pin: $PIN_ID"
```

预期:返回 UUID。
verify: `curl -sS http://localhost:3001/api/v1/pins/$PIN_ID -H "Authorization: Bearer $TOKEN" | jq` 返回完整 Pin 对象,`status=in_progress`,`lng/lat` 自动填(成都中心 ~ 104.06 / 30.66),`closedBy=null`,`closedAt=null`。

- [ ] **Step 6.7: PUT 切到 completed(应自动填 closed_*)**

```bash
curl -sS -X PUT http://localhost:3001/api/v1/pins/$PIN_ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed"}' | jq
```

预期:返回 Pin,`status=completed`,`closedAt` 是当前时间,`closedBy` 是 sysadmin user id。

- [ ] **Step 6.8: PUT 重开(应置空 closed_*)**

```bash
curl -sS -X PUT http://localhost:3001/api/v1/pins/$PIN_ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"in_progress"}' | jq
```

预期:返回 Pin,`status=in_progress`,`closedAt=null`,`closedBy=null`,`abortedReason=null`。

- [ ] **Step 6.9: PUT 中止不带 reason(应 400)**

```bash
curl -sS -X PUT http://localhost:3001/api/v1/pins/$PIN_ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"aborted"}' -w "\nHTTP %{http_code}\n" | head -10
```

预期:HTTP 400,message 含「中止 Pin 必须填写中止原因」。

- [ ] **Step 6.10: PUT 中止带 reason(应 200)**

```bash
curl -sS -X PUT http://localhost:3001/api/v1/pins/$PIN_ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"aborted","abortedReason":"测试中止原因"}' | jq
```

预期:返回 Pin,`status=aborted`,`abortedReason="测试中止原因"`,`closedAt` / `closedBy` 填好。

- [ ] **Step 6.11: PUT aborted → completed 直接切(应 400 非法切换)**

```bash
curl -sS -X PUT http://localhost:3001/api/v1/pins/$PIN_ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed"}' -w "\nHTTP %{http_code}\n"
```

预期:HTTP 400,message 含「非法状态切换:aborted → completed」。

- [ ] **Step 6.12: 删测试 Pin(直接 SQL,API 不暴露 DELETE)**

```bash
psql pop_dev -c "DELETE FROM pins WHERE id = '$PIN_ID';"
```

预期:`DELETE 1`。

- [ ] **Step 6.13: commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register PinsModule + e2e curl verified (CRUD + state machine)"
```

---

## Task 7: API · SeedDemoPins migration(3 条)

**Files:**
- Create: `apps/api/src/database/migrations/1745500000006-SeedDemoPins.ts`

- [ ] **Step 7.1: 写 SeedDemoPins migration**

```ts
// apps/api/src/database/migrations/1745500000006-SeedDemoPins.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed 3 条 demo Pin(SPEC-V0.6-beta2-pin §4)
 *
 * 成都(in_progress / high) / 广州(completed / medium) / 上海(aborted / low)
 * - 3 态各 1 条 → 状态机 demo 完整(紫 / 暗灰 / 浅灰)
 * - 3 档 priority 各 1 条 → 工作台 Table sort by priority demo 力度足
 * - created_by 都填 sysadmin user id(β.2 全 sys_admin)
 *
 * Idempotent:跑前清空 pins 表(MVP 简化,生产 migration 不可清表)
 */
export class SeedDemoPins1745500000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 拿 sysadmin user id(V0.2 SeedDemoUsers 已 seed)
    const userRows = await queryRunner.query(
      `SELECT "id" FROM "users" WHERE "username" = 'sysadmin' LIMIT 1;`,
    );
    if (userRows.length === 0) {
      throw new Error('SeedDemoPins 依赖 SeedDemoUsers,先跑前面的 migration');
    }
    const sysadminId = userRows[0].id;

    // 清空 pins(idempotent)
    await queryRunner.query(`DELETE FROM "pins";`);

    // 3 条 hardcode
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const seeds: Array<{
      title: string;
      description: string;
      status: 'in_progress' | 'completed' | 'aborted';
      abortedReason: string | null;
      closedAt: Date | null;
      priority: 'high' | 'medium' | 'low';
      provinceCode: string;
      cityName: string;
      lng: number;
      lat: number;
    }> = [
      {
        title: '成都新能源汽车产业链对接',
        description: '与成都市经发局对接成都新能源汽车产业,涉及 V2G 试点合作意向初步沟通',
        status: 'in_progress',
        abortedReason: null,
        closedAt: null,
        priority: 'high',
        provinceCode: '510000',
        cityName: '成都市',
        lng: 104.065735,
        lat: 30.659462,
      },
      {
        title: '广州 V2G 试点推进',
        description: '广州市发改委 V2G 示范应用试点合作意向已落地',
        status: 'completed',
        abortedReason: null,
        closedAt: days30Ago,
        priority: 'medium',
        provinceCode: '440000',
        cityName: '广州市',
        lng: 113.280637,
        lat: 23.125178,
      },
      {
        title: '上海数据要素市场化试点',
        description: '上海经信委对接数据要素流通市场化探索',
        status: 'aborted',
        abortedReason: '政策窗口关闭,等下一轮政策周期重启',
        closedAt: days60Ago,
        priority: 'low',
        provinceCode: '310000',
        cityName: '上海市',
        lng: 121.438737,
        lat: 31.072559,
      },
    ];

    for (const s of seeds) {
      // closed/aborted 时 closed_by = sysadmin;in_progress 时 closed_by = null
      const closedBy = s.status === 'in_progress' ? null : sysadminId;
      await queryRunner.query(
        `INSERT INTO "pins"
         ("title", "description", "status", "aborted_reason",
          "closed_by", "closed_at", "priority",
          "province_code", "city_name", "lng", "lat", "created_by")
         VALUES ($1, $2, $3::pin_status, $4, $5, $6, $7::pin_priority,
                 $8, $9, $10, $11, $12);`,
        [
          s.title,
          s.description,
          s.status,
          s.abortedReason,
          closedBy,
          s.closedAt,
          s.priority,
          s.provinceCode,
          s.cityName,
          s.lng,
          s.lat,
          sysadminId,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "pins";`);
  }
}
```

- [ ] **Step 7.2: 跑 migration**

```bash
npm run migration:run --workspace=@pop/api
```

预期 stdout 含 `Migration SeedDemoPins1745500000006 has been executed successfully`。

- [ ] **Step 7.3: psql 验证 3 条**

```bash
psql pop_dev -c "SELECT title, status, priority, city_name FROM pins ORDER BY created_at;"
```

预期 3 行:
```
 成都新能源汽车产业链对接 | in_progress | high   | 成都市
 广州 V2G 试点推进         | completed   | medium | 广州市
 上海数据要素市场化试点    | aborted     | low    | 上海市
```

- [ ] **Step 7.4: GET API 验证(用 Task 6 拿到的 TOKEN)**

```bash
curl -sS http://localhost:3001/api/v1/pins -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

预期:`3`。

```bash
curl -sS http://localhost:3001/api/v1/pins -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {title, status, priority, cityName, abortedReason, closedAt}'
```

预期:3 条 Pin,字段对得上 SPEC §4 表格。

- [ ] **Step 7.5: commit**

```bash
git add apps/api/src/database/migrations/1745500000006-SeedDemoPins.ts
git commit -m "feat(api): seed 3 demo Pins (成都/广州/上海, 3 状态 × 3 priority)"
```

---

## Task 8: Web · PinFormModal 组件

**Files:**
- Create: `apps/web/src/components/PinFormModal.tsx`

- [ ] **Step 8.1: 写 PinFormModal(参考 β.1 VisitFormModal,字段换成 Pin 业务)**

```tsx
// apps/web/src/components/PinFormModal.tsx
import { useEffect, useMemo } from 'react';
import { Alert, Form, Input, Modal, Radio, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Pin,
  CreatePinInput,
  UpdatePinInput,
  PinStatus,
  PinPriority,
  CityListResponse,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑场景:传入现有 Pin;录入场景:undefined */
  editing?: Pin;
}

interface FormValues {
  title: string;
  description: string;
  priority: PinPriority;
  provinceCode: string;
  cityName: string;
  // 编辑态额外:
  status?: PinStatus;
  abortedReason?: string;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function PinFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({
      label: p.provinceName, value: p.provinceCode,
    })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('provinceCode', form);
  const watchStatus = Form.useWatch('status', form);
  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue({
        title: editing.title,
        description: editing.description ?? '',
        priority: editing.priority,
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        status: editing.status,
        abortedReason: editing.abortedReason ?? '',
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({
        priority: 'medium',
      });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      if (editing) {
        // 编辑:含 status 切换 + abortedReason
        const body: UpdatePinInput = {
          title: values.title,
          description: values.description || null,
          priority: values.priority,
          status: values.status,
          // aborted 时带 reason;其他状态不带
          abortedReason: values.status === 'aborted'
            ? (values.abortedReason ?? null)
            : null,
        };
        const r = await fetch(`/api/v1/pins/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: 'update fail' }));
          throw new Error(err.message ?? 'update fail');
        }
      } else {
        // 创建:status 后端强制 in_progress
        const body: CreatePinInput = {
          title: values.title,
          description: values.description || undefined,
          priority: values.priority,
          provinceCode: values.provinceCode,
          cityName: values.cityName,
        };
        const r = await fetch(`/api/v1/pins`, {
          method: 'POST', headers, body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('create fail');
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['pins'] });
      if (editing) qc.invalidateQueries({ queryKey: ['pin', editing.id] });
      onClose();
    },
    onError: (err) => {
      message.error(`保存失败: ${(err as Error).message}`);
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑图钉' : '新建图钉'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
          <Input maxLength={100} placeholder="例:成都新能源汽车产业链对接" />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <TextArea rows={3} placeholder="可选:项目背景 / 推进要点" />
        </Form.Item>

        <Form.Item label="优先级" name="priority" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="high">高</Radio>
            <Radio value="medium">中</Radio>
            <Radio value="low">低</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing}
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>

        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>

        {/* 编辑态:状态切换 + 中止原因 */}
        {editing && (
          <>
            <Form.Item label="状态" name="status" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="in_progress">进行中</Radio>
                <Radio value="completed">完成</Radio>
                <Radio value="aborted">中止</Radio>
              </Radio.Group>
            </Form.Item>

            {watchStatus === 'aborted' && (
              <Form.Item
                label="中止原因"
                name="abortedReason"
                rules={[{ required: true, message: '中止时必须填写原因' }]}
              >
                <TextArea rows={2} placeholder="例:政策窗口关闭,等下一轮" />
              </Form.Item>
            )}

            {watchStatus === 'in_progress' && editing.status !== 'in_progress' && (
              <Alert
                type="info"
                showIcon
                message="重开 Pin 会清空关闭信息(closed_at / closed_by / aborted_reason)"
                style={{ marginBottom: 16 }}
              />
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 8.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass。

- [ ] **Step 8.3: commit**

```bash
git add apps/web/src/components/PinFormModal.tsx
git commit -m "feat(web): add PinFormModal (create/edit + state switch + aborted_reason)"
```

---

## Task 9: Web · PinsTab 替换 StubCard

**Files:**
- Modify: `apps/web/src/pages/console/PinsTab.tsx`

- [ ] **Step 9.1: 替换整个文件**

```tsx
// apps/web/src/pages/console/PinsTab.tsx
import { useState } from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Pin, PinStatus, PinPriority } from '@pop/shared-types';
import { PinFormModal } from '@/components/PinFormModal';
import { authHeaders } from '@/lib/api';

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

async function fetchPins(): Promise<{ data: Pin[] }> {
  const r = await fetch('/api/v1/pins', { headers: authHeaders() });
  if (!r.ok) throw new Error('pins fetch fail');
  return r.json();
}

export function PinsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['pins'], queryFn: fetchPins });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pin | undefined>(undefined);

  const pins = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>图钉清单 ({pins.length})</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
        >
          新建图钉
        </Button>
      </Space>

      <Table
        dataSource={pins}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title',
            ellipsis: true,
          },
          { title: '城市', width: 120, render: (_, r) => r.cityName },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: PinStatus) => (
              <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>
            ),
          },
          {
            title: '优先级',
            dataIndex: 'priority',
            width: 90,
            sorter: (a, b) =>
              PRIORITY_TAG[a.priority].sortKey - PRIORITY_TAG[b.priority].sortKey,
            render: (p: PinPriority) => (
              <Tag color={PRIORITY_TAG[p].color}>{PRIORITY_TAG[p].label}</Tag>
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 170,
            sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
            defaultSortOrder: 'descend',
            render: (v: string) => v.replace('T', ' ').slice(0, 16),
          },
          {
            title: '操作',
            width: 80,
            render: (_, r) => (
              <Button
                size="small"
                type="link"
                onClick={() => { setEditing(r); setModalOpen(true); }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />

      <PinFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
```

- [ ] **Step 9.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass。

- [ ] **Step 9.3: commit**

```bash
git add apps/web/src/pages/console/PinsTab.tsx
git commit -m "feat(web): replace PinsTab StubCard with real Table + PinFormModal"
```

---

## Task 10: Web · PinDetailDrawer 组件

**Files:**
- Create: `apps/web/src/components/PinDetailDrawer.tsx`

- [ ] **Step 10.1: 写 PinDetailDrawer**

参考 β.1 VisitDetailDrawer 风格,差异:
- 顶部状态切换按钮组(根据当前 status 显示有效按钮)
- 中止时弹 Modal.confirm 收 abortedReason
- 不展示「相关工具」(Pin 不接 demo 文档,Visit 才有)
- 「编辑」按钮打开 PinFormModal(editing 态),不在 Drawer 内表单编辑

```tsx
// apps/web/src/components/PinDetailDrawer.tsx
import { useState } from 'react';
import {
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Pin, PinStatus, UpdatePinInput } from '@pop/shared-types';
import { PinFormModal } from './PinFormModal';
import { authHeaders } from '@/lib/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_TAG: Record<PinStatus, { color: string; label: string }> = {
  in_progress: { color: 'purple', label: '进行中' },
  completed: { color: 'default', label: '完成' },
  aborted: { color: 'default', label: '中止' },
};

const PRIORITY_TAG: Record<Pin['priority'], { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'green', label: '低' },
};

interface Props {
  pinId: string | null;
  onClose: () => void;
}

async function fetchPin(id: string): Promise<{ data: Pin }> {
  const r = await fetch(`/api/v1/pins/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('pin detail fetch fail');
  return r.json();
}

async function patchStatus(
  pinId: string,
  status: PinStatus,
  abortedReason?: string,
): Promise<void> {
  const body: UpdatePinInput = { status };
  if (status === 'aborted') body.abortedReason = abortedReason ?? null;
  const r = await fetch(`/api/v1/pins/${pinId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: 'status change fail' }));
    throw new Error(err.message ?? 'status change fail');
  }
}

export function PinDetailDrawer({ pinId, onClose }: Props) {
  const qc = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pin', pinId],
    queryFn: () => fetchPin(pinId as string),
    enabled: !!pinId,
  });

  const pin = data?.data;

  const statusMutation = useMutation({
    mutationFn: (args: { status: PinStatus; reason?: string }) =>
      patchStatus(pinId as string, args.status, args.reason),
    onSuccess: () => {
      message.success('状态已更新');
      qc.invalidateQueries({ queryKey: ['pins'] });
      qc.invalidateQueries({ queryKey: ['pin', pinId] });
    },
    onError: (err) => message.error(`状态变更失败: ${(err as Error).message}`),
  });

  const handleAbort = () => {
    let reason = '';
    Modal.confirm({
      title: '中止图钉',
      content: (
        <div>
          <Paragraph type="secondary">中止后此图钉颜色变浅灰,可后续重开。</Paragraph>
          <TextArea
            rows={3}
            placeholder="中止原因(必填)"
            onChange={(e) => { reason = e.target.value; }}
          />
        </div>
      ),
      okText: '确认中止',
      cancelText: '取消',
      onOk: () => {
        if (!reason.trim()) {
          message.error('中止原因必填');
          return Promise.reject();
        }
        return statusMutation.mutateAsync({ status: 'aborted', reason });
      },
    });
  };

  return (
    <>
      <Drawer
        title={
          pin ? (
            <Space>
              <Text strong style={{ fontSize: 15 }}>{pin.title}</Text>
              <Tag color={STATUS_TAG[pin.status].color}>{STATUS_TAG[pin.status].label}</Tag>
            </Space>
          ) : '加载中…'
        }
        placement="right"
        width={440}
        open={!!pinId}
        onClose={onClose}
        destroyOnClose
      >
        {isLoading || !pin ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <>
            {/* 状态切换按钮组 */}
            <Space style={{ marginBottom: 16 }} wrap>
              {pin.status === 'in_progress' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ status: 'completed' })}
                  >
                    标记完成
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleAbort}
                  >
                    中止
                  </Button>
                </>
              )}
              {pin.status !== 'in_progress' && (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ status: 'in_progress' })}
                >
                  重开
                </Button>
              )}
              <Button icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
                编辑
              </Button>
            </Space>

            {/* 详情展示 */}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="优先级">
                <Tag color={PRIORITY_TAG[pin.priority].color}>{PRIORITY_TAG[pin.priority].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="城市">
                {pin.cityName}({pin.provinceCode})
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {pin.description ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {pin.createdAt.replace('T', ' ').slice(0, 16)}
              </Descriptions.Item>
              {pin.closedAt && (
                <Descriptions.Item label="关闭时间">
                  {pin.closedAt.replace('T', ' ').slice(0, 16)}
                </Descriptions.Item>
              )}
              {pin.status === 'aborted' && pin.abortedReason && (
                <Descriptions.Item label="中止原因">
                  <Text type="secondary">{pin.abortedReason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Drawer>

      {pin && (
        <PinFormModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          editing={pin}
        />
      )}
    </>
  );
}
```

- [ ] **Step 10.2: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass。

- [ ] **Step 10.3: commit**

```bash
git add apps/web/src/components/PinDetailDrawer.tsx
git commit -m "feat(web): add PinDetailDrawer with state switch buttons + abort modal + edit entry"
```

---

## Task 11: Web · MapCanvas 加 pin scatter + MapShell 接入

**Files:**
- Modify: `apps/web/src/components/MapCanvas.tsx`
- Modify: `apps/web/src/pages/MapShell.tsx`

- [ ] **Step 11.1: 改 MapCanvas — 加 ['pins'] query + pin scatter series + onPinClick prop**

在 `apps/web/src/components/MapCanvas.tsx` 顶部 import 加:

```tsx
import type { Pin, PinStatus } from '@pop/shared-types';
```

加 PIN 颜色常量(在文件顶部 `import` 后):

```tsx
const PIN_STATUS_COLOR: Record<PinStatus, string> = {
  in_progress: '#B388FF',  // 紫
  completed: '#607D8B',    // 暗灰
  aborted: '#BDBDBD',      // 浅灰
};

const PIN_STATUS_OPACITY: Record<PinStatus, number> = {
  in_progress: 0.95,
  completed: 0.9,
  aborted: 0.5,
};

async function fetchPins(): Promise<{ data: Pin[] }> {
  const r = await fetch('/api/v1/pins', { headers: authHeaders() });
  if (!r.ok) throw new Error('pins fetch fail');
  return r.json();
}
```

修 Props interface,加 `onPinClick`:

```tsx
interface Props {
  provinceCode: string | null;
  onProvinceChange: (code: string | null) => void;
  onRegionClick?: (regionCode: string, regionName: string) => void;
  onVisitClick?: (visitId: string) => void;
  onPinClick?: (pinId: string) => void;     // ⭐ 新增
}
```

签名加新 prop:

```tsx
export function MapCanvas({
  provinceCode, onProvinceChange, onRegionClick, onVisitClick, onPinClick,
}: Props) {
```

加 pins query(在 `const { data: visits } = useQuery({...})` 后):

```tsx
const { data: pinsResp } = useQuery({
  queryKey: ['pins'],
  queryFn: fetchPins,
});
const pins = pinsResp?.data ?? [];
```

把 pins 转成 scatter data(在 `option = useMemo(...)` 内的 visitsScatterData 后):

```tsx
const pinsScatterData = pins
  .filter((p) => !provinceCode || p.provinceCode === provinceCode)
  .map((p) => ({
    value: [p.lng, p.lat, 1],
    itemStyle: {
      color: PIN_STATUS_COLOR[p.status],
      opacity: PIN_STATUS_OPACITY[p.status],
      shadowBlur: 8,
      shadowColor: 'rgba(0,0,0,0.4)',
    },
    name: p.title,
    pinId: p.id,
  }));
```

在 `series: [{...visit scatter}]` 数组里 append 第二个 series:

```tsx
series: [
  {
    // ... 既有 Visit scatter ...
  },
  {
    // ⭐ 新增 Pin scatter
    type: 'scatter',
    coordinateSystem: 'geo',
    geoIndex: 0,
    symbol: 'pin',
    symbolSize: provinceCode ? 22 : 14,
    data: pinsScatterData,
    z: 6,
    silent: false,
  },
],
```

修 click 事件(原 onEvents.click 处)— 区分 visitId / pinId:

```tsx
const onEvents = {
  click: (params: any) => {
    if (params.componentType === 'series' && params.data?.visitId) {
      onVisitClick?.(params.data.visitId);
      return;
    }
    if (params.componentType === 'series' && params.data?.pinId) {
      onPinClick?.(params.data.pinId);
      return;
    }
    // 既有 region click 逻辑保留
    if (params.componentType === 'geo' && params.name) {
      // ...
    }
  },
};
```

完整 useMemo deps 数组要加 `pinsScatterData` 或 `pins / provinceCode`(具体看现有写法,确保 pin 变化触发 option 重算)。

- [ ] **Step 11.2: 改 MapShell — 加 selectedPinId / pinModalOpen state + 删占位 Drawer + 接 PinFormModal/PinDetailDrawer**

在 `apps/web/src/pages/MapShell.tsx` 顶部 import 加:

```tsx
import { PinFormModal } from '@/components/PinFormModal';
import { PinDetailDrawer } from '@/components/PinDetailDrawer';
```

state 区域加(在 `selectedVisitId` state 后):

```tsx
const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
const [pinModalOpen, setPinModalOpen] = useState(false);
```

`<MapCanvas>` 多接一个 prop:

```tsx
<MapCanvas
  provinceCode={currentProvinceCode}
  onProvinceChange={setCurrentProvinceCode}
  onVisitClick={setSelectedVisitId}
  onPinClick={setSelectedPinId}      {/* ⭐ */}
/>
```

➕📌 浮按钮的 `onClick` 改成 `setPinModalOpen(true)`(替换原 `setDrawerOpen(true)`)— 找到 `<Tooltip title="新增 Pin / 蓝点(占位)">...<Button onClick={() => setDrawerOpen(true)}>` 段,改 onClick:

```tsx
<Button
  // ...
  onClick={() => setPinModalOpen(true)}    {/* 原 setDrawerOpen(true) */}
>
```

删除现有占位 `<Drawer title="新增 Pin / 蓝点(占位)">...</Drawer>` 整段(MapShell.tsx 里大约在 line 142-157)。同时删除 `drawerOpen` state 和 `setDrawerOpen` 用法(若没别的引用)。

末尾加新两个组件:

```tsx
<PinFormModal
  open={pinModalOpen}
  onClose={() => setPinModalOpen(false)}
/>

<PinDetailDrawer
  pinId={selectedPinId}
  onClose={() => setSelectedPinId(null)}
/>
```

更新文案(line ~84 附近)— 末行从「(β.1 真数据 · 32 条 seed Visit)」改成 :

```tsx
{isPolicy
  ? '· 涂层勾选(多层级联)\n· 时间维度\n· (c3 待接 · C4/C8 涂层)'
  : '· 时间窗口\n· 区划筛选\n· 角色筛选\n· (β.1 32 Visit + β.2 3 Pin · 形状区分)'}
```

- [ ] **Step 11.3: typecheck**

```bash
npm run typecheck --workspace=@pop/web
```

预期:pass(可能要补 unused import 清理,如 MapShell 删完占位 Drawer 后 `Drawer` 如果没别处引用,删掉 import)。

- [ ] **Step 11.4: commit**

```bash
git add apps/web/src/components/MapCanvas.tsx apps/web/src/pages/MapShell.tsx
git commit -m "feat(web): add Pin scatter (symbol:pin + 3 status colors) + MapShell wiring"
```

---

## Task 12: 端到端浏览器实测 + Squash + PR

**Files:** 无新增。

按 §7.13 教训:**必须从浏览器登录 → 跳页面 → 看 Network → 看数据**。

- [ ] **Step 12.1: 起双 dev server**

如有 `.claude/launch.json` 配置:
```bash
# preview tools
mcp__Claude_Preview__preview_start({ name: 'api-dev' })
mcp__Claude_Preview__preview_start({ name: 'vite-dev' })
```

或手动:
```bash
npm run dev:api    # terminal 1
npm run dev:web    # terminal 2
```

预期:api 启动 log 含 `PinsController` mapped 4 routes / vite ready on 5173。

- [ ] **Step 12.2: 浏览器 sysadmin 登录**

打开 http://localhost:5173/login → 填 sysadmin / sysadmin123 → 跳到 /map/local 或 console。

- [ ] **Step 12.3: 大盘 `/map/local` 视觉验证**

预期(打开 Network 面板):
- `GET /api/v1/visits` → 200 32 条
- `GET /api/v1/pins` → 200 3 条
- 大盘可见:32 个 Visit 红/黄/绿圆点 + 3 个 Pin 图钉形状(成都紫色 in_progress / 广州暗灰 completed / 上海浅灰半透明 aborted)
- 形状语义清晰区分(图钉头朝下 vs 圆点)

- [ ] **Step 12.4: 大盘 Pin 交互**

- 点成都紫色图钉 → PinDetailDrawer 弹出(右侧),顶部按钮组显示「标记完成 / 中止 / 编辑」
- 点「中止」→ Modal.confirm 弹出 → 输入 reason「测试中止」→ 确认 → 大盘成都图钉变浅灰半透 + Drawer 状态 Tag 变中止 + 按钮组变「重开 / 编辑」
- 点「重开」→ 大盘图钉变紫 + closed_at / aborted_reason 消失
- 点「编辑」→ PinFormModal 弹出,字段预填 → 改 priority 为 medium → 保存 → 大盘 Pin 不动(priority 不影响视觉)+ 工作台 Table 该行 priority Tag 变橙

- [ ] **Step 12.5: ➕📌 浮按钮**

- 点右下 ➕📌 → PinFormModal 弹出
- 填 title「测试新建图钉」/ 优先级 medium / 省 北京 / 市 北京市 → 保存
- 大盘北京位置出现新图钉(紫色 in_progress)
- 工作台 `/console/pins` Table 现 4 行(原 3 + 新 1)

- [ ] **Step 12.6: 工作台 `/console/pins`**

- Table 显示 3-4 行(取决于 12.5 是否新增)
- 列:标题 / 城市 / 状态 Tag(紫紫紫灰...) / 优先级 Tag(红橙绿)/ 创建时间 / [编辑]
- 点「优先级」列头 → sort,高/中/低 顺序变化
- 点「编辑」→ 开 PinFormModal 编辑态
- 点「新建图钉」→ 开 PinFormModal 创建态

- [ ] **Step 12.7: 回归 β.1 / V0.4-V0.5 视觉**

- Visit 散点(红/黄/绿圆点)依然显示,数量 32,跟 Pin 形状区别清楚
- Visit click → VisitDetailDrawer 仍弹出(不退化)
- 浮玻璃 / 把手 / Slider / Legend 视觉无退化
- console 无 401 / 500 / runtime error

- [ ] **Step 12.8: psql 验证最终数据**

```bash
psql pop_dev -c "SELECT COUNT(*) FROM pins;"
psql pop_dev -c "SELECT title, status, priority FROM pins ORDER BY created_at;"
```

预期:
- 至少 3 条(可能 4 条若 12.5 新建未删)
- 字段对得上交互结果

- [ ] **Step 12.9: 清理测试数据(可选)**

如果 12.5 创建了测试 Pin,删掉:

```bash
psql pop_dev -c "DELETE FROM pins WHERE title = '测试新建图钉';"
```

- [ ] **Step 12.10: Squash 推 PR**

把 11 个独立 commits squash 成单 commit(对齐 β.1 流程):

```bash
git fetch origin
# 当前分支 claude/v06-beta2-pin,base = origin/main(c27295a)
git reset --soft origin/main
git status     # 应该看到全部 β.2 改动 staged
git commit -m "feat: V0.6 β.2 Pin/图钉 真业务(端到端 · 3 seed + CRUD + 状态机 + 大盘抽屉)

V0.6 β.2 Pin 真业务端到端闭环:

后端(NestJS + TypeORM + PostgreSQL)
- apps/api/src/pins/ — Entity / Service(状态机校验)/ Controller / Module
- 2 个 migration:AddPinsTable(+ pin_status / pin_priority enum + 3 索引)、SeedDemoPins(成都/广州/上海 各 1 条覆盖 3 态 × 3 priority)
- 4 端点 GET/POST/PUT(无 DELETE,留 V0.7 soft delete)
- 状态机:in_progress ⇄ completed/aborted,允许重开,不允许 completed↔aborted 直接切;aborted 必填 reason
- 全 sys_admin 全权(JWT auth);CASL pmo/lead 真矩阵留 V0.7

前端(React + react-query + AntD)
- apps/web/src/components/PinFormModal.tsx — 录入/编辑 Modal,省+市 cascading 复用 β.1 cities API
- apps/web/src/components/PinDetailDrawer.tsx — 大盘抽屉 + 顶部状态切换按钮组(标记完成 / 中止 / 重开 / 编辑)+ 中止 Modal.confirm
- apps/web/src/pages/console/PinsTab.tsx — 替换 StubCard 为真 Table + sort by priority
- apps/web/src/components/MapCanvas.tsx — 加第二个 scatter series:symbol:'pin' + 3 状态色(紫/暗灰/浅灰半透)
- apps/web/src/pages/MapShell.tsx — selectedPinId state + pinModalOpen state + 删除占位 Drawer + ➕📌 触发 PinFormModal

复用 β.1 idiom 零新代码:
- 后端 lookupCityCenter 自动填 lng/lat
- 前端 lib/api.ts authHeaders fetch wrapper
- VisitFormModal / VisitDetailDrawer 模板克隆改名

📌 不在范围(留后续):
- B8 Pin 留言板(Comment 实体 + UI)→ β.2.5
- G16 子蓝点完成自动留言 → β.3
- PlanPoint(蓝点)+ 状态流转 → β.3
- related_theme_ids → c3
- CASL pmo/lead → V0.7
- Soft delete + audit log → V0.7
- B14 工作台筛选 → V0.7

🎨 β.3 视觉约定(SPEC §12 已记):
PlanPoint 用跟 Visit 散点完全一致的形状(圆点)+ size + style,仅颜色用 palette.visit.blue。

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 12.11: push + 创建 PR**

```bash
git push -u origin claude/v06-beta2-pin

gh pr create --title "feat: V0.6 β.2 Pin/图钉 真业务(端到端 · 3 seed + 状态机 + 大盘抽屉)" --body "$(cat <<'EOF'
## Summary

V0.6 β.2 Pin/图钉 真业务端到端闭环。继 β.1 Visit 后,把 PRD §3.3 B7 + B9 落地。

对齐 PRD:
- B7(L452)图钉创建 + 维护(标题/地理/状态/priority)
- B9(L454)状态机 in_progress ⇄ completed / aborted,允许重开
- 不做:B8 留言板 → β.2.5;G16 自动留言 → β.3;related_theme_ids → c3;CASL → V0.7

## 实现要点

### 后端(NestJS + TypeORM + PostgreSQL)
- pins 表 + 2 enum(pin_status / pin_priority)+ 3 索引
- 5 端点 GET list/:id + POST + PUT(状态机校验在 service.update)
- 状态机:in_progress ⇄ completed/aborted,完成/中止互切必须先 reopen;aborted 必填 reason;重开置空 closed_*
- 3 条 seed:成都(in_progress / high)、广州(completed / medium)、上海(aborted / low)— 3 态 × 3 priority 全覆盖
- 复用 β.1 lookupCityCenter 自动填 lng/lat(零新代码)

### 前端(React + react-query + AntD)
- 大盘 ECharts symbol:'pin' 图钉形状 + 3 状态色(紫 #B388FF / 暗灰 #607D8B / 浅灰 #BDBDBD opacity 0.5)
- ➕📌 浮按钮替换占位抽屉 → PinFormModal(省+市 cascading)
- PinDetailDrawer 顶部状态切换按钮组(标记完成/中止/重开/编辑)+ 中止时弹 Modal.confirm 收 reason
- 工作台 PinsTab 真 Table(sort by priority)
- 命名:DB column snake_case / property + DTO + JSON wire 全 camelCase(对齐 β.1 idiom)

## Test plan

- [x] typecheck pass(api + web + shared-types)
- [x] migration:run 跑通,pins 表 + 2 enum + 3 索引 + 3 seed 入库
- [x] API curl e2e 验证(创建 / 切完成 / 重开 / 中止不带 reason 400 / 中止带 reason / 非法切换 400)
- [x] 浏览器实测:登录 sysadmin → /map/local 看 3 Pin + 32 Visit 共存,形状区分
- [x] 大盘 Pin click → Drawer 状态切换全流程(完成/中止/重开)
- [x] ➕📌 创建新 Pin → 大盘 + 工作台同步可见
- [x] 工作台 Table sort by priority + 编辑入口
- [x] 回归 β.1 Visit 散点 + Drawer 不退化
- [ ] 用户在 stakeholder demo 中验证视觉(留 PR review 后)

## 不含(留 β.2.5 / β.3 / V0.7+)

- B8 Pin 留言板(Comment 实体 + 手动留言 UI)→ β.2.5
- G16 子蓝点完成自动同步留言 → β.3
- PlanPoint(蓝点)+ 状态流转 → β.3
- Pin → PlanPoint 派生入口(B4)→ β.3
- related_theme_ids → c3
- CASL pmo/lead 真矩阵 → V0.7
- Soft delete + audit log → V0.7
- B14 工作台筛选 → V0.7
- B12 H5 移动端 → V0.7+

🎨 **β.3 视觉约定**(本 PR SPEC §12 已记 / β.3 不再讨论):PlanPoint 用跟 Visit 散点完全一致形状/size/style,仅颜色用 palette.visit.blue。

🤖 Generated with Claude Code
EOF
)"
```

- [ ] **Step 12.12: 验证 PR**

```bash
gh pr view --web   # 浏览器打开 PR
gh pr view --json mergeable,mergeStateStatus,additions,deletions,changedFiles
```

预期:`mergeable=MERGEABLE` / `mergeStateStatus=CLEAN` / changedFiles ~16 / additions ~1500 / deletions ~30。

---

## Self-Review Checklist

完成后照下面 checklist 走一遍(实施 agent 自检):

- [ ] **Spec 全覆盖**:SPEC §1 范围 / §2 字段 / §3 API 端点 / §4 seed / §5 工作台 / §6 大盘 / §7 状态机 / §8 复用 / §9 工程 / §10 验证 — 都对应到 task ✅
- [ ] **0 Placeholder**:每 step 都有完整代码或 exact command,无「TBD」「TODO」「类似 Task X」式偷懒
- [ ] **Type 一致**:`PinStatus` / `PinPriority` / `Pin` / `CreatePinInput` / `UpdatePinInput` 在 Task 1 定义,Task 2-11 引用 — 名字字段拼写完全一致
- [ ] **Path 一致**:所有文件 path 都用绝对位置(`apps/api/src/pins/...` / `apps/web/src/components/PinFormModal.tsx`)
- [ ] **Migration 编号无冲突**:1745500000005 / 1745500000006 跟 β.1 的 003/004 接续,无重叠
- [ ] **e2e 不止 curl**:Task 12 显式说明从浏览器 Network 看响应、看数据(对齐 §7.13 token bug 教训)
- [ ] **idiom 复用 grep 过**:authHeaders / lookupCityCenter / VisitFormModal 模板等已确认存在(本 plan 写之前已 grep verify)

---

## 工作量参考

12 task / 估时 ~1.5d:
- Task 1-3(shared-types + entity + migration):0.2d
- Task 4-6(DTOs + service + 注册 + curl 验证):0.4d
- Task 7(seed):0.1d
- Task 8(PinFormModal):0.3d
- Task 9-10(PinsTab + PinDetailDrawer):0.3d
- Task 11(MapCanvas + MapShell):0.2d
- Task 12(浏览器实测 + squash + PR):0.1d

合计 1.6d,跟 §7.14 估的 ~1.5d 对得上(略保守留状态机校验 buffer)。
