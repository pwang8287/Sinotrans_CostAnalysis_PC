<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsOption, ECElementEvent } from 'echarts'
import ChartPanel from './ChartPanel.vue'
import { formatValue } from '../utils/format'

const industries = [
  { name: '科技电子', current: 482, previous: 416, revenue: 1290, margin: 18.6 },
  { name: '家电家具', current: 431, previous: 398, revenue: 1168, margin: 16.9 },
  { name: '装备制造', current: 386, previous: 342, revenue: 1054, margin: 17.8 },
  { name: '能源化工', current: 354, previous: 321, revenue: 986, margin: 15.4 },
  { name: '汽车', current: 328, previous: 306, revenue: 912, margin: 16.2 },
  { name: '医疗健康', current: 296, previous: 274, revenue: 826, margin: 19.1 },
  { name: '食品酒类', current: 268, previous: 251, revenue: 768, margin: 14.8 },
  { name: '冶金矿业', current: 246, previous: 238, revenue: 704, margin: 12.6 },
  { name: '日用两费品', current: 224, previous: 211, revenue: 668, margin: 13.7 },
  { name: '绿能', current: 198, previous: 176, revenue: 612, margin: 18.2 },
  { name: '其他行业', current: 164, previous: 151, revenue: 528, margin: 11.9 },
].sort((a, b) => b.current - a.current)

const selectedIndustry = ref(industries[0].name)
const legendItems = [
  { name: '当年年累计变动成本', label: '当年累计', color: '#4f8df7' },
  { name: '去年同期年累计变动成本', label: '去年同期', color: '#a9c4f7' },
]
const visibleSeries = ref<Record<string, boolean>>(Object.fromEntries(legendItems.map(item => [item.name, true])))
const selected = computed(() => industries.find(item => item.name === selectedIndustry.value) ?? industries[0])
const yoyChange = computed(() => ((selected.value.current - selected.value.previous) / selected.value.previous) * 100)
function signedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
const detailRows = computed(() => {
  const item = selected.value
  const profit = item.revenue - item.current
  return [
    ['变动成本(万元)', item.current],
    ['收入(万元)', item.revenue],
    ['毛利率', `${item.margin.toFixed(1)}%`],
    ['利润占比', `${(profit / industries.reduce((sum, row) => sum + row.revenue - row.current, 0) * 100).toFixed(1)}%`],
    ['成本占比', `${(item.current / industries.reduce((sum, row) => sum + row.current, 0) * 100).toFixed(1)}%`],
    ['同比', signedPercent(((item.current - item.previous) / item.previous) * 100)],
  ]
})
const chartOption = computed<EChartsOption>(() => ({
  color: ['#4f8df7', '#a9c4f7'],
  tooltip: {
    trigger: 'axis',
    confine: true,
    axisPointer: { type: 'shadow' },
    textStyle: { fontSize: 10 },
    position: (point, _params, _dom, _rect, size) => [
      Math.max(8, Math.min(point[0] + 12, size.viewSize[0] - size.contentSize[0] - 8)),
      Math.max(8, Math.min(point[1] + 10, size.viewSize[1] - size.contentSize[1] - 8)),
    ],
    valueFormatter: value => `${formatValue(Number(value))} 万元`,
  },
  legend: { show: false, selected: visibleSeries.value },
  grid: { left: 28, right: 4, top: 38, bottom: 48 },
  xAxis: { type: 'category', data: industries.map(item => item.name), axisLabel: { fontSize: 9, color: '#718096', interval: 1, rotate: 38 }, axisLine: { lineStyle: { color: '#dbe4ef' } } },
  yAxis: { type: 'value', axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: '#e8eef5' } } },
  series: [
    { name: '当年年累计变动成本', type: 'bar', barMaxWidth: 22, barCategoryGap: '22%', barGap: '18%', data: industries.map(item => ({ value: item.current, itemStyle: { color: '#4f8df7', borderRadius: [5, 5, 0, 0], opacity: selectedIndustry.value === item.name ? 1 : .48 } })) },
    { name: '去年同期年累计变动成本', type: 'bar', barMaxWidth: 22, barCategoryGap: '22%', data: industries.map(item => ({ value: item.previous, itemStyle: { color: '#a9c4f7', borderRadius: [5, 5, 0, 0], opacity: selectedIndustry.value === item.name ? .95 : .48 } })) },
  ],
}))
function selectIndustry(params: ECElementEvent) {
  if (params.componentType === 'series' && typeof params.dataIndex === 'number') selectedIndustry.value = industries[params.dataIndex].name
}
</script>

<template>
  <article class="dash-card industry-analysis-card">
    <div class="dash-title"><b>按行业分析</b></div>
    <div class="industry-analysis-body">
      <div class="industry-chart">
        <div class="industry-chart-toolbar">
          <div class="industry-chart-legend">
            <button v-for="item in legendItems" :key="item.name" type="button" :aria-pressed="visibleSeries[item.name]" :class="{ 'is-hidden': !visibleSeries[item.name] }" @click="visibleSeries[item.name] = !visibleSeries[item.name]">
              <i :style="{ background: item.color }" /><span>{{ item.label }}</span>
            </button>
          </div>
          <span class="industry-chart-unit">万元</span>
        </div>
        <ChartPanel :option="chartOption" :height="260" @click="selectIndustry" />
      </div>
      <div class="industry-detail-wrap">
        <div class="industry-detail-title">{{ selected.name }}行业指标</div>
        <div class="industry-detail-table">
          <div class="industry-detail-head"><span>指标</span><span>数值</span></div>
          <div v-for="row in detailRows" :key="row[0]" class="industry-detail-row"><span>{{ row[0] }}</span><b :class="{ highlight: row[0] === '变动成本(万元)', 'yoy-positive': row[0] === '同比' && yoyChange > 0, 'yoy-negative': row[0] === '同比' && yoyChange < 0 }">{{ typeof row[1] === 'number' ? formatValue(row[1]) : row[1] }}</b></div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.industry-chart{position:relative}
.industry-chart-toolbar{position:absolute;top:0;left:4px;right:4px;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;height:20px;font-size:10px;line-height:16px;white-space:nowrap}
.industry-chart-legend{display:flex;align-items:center;gap:14px}
.industry-chart-legend button{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:transparent;color:#718096;font:inherit;line-height:inherit;cursor:pointer}
.industry-chart-legend button i{width:10px;height:8px;flex:none;border-radius:2px}
.industry-chart-legend button.is-hidden{opacity:.4}
.industry-chart-unit{flex:none;color:#94a3b8}
.industry-analysis-card{height:344px}.industry-analysis-body{display:grid;grid-template-columns:minmax(0,1fr) max-content;gap:8px;height:285px}.industry-chart{min-width:0}.industry-detail-wrap{align-self:center;justify-self:end;width:max-content;max-width:100%;min-width:0}.industry-detail-title{display:flex;align-items:center;gap:8px;padding:0 0 7px 0;color:#24364b;font-size:13px;font-weight:700}.industry-detail-title::before{content:'';width:3px;height:15px;flex:none;border-radius:2px;background:#1677ff}.industry-detail-table{width:max-content;max-width:100%;border:1px solid #e5ebf3;border-radius:5px;overflow:hidden;color:#60738c;font-size:10px}.industry-detail-head,.industry-detail-row{display:grid;grid-template-columns:84px 56px;align-items:center;min-height:27px;padding:0 5px}.industry-detail-head{background:#f2f6fa;color:#334155;font-weight:650}.industry-detail-row{border-top:1px solid #edf1f6;background:#fff}.industry-detail-row:nth-child(odd){background:#f8fafc}.industry-detail-row b{text-align:right;color:#334155;font-weight:600}.industry-detail-row b.highlight{color:#1677ff}.industry-detail-row b.yoy-positive{color:#e05252}.industry-detail-row b.yoy-negative{color:#159570}.industry-detail-row span{white-space:nowrap}@media(max-width:1200px){.industry-analysis-body{grid-template-columns:minmax(0,1fr) max-content}}
</style>
