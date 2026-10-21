# 中国外运成本分析 PC 端 V1.0.0

Vue 3 + TypeScript + Vite + Element Plus + Ant Design Vue + ECharts 的经营分析看板首版。

## 启动

```bash
npm install
npm run dev
```

## 校验

```bash
npm run build
```

数据计算保持原始精度，展示层统一处理单位、精度、符号、颜色和空值。空值显示 `-`；同比/环比单位使用 `pct`；上升使用红色 ▲，下滑使用绿色 ▼；去年同期使用灰色系。当前页面使用 mock 数据，接口可替换 `src/api/mock.ts`。
