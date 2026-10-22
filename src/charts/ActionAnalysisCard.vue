<script setup lang="ts">
import type { EChartsOption, ScatterSeriesOption } from 'echarts'
import { actionTypes, getActionComparison } from '../api/action-analysis'
import { formatValue } from '../utils/format'
import ChartPanel from './ChartPanel.vue'

const colors = ['#5b8def', '#2dbda8', '#f4b042', '#f08a8a', '#a78bfa', '#8296ad']
const labelLeft = 8
const plotLeft = 36
const selectedActions = Object.fromEntries(actionTypes.map(name => [name, name === '运']))
const scatterOption: EChartsOption = {
  color: colors,
  legend: {
    top: 0, left: labelLeft, padding: 0, orient: 'horizontal', itemGap: 12, itemWidth: 9, itemHeight: 9,
    textStyle: { fontSize: 10, color: '#718096' },
    data: actionTypes.map(name => ({ name, icon: 'circle' })),
    selectedMode: 'single',
    selected: selectedActions,
  },
  tooltip: {
    trigger: 'item', confine: true, textStyle: { fontSize: 10 },
    formatter: params => {
      const item = Array.isArray(params) ? params[0] : params
      const point = item.data as { business: string; action: string; value: [number, number] }
      return `${item.marker} ${point.action} · ${point.business}<br/>去年同期变动成本：${formatValue(point.value[0])} 万元<br/>当期变动成本：${formatValue(point.value[1])} 万元`
    },
  },
  graphic: [{ type: 'text', left: labelLeft, top: 26, silent: true, style: { text: '当期变动成本(万元)', font: '10px -apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif', fill: '#718096' } }],
  grid: { left: plotLeft, right: 12, top: 48, bottom: 40, containLabel: false },
  xAxis: {
    type: 'value', name: '去年同期变动成本(万元)', nameLocation: 'middle', nameGap: 25,
    nameTextStyle: { fontSize: 10, color: '#718096' },
    scale: true, boundaryGap: ['8%', '12%'], splitNumber: 4,
    axisLabel: { fontSize: 9, hideOverlap: true }, axisTick: { show: false },
    axisLine: { show: true, lineStyle: { color: '#dbe4ef' } },
    splitLine: { lineStyle: { color: '#edf1f6', type: 'dashed' } },
  },
  yAxis: {
    type: 'value',
    scale: true, boundaryGap: ['8%', '12%'], splitNumber: 4,
    axisLabel: { fontSize: 9, hideOverlap: true, align: 'left', margin: plotLeft - labelLeft }, axisTick: { show: false },
    axisLine: { show: true, lineStyle: { color: '#dbe4ef' } },
    splitLine: { lineStyle: { color: '#e8eef5', type: 'dashed' } },
  },
  series: actionTypes.map((action): ScatterSeriesOption => {
    const { points, previousAverage, currentAverage } = getActionComparison(action)
    return {
      name: action, type: 'scatter', symbol: 'circle', symbolSize: 9,
      itemStyle: { opacity: .85, borderColor: '#fff', borderWidth: 1 },
      emphasis: { focus: 'series', scale: 1.4, itemStyle: { opacity: 1, shadowBlur: 6, shadowColor: 'rgba(30,65,120,.2)' } },
      data: points.map(point => ({
        name: `${point.business} · ${point.action}`,
        business: point.business, action: point.action,
        value: [point.previousVariableCost, point.currentVariableCost],
      })),
      markLine: {
        silent: true, symbol: ['none', 'none'],
        lineStyle: { type: 'dashed', width: 1.5 },
        label: { show: true, fontSize: 9, rotate: 0, backgroundColor: 'rgba(255,255,255,.9)', padding: [2, 3], formatter: params => `${params.name}：${formatValue(Number(params.value))}` },
        data: [
          { name: '同期均值', xAxis: previousAverage, lineStyle: { color: '#e7a331' }, label: { position: 'insideEndBottom', color: '#b17a1e' } },
          { name: '当期均值', yAxis: currentAverage, lineStyle: { color: '#2dbda8' }, label: { position: 'insideEndTop', color: '#168f80' } },
        ],
      },
    }
  }),
}
</script>

<template>
  <article class="dash-card action-cost-card action-analysis-card">
    <div class="dash-title"><b>按动作分析</b></div>
    <ChartPanel :option="scatterOption" :height="270" @legendselectchanged="({ selected }) => Object.assign(selectedActions, selected)" />
  </article>
</template>

<style scoped>
.action-analysis-card{height:344px;min-width:0}
</style>
