# POP(政策 One Piece)

内部 GA 团队可视化工作平台。二期开发中(V0.1 Week 1 骨架)。

## 目录结构

```
apps/
  api/              NestJS 10 后端
  web/              React + Vite 前端
packages/
  shared-types/     前后端共享 DTO / enum
legacy/             一期 demo 归档(只读,独立 npm install)
docs/
  HANDOFF.md        项目状态 + 协作规则
  TECH-ARCH.md      技术架构 V0
  PRD-user-led.md   需求规格
docker-compose.yml  本地 postgres + redis + minio
```

## 起本地开发

```bash
# 1. 起基础设施(postgres + redis + minio)
docker compose up -d

# 2. 装依赖(根目录一把装,workspaces 自动 hoist)
npm install

# 3. 起后端(终端 A)
npm run dev:api        # http://localhost:3001/api/v1

# 4. 起前端(终端 B)
npm run dev:web        # http://localhost:5173
```

冒烟验证:打开 http://localhost:5173 , 页面应显示"status: ok"。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev:api` | 后端热重载 |
| `npm run dev:web` | 前端热重载 |
| `npm run build:api` | 后端打包 |
| `npm run build:web` | 前端打包 |
| `npm run typecheck` | 全 workspace 类型检查 |
| `npm run docker:up` | 起 postgres/redis/minio |
| `npm run docker:down` | 停 docker 服务 |
| `npm run docker:logs` | 看 docker 日志 |

## 文档入口

- [docs/HANDOFF.md](docs/HANDOFF.md) — 当前状态,新会话先读这个
- [docs/TECH-ARCH.md](docs/TECH-ARCH.md) — 技术架构决策
- [docs/PRD-user-led.md](docs/PRD-user-led.md) — 需求规格

## 开发策略(V0.1 三拍板)

1. **柔和版重头搭建**:一期 src/ 归档到 legacy/,apps/web/ 从 0 搭;保留视觉 token + 技术栈 + geojson 资产
2. **界面布局重新设计**:不照抄一期 demo,按 PRD §6 开发中协同拍定
3. **C 路径 🔷 默认值起骨架**:不等公司拍 TECH-ARCH §10.2 的 10 项 ⚠️,用默认值先跑,真决策下来后接受返工
