<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { page1Modules } from '../api/mock'
import { formatValue } from '../utils/format'
import ChartPanel from './ChartPanel.vue'

const rows = computed(() => {
  const total = page1Modules.linkComposition.reduce((sum, row) => sum + row.variable + row.fixed, 0)
  return page1Modules.linkComposition.map(row => ({ ...row, total: row.variable + row.fixed, share: (row.variable + row.fixed) / total * 100 })).sort((a, b) => b.total - a.total)
})
const maxCost = computed(() => Math.max(...rows.value.map(row => row.total)))
function barOption(row: typeof rows.value[number]): EChartsOption {
  return {
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    tooltip: {
      trigger: 'item',
      confine: true,
      appendToBody: true,
      position: (point: any, _params: any, _dom: any, _rect: any, size: any) => {
        const [x, y] = point
        const [width, height] = size.contentSize
        const [viewWidth, viewHeight] = size.viewSize
        return [Math.max(8, Math.min(x + 10, viewWidth - width - 8)), Math.max(8, Math.min(y + 14, viewHeight - height - 8))]
      },
      formatter: (params: any) => params.seriesName === '剩余' ? '' : `${params.seriesName}：${formatValue(Number(params.value))} 万元`,
    },
    xAxis: { type: 'value', max: maxCost.value, show: false },
    yAxis: { type: 'category', data: [row.name], show: false },
    series: [
      { name: '变动成本', type: 'bar', stack: 'cost', barWidth: 10, data: [row.variable], itemStyle: { color: '#307af5', borderRadius: [5, 0, 0, 5] } },
      { name: '固定成本', type: 'bar', stack: 'cost', barWidth: 10, data: [row.fixed], itemStyle: { color: '#30bfac', borderRadius: [0, 5, 5, 0] } },
      { name: '剩余', type: 'bar', stack: 'cost', barWidth: 10, data: [maxCost.value - row.total], silent: true, itemStyle: { color: '#e9eef6', borderRadius: [0, 5, 5, 0] }, emphasis: { disabled: true } },
    ],
  }
}
</script>

<template>
  <article class="dash-card link-cost-card">
    <div class="link-cost-heading"><h3>按环节分析</h3></div>
    <div class="link-cost-legend"><span><i class="variable" />变动成本</span><span><i class="fixed" />固定成本</span></div>
    <el-table :data="rows" class="link-cost-table" :show-header="true" :row-key="'name'">
      <el-table-column prop="name" label="业务环节 / 成本构成" min-width="120"><template #default="{ row }"><strong class="link-cost-name" :title="row.name">{{ row.name }}</strong><ChartPanel :option="barOption(row)" :height="24" /></template></el-table-column>
      <el-table-column label="成本(万元)" min-width="90" align="right"><template #default="{ row }"><strong class="link-cost-total">{{ formatValue(row.total) }}</strong></template></el-table-column>
      <el-table-column min-width="80" align="right"><template #header><span class="link-cost-share-heading">成本占比 <el-tooltip content="该环节总成本占全部环节总成本的比例" placement="top"><span class="info-dot" tabindex="0">?</span></el-tooltip></span></template><template #default="{ row }"><span class="link-cost-share">{{ formatValue(row.share) }}%</span></template></el-table-column>
    </el-table>
  </article>
</template>

<style scoped>
.link-cost-card{height:344px;padding:15px 16px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 2px 4px rgba(30,41,59,.04)}
.link-cost-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eaf0f7}
.link-cost-heading h3{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:650;color:#1e293b;margin:0}
.link-cost-heading h3:before{content:'';width:4px;height:18px;background:#1687ff;border-radius:3px}
.link-cost-heading button{display:flex;align-items:center;gap:4px;color:#0088ff;background:none;border:0;cursor:pointer;font:inherit;font-size:11px;padding:0;white-space:nowrap}
.link-cost-heading button span{font-size:24px;line-height:16px}
.link-cost-legend{display:flex;gap:16px;align-items:center;margin-bottom:12px;color:#475569;font-size:11px}
.link-cost-legend>span{display:flex;align-items:center;gap:8px}.link-cost-legend i{width:10px;height:10px;border-radius:4px}.variable{background:#307af5}.fixed{background:#30bfac}
.link-cost-name{display:block;font-size:11px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.link-cost-total{font-size:12px;font-weight:650;color:#0f172a}.link-cost-share{font-size:11px;color:#64748b}.link-cost-share-heading .info-dot{width:11px;height:11px;font-size:8px;line-height:10px}.link-cost-share-heading{display:inline-flex;align-items:center;gap:3px}
.link-cost-table{--el-table-header-bg-color:#fff;--el-table-row-hover-bg-color:#f8fbff;--el-table-border-color:#eaf0f7}
.link-cost-table :deep(th.el-table__cell){color:#94a3b8;font-size:10px;font-weight:500;padding:8px 0 10px}
.link-cost-table :deep(td.el-table__cell){border:0;padding:8px 0}.link-cost-table :deep(.cell){padding:0 8px;white-space:nowrap;word-break:normal}.link-cost-total,.link-cost-share,.link-cost-share-heading{white-space:nowrap}.link-cost-table :deep(.el-table__cell:first-child .cell){padding-left:0}.link-cost-table :deep(.el-table__cell:last-child .cell){padding-right:0}.link-cost-table :deep(.el-table__inner-wrapper:before){display:none}
@media(max-width:760px){.link-cost-card{padding:18px 16px}.link-cost-heading h3{font-size:16px}.link-cost-heading button{white-space:nowrap}}
</style>
