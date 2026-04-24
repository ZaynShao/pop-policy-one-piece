# legacy/ — 一期 demo 归档(只读)

一期纯前端演示原型,为立项服务。2026-04-24 进入二期开发后整体归档。

## 保留目的

- 回看视觉效果(深色 + 玻璃拟态 + 青色主色)
- 回看首屏交互思路(地图 + 列表)
- 原始 GeoJSON 资产存档(二期 apps/web/public/geojson/ 已复制一份)

## 如需本地运行

```bash
cd legacy
npm install       # 独立 node_modules,不进 monorepo workspace
npm run dev       # http://localhost:5173
```

## 注意

- 本目录**不进** monorepo workspace,依赖独立管理
- 只用于回看,不要在此继续开发新功能
- 如果发现有用的组件 / 样式,复制到 apps/web/ 后再改
