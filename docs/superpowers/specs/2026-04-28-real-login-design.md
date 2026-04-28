# V0.7 patch · 真登录(用户名+密码)+ 个人资料 + 用户管理 · 设计 spec

> 状态:brainstorm 已收口(2026-04-28),拆 plan + 跑 subagent

—

## Context

当前登录是"假 SSO":`POST /auth/login` 只收 username,后端按 username 直接发 JWT,前端登录页 5 个角色按钮一键登录。注释里写"V0.5 换真 OIDC"。

本期落实**最小可信真登录**:用户名 + 密码 + bcrypt 校验。删 4 个 demo 用户登录入口(DB 里仍保留给 visits/pins FK,但 password_hash=NULL 拒绝登录),只 sysadmin 默认密码 `pop2026` 可登。sysadmin 登录后通过用户管理 UI 给其他人设密码。

本期同时落实:
- 头像下拉「修改资料」Modal(改 displayName + 改密码)
- 管理后台「用户管理」真实 CRUD(create / list / 改 role / 设密码 / 软删)

—

## 核心决策(brainstorm 已逐项拍)

**凭证 + seed**

1. **凭证**:用户名 + 密码(bcrypt 10 rounds)— 不做邮箱、OTP、OIDC
2. **seed 策略**:5 个 seed 用户**全保留 DB 记录**(给 32 visits + 3 pins FK 完整性)
3. **password_hash 初值**:仅 sysadmin 设 `bcrypt('pop2026')`,其他 4 个 NULL
4. **NULL hash 处理**:login 收到 NULL hash 拒绝 + 提示「用户未启用,请联系管理员设置密码」

**API 边界**

5. **个人资料**:登录用户改自己的 displayName,改自己的 password(必须输旧密码校验)
6. **管理员越权**:sysadmin 重置任意用户密码不需要旧密码(admin override)
7. **创建用户**(sysadmin 专属):必填 username/displayName/email/role/password
8. **软删**:沿用 deletedAt 字段(users 表已有 @DeleteDateColumn),不级联 visits/pins

**JWT + Session**

9. **沿用现有 JWT**:不改 expire / refresh,改密码不强踢现有 session(demo 简单)
10. **password_hash 永不返回**:DTO 严格剥离

**UI**

11. **登录页**:5 角色按钮换成 username + password 表单 + 「登录」按钮 + 提示「请联系管理员获取账号」(不做注册入口)
12. **头像下拉**:加新条目「修改资料」→ ProfileModal(在「个人中心」之上)
13. **ProfileModal**:Tab 二段「基本信息」(改 displayName) / 「修改密码」(旧 + 新 + 确认)
14. **/admin/users**:Stub 替换为真表格 — 列(username / displayName / email / role / status / 操作)+ 新建按钮 + 编辑/重置密码/软删 actions

—

## 用户场景脚本(主流程 + 错误路径)

```
[1] 启动后端 + 跑 migration → users 表多 password_hash 列;sysadmin 自动哈希 pop2026
[2] 浏览器 /login → 看到 username + password 表单
[3] 输 sysadmin / pop2026 → 登录成功 → 派发到 /admin/users(sysadmin 默认首屏)
[4] 点头像 → 下拉「修改资料」→ Modal 打开
    a. 「基本信息」tab 改昵称「老 sysadmin」→ 保存 → 顶栏 avatar tooltip 立刻更新
    b. 「修改密码」tab 输 旧 pop2026 / 新 newpass123 / 确认 newpass123 → 保存
       → 退出 → 重新登录验证新密码可用
[5] sysadmin 进 /admin/users → 看到 5 个用户表格,sysadmin 行 status=active 其他 hash 状态显示
    a. 点「重置密码」给 lead → 输新密码 → 保存
    b. 退出 sysadmin → 用 lead / 新密码 登录 → 进入 lead 默认首屏
[6] 「新建用户」按钮 → modal 填 username/displayName/email/role/initial_password → 保存
    → 表格多 1 行 → 用新用户登录测试
```

**错误路径 6 个**

```
[X1] 错误密码:输 wrong → 401「用户名或密码错误」
[X2] 用户未设密码:输 lead / 任意 → 401「用户未启用,请联系管理员」
[X3] 用户已软删:输 deleted_user → 401「用户名或密码错误」(不暴露已删信息)
[X4] 改密码旧密码错:401「旧密码错误」
[X5] 新密码 < 6 位:400「密码至少 6 位」
[X6] 非 sysadmin 调 /admin/users:403「需要管理员权限」(沿用 RBAC 白名单)
```

—

## DB Migration

文件:`apps/api/src/database/migrations/{ts}-AddUserPasswordHash.ts`

```sql
-- 1. 加 password_hash 列(nullable)
ALTER TABLE users ADD COLUMN password_hash VARCHAR(256) NULL;

-- 2. 给 sysadmin 设密码(bcrypt('pop2026', 10))
-- 这一步在 migration 里用 bcrypt 库执行(JS migration,不用 SQL)
UPDATE users SET password_hash = $1 WHERE username = 'sysadmin';
```

**Migration 逻辑**:

```ts
import * as bcrypt from 'bcrypt';

public async up(qr: QueryRunner): Promise<void> {
  await qr.query('ALTER TABLE "users" ADD COLUMN "password_hash" varchar(256) NULL');
  const hash = await bcrypt.hash('pop2026', 10);
  await qr.query('UPDATE "users" SET "password_hash" = $1 WHERE "username" = $2', [hash, 'sysadmin']);
}

public async down(qr: QueryRunner): Promise<void> {
  await qr.query('ALTER TABLE "users" DROP COLUMN "password_hash"');
}
```

—

## 后端 API

### 1. 改造 — `POST /api/v1/auth/login`

**LoginDto** 加 password 字段:
```ts
@IsString() @MinLength(1) @MaxLength(32) username!: string;
@IsString() @MinLength(6) @MaxLength(64) password!: string;
```

**AuthService.login** 流程:
```ts
async login(dto: LoginDto): Promise<LoginResponseDto> {
  const user = await this.usersService.findByUsername(dto.username);
  if (!user) throw new UnauthorizedException('用户名或密码错误');
  if (!user.passwordHash) throw new UnauthorizedException('用户未启用,请联系管理员');
  const ok = await bcrypt.compare(dto.password, user.passwordHash);
  if (!ok) throw new UnauthorizedException('用户名或密码错误');
  // 沿用现有 JWT 签发逻辑 ...
}
```

User Entity 加 `password_hash` 列(对应 migration):
```ts
@Column({ type: 'varchar', length: 256, nullable: true, name: 'password_hash' })
passwordHash!: string | null;
```

### 2. 新增 — Profile API(自己改自己)

**PUT /api/v1/users/me** — 改 displayName
```ts
@Body() dto: { displayName: string }  // 1-32 chars
@CurrentUser() user
return { data: updatedUser }  // 不含 passwordHash
```

**PUT /api/v1/users/me/password** — 改密码
```ts
@Body() dto: { oldPassword: string; newPassword: string }
- 校验 oldPassword bcrypt match → 否则 401
- newPassword min 6 max 64
- bcrypt hash newPassword,UPDATE users.password_hash
- 返回 204
```

### 3. 新增 — User Management API(sysadmin only)

权限白名单 `USERS_ADMIN_ALLOWED_ROLES = Set([UserRoleCode.SysAdmin])`(对称 Pin/Visit 软删)。

**POST /api/v1/users** — 新建用户
```ts
@Body() dto: {
  username: string;       // 1-32, unique
  displayName: string;    // 1-32
  email: string;          // valid email, unique
  password: string;       // min 6
  roleCode: UserRoleCode;
}
- 校验 username/email unique
- bcrypt hash password → INSERT users
- INSERT user_roles(userId, roleCode, assignedBy=sysadmin)
- 返回 201 + new user(无 passwordHash)
```

**PUT /api/v1/users/:id** — 改 displayName / email
```ts
@Body() dto: { displayName?: string; email?: string }
- email 改时校验 unique
- 不允许改 username(unique 业务标识)
- 不允许通过此 endpoint 改 password / role(走专用)
```

**PUT /api/v1/users/:id/password** — admin 重置任意用户密码
```ts
@Body() dto: { newPassword: string }  // min 6
- 不需要 oldPassword(admin override)
- bcrypt hash → UPDATE password_hash
- 204
```

**PUT /api/v1/users/:id/role** — 改用户 role
```ts
@Body() dto: { roleCode: UserRoleCode }
- 删原 user_roles 行
- INSERT 新 user_roles 行(unique constraint 保护)
- 返回 200 + user with new role
```

**DELETE /api/v1/users/:id** — 软删
```ts
- 不允许删自己(@CurrentUser id === param id 时 400)
- 不允许删唯一 sysadmin(数据库里 sys_admin 只剩 1 个时 400)
- repo.softRemove → deleted_at = now()
```

### 4. 共享类型(packages/shared-types)

`packages/shared-types/src/dtos/user.dto.ts` 新增:
```ts
export interface UpdateProfileInput { displayName: string }
export interface ChangePasswordInput { oldPassword: string; newPassword: string }
export interface CreateUserInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  roleCode: UserRoleCode;
}
export interface UpdateUserInput { displayName?: string; email?: string }
export interface ResetPasswordInput { newPassword: string }
```

LoginDto 已存在,加 password 字段。

—

## 前端 UI

### 1. `apps/web/src/pages/Login.tsx`(改 — 大改)

去掉 ROLES 数组 + 5 角色按钮。换成:
```tsx
<Form onFinish={handleLogin}>
  <Form.Item name="username" rules={[{ required: true }]}>
    <Input prefix={<UserOutlined />} placeholder="用户名" />
  </Form.Item>
  <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
  </Form.Item>
  <Form.Item>
    <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
  </Form.Item>
</Form>
<Text type="secondary">请联系管理员获取账号</Text>
```

提交时 POST /auth/login 带 username + password,沿用现有 setSession 流程。

### 2. `apps/web/src/components/ProfileModal.tsx`(新)

Tab 二段:
- 「基本信息」:displayName Input(已填当前值)+ 保存 → PUT /users/me
- 「修改密码」:旧密码 / 新密码 / 确认新密码 + 保存 → PUT /users/me/password

成功后 `useAuthStore.updateUser({ displayName })` 同步前端 state。

### 3. `apps/web/src/layouts/AppShell.tsx`(改)

userMenu 加新条目:
```ts
{ key: 'profile', icon: <EditOutlined />, label: '修改资料', onClick: () => setProfileModalOpen(true) },
{ key: 'me',      icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/me') },
{ type: 'divider' },
{ key: 'logout',  icon: <LogoutOutlined />, label: '登出', onClick: logout, danger: true },
```

加 state + 渲染 `<ProfileModal open={...} />`。

### 4. `apps/web/src/pages/admin/UsersPage.tsx`(改 — 替换 stub)

```tsx
- Table:列(username / displayName / email / role 标签 / status / 操作)
- 顶部「新建用户」按钮 + 「软删过滤器」Segmented [活跃 / 回收站]
- 操作列:编辑 / 改 role / 重置密码 / 软删 / 还原(对 trash 行)
- 4 个 Modal:UserFormModal(新建/编辑)/ ResetPasswordModal / ChangeRoleModal
```

### 5. `apps/web/src/api/users.ts`(改)

加 fetchers:
- `createUser(input: CreateUserInput)`
- `updateUser(id, input: UpdateUserInput)`
- `resetUserPassword(id, newPassword)`
- `changeUserRole(id, roleCode)`
- `deleteUser(id)`
- `restoreUser(id)`

加 self-fetchers:
- `updateProfile(displayName)`
- `changePassword(old, new)`

### 6. `apps/web/src/stores/auth.ts`(改)

加 `updateUser(patch: Partial<User>)` action(让 ProfileModal 改 displayName 后顶栏 sync)。

—

## 状态切换 / 角色派发不变

`role-home.ts` 沿用:sysadmin → /admin/users / 其他 → /map/local。改密码不影响 role 派发。

—

## 关键文件清单

```
后端(改 + 新)
  apps/api/src/database/migrations/{ts}-AddUserPasswordHash.ts  [新]
  apps/api/src/users/entities/user.entity.ts                    [改:加 passwordHash]
  apps/api/src/users/users.service.ts                           [改:加 6 个方法]
  apps/api/src/users/users.controller.ts                        [改:加 self + admin endpoints]
  apps/api/src/users/dtos/                                      [新:5 个 DTO 文件]
  apps/api/src/auth/dto/login.dto.ts                            [改:加 password]
  apps/api/src/auth/auth.service.ts                             [改:bcrypt verify]
  apps/api/src/users/__tests__/users.service.spec.ts            [新:核心 case]
  package.json                                                  [改:加 bcrypt + @types/bcrypt 依赖]

前端(改 + 新)
  apps/web/src/pages/Login.tsx                              [改:换成 Form]
  apps/web/src/components/ProfileModal.tsx                  [新]
  apps/web/src/layouts/AppShell.tsx                         [改:加 ProfileModal 触发]
  apps/web/src/pages/admin/UsersPage.tsx                    [改:替换 stub]
  apps/web/src/components/UserFormModal.tsx                 [新]
  apps/web/src/components/ResetPasswordModal.tsx            [新]
  apps/web/src/components/ChangeRoleModal.tsx               [新]
  apps/web/src/api/users.ts                                 [改:加 8 个 fetcher]
  apps/web/src/stores/auth.ts                               [改:加 updateUser action]

shared-types
  packages/shared-types/src/dtos/user.dto.ts                [改 / 新建:加 6 个 DTO]
  packages/shared-types/src/dtos/auth.dto.ts                [改:LoginInput 加 password]
```

—

## 复用 / 注意事项

- **bcrypt 库**:NestJS 生态成熟,用 `bcrypt`(C++ 绑定),package.json 加 deps + devDeps
- **migration 内 await bcrypt.hash**:async migration up,fine
- **password_hash 永不进 DTO**:User entity 字段 + service 返回 entity 时 `delete user.passwordHash`(或用 select 只取需要字段)
- **JWT payload 不含 passwordHash**:沿用现有,改密码不踢 session(demo 简单)
- **角色单选**:user_roles 表 unique(user_id),改 role 走 DELETE + INSERT(不更新)
- **复用 PIN_DELETE_ALLOWED_ROLES 模式**:USERS_ADMIN_ALLOWED_ROLES = Set([sys_admin])
- **/me 页面保留**:dropdown 加「修改资料」Modal + 留「个人中心」入口(/me 暂不动,follow-up 加完整 tab)
- **TODO 项**(写进 PRD/roadmap):
  - 自助注册(POST /auth/register)
  - 忘记密码(发邮件 / 短信)
  - 用户管理审计日志(谁改了谁的密码 / role)
