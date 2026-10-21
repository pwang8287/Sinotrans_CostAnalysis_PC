<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { buildBusinessLineTree, getBusinessLinePathsForCategory, getBusinessLineTrend, type BusinessLineNode } from '../api/business-lines'
import { useDashboardStore } from '../stores/dashboard'
import { formatValue } from '../utils/format'
import ChartPanel from './ChartPanel.vue'

type TrendTab = 'unitCost' | 'volume'
const tabs: { key: TrendTab; label: string }[] = [
  { key: 'unitCost', label: '单位变动成本趋势分析' },
  { key: 'volume', label: '业务量趋势分析' },
]
const store = useDashboardStore()
const activeTab = ref<TrendTab>('unitCost')
const selectedBusinessLines = ref<Record<TrendTab, string>>({ unitCost: '水运货代', volume: '水运货代' })
const scopedPaths = computed(() => getBusinessLinePathsForCategory(store.filters.segment))
const businessLineTree = computed(() => buildBusinessLineTree(scopedPaths.value))
watch(businessLineTree, tree => {
  const available = new Set<string>()
  function collect(nodes: BusinessLineNode[]) {
    for (const node of nodes) {
      available.add(node.value)
      if (node.children) collect(node.children)
    }
  }
  collect(tree)
  for (const tab of tabs) {
    if (!available.has(selectedBusinessLines.value[tab.key])) selectedBusinessLines.value[tab.key] = scopedPaths.value[0] ?? ''
  }
}, { immediate: true, flush: 'sync' })
const selectedLine = computed(() => selectedBusinessLines.value[activeTab.value])
const trend = computed(() => getBusinessLineTrend(selectedLine.value, scopedPaths.value))
const compatibleUnits = computed(() => trend.value.units.length === 1)
const unit = computed(() => compatibleUnits.value ? (activeTab.value === 'unitCost' ? '元/' : '') + trend.value.units[0] : '')
const year = computed(() => Number(store.filters.period.slice(0, 4)))
const lastMonth = computed(() => Number(store.filters.period.slice(5, 7)))

async function switchTab(key: TrendTab) {
  activeTab.value = key
  await nextTick()
  document.getElementById(`business-trend-tab-${key}`)?.focus()
}
function filterBusinessLine(keyword: string, data: { value: string }) {
  return data.value.toLowerCase().includes(keyword.trim().toLowerCase())
}

const chartOption = computed<EChartsOption>(() => {
  function metric(row: (typeof trend.value.months)[number], previous: boolean) {
    const volume = previous ? row.previousVolume : row.currentVolume
    if (activeTab.value === 'volume') return volume
    const cost = previous ? row.previousCost : row.currentCost
    return volume ? cost / volume : null
  }
  return {
    color: ['#4f8df7', '#b4bfce'],
    tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 10 }, valueFormatter: value => `${formatValue(Number(value))} ${unit.value}` },
    legend: { bottom: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#718096' } },
    grid: { left: 12, right: 24, top: 16, bottom: 44, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, '0')}月`), axisTick: { show: false }, axisLabel: { fontSize: 10 }, axisLine: { lineStyle: { color: '#dbe4ef' } } },
    yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: '#e8eef5', type: 'dashed' } } },
    series: [
      { name: `${year.value}年`, type: 'line', smooth: true, connectNulls: false, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2 }, data: trend.value.months.map((row, index) => index < lastMonth.value ? metric(row, false) : null) },
      { name: `${year.value - 1}年同期`, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 }, data: trend.value.months.map(row => metric(row, true)) },
    ],
  }
})
</script>

<template>
  <section class="dash-card trend-card business-line-trend-card">
    <div class="business-trend-header">
      <div class="business-trend-tabs" role="tablist" aria-label="业务线趋势">
        <button v-for="(tab, index) in tabs" :id="`business-trend-tab-${tab.key}`" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" aria-controls="business-trend-panel" :tabindex="activeTab === tab.key ? 0 : -1" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key" @keydown.right.prevent="switchTab(tabs[1 - index].key)" @keydown.left.prevent="switchTab(tabs[1 - index].key)">{{ tab.label }}</button>
      </div>
      <el-tree-select :key="`${activeTab}:${store.filters.segment}`" v-model="selectedBusinessLines[activeTab]" :data="businessLineTree" :props="{ label: 'value' }" :title="selectedLine" node-key="value" check-strictly filterable :filter-node-method="filterBusinessLine" :default-expanded-keys="[selectedLine.split('-')[0]]" :render-after-expand="false" class="business-trend-select" :aria-label="`${tabs.find(tab => tab.key === activeTab)?.label}业务线选择`" placeholder="选择业务线" size="small">
        <template #default="{ data }"><span :title="data.value">{{ data.label }}</span></template>
      </el-tree-select>
    </div>
    <div id="business-trend-panel" role="tabpanel" :aria-labelledby="`business-trend-tab-${activeTab}`">
      <div class="business-trend-meta"><span>{{ unit ? `单位：${unit}` : '包含多种计量单位' }}</span><span class="business-trend-path" :title="selectedLine">{{ selectedLine }}</span></div>
      <ChartPanel v-if="compatibleUnits" :option="chartOption" :height="300" />
      <el-empty v-else :image-size="64" class="business-trend-empty" :description="`所选业务线包含${trend.units.join('、')}等计量单位，请选择下一级业务线查看趋势`" />
    </div>
  </section>
</template>

<style scoped>
.business-line-trend-card{height:auto;min-height:380px;padding:12px 16px 16px}
.business-trend-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px;padding-bottom:10px;border-bottom:1px solid #eef1f6}
.business-trend-tabs{display:flex;align-items:center;gap:6px;min-width:0}
.business-trend-tabs button{border:0;border-radius:5px;padding:8px 12px;background:transparent;color:#718096;font-family:inherit;font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer}
.business-trend-tabs button.active{background:#e6f3ff;color:#1687ff}
.business-trend-tabs button:focus-visible{outline:2px solid #79aafa;outline-offset:2px}
.business-trend-select{width:420px;max-width:100%;flex:none}
.business-trend-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px 4px;color:#94a3b8;font-size:10px;line-height:16px}
.business-trend-path{color:#718096;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.business-trend-empty{min-height:300px}
@media(max-width:900px){.business-trend-header{align-items:flex-start;flex-wrap:wrap;gap:10px}.business-trend-tabs{flex-wrap:wrap}.business-trend-select{margin-left:auto;width:260px}}
@media(max-width:480px){.business-trend-tabs{gap:3px}.business-trend-tabs button{font-size:11px;padding:7px 8px}.business-trend-select{width:100%}.business-trend-meta{align-items:flex-start}.business-trend-path{max-width:65%}}
</style>
