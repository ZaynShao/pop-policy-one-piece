# DNS 配置交接 · xiaojuenergy.com

> **目的**:把 `xiaojuenergy.com` 解析到我们的服务器 `47.238.72.38`,用于 POP 系统(政策 One Piece)的访问入口。
> **当前状态**:域名已注册(阿里云万网),但 A 记录未生效 — 多个 DNS resolver 都查不到 IP。
> **执行人**:有阿里云万网账号权限的同事(可以登录 https://wanwang.aliyun.com 操作 DNS)。
> **预计耗时**:5 分钟操作 + 5 分钟生效等待。

---

## 1. 现状诊断

### 1.1 域名注册信息

```
域名:xiaojuenergy.com
注册商:阿里云万网(Alibaba Cloud / HiChina)
NS 服务器:dns23.hichina.com / dns24.hichina.com   ← 即阿里云 DNS 系统
```

### 1.2 当前 DNS 状态(2026-04-30 测试)

```bash
$ dig +short xiaojuenergy.com A @223.5.5.5     # 阿里云 DNS 直查
(空,无返回)

$ dig +short xiaojuenergy.com A @1.1.1.1        # Cloudflare DNS 验证
(空)

$ dig +short ggswpop.xyz A                       # 对照组,同样阿里云 DNS,已配
47.238.72.38                                     # ✓ 这个能正常返回
```

**结论**:`xiaojuenergy.com` 在权威 NS 上**根本没有 A 记录**。这不是 DNS 缓存或传播延迟问题(权威 DNS 也查不到)。

### 1.3 浏览器访问 http://xiaojuenergy.com 看到 409 的解释

阿里云 DNS hijack:当域名在阿里云注册但**没有解析记录**时,阿里云会把这个域名劫持到一个默认页(经 Cloudflare 提供),所以 curl 看到 `Cf-Ray` header + `409 Conflict`。**这不是我们的服务在响应**,是阿里云的「未配置解析」泊车页。

---

## 2. 目标配置

在阿里云万网后台,给 `xiaojuenergy.com` 添加**1 条 A 记录**:

| 字段 | 值 |
|---|---|
| 记录类型 | **A** |
| 主机记录 | **@**(单字符 @,不是 www,不是空,不是 *) |
| 解析线路 | 默认 |
| 记录值 | **47.238.72.38** |
| TTL | **600**(秒,默认即可) |

> **不要**添加 `www.xiaojuenergy.com`(项目 owner 已确认不用 www 子域)。
> **不要**添加 CNAME(这是根域,只能用 A 记录)。

---

## 3. 操作步骤(给阿里云后台操作人员)

1. 登录 https://wanwang.aliyun.com(阿里云万网域名控制台)
2. 左侧菜单「**域名列表**」
3. 找到 `xiaojuenergy.com` 那一行,点行末「**解析**」按钮(注意是「解析」,不是「管理」)
4. 进入解析列表后,点「**添加记录**」
5. 按上面 §2 的表格填字段
6. 点「**确认**」保存
7. 状态列应该显示「**正常**」(绿色对勾)

---

## 4. 验证(操作人 / AI 都可以跑)

加完记录后,**等 5 分钟**(让 TTL 600 生效),然后跑:

```bash
# 1) 阿里云 DNS 直查 — 应立即返回 47.238.72.38
dig +short xiaojuenergy.com A @223.5.5.5
# 期望输出:47.238.72.38

# 2) 全球 DNS 验证(Cloudflare 1.1.1.1)
dig +short xiaojuenergy.com A @1.1.1.1
# 期望输出:47.238.72.38(可能慢 30-60 秒生效)

# 3) HTTP 连通性
curl -sI http://xiaojuenergy.com | head -3
# 期望:HTTP/1.1 308 Permanent Redirect(Caddy 自动 80→443 跳转)
# 或:HTTP/1.1 200 OK(如果 Caddy 还没配 443 块,先回 200)

# 4) 跟对照组 ggswpop.xyz 比对(应该一致)
dig +short ggswpop.xyz A
# 47.238.72.38(已知 work)
```

**如果以上 1) 还是返回空**:
- 检查阿里云后台 A 记录的「状态」列是否是「正常」
- 检查主机记录是否填的 `@`(很多新手填空字符串会失败)
- 检查记录值有没有多余空格
- 截图阿里云后台的解析列表页,发回项目 owner

---

## 5. 上下文 · 部署架构(给 AI 助手参考)

> 这一节用于让同事的 AI 理解为什么要这样配,如果同事自己懂可以跳过。

```
[浏览器/手机]
      ↓ HTTPS
[xiaojuenergy.com → 47.238.72.38 (阿里云香港 ECS)]
      ↓
[Caddy :80/:443]    ← 自动 ACME Let's Encrypt(配 A 记录后会自动签证书)
      ↓
   ├─ /api/* → reverse_proxy 127.0.0.1:3001 (NestJS pm2)
   └─ /*     → file_server /opt/pop/apps/web/dist (静态)
[PostgreSQL :5432, 本机]
```

- **服务器位置**:阿里云**香港**(域名解析到境外,**.com 域名不需要 ICP 备案**就能在国内访问)
- **HTTPS 必要性**:移动端使用麦克风录音(`getUserMedia`)需要 secure context(HTTPS),否则浏览器拒绝授权 — 所以加这个域名 + Let's Encrypt 是项目演示的必要前提
- **平行域名**:`ggswpop.xyz` 已经配好(同套 NS,A 记录指向同 IP),保留作 backup,**不影响新域名加 A 记录**

---

## 6. 后续(项目 owner 这边跟进)

DNS 生效后,项目 owner 会:
1. SSH 47.238.72.38,改 `/etc/caddy/Caddyfile` 加 `xiaojuenergy.com` 域名块
2. `caddy reload` — Caddy 自动向 Let's Encrypt 申请证书(需要 80 端口可达,我们 Caddy 已在监听)
3. 验证 `https://xiaojuenergy.com/api/v1/health` 返回 `{"status":"ok"}`
4. 演示链接切换到 `https://xiaojuenergy.com/m/visit/new`

**操作人不需要在服务器上做任何事**,只在阿里云万网后台加 1 条 A 记录即可。

---

## 7. 常见错误对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| `dig` 仍返回空,等了 30 分钟 | A 记录没正确保存 | 重新进阿里云后台检查记录状态 |
| `dig` 返回 IP 但 `curl` 超时 | 服务器 80/443 端口不通 | 联系项目 owner 检查 Caddy 状态 |
| `dig` 返回 IP 但浏览器显示「证书错误」 | Caddyfile 没加这个域名块 | 通知项目 owner 改 Caddyfile + reload |
| 阿里云后台找不到「解析」按钮 | 域名是阿里云**云解析 DNS**(不是万网默认 DNS) | 切到 https://dns.console.aliyun.com 控制台 |
| 看到 NS 不是 dns23/24.hichina.com | 域名转 NS 到第三方(Cloudflare 等) | 在第三方 DNS 控制台加记录,不是阿里云 |

---

## 附:服务器自身已有配置(只读参考,操作人无需改)

```
主机:阿里云香港 ECS, 公网 IP 47.238.72.38
SSH:配过免密(项目 owner 有访问权)
反代:Caddy 2.x, 配置 /etc/caddy/Caddyfile, ACME 自动开
后端:NestJS via pm2, port 3001, 名字 'pop-api'
静态:Nest build 输出 + Vite build 输出在 /opt/pop/
DB:PostgreSQL 16, port 5432, 用户 pop, 库 pop
环境变量:/opt/pop/.env(MINIMAX_API_KEY / ALI_NLS_APP_KEY / ALI_NLS_TOKEN 等)
```

---

**联系**:配置过程中任何问题,直接发以下信息给项目 owner:
- 阿里云后台「解析列表」页面截图
- `dig +short xiaojuenergy.com A @223.5.5.5` 命令的输出
- 你在哪一步卡住了
