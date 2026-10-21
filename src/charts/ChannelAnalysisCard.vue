<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { ECElementEvent, EChartsOption } from 'echarts'
import { channelAnalysis } from '../api/mock'
import { formatValue } from '../utils/format'
import ChartPanel from './ChartPanel.vue'

const colors = ['#5b8def', '#2dbda8', '#f08a8a', '#f4b042']
const selectedIndex = ref(0)
const hoveredIndex = ref<number | null>(null)
const selected = computed(() => channelAnalysis[selectedIndex.value])
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function highlight(index: number) {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoveredIndex.value = index
}
function leave() {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => { hoveredIndex.value = null }, 80)
}
function chartHover(params: ECElementEvent) {
  if (params.componentType === 'series' && typeof params.dataIndex === 'number') highlight(params.dataIndex)
}
function chartClick(params: ECElementEvent) {
  if (params.componentType === 'series' && typeof params.dataIndex === 'number') selectedIndex.value = params.dataIndex
}
onBeforeUnmount(() => { if (hoverTimer) clearTimeout(hoverTimer) })

const roseOption = computed<EChartsOption>(() => ({
  color: colors,
  tooltip: { trigger: 'item', confine: true, textStyle: { fontSize: 10 }, valueFormatter: value => `${formatValue(Number(value))} 万元` },
  series: [{
    name: '通道总成本', type: 'pie', roseType: 'radius', radius: ['24%', '82%'], center: ['50%', '50%'],
    label: { show: false }, selectedMode: 'single', selectedOffset: 4,
    emphasis: { scale: true, scaleSize: 5 },
    itemStyle: { borderColor: '#fff', borderWidth: 3 },
    data: channelAnalysis.map((row, index) => ({
      name: row.name, value: row.totalCost, selected: selectedIndex.value === index,
      itemStyle: { opacity: hoveredIndex.value === null || hoveredIndex.value === index ? 1 : .24 },
    })),
  }],
}))
const productOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 10 }, axisPointer: { type: 'shadow' }, valueFormatter: value => `${formatValue(Number(value))} ${selected.value.unit}` },
  grid: { left: 5, right: 8, top: 24, bottom: 6, containLabel: true },
  xAxis: { type: 'category', data: selected.value.products.map(row => row.name), axisTick: { show: false }, axisLabel: { fontSize: 9, interval: 0, formatter: (name: string) => name.slice(0, 2) + '\n' + name.slice(2), lineHeight: 13 }, axisLine: { lineStyle: { color: '#dbe4ef' } } },
  yAxis: { type: 'value', axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: '#e8eef5', type: 'dashed' } } },
  series: [{ name: '单位变动成本', type: 'bar', barMaxWidth: 34, barCategoryGap: '38%',
    label: { show: true, position: 'top', fontSize: 9, color: '#53657b', formatter: params => formatValue(Number(params.value)) },
    itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#79adff' }, { offset: 1, color: '#3778e5' }] } },
    data: selected.value.products.map(row => row.value),
  }],
}))
</script>

<template>
  <article class="dash-card channel-cost-card">
    <div class="dash-title"><b>按通道分析</b></div>
    <div class="channel-analysis-body">
      <div class="channel-distribution">
        <div class="channel-rose"><ChartPanel :option="roseOption" :height="132" @mouseover="chartHover" @globalout="leave" @click="chartClick" /></div>
        <div class="channel-table-wrap">
          <table class="channel-table">
            <thead><tr><th>通道</th><th>毛利率</th><th>总成本(万元)</th><th>变动成本(万元)</th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in channelAnalysis" :key="row.name" tabindex="0" role="button" :aria-pressed="selectedIndex === index" :class="{ 'is-selected': selectedIndex === index, 'is-hovered': hoveredIndex === index }" @mouseenter="highlight(index)" @mouseleave="leave" @focus="highlight(index)" @blur="leave" @click="selectedIndex = index" @keydown.enter="selectedIndex = index" @keydown.space.prevent="selectedIndex = index">
                <td><span class="channel-name"><i :style="{ background: colors[index] }" />{{ row.name }}</span></td>
                <td>{{ formatValue(row.marginRate) }}%</td><td>{{ formatValue(row.totalCost) }}</td><td>{{ formatValue(row.variableCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="channel-products">
        <div class="channel-product-heading"><b>{{ selected.name }} · 业务产品</b><span>{{ selected.unit }}</span></div>
        <div class="channel-product-subtitle">单位变动成本</div>
        <ChartPanel :option="productOption" :height="227" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.channel-cost-card{container-type:inline-size;height:344px}
.channel-analysis-body{display:grid;grid-template-columns:minmax(230px,1.08fr) minmax(0,1fr);gap:12px;align-items:center}
.channel-distribution,.channel-products{min-width:0}
.channel-rose{max-width:190px;margin:0 auto}
.channel-table{width:100%;border-collapse:separate;border-spacing:0 2px;white-space:nowrap;font-size:9px;font-variant-numeric:tabular-nums;color:#53657b}
.channel-table th{height:21px;padding:0 4px;text-align:right;font-weight:500;color:#94a3b8}
.channel-table td{height:24px;padding:0 4px;text-align:right;border-top:1px solid transparent;border-bottom:1px solid transparent}
.channel-table th:first-child,.channel-table td:first-child{text-align:left}
.channel-name{display:inline-flex;align-items:center;gap:4px;color:#334155}
.channel-name i{width:7px;height:7px;border-radius:2px;flex:none}
.channel-table tbody tr{cursor:pointer;outline:none}
.channel-table tbody tr:is(.is-selected,.is-hovered,:focus-visible) td{background:#eef6ff;border-color:#b9d8ff;color:#1677ff}
.channel-table tbody tr:is(.is-selected,.is-hovered,:focus-visible) td:first-child{border-left:1px solid #b9d8ff;border-radius:4px 0 0 4px}
.channel-table tbody tr:is(.is-selected,.is-hovered,:focus-visible) td:last-child{border-right:1px solid #b9d8ff;border-radius:0 4px 4px 0}
.channel-table tr.is-selected .channel-name{font-weight:600;color:#1677ff}
.channel-product-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;line-height:16px}
.channel-product-heading b{display:flex;align-items:center;gap:5px;color:#334155;font-weight:650}
.channel-product-heading b::before{content:'';width:3px;height:12px;background:#1687ff;border-radius:2px;flex:none}
.channel-product-heading span{font-size:9px;color:#94a3b8;white-space:nowrap}
.channel-product-subtitle{font-size:9px;color:#94a3b8;margin:2px 0 0 8px}
@container(min-width:720px){
  .channel-analysis-body{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px}
  .channel-distribution{display:grid;grid-template-columns:minmax(140px,1fr) minmax(220px,1.4fr);align-items:center;gap:12px}
  .channel-rose{width:100%;max-width:220px}
  .channel-rose :deep(.chart-panel){height:220px!important}
  .channel-table{font-size:11px}
  .channel-table td{height:32px}
}
@container(max-width:380px){
  .channel-analysis-body{grid-template-columns:minmax(0,1fr)}
  .channel-distribution{display:grid;grid-template-columns:minmax(85px,.7fr) minmax(0,1.5fr);align-items:center;gap:6px}
  .channel-rose{width:100%}
  .channel-products{margin-top:8px}
}
@media(max-width:1200px){.channel-cost-card{height:auto;min-height:344px}}
@media(min-width:1201px){
  .channel-cost-card{height:344px}
  @container(max-width:380px){
    .channel-rose :deep(.chart-panel){height:120px!important}
    .channel-products{margin-top:0}
    .channel-products :deep(.chart-panel){height:108px!important}
  }
}
</style>
