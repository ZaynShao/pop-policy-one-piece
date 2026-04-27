# V0.6 β.2.5 + β.3 蓝点闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 visits 表升级为「计划/拜访点」统一实体,加 comments 留言板自动同步,演示端到端「Pin → 派生蓝点 → 拜访 → 转色 + 自动留言」闭环。

**Architecture:** 单表升级(visits 加 status/parent_pin_id/title/planned_date),visit_color enum 扩 blue。新建 comments 表挂在 Pin 上(parent_pin_id NOT NULL)。状态机 planned ↔ cancelled / planned → completed 不可逆,completed 白名单只允许 visitColor 改。Comment auto INSERT 在 visits.update 事务内,触发条件 planned→completed + parentPinId NOT NULL。前端 1 套表单 + Segmented 切换器,大盘单 series + status 推色。

**Tech Stack:** NestJS + TypeORM + PostgreSQL(后端),Vite + React + antd + react-query(前端),Jest(后端单元测试 — 新引入)。

**Spec 文档**:[docs/SPEC-V0.6-beta25-beta3-bluepoint.md](SPEC-V0.6-beta25-beta3-bluepoint.md)

---

## File Structure(全部改 + 新文件)

**后端(apps/api)**

```
新建:
  jest.config.ts
  src/visits/__tests__/visits.service.spec.ts
  src/visits/__tests__/comment-template.spec.ts
  src/visits/comment-template.ts
  src/comments/comments.module.ts
  src/comments/comments.controller.ts
  src/comments/comments.service.ts
  src/comments/entities/comment.entity.ts
  src/comments/dtos/create-comment.dto.ts
  src/database/migrations/{ts1}-AddVisitStatusAndPin.ts
  src/database/migrations/{ts2}-CreateComments.ts

修改:
  package.json                                     [加 jest 依赖 + scripts]
  src/visits/entities/visit.entity.ts              [加 4 字段 + enum 扩 blue]
  src/visits/dtos/create-visit.dto.ts              [加 status/parentPinId/title/plannedDate]
  src/visits/dtos/update-visit.dto.ts              [加同上]
  src/visits/visits.service.ts                     [状态机 + Comment auto listener + 事务]
  src/visits/visits.controller.ts                  [GET 加 status/parentPinId query param]
  src/visits/visits.module.ts                      [import CommentsModule]
  src/app.module.ts                                [挂 CommentsModule]
```

**前端(apps/web + packages/shared-types)**

```
新建:
  apps/web/src/components/PinCommentBoard.tsx
  apps/web/src/api/comments.ts

修改:
  packages/shared-types/src/index.ts                [export 新 enum + Comment]
  apps/web/src/components/VisitFormModal.tsx        [Segmented + 字段联动]
  apps/web/src/components/VisitDetailDrawer.tsx     [三态渲染]
  apps/web/src/components/PinDetailDrawer.tsx      [加派生按钮 + 留言板 section]
  apps/web/src/components/MapCanvas.tsx            [visits color 函数 status 分支]
  apps/web/src/pages/console/VisitsTab.tsx         [status 筛选 + title/parentPin 列]
  apps/web/src/pages/MapShell.tsx                  [蓝点 click 统一 → VisitDetailDrawer]
```

---

## 既有代码引用(写 task 时常用)

**Pin 状态机模式**(参考样板,在 [pins.service.ts](../apps/api/src/pins/pins.service.ts) 第 17-23 + 67-97 行):

```typescript
const ALLOWED_TRANSITIONS: Record<PinStatus, PinStatus[]> = {
  in_progress: ['completed', 'aborted'],
  completed: ['in_progress'],
  aborted: ['in_progress'],
};

if (newStatus !== prev.status) {
  if (!ALLOWED_TRANSITIONS[prev.status].includes(newStatus)) {
    throw new BadRequestException(`非法状态切换:${prev.status} → ${newStatus}`);
  }
  // ...各转移的副作用
}
```

**已存在的 palette.visit.blue**(在 [tokens.ts](../apps/web/src/tokens.ts) 第 22 行):`'#1677ff'` — 直接启用,不改 tokens。

**现有 VisitFormModal 模式**(在 [VisitFormModal.tsx](../apps/web/src/components/VisitFormModal.tsx)):antd `Form` + `useMutation` + `editing` prop 区分新建/编辑。

**现有 PinDetailDrawer 模式**(在 [PinDetailDrawer.tsx](../apps/web/src/components/PinDetailDrawer.tsx)):antd `Drawer` + `Space` + 状态切换按钮组 + `Descriptions`。

---

# Task 0:apps/api 引入 Jest 测试基础设施

**Files:**
- Create: `apps/api/jest.config.ts`
- Modify: `apps/api/package.json`(加依赖 + scripts)
- Create: `apps/api/src/visits/__tests__/sanity.spec.ts`(冒烟)

- [ ] **Step 0.1: 装依赖**

```bash
cd apps/api && npm install -D jest @types/jest ts-jest @nestjs/testing
```

期望:`package-lock.json` 更新,无 peer 警告。

- [ ] **Step 0.2: 写 `apps/api/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@pop/shared-types$': '<rootDir>/../../../packages/shared-types/src',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!**/migrations/**'],
};

export default config;
```

- [ ] **Step 0.3: package.json scripts 加 test**

`apps/api/package.json` 的 `"scripts"` 段加:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 0.4: 写 sanity 测试 `apps/api/src/visits/__tests__/sanity.spec.ts`**

```typescript
describe('jest infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 0.5: 跑测试验证设施 OK**

```bash
cd apps/api && npm test
```

期望:`Tests: 1 passed`。

- [ ] **Step 0.6: typecheck 验证**

```bash
cd apps/api && npm run typecheck
```

期望:无 error。

---

# Task 1:shared-types 扩展(VisitColor + VisitStatus + Comment)

**Files:**
- Modify: `packages/shared-types/src/enums/visit-color.ts`
- Create: `packages/shared-types/src/enums/visit-status.ts`
- Create: `packages/shared-types/src/enums/comment-source.ts`
- Modify: `packages/shared-types/src/dtos/visit.ts`
- Create: `packages/shared-types/src/dtos/comment.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1.1: 改 `packages/shared-types/src/enums/visit-color.ts`**

把现有

```typescript
export type VisitStatusColor = 'red' | 'yellow' | 'green';
```

改为

```typescript
export type VisitStatusColor = 'red' | 'yellow' | 'green' | 'blue';
// 'blue' 仅 status='planned' 时使用,前端按 status 推导,不依赖 visitColor 字段
```

- [ ] **Step 1.2: 写 `packages/shared-types/src/enums/visit-status.ts`**

```typescript
export type VisitStatus = 'planned' | 'completed' | 'cancelled';
```

- [ ] **Step 1.3: 写 `packages/shared-types/src/enums/comment-source.ts`**

```typescript
export type CommentSource = 'manual' | 'auto_from_visit';
```

- [ ] **Step 1.4: 改 `packages/shared-types/src/dtos/visit.ts`**

在 `Visit` 接口里加(其他字段保留):

```typescript
import type { VisitStatusColor } from '../enums/visit-color';
import type { VisitStatus } from '../enums/visit-status';

export interface Visit {
  id: string;
  status: VisitStatus;             // 新增
  parentPinId: string | null;      // 新增
  title: string | null;            // 新增
  plannedDate: string | null;      // 新增 (YYYY-MM-DD)

  visitDate: string | null;        // 改为 nullable(planned 状态可空)
  department: string | null;       // 改为 nullable
  contactPerson: string | null;    // 改为 nullable
  contactTitle: string | null;
  outcomeSummary: string | null;   // 改为 nullable
  color: VisitStatusColor;         // 类型已扩 blue
  followUp: boolean;
  provinceCode: string;
  cityName: string;
  lng: number;
  lat: number;
  visitorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitInput {
  status?: VisitStatus;            // 默认 'completed'
  parentPinId?: string;
  title?: string;
  plannedDate?: string;
  visitDate?: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp?: boolean;
  provinceCode: string;            // 必填(用于 city center lookup)
  cityName: string;                // 必填
}

export interface UpdateVisitInput {
  status?: VisitStatus;
  parentPinId?: string | null;
  title?: string | null;
  plannedDate?: string | null;
  visitDate?: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string | null;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp?: boolean;
}
```

- [ ] **Step 1.5: 写 `packages/shared-types/src/dtos/comment.ts`**

```typescript
import type { CommentSource } from '../enums/comment-source';

export interface Comment {
  id: string;
  parentPinId: string;
  sourceType: CommentSource;
  body: string;
  linkedVisitId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateCommentInput {
  body: string;
}
```

- [ ] **Step 1.6: 改 `packages/shared-types/src/index.ts` export**

加:

```typescript
export * from './enums/visit-status';
export * from './enums/comment-source';
export * from './dtos/comment';
```

- [ ] **Step 1.7: typecheck 整 monorepo**

```bash
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
npm run typecheck --workspaces --if-present
```

期望:可能报多个 error(下游使用 Visit 的地方还没适配新字段) — 这正常,后续 task 会修。重点确认 `packages/shared-types` 自己 typecheck 通过。

---

# Task 2:DB Migration 1 — visits 升级 + visit_color 扩 'blue'

**Files:**
- Create: `apps/api/src/database/migrations/{timestamp}-AddVisitStatusAndPin.ts`
- Modify: `apps/api/src/visits/entities/visit.entity.ts`

- [ ] **Step 2.1: 改 entity `apps/api/src/visits/entities/visit.entity.ts`**

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
import type { VisitStatusColor, VisitStatus } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';
import { PinEntity } from '../../pins/entities/pin.entity';

/**
 * Visit · 计划/拜访点统一实体(β.2.5 + β.3 升级)
 *
 * 4 种合法身份:
 * - parentPinId NULL  + status completed = 化身拜访(老 β.1 数据)
 * - parentPinId NULL  + status planned   = 化身计划(场景 C)
 * - parentPinId NOT   + status planned   = 项目下计划点(蓝点 = β.3)
 * - parentPinId NOT   + status completed = 项目下拜访点(转色后)
 *
 * 状态机:
 *   planned ↔ cancelled
 *   planned → completed (不可逆)
 *   completed → * (全禁,只允许改 visitColor)
 */
@Entity('visits')
@Index(['visitorId'])
@Index(['provinceCode'])
@Index(['visitDate'])
@Index(['parentPinId'])
@Index(['status'])
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // β.2.5 / β.3 新增 4 字段
  @Column({
    type: 'enum',
    enum: ['planned', 'completed', 'cancelled'],
    enumName: 'visit_status',
    default: 'completed',
  })
  status!: VisitStatus;

  @Column({ type: 'uuid', nullable: true, name: 'parent_pin_id' })
  parentPinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_pin_id' })
  parentPin?: PinEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title!: string | null;

  @Column({ type: 'date', nullable: true, name: 'planned_date' })
  plannedDate!: string | null;

  // 业务字段(planned 时全部可空,completed 时部分必填)
  @Column({ type: 'date', nullable: true, name: 'visit_date' })
  visitDate!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_person' })
  contactPerson!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_title' })
  contactTitle!: string | null;

  @Column({ type: 'text', nullable: true, name: 'outcome_summary' })
  outcomeSummary!: string | null;

  @Column({
    type: 'enum',
    enum: ['red', 'yellow', 'green', 'blue'],
    enumName: 'visit_color',
    nullable: true,
  })
  color!: VisitStatusColor | null;

  @Column({ type: 'boolean', default: false, name: 'follow_up' })
  followUp!: boolean;

  // 地理字段
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

- [ ] **Step 2.2: 生成 migration**

```bash
cd apps/api && npm run migration:generate src/database/migrations/AddVisitStatusAndPin
```

期望:文件 `src/database/migrations/{timestamp}-AddVisitStatusAndPin.ts` 生成,内含 ALTER TYPE / CREATE TYPE / ALTER TABLE 语句。

- [ ] **Step 2.3: 检查生成的 migration 内容**

打开生成的 migration,确认 up() 含:
1. `ALTER TYPE visit_color ADD VALUE 'blue'`(可能在多个地方:DROP+CREATE 或 ADD VALUE — typeorm 通常用 DROP+CREATE)
2. `CREATE TYPE visit_status AS ENUM (...)`
3. `ALTER TABLE visits ADD COLUMN status / parent_pin_id / title / planned_date`
4. `ALTER COLUMN ... DROP NOT NULL`(对 visitDate / department / 等)
5. `ALTER TABLE visits ADD CONSTRAINT FK_... FOREIGN KEY (parent_pin_id) REFERENCES pins(id) ON DELETE SET NULL`

如果 typeorm 生成的 ALTER 顺序有问题(比如 DROP NOT NULL 在 ADD COLUMN 之前),手动调顺序。

⚠️ **特别注意**:typeorm 改 enum 时常用 "DROP TYPE + CREATE TYPE",但 visits 表有 color 列引用旧 enum。生成的 SQL 应该形如:

```sql
ALTER TYPE visit_color RENAME TO visit_color_old;
CREATE TYPE visit_color AS ENUM ('red', 'yellow', 'green', 'blue');
ALTER TABLE visits ALTER COLUMN color TYPE visit_color USING color::text::visit_color;
DROP TYPE visit_color_old;
```

如果生成的不是这样,**手动改成这种 RENAME + 转换的形式**。

- [ ] **Step 2.4: 跑 migration**

```bash
cd apps/api && npm run migration:run
```

期望:`Migration "AddVisitStatusAndPin{timestamp}" has been executed successfully`。

- [ ] **Step 2.5: psql 验证 schema**

```bash
psql -U pop -d pop -c "\d visits"
```

期望看到列:`status`(visit_status NOT NULL DEFAULT 'completed')、`parent_pin_id`(uuid NULL)、`title`(varchar(100) NULL)、`planned_date`(date NULL)。

```bash
psql -U pop -d pop -c "SELECT enum_range(NULL::visit_color);"
```

期望:`{red,yellow,green,blue}`。

```bash
psql -U pop -d pop -c "SELECT COUNT(*), status FROM visits GROUP BY status;"
```

期望:`32 | completed`(32 条 seed 全部 status=completed,parent_pin_id NULL)。

- [ ] **Step 2.6: 启 api dev 验证 entity 加载无问题**

```bash
cd apps/api && npm run dev
```

期望:server start `Listening on port 3000`,无 entity metadata 错误。

按 Ctrl+C 关 dev,继续下一步。

---

# Task 3:DB Migration 2 + comments 实体/模块骨架

**Files:**
- Create: `apps/api/src/comments/entities/comment.entity.ts`
- Create: `apps/api/src/comments/dtos/create-comment.dto.ts`
- Create: `apps/api/src/comments/comments.service.ts`
- Create: `apps/api/src/comments/comments.controller.ts`
- Create: `apps/api/src/comments/comments.module.ts`
- Modify: `apps/api/src/app.module.ts`(挂 CommentsModule)
- Create: `apps/api/src/database/migrations/{timestamp}-CreateComments.ts`

- [ ] **Step 3.1: 写 entity `apps/api/src/comments/entities/comment.entity.ts`**

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
import type { CommentSource } from '@pop/shared-types';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('comments')
@Index(['parentPinId', 'createdAt'])
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'parent_pin_id' })
  parentPinId!: string;

  @ManyToOne(() => PinEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_pin_id' })
  parentPin?: PinEntity;

  @Column({
    type: 'enum',
    enum: ['manual', 'auto_from_visit'],
    enumName: 'comment_source',
    name: 'source_type',
  })
  sourceType!: CommentSource;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'uuid', nullable: true, name: 'linked_visit_id' })
  linkedVisitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_visit_id' })
  linkedVisit?: VisitEntity;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 3.2: 写 DTO `apps/api/src/comments/dtos/create-comment.dto.ts`**

```typescript
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}
```

- [ ] **Step 3.3: 写 service `apps/api/src/comments/comments.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentEntity } from './entities/comment.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CreateCommentDto } from './dtos/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(PinEntity)
    private readonly pinsRepo: Repository<PinEntity>,
  ) {}

  async listByPin(pinId: string): Promise<CommentEntity[]> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);
    return this.commentsRepo.find({
      where: { parentPinId: pinId },
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });
  }

  async createManual(
    pinId: string,
    dto: CreateCommentDto,
    createdBy: string,
  ): Promise<CommentEntity> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);

    const comment = this.commentsRepo.create({
      parentPinId: pinId,
      sourceType: 'manual',
      body: dto.body,
      linkedVisitId: null,
      createdBy,
    });
    return this.commentsRepo.save(comment);
  }
}
```

- [ ] **Step 3.4: 写 controller `apps/api/src/comments/comments.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dtos/create-comment.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@Controller({ path: 'pins/:pinId/comments', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  @Roles('sys_admin', 'lead', 'pmo', 'local_ga', 'central_ga')
  list(@Param('pinId', ParseUUIDPipe) pinId: string) {
    return this.service.listByPin(pinId).then((data) => ({ data }));
  }

  @Post()
  @Roles('sys_admin')
  create(
    @Param('pinId', ParseUUIDPipe) pinId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.createManual(pinId, dto, req.user.sub);
  }
}
```

⚠️ 路径里 `auth/jwt-auth.guard` 和 `auth/roles.guard` 是假设 — 实施时按现有 [pins.controller.ts](../apps/api/src/pins/pins.controller.ts) 的 import 路径对齐。

- [ ] **Step 3.5: 写 module `apps/api/src/comments/comments.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentEntity } from './entities/comment.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommentEntity, PinEntity])],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],  // visits.service 要注入
})
export class CommentsModule {}
```

- [ ] **Step 3.6: 改 `apps/api/src/app.module.ts` 挂上**

在现有 `imports` 数组里加 `CommentsModule`(import 顶上加一行)。

- [ ] **Step 3.7: 生成 migration**

```bash
cd apps/api && npm run migration:generate src/database/migrations/CreateComments
```

期望文件 `{timestamp}-CreateComments.ts` 生成,含 `CREATE TYPE comment_source` + `CREATE TABLE comments` + index。

- [ ] **Step 3.8: 跑 migration + 验证**

```bash
cd apps/api && npm run migration:run
psql -U pop -d pop -c "\d comments"
```

期望看到 comments 表存在,parent_pin_id NOT NULL,source_type comment_source NOT NULL。

- [ ] **Step 3.9: 启 api dev,curl 测试 CRUD**

```bash
cd apps/api && npm run dev   # 后台启动
# 拿一个 Pin id
PIN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM pins LIMIT 1")
# 拿 token(sysadmin 登录)
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)
# GET 空列表
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/pins/$PIN_ID/comments
# 期望:{"data":[]}
# POST manual
curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"测试手动留言"}' \
  http://localhost:3000/api/v1/pins/$PIN_ID/comments
# 期望:返回新 comment 对象,sourceType='manual'
# GET 看到 1 条
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/pins/$PIN_ID/comments
```

期望第 3 个 GET 返回 `data: [{sourceType:'manual', body:'测试手动留言', ...}]`。

---

# Task 4:visits.service.create 校验 + DTO 扩展(jest TDD)

**Files:**
- Modify: `apps/api/src/visits/dtos/create-visit.dto.ts`
- Modify: `apps/api/src/visits/dtos/update-visit.dto.ts`
- Modify: `apps/api/src/visits/visits.service.ts`(create 函数)
- Create: `apps/api/src/visits/__tests__/visits.service.spec.ts`

- [ ] **Step 4.1: 改 `apps/api/src/visits/dtos/create-visit.dto.ts`**

```typescript
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVisitDto {
  // β.2.5/β.3 新增
  @IsOptional()
  @IsEnum(['planned', 'completed', 'cancelled'])
  status?: 'planned' | 'completed' | 'cancelled';

  @IsOptional()
  @IsUUID()
  parentPinId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  // 业务字段(均改 optional,service 层按 status 校验必填)
  @IsOptional() @IsDateString() visitDate?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional() @IsString() @MaxLength(64) contactPerson?: string;
  @IsOptional() @IsString() @MaxLength(64) contactTitle?: string;
  @IsOptional() @IsString() outcomeSummary?: string;

  @IsOptional()
  @IsEnum(['red', 'yellow', 'green', 'blue'])
  color?: 'red' | 'yellow' | 'green' | 'blue';

  @IsOptional() @IsBoolean() followUp?: boolean;

  // 地理(必填,用于 city center lookup)
  @IsString() @IsNotEmpty() @MaxLength(6) provinceCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) cityName!: string;
}
```

- [ ] **Step 4.2: 改 `apps/api/src/visits/dtos/update-visit.dto.ts`**

```typescript
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateVisitDto {
  @IsOptional()
  @IsEnum(['planned', 'completed', 'cancelled'])
  status?: 'planned' | 'completed' | 'cancelled';

  @IsOptional()
  @IsUUID()
  parentPinId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IsOptional()
  @IsDateString()
  plannedDate?: string | null;

  @IsOptional() @IsDateString() visitDate?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional() @IsString() @MaxLength(64) contactPerson?: string;
  @IsOptional() @IsString() @MaxLength(64) contactTitle?: string | null;
  @IsOptional() @IsString() outcomeSummary?: string;

  @IsOptional()
  @IsEnum(['red', 'yellow', 'green', 'blue'])
  color?: 'red' | 'yellow' | 'green' | 'blue';

  @IsOptional() @IsBoolean() followUp?: boolean;
}
```

- [ ] **Step 4.3: 写失败测试 `apps/api/src/visits/__tests__/visits.service.spec.ts`**(create 部分)

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitsService } from '../visits.service';
import { VisitEntity } from '../entities/visit.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { CommentEntity } from '../../comments/entities/comment.entity';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ ...x, id: 'mock-uuid' })),
  findOne: jest.fn(),
  find: jest.fn(),
});

describe('VisitsService.create', () => {
  let svc: VisitsService;
  let pinsRepo: any;

  beforeEach(async () => {
    const visitsRepo = mockRepo();
    pinsRepo = mockRepo();
    const commentsRepo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
        { provide: getRepositoryToken(CommentEntity), useValue: commentsRepo },
      ],
    }).compile();

    svc = module.get(VisitsService);
  });

  const baseGeo = { provinceCode: '510000', cityName: '成都市' };
  const visitorId = 'visitor-uuid';

  it('rejects status=cancelled on create', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'cancelled' }, visitorId),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires title when status=planned', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'planned' }, visitorId),
    ).rejects.toThrow(/title/);
  });

  it('requires visitDate/contactPerson/color when status=completed', async () => {
    await expect(
      svc.create({ ...baseGeo, status: 'completed' }, visitorId),
    ).rejects.toThrow(/visitDate|contactPerson|color/);
  });

  it('validates parentPinId exists', async () => {
    pinsRepo.findOne.mockResolvedValue(null);
    await expect(
      svc.create(
        { ...baseGeo, status: 'planned', title: 'x', parentPinId: 'non-exist' },
        visitorId,
      ),
    ).rejects.toThrow(/parentPin/i);
  });

  it('creates planned visit with parentPin successfully', async () => {
    pinsRepo.findOne.mockResolvedValue({ id: 'pin-1', title: 'Pin' });
    const result = await svc.create(
      { ...baseGeo, status: 'planned', title: '拜访某厂', parentPinId: 'pin-1', plannedDate: '2026-05-15' },
      visitorId,
    );
    expect(result.status).toBe('planned');
    expect(result.parentPinId).toBe('pin-1');
    expect(result.title).toBe('拜访某厂');
  });

  it('creates completed visit (default status) with backward compat', async () => {
    const result = await svc.create(
      {
        ...baseGeo,
        visitDate: '2026-04-27',
        department: '某局',
        contactPerson: '张工',
        color: 'green',
        followUp: false,
      },
      visitorId,
    );
    expect(result.status).toBe('completed');  // 默认
  });
});
```

- [ ] **Step 4.4: 跑测试,确认全失败**

```bash
cd apps/api && npm test -- visits.service
```

期望:6 个 test FAIL(因为 service.create 还没改造)。

- [ ] **Step 4.5: 改 `apps/api/src/visits/visits.service.ts`(create 部分)**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { lookupCityCenter } from '../lib/geojson-cities';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { CreateVisitDto } from './dtos/create-visit.dto';
import { UpdateVisitDto } from './dtos/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
    @InjectRepository(CommentEntity) private readonly commentsRepo: Repository<CommentEntity>,
  ) {}

  // (list / findOne 不变,沿用现状)

  async create(dto: CreateVisitDto, visitorId: string): Promise<VisitEntity> {
    const status = dto.status ?? 'completed';

    if (status === 'cancelled') {
      throw new BadRequestException('不允许直接创建 cancelled 状态');
    }

    if (status === 'planned' && !dto.title) {
      throw new BadRequestException('计划点 title 必填');
    }

    if (status === 'completed') {
      if (!dto.visitDate) throw new BadRequestException('visitDate 必填');
      if (!dto.contactPerson) throw new BadRequestException('contactPerson 必填');
      if (!dto.color) throw new BadRequestException('color 必填');
    }

    if (dto.parentPinId) {
      const pin = await this.pinsRepo.findOne({ where: { id: dto.parentPinId } });
      if (!pin) throw new BadRequestException(`parentPin ${dto.parentPinId} not found`);
    }

    const center = lookupCityCenter(dto.provinceCode, dto.cityName);
    if (!center) {
      throw new BadRequestException(
        `未知的 provinceCode/cityName: ${dto.provinceCode}/${dto.cityName}`,
      );
    }

    const visit = this.repo.create({
      status,
      parentPinId: dto.parentPinId ?? null,
      title: dto.title ?? null,
      plannedDate: dto.plannedDate ?? null,
      visitDate: dto.visitDate ?? null,
      department: dto.department ?? null,
      contactPerson: dto.contactPerson ?? null,
      contactTitle: dto.contactTitle ?? null,
      outcomeSummary: dto.outcomeSummary ?? null,
      color: dto.color ?? null,
      followUp: dto.followUp ?? false,
      provinceCode: dto.provinceCode,
      cityName: dto.cityName,
      lng: center.lng,
      lat: center.lat,
      visitorId,
    });
    return this.repo.save(visit);
  }
}
```

⚠️ 注意:这里我们注入了 `pinsRepo` 和 `commentsRepo`,但 visits.module.ts 也要更新 — 在 Step 4.7 处理。`update` 函数下个 task 改。

- [ ] **Step 4.6: 改 `apps/api/src/visits/visits.module.ts` 加 PinEntity / CommentEntity 注册**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitEntity } from './entities/visit.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentEntity } from '../comments/entities/comment.entity';
import { VisitsController, CitiesController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitEntity, PinEntity, CommentEntity])],
  controllers: [VisitsController, CitiesController],
  providers: [VisitsService],
})
export class VisitsModule {}
```

- [ ] **Step 4.7: 跑测试,确认全过**

```bash
cd apps/api && npm test -- visits.service
```

期望:6 个 PASS。

- [ ] **Step 4.8: 启 api dev curl 验证**

```bash
cd apps/api && npm run dev    # 后台
# 创建 1 条 planned 计划点(关联现有 Pin)
PIN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM pins LIMIT 1")
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)
curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"status\":\"planned\",\"title\":\"测试计划点\",\"parentPinId\":\"$PIN_ID\",\"provinceCode\":\"510000\",\"cityName\":\"成都市\"}" \
  http://localhost:3000/api/v1/visits | jq
```

期望:返回 visits 行,`status:'planned', parentPinId, title`,createdAt 当前时间。

```bash
psql -U pop -d pop -c "SELECT status, parent_pin_id, title FROM visits WHERE status='planned';"
```

期望:1 行 planned。

---

# Task 5:visits.service.update 状态机 + completed 白名单(jest TDD)

**Files:**
- Modify: `apps/api/src/visits/visits.service.ts`(update 函数)
- Modify: `apps/api/src/visits/__tests__/visits.service.spec.ts`(加 update 测试)

- [ ] **Step 5.1: 测试加 update 状态机 cases**

把这个 describe 块追加到 `visits.service.spec.ts`:

```typescript
describe('VisitsService.update state machine', () => {
  let svc: VisitsService;
  let visitsRepo: any;

  beforeEach(async () => {
    visitsRepo = mockRepo();
    const pinsRepo = mockRepo();
    const commentsRepo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: getRepositoryToken(VisitEntity), useValue: visitsRepo },
        { provide: getRepositoryToken(PinEntity), useValue: pinsRepo },
        { provide: getRepositoryToken(CommentEntity), useValue: commentsRepo },
      ],
    }).compile();

    svc = module.get(VisitsService);
  });

  const plannedVisit = (overrides = {}) => ({
    id: 'v1',
    status: 'planned',
    parentPinId: null,
    title: 'plan',
    plannedDate: null,
    visitDate: null,
    department: null,
    contactPerson: null,
    contactTitle: null,
    outcomeSummary: null,
    color: null,
    followUp: false,
    provinceCode: '510000',
    cityName: '成都市',
    lng: 0, lat: 0, visitorId: 'u1',
    ...overrides,
  });

  it('rejects completed → planned', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(svc.update('v1', { status: 'planned' }, 'u1')).rejects.toThrow(/不允许.*completed.*planned/);
  });

  it('rejects completed → cancelled', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(svc.update('v1', { status: 'cancelled' }, 'u1')).rejects.toThrow(/不允许.*completed.*cancelled/);
  });

  it('allows planned → completed with required fields', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    const result = await svc.update('v1', {
      status: 'completed',
      visitDate: '2026-04-27',
      contactPerson: '张工',
      department: '某局',
      color: 'green',
    }, 'u1');
    expect(result.status).toBe('completed');
  });

  it('rejects planned → completed without visitDate', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    await expect(
      svc.update('v1', { status: 'completed' }, 'u1'),
    ).rejects.toThrow(/visitDate/);
  });

  it('allows planned → cancelled', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit());
    const result = await svc.update('v1', { status: 'cancelled' }, 'u1');
    expect(result.status).toBe('cancelled');
  });

  it('allows cancelled → planned (restart)', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'cancelled' }));
    const result = await svc.update('v1', { status: 'planned' }, 'u1');
    expect(result.status).toBe('planned');
  });

  it('completed: only allows changing color', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    const result = await svc.update('v1', { color: 'yellow' }, 'u1');
    expect(result.color).toBe('yellow');
  });

  it('completed: rejects changing other fields', async () => {
    visitsRepo.findOne.mockResolvedValue(plannedVisit({ status: 'completed' }));
    await expect(
      svc.update('v1', { outcomeSummary: 'changed' }, 'u1'),
    ).rejects.toThrow(/已完成拜访只允许改 visitColor/);
  });
});
```

- [ ] **Step 5.2: 跑测试,8 个 FAIL**

```bash
cd apps/api && npm test -- visits.service
```

期望:8 个新 test FAIL(create 6 个仍 PASS)。

- [ ] **Step 5.3: 改 `apps/api/src/visits/visits.service.ts` 加 update 状态机**

在文件顶部加(import 后):

```typescript
import type { VisitStatus } from '@pop/shared-types';

const ALLOWED_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  planned: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['planned'],
};
```

替换 update 函数:

```typescript
async update(id: string, dto: UpdateVisitDto, currentUserId: string): Promise<VisitEntity> {
  const prev = await this.findOne(id);
  const newStatus = (dto.status ?? prev.status) as VisitStatus;

  // 状态切换校验
  if (newStatus !== prev.status) {
    if (!ALLOWED_TRANSITIONS[prev.status].includes(newStatus)) {
      throw new BadRequestException(`不允许 ${prev.status} → ${newStatus}`);
    }
    if (newStatus === 'completed') {
      const visitDate = dto.visitDate ?? prev.visitDate;
      const contactPerson = dto.contactPerson ?? prev.contactPerson;
      const color = dto.color ?? prev.color;
      if (!visitDate) throw new BadRequestException('转 completed 必须填 visitDate');
      if (!contactPerson) throw new BadRequestException('转 completed 必须填 contactPerson');
      if (!color) throw new BadRequestException('转 completed 必须填 color');
    }
    prev.status = newStatus;
  }

  // completed 状态白名单:不切 status 时只允许 color
  if (prev.status === 'completed' && !dto.status) {
    const allowedKeys = new Set(['color']);
    const dtoKeys = Object.keys(dto).filter((k) => dto[k as keyof UpdateVisitDto] !== undefined);
    const violation = dtoKeys.find((k) => !allowedKeys.has(k));
    if (violation) {
      throw new BadRequestException('已完成拜访只允许改 visitColor');
    }
  }

  // 应用 dto 字段
  if (dto.title !== undefined) prev.title = dto.title;
  if (dto.plannedDate !== undefined) prev.plannedDate = dto.plannedDate;
  if (dto.parentPinId !== undefined) {
    if (dto.parentPinId !== null) {
      const pin = await this.pinsRepo.findOne({ where: { id: dto.parentPinId } });
      if (!pin) throw new BadRequestException(`parentPin ${dto.parentPinId} not found`);
    }
    prev.parentPinId = dto.parentPinId;
  }
  if (dto.visitDate !== undefined) prev.visitDate = dto.visitDate;
  if (dto.department !== undefined) prev.department = dto.department;
  if (dto.contactPerson !== undefined) prev.contactPerson = dto.contactPerson;
  if (dto.contactTitle !== undefined) prev.contactTitle = dto.contactTitle;
  if (dto.outcomeSummary !== undefined) prev.outcomeSummary = dto.outcomeSummary;
  if (dto.color !== undefined) prev.color = dto.color;
  if (dto.followUp !== undefined) prev.followUp = dto.followUp;

  return this.repo.save(prev);
}
```

- [ ] **Step 5.4: 跑测试,全过**

```bash
cd apps/api && npm test -- visits.service
```

期望:14 个 PASS(6 + 8)。

- [ ] **Step 5.5: 启 api dev curl 验证**

```bash
# 拿 id 是 planned 的那条 visit
PLAN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM visits WHERE status='planned' LIMIT 1")
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)

# 错误路径 1:转 completed 缺 visitDate
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}' http://localhost:3000/api/v1/visits/$PLAN_ID
# 期望 400 + "转 completed 必须填 visitDate"

# 正确转 completed
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed","visitDate":"2026-04-27","department":"局","contactPerson":"张","color":"yellow","outcomeSummary":"OK"}' \
  http://localhost:3000/api/v1/visits/$PLAN_ID
# 期望 200,返回 status='completed'

# 错误路径 3:已 completed 改 outcome
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"outcomeSummary":"changed"}' http://localhost:3000/api/v1/visits/$PLAN_ID
# 期望 400 + "已完成拜访只允许改 visitColor"

# 正确改色
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"color":"red"}' http://localhost:3000/api/v1/visits/$PLAN_ID
# 期望 200,color 改成 red
```

---

# Task 6:visits.service Comment auto listener + 事务(jest TDD)

**Files:**
- Modify: `apps/api/src/visits/visits.service.ts`(update 加 listener + 事务)
- Create: `apps/api/src/visits/comment-template.ts`
- Create: `apps/api/src/visits/__tests__/comment-template.spec.ts`
- Modify: `apps/api/src/visits/__tests__/visits.service.spec.ts`(加 listener 测试)

- [ ] **Step 6.1: 写 `apps/api/src/visits/comment-template.ts`**

```typescript
import type { VisitStatusColor } from '@pop/shared-types';

const COLOR_ZH: Record<Exclude<VisitStatusColor, 'blue'>, string> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
};

interface RenderInput {
  title: string | null;
  visitDate: string | null;
  visitorName: string;
  department: string | null;
  contactPerson: string | null;
  contactTitle: string | null;
  color: VisitStatusColor | null;
  outcomeSummary: string | null;
}

export function renderAutoComment(input: RenderInput): string {
  const colorZh = input.color && input.color !== 'blue'
    ? COLOR_ZH[input.color]
    : '未知';
  return [
    `✅ 计划点「${input.title ?? '(无标题)'}」已完成。`,
    `${input.visitDate ?? '(无日期)'} ${input.visitorName} 拜访 ${input.department ?? '(无部门)'}`,
    `(${input.contactPerson ?? '(无对接人)'} ${input.contactTitle ?? ''})`,
    `,色 ${colorZh},摘要:${input.outcomeSummary ?? '(无)'}`,
  ].join('');
}
```

- [ ] **Step 6.2: 写测试 `apps/api/src/visits/__tests__/comment-template.spec.ts`**

```typescript
import { renderAutoComment } from '../comment-template';

describe('renderAutoComment', () => {
  it('renders full template', () => {
    const out = renderAutoComment({
      title: '拜访中芯成都',
      visitDate: '2026-04-27',
      visitorName: '系统管理员',
      department: '中芯成都',
      contactPerson: '张工',
      contactTitle: '副总',
      color: 'yellow',
      outcomeSummary: '希望补贴翻倍',
    });
    expect(out).toContain('计划点「拜访中芯成都」已完成');
    expect(out).toContain('系统管理员 拜访 中芯成都');
    expect(out).toContain('张工');
    expect(out).toContain('副总');
    expect(out).toContain('色 层级提升');
    expect(out).toContain('希望补贴翻倍');
  });

  it('handles null fields gracefully', () => {
    const out = renderAutoComment({
      title: null,
      visitDate: null,
      visitorName: '某用户',
      department: null,
      contactPerson: null,
      contactTitle: null,
      color: null,
      outcomeSummary: null,
    });
    expect(out).toContain('(无标题)');
    expect(out).toContain('(无日期)');
    expect(out).toContain('色 未知');
    expect(out).toContain('(无)');
  });
});
```

- [ ] **Step 6.3: 跑模板测试,FAIL**

```bash
cd apps/api && npm test -- comment-template
```

应该是直接 PASS — 因为 `renderAutoComment` 已经实现。改成「写完 template + 测试同时写」+ Step 6.3 改成「跑确认 PASS」。

- [ ] **Step 6.4: 加 listener 测试**

把这个块追加到 `visits.service.spec.ts`(在 `describe('VisitsService.update state machine')` 块内):

```typescript
it('auto-creates comment when planned → completed with parentPinId', async () => {
  const visit = plannedVisit({ parentPinId: 'pin-1', title: 'plan' });
  visitsRepo.findOne.mockResolvedValue(visit);
  // 模拟事务:让 dataSource.transaction 直接执行 callback,传入 manager
  // 但简化做法:在 svc 里若用注入 commentsRepo 直接 save,我们直接 mock commentsRepo.save
  const visitor = { id: 'u1', name: '系统管理员' };
  const usersRepoFind = jest.fn().mockResolvedValue(visitor);
  // 注入 usersRepo(下面实施时一并加 — 拜访者 name 要查)

  await svc.update('v1', {
    status: 'completed',
    visitDate: '2026-04-27',
    department: '局',
    contactPerson: '张工',
    contactTitle: '副总',
    color: 'yellow',
    outcomeSummary: 'OK',
  }, 'u1');

  // commentsRepo.save 被调用 1 次,sourceType=auto_from_visit
  // (具体断言在实施 step 完成后,根据真实代码补)
});
```

⚠️ 这个测试需要 visitor 名字 — service 实施时要注入 `UserEntity` repo 来查 visitor.name。下个 step 处理。

- [ ] **Step 6.5: 改 visits.service.ts 加 listener + 事务 + UserEntity 注入**

修改 imports 和 constructor:

```typescript
import { UserEntity } from '../users/entities/user.entity';
import { renderAutoComment } from './comment-template';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity) private readonly repo: Repository<VisitEntity>,
    @InjectRepository(PinEntity) private readonly pinsRepo: Repository<PinEntity>,
    @InjectRepository(CommentEntity) private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}
```

在 `visits.module.ts` 加 `UserEntity`:

```typescript
imports: [TypeOrmModule.forFeature([VisitEntity, PinEntity, CommentEntity, UserEntity])],
```

替换 update 函数最后部分(从 `// 应用 dto 字段` 之后):

```typescript
// 应用 dto 字段(同 Step 5.3 保留,只是换成事务包裹)
const triggerAutoComment = (
  prevStatus === 'planned' &&
  newStatus === 'completed' &&
  prev.parentPinId !== null
);

const visitor = await this.usersRepo.findOne({ where: { id: prev.visitorId } });
const visitorName = visitor?.fullName ?? visitor?.username ?? '(未知拜访者)';
// ⚠️ 实施时按 UserEntity 实际字段调整 — 现有 user.entity.ts 看一下用 `username` / `displayName` 还是别的

return this.dataSource.transaction(async (manager) => {
  const saved = await manager.save(VisitEntity, prev);

  if (triggerAutoComment) {
    const commentBody = renderAutoComment({
      title: saved.title,
      visitDate: saved.visitDate,
      visitorName,
      department: saved.department,
      contactPerson: saved.contactPerson,
      contactTitle: saved.contactTitle,
      color: saved.color,
      outcomeSummary: saved.outcomeSummary,
    });
    await manager.save(CommentEntity, {
      parentPinId: saved.parentPinId!,
      sourceType: 'auto_from_visit',
      body: commentBody,
      linkedVisitId: saved.id,
      createdBy: prev.visitorId,
    });
  }

  return saved;
});
```

⚠️ 把 `prevStatus` 缓存在状态切换前(因为后面 prev 已被 mutate):

```typescript
const prevStatus = prev.status;  // 缓存
// 状态切换校验... 后面用 prevStatus 判断 triggerAutoComment
```

整段重写后的 update 函数完整版:

```typescript
async update(id: string, dto: UpdateVisitDto, currentUserId: string): Promise<VisitEntity> {
  const prev = await this.findOne(id);
  const prevStatus = prev.status;
  const newStatus = (dto.status ?? prev.status) as VisitStatus;

  if (newStatus !== prev.status) {
    if (!ALLOWED_TRANSITIONS[prev.status].includes(newStatus)) {
      throw new BadRequestException(`不允许 ${prev.status} → ${newStatus}`);
    }
    if (newStatus === 'completed') {
      const visitDate = dto.visitDate ?? prev.visitDate;
      const contactPerson = dto.contactPerson ?? prev.contactPerson;
      const color = dto.color ?? prev.color;
      if (!visitDate) throw new BadRequestException('转 completed 必须填 visitDate');
      if (!contactPerson) throw new BadRequestException('转 completed 必须填 contactPerson');
      if (!color) throw new BadRequestException('转 completed 必须填 color');
    }
    prev.status = newStatus;
  }

  if (prev.status === 'completed' && !dto.status) {
    const allowedKeys = new Set(['color']);
    const dtoKeys = Object.keys(dto).filter((k) => dto[k as keyof UpdateVisitDto] !== undefined);
    const violation = dtoKeys.find((k) => !allowedKeys.has(k));
    if (violation) throw new BadRequestException('已完成拜访只允许改 visitColor');
  }

  if (dto.title !== undefined) prev.title = dto.title;
  if (dto.plannedDate !== undefined) prev.plannedDate = dto.plannedDate;
  if (dto.parentPinId !== undefined) {
    if (dto.parentPinId !== null) {
      const pin = await this.pinsRepo.findOne({ where: { id: dto.parentPinId } });
      if (!pin) throw new BadRequestException(`parentPin ${dto.parentPinId} not found`);
    }
    prev.parentPinId = dto.parentPinId;
  }
  if (dto.visitDate !== undefined) prev.visitDate = dto.visitDate;
  if (dto.department !== undefined) prev.department = dto.department;
  if (dto.contactPerson !== undefined) prev.contactPerson = dto.contactPerson;
  if (dto.contactTitle !== undefined) prev.contactTitle = dto.contactTitle;
  if (dto.outcomeSummary !== undefined) prev.outcomeSummary = dto.outcomeSummary;
  if (dto.color !== undefined) prev.color = dto.color;
  if (dto.followUp !== undefined) prev.followUp = dto.followUp;

  const triggerAutoComment = (
    prevStatus === 'planned' &&
    newStatus === 'completed' &&
    prev.parentPinId !== null
  );

  if (!triggerAutoComment) {
    return this.repo.save(prev);
  }

  const visitor = await this.usersRepo.findOne({ where: { id: prev.visitorId } });
  const visitorName = (visitor as any)?.fullName ?? (visitor as any)?.username ?? '(未知拜访者)';

  return this.dataSource.transaction(async (manager) => {
    const saved = await manager.save(VisitEntity, prev);
    const commentBody = renderAutoComment({
      title: saved.title,
      visitDate: saved.visitDate,
      visitorName,
      department: saved.department,
      contactPerson: saved.contactPerson,
      contactTitle: saved.contactTitle,
      color: saved.color,
      outcomeSummary: saved.outcomeSummary,
    });
    await manager.save(CommentEntity, {
      parentPinId: saved.parentPinId!,
      sourceType: 'auto_from_visit',
      body: commentBody,
      linkedVisitId: saved.id,
      createdBy: prev.visitorId,
    });
    return saved;
  });
}
```

- [ ] **Step 6.6: 跑测试**

```bash
cd apps/api && npm test
```

期望:14 个 PASS(state machine + create) + comment-template 2 个 PASS。listener 测试可能不完整,跳过(由 Step 6.7 e2e 验证)。

- [ ] **Step 6.7: e2e curl 验证 listener**

```bash
cd apps/api && npm run dev   # 后台
# 创建 1 条新的 planned 计划点(关联现有 Pin)
PIN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM pins WHERE status='in_progress' LIMIT 1")
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)
PLAN_ID=$(curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"status\":\"planned\",\"title\":\"e2e 测试计划\",\"parentPinId\":\"$PIN_ID\",\"provinceCode\":\"510000\",\"cityName\":\"成都市\"}" \
  http://localhost:3000/api/v1/visits | jq -r .id)
# 转 completed → 触发 auto comment
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed","visitDate":"2026-04-27","department":"中芯","contactPerson":"张工","contactTitle":"副总","color":"yellow","outcomeSummary":"OK"}' \
  http://localhost:3000/api/v1/visits/$PLAN_ID
# 拉 Pin 留言板
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/pins/$PIN_ID/comments | jq
```

期望最后一个 GET 返回 1 条 `sourceType: 'auto_from_visit'` 的留言,body 含「计划点「e2e 测试计划」已完成」。

```bash
psql -U pop -d pop -c "SELECT source_type, body FROM comments ORDER BY created_at DESC LIMIT 1;"
```

期望:`auto_from_visit | ✅ 计划点「e2e 测试计划」已完成。...`。

---

# Task 7:visits.controller GET 加 status / parentPinId query param

**Files:**
- Modify: `apps/api/src/visits/visits.controller.ts`
- Modify: `apps/api/src/visits/visits.service.ts`(list 函数)

- [ ] **Step 7.1: 改 service.list 接受 filter**

```typescript
list(filter?: { status?: VisitStatus; parentPinId?: string }): Promise<VisitEntity[]> {
  const where: any = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.parentPinId) where.parentPinId = filter.parentPinId;
  return this.repo.find({
    where,
    order: { visitDate: 'DESC', createdAt: 'DESC' },
  });
}
```

- [ ] **Step 7.2: 改 controller 加 query param**

`apps/api/src/visits/visits.controller.ts` GET 段:

```typescript
@Get()
@Roles('sys_admin', 'lead', 'pmo', 'local_ga', 'central_ga')
list(
  @Query('status') status?: 'planned' | 'completed' | 'cancelled',
  @Query('parentPinId') parentPinId?: string,
) {
  return this.service.list({ status, parentPinId }).then((data) => ({ data }));
}
```

⚠️ import `Query` from '@nestjs/common'。

- [ ] **Step 7.3: e2e curl 验证**

```bash
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)

# 全部
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/visits | jq '.data | length'
# 期望:33(32 + 1 e2e 那条)

# 只 completed
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/visits?status=completed" | jq '.data | length'
# 期望:33

# 只 planned
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/visits?status=planned" | jq '.data | length'
# 期望:0(任务进行到此处时,e2e 那条已转 completed)
```

---

# Task 8:前端 MapCanvas + tokens 启用蓝点视觉

**Files:**
- Modify: `apps/web/src/components/MapCanvas.tsx`

- [ ] **Step 8.1: 改 visits color 函数**

在 [MapCanvas.tsx](../apps/web/src/components/MapCanvas.tsx) 找到 `COLOR_HEX` 处(第 41-46 行),保留并加一个新的 helper:

```typescript
import type { VisitStatus } from '@pop/shared-types';

const COLOR_HEX: Record<'red' | 'yellow' | 'green', string> = {
  red: palette.visit.red,
  yellow: palette.visit.yellow,
  green: palette.visit.green,
};

const visitColorByRow = (v: Visit): string => {
  if (v.status === 'planned') return palette.visit.blue;
  // cancelled 状态用半透明灰
  if (v.status === 'cancelled') return 'rgba(180, 180, 180, 0.4)';
  // completed:按 visitColor
  return v.color ? COLOR_HEX[v.color as 'red' | 'yellow' | 'green'] : palette.visit.green;
};
```

找到 visits scatter series 的 itemStyle.color 处(原来用 `COLOR_HEX[v.color]`),改成调用 `visitColorByRow(v)`。

具体定位:`MapCanvas.tsx` 里 useMemo 计算 visits scatter data 的段落,把 `color: COLOR_HEX[v.color]` 改为 `color: visitColorByRow(v)`。

- [ ] **Step 8.2: 启 web dev,浏览器看大盘**

```bash
# preview_start({ name: 'vite-dev' })
# 同时确保 api-dev 在跑(Step 6 起的可能还在)
```

打开 http://localhost:5173/login → sysadmin → /map/local。

- [ ] **Step 8.3: preview_screenshot 验证大盘有蓝点**

```javascript
// preview_eval: window.location.pathname
// preview_screenshot
```

期望:大盘上能看到 1 个蓝色散点(就是 Task 6 e2e 创的、又转 completed 的那条 — 现在它已经是 yellow 了 ⚠️)。

⚠️ 实际 Task 6 后那条 visit 已经是 completed,所以这一步看不到蓝点。要先在浏览器里通过 API 创建 1 条新 planned 计划点验证(curl 或者直接用 prev steps 的 e2e curl 命令再创一条不转色的)。

```bash
PIN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM pins WHERE status='in_progress' LIMIT 1")
TOKEN=...
curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"status\":\"planned\",\"title\":\"蓝点视觉测试\",\"parentPinId\":\"$PIN_ID\",\"provinceCode\":\"510000\",\"cityName\":\"成都市\"}" \
  http://localhost:3000/api/v1/visits
```

刷新 /map/local → preview_screenshot 应看到成都坐标多个蓝点。

- [ ] **Step 8.4: preview_console_logs 检查无 error**

期望:无 React render error / TypeError。

---

# Task 9:前端 VisitFormModal — Segmented 切换器 + 字段联动

**Files:**
- Modify: `apps/web/src/components/VisitFormModal.tsx`

- [ ] **Step 9.1: 重写 VisitFormModal 加 Segmented + props**

完整新版本(替换整个文件):

```typescript
import { useEffect, useMemo } from 'react';
import { Form, Input, Modal, Select, DatePicker, Radio, Switch, Segmented, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type {
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  CityListResponse,
  VisitStatusColor,
  VisitStatus,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Visit;
  defaultStatus?: 'planned' | 'completed';
  presetParentPinId?: string;
  presetLng?: number;
  presetLat?: number;
  presetProvinceCode?: string;
  presetCityName?: string;
}

interface FormValues {
  status: 'planned' | 'completed';
  title?: string;
  plannedDate?: dayjs.Dayjs;
  visitDate?: dayjs.Dayjs;
  provinceCode: string;
  cityName: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp: boolean;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function VisitFormModal({
  open,
  onClose,
  editing,
  defaultStatus,
  presetParentPinId,
  presetProvinceCode,
  presetCityName,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({ label: p.provinceName, value: p.provinceCode })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('provinceCode', form);
  const watchedStatus = Form.useWatch('status', form) ?? 'completed';

  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        status: editing.status === 'cancelled' ? 'planned' : editing.status,
        title: editing.title ?? undefined,
        plannedDate: editing.plannedDate ? dayjs(editing.plannedDate) : undefined,
        visitDate: editing.visitDate ? dayjs(editing.visitDate) : undefined,
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        department: editing.department ?? undefined,
        contactPerson: editing.contactPerson ?? undefined,
        contactTitle: editing.contactTitle ?? '',
        outcomeSummary: editing.outcomeSummary ?? undefined,
        color: editing.color === 'blue' ? undefined : editing.color ?? undefined,
        followUp: editing.followUp,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: defaultStatus ?? 'completed',
        provinceCode: presetProvinceCode,
        cityName: presetCityName,
        visitDate: dayjs(),
        color: 'green',
        followUp: false,
      });
    }
  }, [open, editing, defaultStatus, presetProvinceCode, presetCityName, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      const isPlanned = values.status === 'planned';

      const payload: CreateVisitInput | UpdateVisitInput = {
        status: values.status,
        title: isPlanned ? values.title : undefined,
        plannedDate: isPlanned ? values.plannedDate?.format('YYYY-MM-DD') : undefined,
        visitDate: !isPlanned ? values.visitDate?.format('YYYY-MM-DD') : undefined,
        department: !isPlanned ? values.department : undefined,
        contactPerson: !isPlanned ? values.contactPerson : undefined,
        contactTitle: !isPlanned ? values.contactTitle || undefined : undefined,
        outcomeSummary: !isPlanned ? values.outcomeSummary : undefined,
        color: !isPlanned ? values.color : undefined,
        followUp: !isPlanned ? values.followUp : undefined,
        ...(presetParentPinId && !editing ? { parentPinId: presetParentPinId } : {}),
      };

      if (editing) {
        const r = await fetch(`/api/v1/visits/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? 'update fail');
        }
      } else {
        const createBody: CreateVisitInput = {
          ...payload,
          provinceCode: values.provinceCode,
          cityName: values.cityName,
        } as CreateVisitInput;
        const r = await fetch(`/api/v1/visits`, {
          method: 'POST', headers, body: JSON.stringify(createBody),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? 'create fail');
        }
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
      title={editing ? '编辑拜访' : '新建计划/拜访'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="类型" name="status" rules={[{ required: true }]}>
          <Segmented
            options={[
              { label: '○ 计划中', value: 'planned' },
              { label: '● 已拜访', value: 'completed' },
            ]}
            block
            disabled={!!editing}
          />
        </Form.Item>

        {/* 计划中 字段 */}
        {watchedStatus === 'planned' && (
          <>
            <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
              <Input maxLength={100} placeholder="比如:拜访中芯成都厂" />
            </Form.Item>
            <Form.Item label="计划日期" name="plannedDate">
              <DatePicker style={{ width: '100%' }} placeholder="可选,如:2026-05-15" />
            </Form.Item>
          </>
        )}

        {/* 已拜访 字段 */}
        {watchedStatus === 'completed' && (
          <>
            <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="对接部门" name="department" rules={[{ required: true, max: 128 }]}>
              <Input maxLength={128} />
            </Form.Item>
            <Form.Item label="对接人" name="contactPerson" rules={[{ required: true, max: 64 }]}>
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="对接人职务" name="contactTitle">
              <Input maxLength={64} placeholder="可选" />
            </Form.Item>
            <Form.Item label="产出描述" name="outcomeSummary" rules={[{ required: true }]}>
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="green">绿(常规)</Radio>
                <Radio value="yellow">黄(层级提升)</Radio>
                <Radio value="red">红(紧急)</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="后续跟进" name="followUp" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        )}

        {/* 地理(都需要) */}
        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing || !!presetProvinceCode}
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !!presetCityName || !selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 9.2: typecheck**

```bash
cd apps/web && npm run typecheck
```

期望:无 error(可能 PinDetailDrawer 用旧 props 报错 — 留到 Task 11 修)。

- [ ] **Step 9.3: e2e 验证 — 通过工作台 +新建 测切换器**

打开 /console → 拜访清单 → +新建 → modal 顶部应有 Segmented `[○ 计划中  ● 已拜访]`。

```javascript
// preview_click({ selector: 'antd Segmented "○ 计划中"' })
// preview_snapshot 看字段切换
// preview_screenshot
```

期望:切「计划中」后,visitDate / contactPerson / color 等字段消失,只剩 title / plannedDate / 省 / 市。

---

# Task 10:前端 VisitDetailDrawer — 三态渲染

**Files:**
- Modify: `apps/web/src/components/VisitDetailDrawer.tsx`

⚠️ 现有 VisitDetailDrawer 文件没在 Explore 阶段拿到 — 实施时先 Read 该文件,看其现有结构,再按现状改造。基本结构应该跟 PinDetailDrawer 类似(Drawer + Descriptions + 按钮)。

- [ ] **Step 10.1: Read 现有 VisitDetailDrawer.tsx,记下结构**

```bash
# Read apps/web/src/components/VisitDetailDrawer.tsx
```

- [ ] **Step 10.2: 改 Drawer 按 status 三态渲染**

参考 [PinDetailDrawer.tsx](../apps/web/src/components/PinDetailDrawer.tsx) 的状态切换按钮组模式,把 VisitDetailDrawer 改成:

- 顶部 status Tag(planned 蓝 / completed 按 color / cancelled 灰)
- planned 状态下:
  - 显示 title / plannedDate / 父 Pin 链接 / 坐标
  - 主按钮「转为已拜访」点击 → 打开 VisitFormModal({ editing: visit })— 切换器锁 completed,fieldsValue 预填 visit 现有字段
  - 次按钮「取消计划」→ confirm Modal → PUT { status: 'cancelled' }
- completed 状态下:
  - 显示完整 visit 字段
  - 「关联 Pin」展示(若 parentPinId 不空)
  - color 改下拉(白名单字段),onChange → PUT { color: x }
- cancelled 状态下:
  - 显示 title + 取消提示
  - 主按钮「重启为计划中」→ PUT { status: 'planned' }

具体实现交给实施者(参考 PinDetailDrawer 模式 + Task 9 VisitFormModal 用法)。

- [ ] **Step 10.3: e2e 验证三态**

通过 curl 创建 1 条 planned + 1 条 cancelled,然后浏览器点散点验证 Drawer 三态。

```javascript
// preview_click({ selector: '蓝点散点' })
// preview_snapshot 看 Drawer 显示「计划中」+「转为已拜访」「取消计划」
// preview_click({ selector: '取消计划' })
// preview_snapshot 看变成 cancelled 灰,显示「重启为计划中」
```

---

# Task 11:前端 PinCommentBoard 新组件 + PinDetailDrawer 加派生 + 留言板

**Files:**
- Create: `apps/web/src/api/comments.ts`
- Create: `apps/web/src/components/PinCommentBoard.tsx`
- Modify: `apps/web/src/components/PinDetailDrawer.tsx`

- [ ] **Step 11.1: 写 `apps/web/src/api/comments.ts`**

```typescript
import type { Comment, CreateCommentInput } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchPinComments(pinId: string): Promise<{ data: Comment[] }> {
  const r = await fetch(`/api/v1/pins/${pinId}/comments`, { headers: authHeaders() });
  if (!r.ok) throw new Error('comments fetch fail');
  return r.json();
}

export async function postPinComment(pinId: string, input: CreateCommentInput): Promise<Comment> {
  const r = await fetch(`/api/v1/pins/${pinId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error('comment post fail');
  return r.json();
}
```

- [ ] **Step 11.2: 写 `apps/web/src/components/PinCommentBoard.tsx`**

```typescript
import { useState } from 'react';
import { Avatar, Button, Empty, Input, List, Space, Tag, Typography, message } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPinComments, postPinComment } from '@/api/comments';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  pinId: string;
}

export function PinCommentBoard({ pinId }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pin-comments', pinId],
    queryFn: () => fetchPinComments(pinId),
    enabled: !!pinId,
  });

  const mutation = useMutation({
    mutationFn: (input: { body: string }) => postPinComment(pinId, input),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['pin-comments', pinId] });
      message.success('已发送');
    },
    onError: (err) => message.error(`发送失败: ${(err as Error).message}`),
  });

  const comments = data?.data ?? [];

  return (
    <div style={{ marginTop: 16 }}>
      <Text strong>留言板 ({comments.length})</Text>
      <List
        loading={isLoading}
        locale={{ emptyText: <Empty description="暂无留言" /> }}
        dataSource={comments}
        renderItem={(c) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <Avatar
                  size="small"
                  icon={c.sourceType === 'auto_from_visit' ? <RobotOutlined /> : <UserOutlined />}
                />
              }
              title={
                <Space size={6}>
                  <Text style={{ fontSize: 12 }}>{c.createdBy ?? 'system'}</Text>
                  {c.sourceType === 'auto_from_visit' && <Tag color="cyan">系统</Tag>}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {c.createdAt.replace('T', ' ').slice(0, 16)}
                  </Text>
                </Space>
              }
              description={<Text style={{ fontSize: 13 }}>{c.body}</Text>}
            />
          </List.Item>
        )}
      />
      <Space.Compact style={{ width: '100%', marginTop: 8 }}>
        <TextArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="输入留言…"
        />
        <Button
          type="primary"
          loading={mutation.isPending}
          disabled={!body.trim()}
          onClick={() => mutation.mutate({ body: body.trim() })}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  );
}
```

- [ ] **Step 11.3: 改 PinDetailDrawer.tsx 加「派生计划点」+ 留言板**

在 PinDetailDrawer.tsx 现有 imports 加:

```typescript
import { PlusOutlined } from '@ant-design/icons';
import { VisitFormModal } from './VisitFormModal';
import { PinCommentBoard } from './PinCommentBoard';
```

按钮组 Space 里加新按钮(放在「编辑」按钮前):

```tsx
<Button
  icon={<PlusOutlined />}
  onClick={() => setDeriveModalOpen(true)}
>
  派生计划点
</Button>
```

`useState` 加:

```typescript
const [deriveModalOpen, setDeriveModalOpen] = useState(false);
```

Drawer 渲染最后(Descriptions 之后)加:

```tsx
<PinCommentBoard pinId={pin.id} />
```

Drawer 闭包之外加 modal:

```tsx
{pin && (
  <VisitFormModal
    open={deriveModalOpen}
    onClose={() => setDeriveModalOpen(false)}
    defaultStatus="planned"
    presetParentPinId={pin.id}
    presetProvinceCode={pin.provinceCode}
    presetCityName={pin.cityName}
  />
)}
```

- [ ] **Step 11.4: typecheck + e2e 验证**

```bash
cd apps/web && npm run typecheck
```

期望:无 error。

```javascript
// preview_click({ selector: 'Pin 散点(成都红图钉)' })
// preview_snapshot 看 Drawer 有「派生计划点」+「留言板」section
// preview_click({ selector: '派生计划点' })
// preview_snapshot 看 VisitFormModal 弹出,Segmented 锁「计划中」
```

---

# Task 12:前端 VisitsTab status 筛选 + 列扩展

**Files:**
- Modify: `apps/web/src/pages/console/VisitsTab.tsx`

⚠️ 文件未在 Explore 阶段拿到 — Read 后按现状改。

- [ ] **Step 12.1: Read 现有 VisitsTab.tsx**

```bash
# Read apps/web/src/pages/console/VisitsTab.tsx
```

- [ ] **Step 12.2: 加 status Select 筛选**

表头工具栏加 antd `Select`:

```tsx
import { Select } from 'antd';
import type { VisitStatus } from '@pop/shared-types';

const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('completed');

// 工具栏:
<Select
  value={statusFilter}
  onChange={setStatusFilter}
  options={[
    { label: '全部', value: 'all' },
    { label: '计划中', value: 'planned' },
    { label: '已拜访', value: 'completed' },
    { label: '已取消', value: 'cancelled' },
  ]}
  style={{ width: 120 }}
/>
```

`useQuery` 的 queryKey 和 queryFn 改成:

```typescript
const { data } = useQuery({
  queryKey: ['visits', statusFilter],
  queryFn: async () => {
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    const r = await fetch(`/api/v1/visits${q}`, { headers: authHeaders() });
    return r.json();
  },
});
```

- [ ] **Step 12.3: 表格加列**

新增列:

```tsx
{ title: '类型', dataIndex: 'status', render: (s: VisitStatus) => (
  <Tag color={s === 'planned' ? 'blue' : s === 'completed' ? 'green' : 'default'}>
    {s === 'planned' ? '计划' : s === 'completed' ? '已拜访' : '已取消'}
  </Tag>
)},
{ title: '标题', dataIndex: 'title', render: (t: string | null, row: Visit) =>
  t ?? (row.status === 'completed' ? row.contactPerson : <Text type="secondary">—</Text>)
},
{ title: '关联项目', dataIndex: 'parentPinId', render: (pid: string | null) =>
  pid ? <Text style={{ fontSize: 12 }}>{pid.slice(0, 8)}…</Text> : <Text type="secondary">—</Text>
},
```

⚠️ 「关联项目」实施时如果想显示 Pin 的 title,要么改后端 GET visits 时带 `relations: ['parentPin']`,要么前端 GET pins 列表 + map。简单做法:先显示 id 前 8 位即可。

- [ ] **Step 12.4: e2e 验证筛选切换**

```javascript
// preview_eval: window.location.pathname = '/console/visits'
// preview_snapshot 看默认 completed,33 条
// preview_click({ selector: 'status select 计划中' })
// preview_snapshot 看 0-1 条
```

---

# Task 13:前端 MapShell click handler 统一

**Files:**
- Modify: `apps/web/src/pages/MapShell.tsx`

⚠️ 文件未在 Explore 阶段拿到 — Read 后按现状改。

- [ ] **Step 13.1: Read MapShell.tsx**

- [ ] **Step 13.2: 蓝点(planned visits)和拜访点统一 click 调 VisitDetailDrawer**

现有 MapShell 应该有 `onVisitClick(visitId)` handler 处理 visits 散点的点击。把它改成对**所有 status** 统一处理 — 即 planned 蓝点和 completed/cancelled 拜访点都调同一个 `setSelectedVisitId(visitId)`,VisitDetailDrawer 内部按 status 渲染(Task 10 已处理)。

具体改动可能就 1-2 行。如果原代码已经统一调,这个 task 就是 no-op,只需 e2e 验证。

- [ ] **Step 13.3: e2e 验证点蓝点弹 Drawer**

```javascript
// preview_click({ selector: '成都坐标的蓝点散点' })
// preview_snapshot 看 VisitDetailDrawer 弹出,显示「计划中」标签
```

---

# Task 14:端到端场景脚本验证(8 步主流程)

**Files:** 无文件改动,纯 e2e 验证。

按 spec [Section 5](SPEC-V0.6-beta25-beta3-bluepoint.md) 用户场景脚本逐步验证。

- [ ] **Step 14.0: 重置数据,从 fresh 状态开始**

```bash
# 删掉之前 e2e 测试创的临时 visits / comments
psql -U pop -d pop -c "DELETE FROM comments WHERE source_type='manual';"
psql -U pop -d pop -c "DELETE FROM comments WHERE source_type='auto_from_visit';"
psql -U pop -d pop -c "DELETE FROM visits WHERE title IS NOT NULL;"  # 清掉测试创的 title 不空的
psql -U pop -d pop -c "SELECT COUNT(*) FROM visits;"  # 应回到 32
psql -U pop -d pop -c "SELECT COUNT(*) FROM pins;"    # 应是 3
```

- [ ] **Step 14.1: [步骤 0] 登录 + 大盘**

```bash
preview_start({ name: 'api-dev' })
preview_start({ name: 'vite-dev' })
```

```javascript
// preview_eval: window.location.href = 'http://localhost:5173/login'
// preview_click({ selector: '系统管理员' })
// preview_snapshot 看 /map/local
// preview_screenshot 留证「3 红/灰 Pin + 32 橙/黄/绿散点」
```

期望:大盘干净,无蓝点。

- [ ] **Step 14.2: [步骤 1-2] 派生计划点**

```javascript
// preview_click({ selector: '成都红图钉' })
// preview_snapshot 看 Drawer
// preview_click({ selector: '派生计划点' })
// preview_fill: title="拜访中芯成都厂"
// preview_fill: plannedDate="2026-05-15"
// preview_click({ selector: '保存' })
```

- [ ] **Step 14.3: [步骤 3-6] 转色 + 验证**

```javascript
// preview_screenshot 看大盘成都坐标多了蓝点
// preview_click({ selector: '蓝点散点' })
// preview_snapshot 看「计划中」+「转为已拜访」
// preview_click({ selector: '转为已拜访' })
// preview_fill: visitDate / department / contactPerson / contactTitle / outcomeSummary / color=yellow
// preview_click({ selector: '保存' })
// preview_screenshot 看大盘蓝点变黄
```

- [ ] **Step 14.4: [步骤 7] 留言板自动留言**

```javascript
// preview_click({ selector: '成都红图钉' })
// preview_snapshot 看留言板 +1 条 🤖 系统留言
// preview_screenshot 留证留言模板渲染对
```

期望:留言 body 含「计划点「拜访中芯成都厂」已完成」+ 拜访信息。

- [ ] **Step 14.5: [步骤 8] 手动留言**

```javascript
// preview_fill: textarea = "这条线索值得继续追,下周约部委对接"
// preview_click({ selector: '发送' })
// preview_snapshot 看留言板 +1 条 manual 留言(无 🤖)
```

- [ ] **Step 14.6: [步骤 A] 工作台拜访清单**

```javascript
// preview_eval: window.location.pathname = '/console/visits'
// preview_snapshot 看默认 completed 显示 33 条
// preview_screenshot 留证关联项目列(那条转 completed 的关联到成都 Pin)
```

- [ ] **Step 14.7: [步骤 B] 化身计划场景**

```javascript
// preview_click({ selector: 'status select 计划中' })
// preview_snapshot 看 0 条
// preview_click({ selector: '+新建' })
// preview_click({ selector: 'Segmented 计划中' })
// preview_fill: title="化身计划:走访某老乡"
// preview_fill: 省=广东省,市=广州市
// preview_click({ selector: '保存' })
// preview_snapshot 看 status=planned 列表 +1 条
// preview_screenshot 大盘广州坐标多 1 个蓝点
```

- [ ] **Step 14.8: 错误路径 4 个 (curl)**

```bash
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"sysadmin"}' | jq -r .accessToken)

# X: 已 completed → planned
COMPLETED_ID=$(psql -U pop -d pop -tAc "SELECT id FROM visits WHERE status='completed' LIMIT 1")
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"planned"}' http://localhost:3000/api/v1/visits/$COMPLETED_ID
# 期望:400 + "不允许 completed → planned"

# Y: planned → completed 缺 visitDate
PLAN_ID=$(psql -U pop -d pop -tAc "SELECT id FROM visits WHERE status='planned' LIMIT 1")
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}' http://localhost:3000/api/v1/visits/$PLAN_ID
# 期望:400 + "转 completed 必须填 visitDate"

# Z: 已 completed 改 outcome
curl -sX PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"outcomeSummary":"x"}' http://localhost:3000/api/v1/visits/$COMPLETED_ID
# 期望:400 + "已完成拜访只允许改 visitColor"

# W: 不存在的 Pin
curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"x"}' http://localhost:3000/api/v1/pins/00000000-0000-0000-0000-000000000000/comments
# 期望:404
```

- [ ] **Step 14.9: preview_console_logs / preview_network 检查**

```javascript
// preview_console_logs() 看无 error
// preview_network() 看所有 API 调用 200 / 201 / 400 / 404 符合预期
```

- [ ] **Step 14.10: 回归保护检查**

```javascript
// preview_eval: window.location.pathname = '/map/local'
// preview_screenshot 跟 Step 14.1 对比 — 32 + 1(化身计划)+ 转色那条 = 34 条 visits
// 3 红/灰 Pin 不变
// preview_click 化身拜访(原 32 条之一)→ Drawer 显示 completed 形态(无变化,β.1 回归)
// preview_click 任一 Pin → ✓/✕/↺/编辑 4 按钮 + 派生 + 留言板(β.2 回归 + β.2.5/β.3 增补)
```

---

# Task 15:整合 commit + push

**Files:** 全部 task 已改的文件 + `docs/SPEC-V0.6-beta25-beta3-bluepoint.md`(spec 文件,Task 0 之前就放好了)

- [ ] **Step 15.1: git status 确认改动面**

```bash
git status
```

期望:大约 25-30 个 modified/new 文件。

- [ ] **Step 15.2: 分批 add(避免误带其他)**

```bash
git add docs/SPEC-V0.6-beta25-beta3-bluepoint.md
git add docs/PLAN-V0.6-beta25-beta3-bluepoint.md
git add packages/shared-types/
git add apps/api/src/visits/
git add apps/api/src/comments/
git add apps/api/src/database/migrations/
git add apps/api/src/app.module.ts
git add apps/api/jest.config.ts
git add apps/api/package.json
git add apps/api/package-lock.json  # 新装 jest 依赖
git add apps/web/src/components/VisitFormModal.tsx
git add apps/web/src/components/VisitDetailDrawer.tsx
git add apps/web/src/components/PinDetailDrawer.tsx
git add apps/web/src/components/PinCommentBoard.tsx
git add apps/web/src/components/MapCanvas.tsx
git add apps/web/src/pages/console/VisitsTab.tsx
git add apps/web/src/pages/MapShell.tsx
git add apps/web/src/api/comments.ts
```

- [ ] **Step 15.3: 检查没误带**

```bash
git status   # 应只剩"nothing to commit"或个别 untracked(非源码)
git diff --cached --stat   # 看一眼 line 变化分布
```

- [ ] **Step 15.4: commit**

```bash
git commit -m "$(cat <<'EOF'
feat: V0.6 β.2.5 + β.3 蓝点闭环(visits 表升级 + comments 留言板 + 自动同步)

- visits 表升级为「计划/拜访点」统一实体,加 status/parent_pin_id/title/planned_date 4 字段
- visit_color enum 扩 'blue';状态机 planned ↔ cancelled / planned → completed 不可逆
- 新建 comments 表 + 自动留言耦合(planned → completed + parentPinId 时事务内 INSERT auto_from_visit)
- 前端:VisitFormModal 加 Segmented 切换器、PinDrawer 加派生 + 留言板 section、大盘单 series + status 推色
- 后端引入 jest + 14 个 unit tests(状态机 + create 校验 + comment 模板)
- spec/plan 文档纳入仓库

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 15.5: 跑 typecheck + 整体 build sanity**

```bash
npm run typecheck --workspaces --if-present
cd apps/api && npm run build
cd apps/web && npm run build
```

期望全过。

- [ ] **Step 15.6: push + 提 PR(可选,等用户拍)**

```bash
git push -u origin claude/frosty-easley-88c5ed
gh pr create --title "feat: V0.6 β.2.5 + β.3 蓝点闭环" --body "$(cat <<'EOF'
## Summary
- visits 表升级为「计划/拜访点」统一实体(加 status/parent_pin_id/title/planned_date)
- 新建 comments 表 + 自动留言耦合(planned → completed + parentPinId 时事务内 INSERT)
- 前端 1 套表单 + Segmented 切换器、Pin Drawer 加留言板 section、大盘 status 推色

## Test plan
- [ ] β.2 回归:3 红/灰 Pin + 32 橙/黄/绿散点不变
- [ ] 派生计划点:Pin Drawer → VisitFormModal 锁 planned → 大盘出蓝点
- [ ] 转色 + 自动留言:蓝点 Drawer「转为已拜访」→ 大盘变色 + 父 Pin 留言板 +1 条 🤖 留言
- [ ] 化身计划:工作台 +新建 → Segmented 切「计划中」 → 大盘出 parentPin=NULL 蓝点
- [ ] 错误路径:completed → planned (400) / 缺 visitDate (400) / 改 outcome (400) / 不存在 Pin (404)
- [ ] 后端 14 个 jest unit tests 全过
- [ ] typecheck + build 全过

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

⚠️ Step 15.6 涉及 push + PR — 是 user-visible action,实施时**先问用户拍**再做。

---

## Self-Review

**1. Spec coverage:** 把 [spec](SPEC-V0.6-beta25-beta3-bluepoint.md) 的 14 条决策跟 task 对一遍:

| Spec 决策 | 落到哪个 Task |
|---|---|
| 1. 不新建 plan_points 表 → visits 升级 | T2 |
| 2. 加 status/parent_pin_id/title/planned_date 4 字段 | T2 |
| 3. visit_color 扩 'blue' | T2 |
| 4. 32 条 seed 自动 status='completed'(DEFAULT 兜底) | T2 |
| 5. Pin → 计划点 1:N | T2(parentPinId 不限唯一) |
| 6. 化身可 planned | T4 + T5(校验不强制 parentPinId) |
| 7. planned → completed 不可逆 | T5 |
| 8. planned ↔ cancelled | T5 |
| 9. completed 白名单只允许 visitColor | T5 |
| 10. completed → * 全禁 | T5 |
| 11. 触发时机 planned→completed + parentPinId NOT NULL | T6 |
| 12. Comment 模板中档 | T6(comment-template.ts) |
| 13. comments 表字段 | T3 |
| 14. 手动留言 UI 一起上 | T11(PinCommentBoard) |
| 15. 大盘单 series 同形同尺寸 | T8 |
| 16. 工作台默认 completed + status 筛选 | T12 |
| 17. 1 套表单 + Segmented + 字段联动 | T9 |

**Coverage 完整,无 spec 遗漏 task。**

**2. Placeholder scan:** 全文搜「TBD」「TODO」「fill in」「实施时按现有」 —

发现:T3 Step 3.4 提到「auth/jwt-auth.guard 路径假设 — 实施时按现有对齐」、T6 Step 6.5 「按 UserEntity 实际字段调整」、T10/T12/T13 多处「Read 后按现状改」。

⚠️ 这些不是 placeholder 而是「**安全护栏**」 — 因为 Explore 阶段没拿到这些文件原貌,实施时必须 Read 现状。我可以接受这些保留,但应该在 task 头部强调「Step X.0:Read 现有文件」作为第一步(已经在 T10/12/13 这么做了)。

**3. Type consistency:** 全文搜方法/字段名一致:

- `parentPinId` / `parent_pin_id` / `parentPin` 三种写法分别对应 TS / SQL / 关系名 — 一致 ✓
- `VisitStatus` / `VisitStatusColor` / `CommentSource` enum 命名一致 ✓
- `renderAutoComment` 函数签名:在 T6.1 定义、T6.5 调用、T6.2 测试 — 入参字段一致 ✓
- `auto_from_visit` 字符串值在 entity / DTO / template / 测试 — 一致 ✓
- `palette.visit.blue` 在 T8 引用,tokens.ts 已有 ✓
- `ALLOWED_TRANSITIONS` 表在 T5 用 — 与 spec 决策表一致 ✓

**4. 已知不完美:**

- Step 6.4 listener 测试不完整(注释「具体断言在实施 step 完成后,根据真实代码补」)— 接受,因为 commentsRepo mock + dataSource.transaction mock 太复杂,e2e Step 6.7 已经验证。
- Step 14.6/14.7 工作台「关联项目」列简化为只显示 id 前 8 位 — 演示足够,Pin title 联动留 V0.7。

---

## Plan complete

**Saved to:** `docs/PLAN-V0.6-beta25-beta3-bluepoint.md`

**Two execution options:**

**1. Subagent-Driven(推荐)** — 每个 task 起一个 fresh subagent,完了 review,再开下一个。15 个 task ≈ 15 个 subagent 调度。我来 review 每个 task 的产出。

**2. Inline Execution** — 在当前 session 跑 superpowers:executing-plans,batch 执行 + checkpoint review。

跟用户拍哪个走法。
