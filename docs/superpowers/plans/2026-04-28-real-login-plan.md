# V0.7 patch · 真登录(用户名+密码)+ 个人资料 + 用户管理 实施 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 bcrypt 真校验 + 完整用户管理 替换当前假 SSO 登录;头像下拉「修改资料」自助改昵称/密码;管理后台用户管理 CRUD。

**Architecture:** Postgres 加 password_hash 列 + bcrypt 10 rounds + 沿用 JWT。后端加 self profile + admin user mgmt 共 7 个 endpoints。前端登录页换 Form,加 ProfileModal,Admin UsersPage 真 CRUD。

**Tech Stack:** bcrypt(C++ binding,加依赖)+ NestJS Validation + antd Form / Table / Modal + react-query。

**Spec:** `docs/superpowers/specs/2026-04-28-real-login-design.md`

—

## Task 1:加 bcrypt 依赖 + Migration + Entity

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/database/migrations/{timestamp}-AddUserPasswordHash.ts`
- Modify: `apps/api/src/users/entities/user.entity.ts`

—

- [ ] **Step 1.1: 装 bcrypt**

```bash
cd apps/api && npm install bcrypt && npm install --save-dev @types/bcrypt
```

验证:`grep bcrypt package.json` 看 dependencies + devDependencies 都有。

- [ ] **Step 1.2: User entity 加 passwordHash**

编辑 `apps/api/src/users/entities/user.entity.ts`,在 `note` 字段后加:

```ts
@Column({ type: 'varchar', length: 256, nullable: true, name: 'password_hash' })
passwordHash!: string | null;
```

- [ ] **Step 1.3: 创建 migration**

文件 `apps/api/src/database/migrations/1777400000000-AddUserPasswordHash.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * 真登录第一步 — users 表加 password_hash 列 + 给 sysadmin 设默认密码
 *
 * - sysadmin 默认密码:pop2026(bcrypt 10 rounds)
 * - 其他 4 demo 用户 password_hash=NULL,login 时拒绝「未启用」
 *   → sysadmin 登录后通过 /admin/users「重置密码」给他们设
 */
export class AddUserPasswordHash1777400000000 implements MigrationInterface {
  name = 'AddUserPasswordHash1777400000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" ADD COLUMN "password_hash" varchar(256) NULL`);
    const hash = await bcrypt.hash('pop2026', 10);
    await qr.query(
      `UPDATE "users" SET "password_hash" = $1 WHERE "username" = $2`,
      [hash, 'sysadmin'],
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}
```

- [ ] **Step 1.4: 跑 migration + 验证**

```bash
cd apps/api && npm run migration:run
psql -U pop -d pop -c "\d users" | grep password_hash    # 列存在
psql -U pop -d pop -c "SELECT username, LEFT(password_hash, 7) FROM users"
# 期望:sysadmin 的 hash 以 \$2b\$10\$ 开头,其他 4 个 NULL
```

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/users/entities/user.entity.ts apps/api/src/database/migrations/1777400000000-AddUserPasswordHash.ts
git commit -m "feat(api): users 表加 password_hash + sysadmin 默认密码 pop2026"
```

—

## Task 2:Login API 改用 bcrypt 验证

**Files:**
- Modify: `apps/api/src/auth/dto/login.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `packages/shared-types/src/dtos/auth.dto.ts`(若有,无则跳过)

—

- [ ] **Step 2.1: LoginDto 加 password**

编辑 `apps/api/src/auth/dto/login.dto.ts`:

```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;
}
```

- [ ] **Step 2.2: AuthService 加 bcrypt verify**

编辑 `apps/api/src/auth/auth.service.ts`(读取现有 login 方法,在 user lookup 之后加):

```ts
import * as bcrypt from 'bcrypt';

// 现有:const user = await this.usersService.findByUsername(dto.username);
//      if (!user) throw new UnauthorizedException(...);

// 加在 user 查到之后:
if (!user.passwordHash) {
  throw new UnauthorizedException('用户未启用,请联系管理员');
}
const ok = await bcrypt.compare(dto.password, user.passwordHash);
if (!ok) {
  throw new UnauthorizedException('用户名或密码错误');
}
```

注意:统一错误消息「用户名或密码错误」(用户名不存在 / 密码错都返回这个 — 防枚举)。「用户未启用」单独消息(没设密码场景)。

- [ ] **Step 2.3: 重启 API + curl 验证**

```bash
preview_stop / preview_start api-dev
TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"sysadmin","password":"pop2026"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")
echo "$TOK" | head -c 30  # 应该有 token

# 错误密码
curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"sysadmin","password":"wrongpass"}' -w '\nhttp=%{http_code}\n'
# 期望:401 + 「用户名或密码错误」

# 未启用用户
curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"lead","password":"anything"}' -w '\nhttp=%{http_code}\n'
# 期望:401 + 「用户未启用,请联系管理员」
```

- [ ] **Step 2.4: 共享类型同步**

如果 `packages/shared-types/src/dtos/auth.dto.ts` 里有 LoginInput,加 `password: string` 字段。

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/auth/ packages/shared-types/src/
git commit -m "feat(api): login 用 bcrypt 真校验 + 401 提示分场景"
```

—

## Task 3:Profile API(self)+ shared-types

**Files:**
- Create: `apps/api/src/users/dtos/update-profile.dto.ts`
- Create: `apps/api/src/users/dtos/change-password.dto.ts`
- Modify: `apps/api/src/users/users.service.ts`(加 2 方法)
- Modify: `apps/api/src/users/users.controller.ts`(加 2 endpoints)
- Modify: `packages/shared-types/src/dtos/user.dto.ts`(加 2 个接口)

—

- [ ] **Step 3.1: DTO 文件**

`apps/api/src/users/dtos/update-profile.dto.ts`:
```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString() @MinLength(1) @MaxLength(32)
  displayName!: string;
}
```

`apps/api/src/users/dtos/change-password.dto.ts`:
```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(6) @MaxLength(64)
  oldPassword!: string;

  @IsString() @MinLength(6) @MaxLength(64)
  newPassword!: string;
}
```

- [ ] **Step 3.2: UsersService 加方法**

在 `apps/api/src/users/users.service.ts` 末尾(类内)加:

```ts
async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserEntity> {
  const user = await this.findById(userId);
  if (!user) throw new NotFoundException(`User ${userId}`);
  user.displayName = dto.displayName;
  return this.users.save(user);
}

async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await this.findById(userId);
  if (!user) throw new NotFoundException(`User ${userId}`);
  if (!user.passwordHash) {
    throw new UnauthorizedException('账号未设密码,请联系管理员');
  }
  const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedException('旧密码错误');
  user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
  await this.users.save(user);
}
```

import 头加:
```ts
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
```

- [ ] **Step 3.3: Controller 加 endpoints**

在 `apps/api/src/users/users.controller.ts` 加:
```ts
@Put('me')
async updateMe(
  @Body() dto: UpdateProfileDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  const data = await this.service.updateProfile(user.id, dto);
  return { data: { id: data.id, username: data.username, displayName: data.displayName } };
}

@Put('me/password')
@HttpCode(204)
async changeMyPassword(
  @Body() dto: ChangePasswordDto,
  @CurrentUser() user: AuthenticatedUser,
): Promise<void> {
  await this.service.changePassword(user.id, dto);
}
```

import:
```ts
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
```

- [ ] **Step 3.4: 共享类型**

`packages/shared-types/src/dtos/user.dto.ts` 末尾加:
```ts
export interface UpdateProfileInput {
  displayName: string;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}
```

- [ ] **Step 3.5: 重启 API + curl 验证**

```bash
TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"sysadmin","password":"pop2026"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

# update displayName
curl -s -X PUT http://localhost:3001/api/v1/users/me -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"displayName":"老 sysadmin"}'

# change password
curl -s -X PUT http://localhost:3001/api/v1/users/me/password -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"oldPassword":"pop2026","newPassword":"newpass"}' -w '\nhttp=%{http_code}\n'
# 期望:204

# 错误旧密码
curl -s -X PUT http://localhost:3001/api/v1/users/me/password -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"oldPassword":"wrong","newPassword":"newpass"}' -w '\nhttp=%{http_code}\n'
# 期望:401 + 「旧密码错误」

# 改回 pop2026 给后续 task 用
curl -s -X PUT http://localhost:3001/api/v1/users/me/password -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"oldPassword":"newpass","newPassword":"pop2026"}'
```

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/src/users/ packages/shared-types/src/dtos/user.dto.ts
git commit -m "feat(api): users self profile API(改昵称 / 改密码)"
```

—

## Task 4:Admin User Management API

**Files:**
- Create: `apps/api/src/users/dtos/create-user.dto.ts`
- Create: `apps/api/src/users/dtos/update-user.dto.ts`
- Create: `apps/api/src/users/dtos/reset-password.dto.ts`
- Create: `apps/api/src/users/dtos/change-role.dto.ts`
- Modify: `apps/api/src/users/users.service.ts`(加 5 方法)
- Modify: `apps/api/src/users/users.controller.ts`(加 5 endpoints)
- Modify: `packages/shared-types/src/dtos/user.dto.ts`(加 4 接口)

—

- [ ] **Step 4.1: DTO 文件 4 个**

`create-user.dto.ts`:
```ts
import { IsString, MinLength, MaxLength, IsEmail, IsEnum } from 'class-validator';
import { UserRoleCode } from '@pop/shared-types';

export class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(32)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(32)
  displayName!: string;

  @IsEmail() @MaxLength(128)
  email!: string;

  @IsString() @MinLength(6) @MaxLength(64)
  password!: string;

  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
```

`update-user.dto.ts`:
```ts
import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(32)
  displayName?: string;

  @IsOptional() @IsEmail() @MaxLength(128)
  email?: string;
}
```

`reset-password.dto.ts`:
```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString() @MinLength(6) @MaxLength(64)
  newPassword!: string;
}
```

`change-role.dto.ts`:
```ts
import { IsEnum } from 'class-validator';
import { UserRoleCode } from '@pop/shared-types';

export class ChangeRoleDto {
  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
```

- [ ] **Step 4.2: UsersService 加 RBAC + 5 方法**

在 `users.service.ts` 类外加权限白名单:
```ts
const USERS_ADMIN_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
]);
```

类内加 5 方法(放在 changePassword 之后):

```ts
private assertAdmin(currentUser: AuthenticatedUser): void {
  if (!USERS_ADMIN_ALLOWED_ROLES.has(currentUser.roleCode)) {
    throw new ForbiddenException('需要管理员权限');
  }
}

async create(dto: CreateUserDto, currentUser: AuthenticatedUser): Promise<UserEntity> {
  this.assertAdmin(currentUser);
  const exists = await this.users.findOne({
    where: [{ username: dto.username }, { email: dto.email }],
    withDeleted: true,
  });
  if (exists) throw new BadRequestException('用户名或邮箱已存在');
  const user = this.users.create({
    username: dto.username,
    displayName: dto.displayName,
    email: dto.email,
    passwordHash: await bcrypt.hash(dto.password, 10),
    status: 'active' as never,
    createdBy: currentUser.id,
  });
  const saved = await this.users.save(user);
  await this.userRoles.save({
    userId: saved.id,
    roleCode: dto.roleCode,
    assignedBy: currentUser.id,
  });
  return saved;
}

async updateById(id: string, dto: UpdateUserDto, currentUser: AuthenticatedUser): Promise<UserEntity> {
  this.assertAdmin(currentUser);
  const user = await this.findById(id);
  if (!user) throw new NotFoundException(`User ${id}`);
  if (dto.email && dto.email !== user.email) {
    const conflict = await this.users.findOne({ where: { email: dto.email }, withDeleted: true });
    if (conflict) throw new BadRequestException('邮箱已存在');
    user.email = dto.email;
  }
  if (dto.displayName !== undefined) user.displayName = dto.displayName;
  return this.users.save(user);
}

async resetPassword(id: string, newPassword: string, currentUser: AuthenticatedUser): Promise<void> {
  this.assertAdmin(currentUser);
  const user = await this.findById(id);
  if (!user) throw new NotFoundException(`User ${id}`);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await this.users.save(user);
}

async changeRole(id: string, roleCode: UserRoleCode, currentUser: AuthenticatedUser): Promise<UserRoleCode> {
  this.assertAdmin(currentUser);
  const user = await this.findById(id);
  if (!user) throw new NotFoundException(`User ${id}`);
  // 删旧 role + 插新 role(保护 unique constraint)
  await this.userRoles.delete({ userId: id });
  await this.userRoles.save({ userId: id, roleCode, assignedBy: currentUser.id });
  return roleCode;
}

async softDelete(id: string, currentUser: AuthenticatedUser): Promise<void> {
  this.assertAdmin(currentUser);
  if (id === currentUser.id) throw new BadRequestException('不能删除自己');
  const user = await this.findById(id);
  if (!user) throw new NotFoundException(`User ${id}`);
  // 检查目标是否唯一 sys_admin
  const role = await this.userRoles.findOne({ where: { userId: id } });
  if (role?.roleCode === UserRoleCode.SysAdmin) {
    const adminCount = await this.userRoles.count({ where: { roleCode: UserRoleCode.SysAdmin } });
    if (adminCount <= 1) throw new BadRequestException('不能删除唯一管理员');
  }
  await this.users.softRemove(user);
}

async restore(id: string, currentUser: AuthenticatedUser): Promise<UserEntity> {
  this.assertAdmin(currentUser);
  await this.users.restore(id);
  return this.users.findOneOrFail({ where: { id } });
}
```

import 顶部加:
```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '@pop/shared-types';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
```

- [ ] **Step 4.3: Controller 加 5 endpoints**

在 `users.controller.ts` 加:
```ts
@Post()
async create(
  @Body() dto: CreateUserDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  const data = await this.service.create(dto, user);
  return { data: this.stripPasswordHash(data) };
}

@Put(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  const data = await this.service.updateById(id, dto, user);
  return { data: this.stripPasswordHash(data) };
}

@Put(':id/password')
@HttpCode(204)
async resetPassword(
  @Param('id') id: string,
  @Body() dto: ResetPasswordDto,
  @CurrentUser() user: AuthenticatedUser,
): Promise<void> {
  await this.service.resetPassword(id, dto.newPassword, user);
}

@Put(':id/role')
async changeRole(
  @Param('id') id: string,
  @Body() dto: ChangeRoleDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  const role = await this.service.changeRole(id, dto.roleCode, user);
  return { data: { id, roleCode: role } };
}

@Delete(':id')
@HttpCode(204)
async softDelete(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
): Promise<void> {
  await this.service.softDelete(id, user);
}

@Post(':id/restore')
async restore(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  const data = await this.service.restore(id, user);
  return { data: this.stripPasswordHash(data) };
}

private stripPasswordHash(u: UserEntity): Omit<UserEntity, 'passwordHash'> {
  const { passwordHash: _drop, ...rest } = u;
  void _drop;
  return rest as Omit<UserEntity, 'passwordHash'>;
}
```

注意 Controller 里的 @Get list 也要 strip passwordHash。改 list:
```ts
@Get()
async list(@CurrentUser() user: AuthenticatedUser, @Query('withDeleted') withDeleted?: string) {
  const data = await this.service.listAllWithRole({ withDeleted: withDeleted === 'true', currentUser: user });
  return { data };
}
```

并对应改 service.listAllWithRole 接受 opts:`{ withDeleted?, currentUser }`,withDeleted=true 需要 admin。
listAllWithRole 内部已经是返回剥离了 passwordHash 的 plain object,无需额外 strip。

- [ ] **Step 4.4: 共享类型**

`packages/shared-types/src/dtos/user.dto.ts` 加:
```ts
export interface CreateUserInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  roleCode: UserRoleCode;
}

export interface UpdateUserInput {
  displayName?: string;
  email?: string;
}

export interface ResetPasswordInput {
  newPassword: string;
}

export interface ChangeRoleInput {
  roleCode: UserRoleCode;
}
```

import 头加 UserRoleCode 如缺。

- [ ] **Step 4.5: 重启 API + curl 验证 6 路径**

```bash
TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"sysadmin","password":"pop2026"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

# 1. 重置 lead 密码
LEAD_ID=$(curl -s "http://localhost:3001/api/v1/users" -H "Authorization: Bearer $TOK" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print([u['id'] for u in d if u['username']=='lead'][0])")
curl -s -X PUT "http://localhost:3001/api/v1/users/$LEAD_ID/password" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"newPassword":"leadpass"}' -w '\nhttp=%{http_code}\n'
# 期望:204

# 2. lead 用新密码登录
curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"lead","password":"leadpass"}' | python3 -c "import json,sys;print('OK' if 'accessToken' in json.load(sys.stdin) else 'FAIL')"

# 3. 创建用户
curl -s -X POST http://localhost:3001/api/v1/users -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"username":"newbie","displayName":"新人","email":"newbie@demo.com","password":"newbie123","roleCode":"local_ga"}' | python3 -m json.tool

# 4. 改 displayName
curl -s -X PUT "http://localhost:3001/api/v1/users/$LEAD_ID" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"displayName":"王 Lead"}'

# 5. 改 role
curl -s -X PUT "http://localhost:3001/api/v1/users/$LEAD_ID/role" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"roleCode":"pmo"}'
# 改回去
curl -s -X PUT "http://localhost:3001/api/v1/users/$LEAD_ID/role" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"roleCode":"lead"}'

# 6. RBAC:lead 不能创建用户
LEAD_TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"lead","password":"leadpass"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")
curl -s -X POST http://localhost:3001/api/v1/users -H "Authorization: Bearer $LEAD_TOK" -H 'Content-Type: application/json' -d '{"username":"x","displayName":"x","email":"x@x.com","password":"xxxxxx","roleCode":"local_ga"}' -w '\nhttp=%{http_code}\n'
# 期望:403
```

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/users/ packages/shared-types/src/dtos/user.dto.ts
git commit -m "feat(api): users 管理员 CRUD(create/update/role/password reset/soft delete)"
```

—

## Task 5:Login 页面换成 Form

**Files:**
- Modify: `apps/web/src/pages/Login.tsx`(整页重写)

—

- [ ] **Step 5.1: 重写 Login.tsx**

把整个 5 角色按钮 UI 替换成 Form。完整文件:

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import type { LoginResponseDto } from '@pop/shared-types';
import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const res = await http.post<LoginResponseDto>('/auth/login', values);
      setSession(res.data.accessToken, res.data.expiresAt, res.data.user);
      navigate(from ?? '/', { replace: true });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? '登录失败,请稍后再试';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 420 }}>
        <header style={{ textAlign: 'center' }}>
          <Title level={1} className="glow-title" style={{ marginBottom: 8 }}>
            政策 One Piece · POP
          </Title>
          <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
            用户名 + 密码登录
          </Paragraph>
        </header>

        {error && <Alert type="error" message={error} showIcon closable />}

        <Card className="glass-panel" title={<span style={{ color: palette.primary }}>登录</span>}>
          <Form<LoginForm> layout="vertical" onFinish={handleSubmit} disabled={loading}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }, { max: 32 }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: palette.textMuted }} />}
                placeholder="username"
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }, { min: 6, max: 64 }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: palette.textMuted }} />}
                placeholder="至少 6 位"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12, textAlign: 'center' }}>
            没有账号?<Tag color="processing" style={{ marginLeft: 4 }}>请联系管理员</Tag>
          </Text>
        </Card>

        <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
          默认管理员:sysadmin / pop2026
        </Text>
      </Space>
    </div>
  );
}
```

- [ ] **Step 5.2: typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/pages/Login.tsx
git commit -m "feat(web): 登录页换成 username+password Form(去 5 角色按钮)"
```

—

## Task 6:ProfileModal + AppShell dropdown

**Files:**
- Create: `apps/web/src/components/ProfileModal.tsx`
- Modify: `apps/web/src/layouts/AppShell.tsx`(加 ProfileModal trigger)
- Modify: `apps/web/src/api/users.ts`(加 updateProfile + changePassword)
- Modify: `apps/web/src/stores/auth.ts`(加 updateUser action)

—

- [ ] **Step 6.1: api/users.ts 加 self fetchers**

```ts
export async function updateProfile(displayName: string): Promise<UserListItem> {
  const r = await fetch('/api/v1/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ displayName }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'update profile fail');
  }
  return (await r.json()).data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const r = await fetch('/api/v1/users/me/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'change password fail');
  }
}
```

- [ ] **Step 6.2: stores/auth.ts 加 updateUser action**

打开 `apps/web/src/stores/auth.ts`,在 setSession 之后加:
```ts
updateUser: (patch: Partial<{ displayName: string }>) => {
  const cur = get().user;
  if (!cur) return;
  set({ user: { ...cur, ...patch } });
},
```

(若 type signature 在 interface 里,接口也要加 `updateUser: (patch: Partial<...>) => void`。)

- [ ] **Step 6.3: 创建 ProfileModal.tsx**

```tsx
import { useState } from 'react';
import { Form, Input, Modal, Tabs, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { changePassword, updateProfile } from '@/api/users';
import { useAuthStore } from '@/stores/auth';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ProfileForm { displayName: string }
interface PasswordForm { oldPassword: string; newPassword: string; confirm: string }

export function ProfileModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [profileForm] = Form.useForm<ProfileForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  const profileMutation = useMutation({
    mutationFn: (vs: ProfileForm) => updateProfile(vs.displayName),
    onSuccess: (data) => {
      message.success('资料已更新');
      updateUser({ displayName: data.displayName });
      onClose();
    },
    onError: (e) => message.error(`保存失败: ${(e as Error).message}`),
  });

  const passwordMutation = useMutation({
    mutationFn: (vs: PasswordForm) => changePassword(vs.oldPassword, vs.newPassword),
    onSuccess: () => {
      message.success('密码已修改');
      passwordForm.resetFields();
      onClose();
    },
    onError: (e) => message.error(`修改失败: ${(e as Error).message}`),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="修改资料"
      footer={null}
      destroyOnHidden
      width={420}
    >
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'profile' | 'password')}
        items={[
          {
            key: 'profile',
            label: '基本信息',
            children: (
              <Form<ProfileForm>
                form={profileForm}
                layout="vertical"
                initialValues={{ displayName: user?.displayName ?? '' }}
                onFinish={(vs) => profileMutation.mutate(vs)}
              >
                <Form.Item label="用户名">
                  <Input value={user?.username} disabled />
                </Form.Item>
                <Form.Item label="显示名称" name="displayName" rules={[{ required: true, max: 32 }]}>
                  <Input maxLength={32} />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <button type="submit" disabled={profileMutation.isPending}
                    style={{ width: '100%', height: 36, background: '#1677ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {profileMutation.isPending ? '保存中...' : '保存'}
                  </button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'password',
            label: '修改密码',
            children: (
              <Form<PasswordForm>
                form={passwordForm}
                layout="vertical"
                onFinish={(vs) => passwordMutation.mutate(vs)}
              >
                <Form.Item label="旧密码" name="oldPassword" rules={[{ required: true, min: 6 }]}>
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
                <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 6, max: 64 }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  label="确认新密码"
                  name="confirm"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        return !value || getFieldValue('newPassword') === value
                          ? Promise.resolve()
                          : Promise.reject('两次密码不一致');
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <button type="submit" disabled={passwordMutation.isPending}
                    style={{ width: '100%', height: 36, background: '#1677ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {passwordMutation.isPending ? '保存中...' : '保存'}
                  </button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
}
```

- [ ] **Step 6.4: AppShell.tsx 接入**

读 `apps/web/src/layouts/AppShell.tsx`,加 state + Modal 渲染:
```tsx
import { useState } from 'react';
import { ProfileModal } from '@/components/ProfileModal';

export function AppShell() {
  // ... existing ...
  const [profileOpen, setProfileOpen] = useState(false);
  // ...

  const userMenu = {
    items: [
      { key: 'profile', icon: <EditOutlined />, label: '修改资料', onClick: () => setProfileOpen(true) },
      { key: 'me', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/me') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: logout, danger: true },
    ],
  };

  return (
    <Layout ...>
      <Header>
        ...
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      </Header>
      ...
    </Layout>
  );
}
```

import 头加 EditOutlined.

- [ ] **Step 6.5: typecheck + 重启浏览器测**

```bash
cd apps/web && npx tsc --noEmit
```

浏览器:登 sysadmin → 点头像 → 「修改资料」→ Modal 出现 → 改昵称保存 → 顶栏立即同步。

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/components/ProfileModal.tsx apps/web/src/layouts/AppShell.tsx apps/web/src/api/users.ts apps/web/src/stores/auth.ts
git commit -m "feat(web): ProfileModal 修改资料 / 密码 + AppShell dropdown 接入"
```

—

## Task 7:Admin UsersPage 真 CRUD

**Files:**
- Modify: `apps/web/src/pages/admin/UsersPage.tsx`(整页重写)
- Create: `apps/web/src/components/UserFormModal.tsx`(新建/编辑用户)
- Create: `apps/web/src/components/ResetUserPasswordModal.tsx`
- Create: `apps/web/src/components/ChangeRoleModal.tsx`
- Modify: `apps/web/src/api/users.ts`(加 5 admin fetchers)

—

- [ ] **Step 7.1: api/users.ts 加 admin fetchers**

```ts
import type { CreateUserInput, UpdateUserInput, UserRoleCode } from '@pop/shared-types';

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const r = await fetch('/api/v1/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'create fail');
  }
  return (await r.json()).data;
}

export async function updateUserById(id: string, input: UpdateUserInput): Promise<UserListItem> {
  const r = await fetch(`/api/v1/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'update fail');
  }
  return (await r.json()).data;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword }),
  });
  if (!r.ok) throw new Error('reset password fail');
}

export async function changeUserRole(id: string, roleCode: UserRoleCode): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ roleCode }),
  });
  if (!r.ok) throw new Error('change role fail');
}

export async function deleteUser(id: string): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'delete fail');
  }
}

export async function restoreUser(id: string): Promise<UserListItem> {
  const r = await fetch(`/api/v1/users/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('restore fail');
  return (await r.json()).data;
}
```

- [ ] **Step 7.2: UserFormModal.tsx**

```tsx
import { useEffect } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { UserRoleCode, type CreateUserInput } from '@pop/shared-types';
import { createUser, updateUserById, type UserListItem } from '@/api/users';

const ROLE_OPTIONS = [
  { label: '系统管理员', value: 'sys_admin' },
  { label: '负责人', value: 'lead' },
  { label: 'PMO', value: 'pmo' },
  { label: '属地 GA', value: 'local_ga' },
  { label: '中台 GA', value: 'central_ga' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: UserListItem | null;
  onSaved: () => void;
}

interface FormValues {
  username: string;
  displayName: string;
  email: string;
  password: string;
  roleCode: UserRoleCode;
}

export function UserFormModal({ open, onClose, editing, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({
          username: editing.username,
          displayName: editing.displayName,
          email: '',  // 不显示原 email,避免输入歧义
          password: '',
          roleCode: editing.roleCode as UserRoleCode,
        });
      }
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (vs: FormValues) =>
      editing
        ? updateUserById(editing.id, { displayName: vs.displayName, email: vs.email || undefined })
        : createUser(vs as CreateUserInput),
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      onSaved();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={editing ? '编辑用户' : '新建用户'}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(vs) => mutation.mutate(vs)}>
        <Form.Item label="用户名" name="username" rules={[{ required: true, max: 32 }]}>
          <Input disabled={!!editing} />
        </Form.Item>
        <Form.Item label="显示名称" name="displayName" rules={[{ required: true, max: 32 }]}>
          <Input />
        </Form.Item>
        <Form.Item label="邮箱" name="email" rules={[{ required: !editing, type: 'email', max: 128 }]}>
          <Input placeholder={editing ? '留空不修改' : ''} />
        </Form.Item>
        {!editing && (
          <Form.Item label="初始密码" name="password" rules={[{ required: true, min: 6, max: 64 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        )}
        {!editing && (
          <Form.Item label="角色" name="roleCode" rules={[{ required: true }]} initialValue="local_ga">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 7.3: ResetUserPasswordModal.tsx**

```tsx
import { Form, Input, Modal, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { resetUserPassword, type UserListItem } from '@/api/users';

interface Props {
  open: boolean;
  user: UserListItem | null;
  onClose: () => void;
}

interface FormValues { newPassword: string; confirm: string }

export function ResetUserPasswordModal({ open, user, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: (vs: FormValues) => resetUserPassword(user!.id, vs.newPassword),
    onSuccess: () => {
      message.success(`已重置 ${user?.username} 的密码`);
      form.resetFields();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  if (!user) return null;

  return (
    <Modal
      open={open}
      title={`重置密码 — ${user.displayName}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(vs) => mutation.mutate(vs)}>
        <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 6, max: 64 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirm"
          dependencies={['newPassword']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue('newPassword') === value
                  ? Promise.resolve()
                  : Promise.reject('两次密码不一致');
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 7.4: ChangeRoleModal.tsx**

```tsx
import { Form, Modal, Select, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { UserRoleCode } from '@pop/shared-types';
import { changeUserRole, type UserListItem } from '@/api/users';

const ROLE_OPTIONS = [
  { label: '系统管理员', value: 'sys_admin' },
  { label: '负责人', value: 'lead' },
  { label: 'PMO', value: 'pmo' },
  { label: '属地 GA', value: 'local_ga' },
  { label: '中台 GA', value: 'central_ga' },
];

interface Props {
  open: boolean;
  user: UserListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ChangeRoleModal({ open, user, onClose, onSaved }: Props) {
  const [form] = Form.useForm<{ roleCode: UserRoleCode }>();

  const mutation = useMutation({
    mutationFn: (vs: { roleCode: UserRoleCode }) => changeUserRole(user!.id, vs.roleCode),
    onSuccess: () => {
      message.success('角色已更新');
      onSaved();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  if (!user) return null;

  return (
    <Modal
      open={open}
      title={`改角色 — ${user.displayName}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ roleCode: user.roleCode }}
        onFinish={(vs) => mutation.mutate(vs)}
      >
        <Form.Item label="新角色" name="roleCode" rules={[{ required: true }]}>
          <Select options={ROLE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 7.5: UsersPage.tsx 重写**

```tsx
import { useState } from 'react';
import { Button, Modal, Segmented, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, TeamOutlined, UndoOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRoleCode } from '@pop/shared-types';
import { UserFormModal } from '@/components/UserFormModal';
import { ResetUserPasswordModal } from '@/components/ResetUserPasswordModal';
import { ChangeRoleModal } from '@/components/ChangeRoleModal';
import { deleteUser, fetchUsers, restoreUser, type UserListItem } from '@/api/users';

const { Title } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: '负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

const ROLE_COLOR: Record<string, string> = {
  sys_admin: 'magenta',
  lead: 'gold',
  pmo: 'blue',
  local_ga: 'green',
  central_ga: 'cyan',
};

type View = 'active' | 'trash';

export function UsersPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [changingRole, setChangingRole] = useState<UserListItem | null>(null);

  const active = useQuery({ queryKey: ['users', 'active'], queryFn: () => fetchUsers() });
  // 后端 list 不支持 withDeleted query — 这里只演示活跃 list
  // (要 trash 列表需要后端 list endpoint 加 withDeleted=true 支持,留 follow-up)

  const data = active.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => message.error(`删除失败: ${(e as Error).message}`),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreUser(id),
    onSuccess: () => {
      message.success('已还原');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleDelete = (u: UserListItem) => {
    Modal.confirm({
      title: `删除用户 ${u.displayName}?`,
      content: '软删除,可在回收站还原。',
      okText: '确认删除',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(u.id),
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理 ({data.length})</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setFormOpen(true); }}>
          新建用户
        </Button>
      </Space>

      <Table<UserListItem>
        dataSource={data}
        rowKey="id"
        loading={active.isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 120 },
          { title: '显示名', dataIndex: 'displayName', width: 140 },
          {
            title: '角色',
            dataIndex: 'roleCode',
            width: 120,
            render: (r: UserRoleCode | null) =>
              r ? <Tag color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Tag> : <Tag>无</Tag>,
          },
          {
            title: '操作',
            width: 280,
            render: (_, u) => (
              <Space size={4} wrap>
                <Button size="small" type="link" icon={<EditOutlined />}
                  onClick={() => { setEditing(u); setFormOpen(true); }}>编辑</Button>
                <Button size="small" type="link" icon={<TeamOutlined />}
                  onClick={() => setChangingRole(u)}>角色</Button>
                <Button size="small" type="link" icon={<KeyOutlined />}
                  onClick={() => setResetting(u)}>密码</Button>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}
                  onClick={() => handleDelete(u)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
      <ResetUserPasswordModal
        open={!!resetting}
        user={resetting}
        onClose={() => setResetting(null)}
      />
      <ChangeRoleModal
        open={!!changingRole}
        user={changingRole}
        onClose={() => setChangingRole(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
```

- [ ] **Step 7.6: typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
cd /Users/shaoziyuan/政策大图/.claude/worktrees/frosty-easley-88c5ed
git add apps/web/src/pages/admin/UsersPage.tsx apps/web/src/components/UserFormModal.tsx apps/web/src/components/ResetUserPasswordModal.tsx apps/web/src/components/ChangeRoleModal.tsx apps/web/src/api/users.ts
git commit -m "feat(web): 管理后台用户管理真 CRUD(create/edit/role/password reset/delete)"
```

—

## Task 8:e2e 浏览器验证 + push PR

- [ ] **Step 8.1: 浏览器场景脚本**

```
1. 打开 /login → 看到 username + password Form(不再是 5 角色按钮)
2. 输 sysadmin / pop2026 → 登录 → 派发到 /admin/users
3. 看到 5 用户表格 + 「新建用户」按钮
4. 点头像 → 「修改资料」→ Modal 打开
   a. 改昵称「老 sysadmin」→ 保存 → 顶栏立即同步
   b. 切「修改密码」→ 旧 pop2026 / 新 newpass / 确认 newpass → 保存
5. 退出登录 → 用 newpass 登录验证
6. 改回 pop2026
7. /admin/users 给 lead 重置密码为 leadpass
8. 退出 → 以 lead/leadpass 登录 → 看 lead 默认首屏 OK
9. /admin/users 创建 newbie 用户 → 用 newbie 登录测试
10. preview_console_logs 检查无 error
```

- [ ] **Step 8.2: 回归保护**

- 现有 sysadmin token 调任意业务接口仍 OK(JWT 沿用)
- 现有 32 visits / 3 pins / 主题 / 涂层 / 浮窗 都能用

- [ ] **Step 8.3: Push + 开 PR**

```bash
git push -u origin claude/real-login

gh pr create --title "feat: V0.7 patch · 真登录(密码 bcrypt)+ 个人资料 + 用户管理" --body "..."
```

—

## 复用 / 注意事项

- **bcrypt 10 rounds**:与 NestJS 文档一致
- **统一 401 文案**:用户名错 = 密码错(防枚举)
- **「未启用」单独提示**:hash=NULL 时区分,引导联系管理员
- **password_hash 永不进 DTO**:Controller 用 stripPasswordHash helper
- **不强踢 session**:改密码不 invalidate 现有 JWT(demo 简单)
- **角色单选**:user_roles 表 unique(userId),改 role 走 DELETE + INSERT
- **唯一管理员保护**:删唯一 sys_admin 抛 400(防误删自锁)
- **复用 PIN_DELETE_ALLOWED_ROLES 模式**:USERS_ADMIN_ALLOWED_ROLES 白名单
- **不动 /me 页面**:dropdown 加新「修改资料」Modal 入口,/me 留 follow-up
- **TODO**:自助注册 / 忘记密码 / 用户管理审计日志
