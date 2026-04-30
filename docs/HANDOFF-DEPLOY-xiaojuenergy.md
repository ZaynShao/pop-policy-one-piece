# 部署交接 · xiaojuenergy.com 上线 HTTPS

> **目的**:把域名 `xiaojuenergy.com` 解析 + 反代到我们的服务器 `47.238.72.38`,自动拿 Let's Encrypt 证书,让浏览器/手机能通过 `https://xiaojuenergy.com` 访问 POP 系统。
>
> **执行人**:同事(可登录阿里云万网 + 收到项目 owner 点对点发的 SSH 凭证)。
>
> **预计耗时**:DNS 5 分钟操作 + 5 分钟生效 + Caddy 配置 + cert 申请 ≈ 15-20 分钟。
>
> **凭证**:本文档**不包含** SSH 私钥/密码 — 由项目 owner 通过安全渠道(1Password 共享 / 当面 / 端到端加密 IM)单独发送给操作人。

---

## 0. 项目背景(给 AI 助手 30 秒理解)

**POP(政策 One Piece)** — GA 团队属地政策大地图。NestJS + PostgreSQL + React monorepo。
- 已上线模块:大盘地图 / Pin 闭环 / Visit 闭环 / 蓝点 / 管理后台 / 移动端语音录入(刚加完)
- **HTTPS 是硬需求**:移动端用浏览器麦克风(`navigator.mediaDevices.getUserMedia`)需要 secure context,HTTP 模式下浏览器拒绝授权 — 这是这次上线 HTTPS 的核心动机
- 服务器在阿里云**香港**:`.com` 域名解析到香港 IP **不需要 ICP 备案**

---

## 1. 任务总览(3 步)

| # | 步骤 | 谁做 | 用什么权限 |
|---|---|---|---|
| 1 | 在阿里云万网加 A 记录:`xiaojuenergy.com → 47.238.72.38` | 操作人 | 阿里云万网账号 |
| 2 | SSH 47.238.72.38,改 `/etc/caddy/Caddyfile` 加域名块,`caddy reload` | 操作人 | SSH 凭证(owner 单独给) |
| 3 | 跑验证命令链 + 浏览器烟测 | 操作人 | 任何机器即可 |

---

## 2. 现状诊断(2026-04-30)

### 2.1 域名注册

```
域名:xiaojuenergy.com
注册商:阿里云万网(Alibaba Cloud / HiChina)
NS 服务器:dns23.hichina.com / dns24.hichina.com   ← 阿里云 DNS
```

### 2.2 当前 DNS 状态

```bash
$ dig +short xiaojuenergy.com A @223.5.5.5     # 阿里云 DNS 直查
(空,无返回)

$ dig +short ggswpop.xyz A                     # 对照组,同 NS,已 work
47.238.72.38                                   # ✓
```

**结论**:`xiaojuenergy.com` 在阿里云权威 NS 上**根本没有 A 记录**。这不是缓存延迟问题。

### 2.3 浏览器看到 `Cf-Ray + 409 Conflict` 的原因

阿里云 DNS 对未配置解析的域名,默认重定向到一个 Cloudflare 上的「未配置」泊车页 — 不是我们的服务在响应。配好 A 记录后这个页面就消失了。

---

## 3. STEP 1 — 添加 DNS A 记录

### 3.1 操作步骤

1. 登录 https://wanwang.aliyun.com (阿里云万网)
2. 左侧「**域名列表**」
3. 找到 `xiaojuenergy.com` → 点行末「**解析**」按钮
4. 点「**添加记录**」
5. 字段填入:

   | 字段 | 值 |
   |---|---|
   | 记录类型 | **A** |
   | 主机记录 | **@**(单字符 @,代表根域;**不**填 www / 空 / *) |
   | 解析线路 | 默认 |
   | 记录值 | **47.238.72.38** |
   | TTL | **600** |

6. 点「**确认**」保存,状态列应显示「**正常**」(绿色对勾)

> ⚠ **不要**加 `www.xiaojuenergy.com`(项目 owner 已确认不用 www 子域)。
> ⚠ **不要**用 CNAME(根域只能 A 记录)。

### 3.2 验证 DNS 生效

等 5 分钟,跑:

```bash
dig +short xiaojuenergy.com A @223.5.5.5
# 期望:47.238.72.38

dig +short xiaojuenergy.com A @1.1.1.1
# 期望:47.238.72.38(可能晚 30-60 秒)
```

如果 5 分钟后还是空 → 回阿里云后台检查记录状态,或截图发回 owner。

**DNS 不生效不要进 STEP 2**(Caddy 自动 ACME 需要域名能解析才能拿到证书)。

---

## 4. STEP 2 — 服务器配置 Caddy

### 4.1 准入

操作人会收到 owner 通过安全渠道发来的:
- SSH 用户名(预期是 `root`)
- 服务器 IP `47.238.72.38`(已知)
- 私钥文件 `pop-server.pem` 或者密码

放好私钥(假设 `~/.ssh/pop-server.pem`),设权限:
```bash
chmod 600 ~/.ssh/pop-server.pem
```

测试登录:
```bash
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'whoami && date'
# 期望:root 用户名 + 当前时间
```

如果连不上 → 防火墙问题,联系 owner。

### 4.2 看一眼当前 Caddyfile

**先 cat 看现状**(不要直接改,先理解):

```bash
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'cat /etc/caddy/Caddyfile'
```

**预期看到的格式**(2 种之一):

**形式 A — 已经按域名分块**(已经为 ggswpop.xyz 配了 HTTPS):
```caddyfile
ggswpop.xyz {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}
```

**形式 B — 简单 :80 块**(还没切 HTTPS):
```caddyfile
:80 {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}
```

### 4.3 修改 Caddyfile

**目标**:让 `xiaojuenergy.com` 也走 HTTPS,反代相同的 backend。

**A) 如果是形式 A**(已分块):**复制 ggswpop.xyz 的整个 block,把域名换成 `xiaojuenergy.com`**:

```caddyfile
# 既有 ggswpop.xyz block(保留作 backup)
ggswpop.xyz {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}

# 新加 xiaojuenergy.com block
xiaojuenergy.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}
```

**B) 如果是形式 B**(只有 :80 块):**改成 2 个并列域名块**:

```caddyfile
xiaojuenergy.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}

# 旧 IP 直接访问,可选保留(给老书签用,Caddy 不会拿 cert)
:80 {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /opt/pop/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}
```

> Caddy 的语法:**只要 block 头部是域名(如 `xiaojuenergy.com {`),Caddy 会自动申请 Let's Encrypt 证书,自动 80 → 443 跳转**,不需要手写 ACME 配置。

修改方法(SSH 上服务器):

```bash
# 1. 备份当前配置
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d-%H%M)'

# 2. 编辑(用 vim/nano,也可以 scp 修改后传上去)
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'vim /etc/caddy/Caddyfile'
# 加上面 §4.3 的 xiaojuenergy.com 块

# 3. 校验语法(Caddy 自带 fmt + validate)
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'caddy validate --config /etc/caddy/Caddyfile'
# 期望:Valid configuration
```

如果 validate 报错 → 不要 reload,先看错误改回来。

### 4.4 Reload Caddy

```bash
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'systemctl reload caddy'
# 或如果 Caddy 不是 systemd 管的:
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'caddy reload --config /etc/caddy/Caddyfile'
```

reload 是 zero-downtime,服务不中断。

### 4.5 观察 ACME 自动签证书

```bash
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 'journalctl -u caddy -n 50 --no-pager | grep -E "(xiaojuenergy|certificate|tls)"'
```

期望看到类似:
```
INFO  tls.obtain  acquiring lock  {"identifier": "xiaojuenergy.com"}
INFO  tls.obtain  certificate obtained successfully  {"identifier": "xiaojuenergy.com"}
```

**如果失败常见原因**:
- DNS 还没生效(STEP 1 验证那一步偷懒了)
- 服务器 80 端口被防火墙拦了(阿里云安全组没开 80,或者 ufw 没开)
- 域名指错 IP(检查 dig 输出)

---

## 5. STEP 3 — 验证

### 5.1 命令验证

```bash
# 1) DNS 解析
dig +short xiaojuenergy.com A
# 期望:47.238.72.38

# 2) HTTP 80 → 自动跳转 443(Caddy 默认行为)
curl -sI http://xiaojuenergy.com | head -3
# 期望:HTTP/1.1 308 Permanent Redirect, Location: https://xiaojuenergy.com/

# 3) HTTPS 拿 cert
curl -sI https://xiaojuenergy.com | head -3
# 期望:HTTP/2 200(或 404/302 取决于 / 路径)

# 4) API health endpoint
curl -s https://xiaojuenergy.com/api/v1/health
# 期望:{"status":"ok"}(或 NestJS 的 health 实际返回值)

# 5) 证书签发方
echo | openssl s_client -connect xiaojuenergy.com:443 -servername xiaojuenergy.com 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
# 期望:issuer=...Let's Encrypt..., subject=CN=xiaojuenergy.com, notAfter=约 90 天后
```

### 5.2 浏览器烟测

1. 打开 https://xiaojuenergy.com — 应该看到登录页(POP 系统),浏览器地址栏**有锁标 + 没有「不安全」警告**
2. 用 sys_admin 账号登录(凭证由 owner 提供) → 进入 `/console`
3. 移动端 https://xiaojuenergy.com/m/visit/new — 应该能直接调起浏览器麦克风权限请求(不再需要 Chrome insecure-origin 例外)

如果上面任何一步挂 → 看 §6 回滚 + 联系 owner。

---

## 6. 回滚预案

如果 Caddy reload 后服务挂了(整个站点 502 / 不响应):

```bash
# 1) 恢复备份
ssh -i ~/.ssh/pop-server.pem root@47.238.72.38 \
  'cp /etc/caddy/Caddyfile.bak.YYYYMMDD-HHMM /etc/caddy/Caddyfile && systemctl reload caddy'

# 2) 验证 ggswpop.xyz 老链路恢复(应该回到改之前的状态)
curl -sI http://ggswpop.xyz
```

DNS 改动也可以回滚(阿里云后台删掉那条 A 记录),但通常不需要。

---

## 7. 附录 · 服务器架构(只读 context)

```
[浏览器/手机] ─── HTTPS ───> xiaojuenergy.com → 47.238.72.38 (阿里云香港 ECS)
                                   │
                                   ▼
                             Caddy :80/:443
                                   │
                          ┌────────┴─────────┐
                          ▼                  ▼
                   /api/*               /*  (静态文件)
                   reverse_proxy        root /opt/pop/apps/web/dist
                   127.0.0.1:3001       SPA fallback to /index.html
                          │
                          ▼
                  NestJS via pm2
                  (pm2 进程名:pop-api)
                          │
                          ▼
                  PostgreSQL :5432
                  (用户:pop, 库:pop)
```

**关键路径**(同事/AI 排查时参考):
- Caddy 配置:`/etc/caddy/Caddyfile`
- Caddy 日志:`journalctl -u caddy -f`
- pm2 状态:`pm2 list` / `pm2 logs pop-api --lines 50`
- 前端 dist:`/opt/pop/apps/web/dist`
- 后端 dist:`/opt/pop/apps/api/dist`
- 环境变量:`/opt/pop/.env`(含 MINIMAX/ALI_NLS keys,不要泄露)

**不要做**:
- 改 `/opt/pop/.env`(里面有 API key,owner 会自己处理 Aliyun NLS Token 24h 续期)
- 重启 PostgreSQL(数据库有 demo 数据,重启不会丢但增加风险)
- 改 NestJS 代码或重新 build(部署是 owner 在工作机 build → rsync 上来)
- 删除任何文件(`/opt/pop/.env.bak.*` / `Caddyfile.bak.*` 等备份保留)

**只需要做**:
- 改 `/etc/caddy/Caddyfile` 加新域名块
- `systemctl reload caddy`(或 `caddy reload`)

---

## 8. 常见错误对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| `dig` 仍返回空,等了 30 分钟 | A 记录没正确保存 | 阿里云后台再检查记录状态 |
| `caddy validate` 报错 `unrecognized directive` | Caddyfile 语法错(花括号 / handle 拼错) | 对照 §4.3 模板逐字符比对 |
| `journalctl` 看到 `obtain failed: ... 80 dial tcp` | 80 端口被防火墙拦 | 检查阿里云安全组是否开 80(应该已经开,因为 ggswpop 能访问) |
| `obtain failed: ... no such host` | DNS 没生效 | 回 STEP 1 检查 |
| 浏览器显示「证书错误 NET::ERR_CERT_AUTHORITY_INVALID」 | Caddy 还没拿到 cert,或 cert 是 self-signed | 等 30 秒重试;查 journalctl 看 ACME 进度 |
| `502 Bad Gateway` | NestJS pm2 挂了 | `pm2 restart pop-api`,联系 owner |
| 移动端 getUserMedia 仍被拒 | URL 不是 HTTPS | 检查地址栏是 https:// 不是 http:// |

---

## 9. 完成回执

**全部成功后,操作人请告知 owner**:

```
[ ] STEP 1 DNS 已生效:dig +short xiaojuenergy.com → 47.238.72.38
[ ] STEP 2 Caddyfile 已加 xiaojuenergy.com 块,reload OK
[ ] STEP 3 https://xiaojuenergy.com 浏览器拿绿锁,/api/v1/health 返回 ok
[ ] 证书 issuer=Let's Encrypt,有效期 ~90 天
[ ] 移动端 /m/visit/new 麦克风授权弹窗正常
```

**演示链接**(给团队):
```
桌面端:https://xiaojuenergy.com
移动端:https://xiaojuenergy.com/m/visit/new
```

---

## 10. 联系

任何问题或卡住,把以下信息发回项目 owner:
- 卡在哪一步(§3 / §4 / §5)
- 命令输出 / 报错截图
- 阿里云后台「解析列表」截图(如果 DNS 问题)
- Caddyfile 当前内容(`cat /etc/caddy/Caddyfile`)
