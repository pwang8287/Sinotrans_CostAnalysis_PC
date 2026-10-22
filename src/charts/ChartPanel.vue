<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
const props = defineProps<{ option: echarts.EChartsOption; height?: number }>()
type LegendSelectionEvent = { name: string; selected: Record<string, boolean> }
const emit = defineEmits<{ click: [params: echarts.ECElementEvent]; mouseover: [params: echarts.ECElementEvent]; globalout: []; legendselectchanged: [params: LegendSelectionEvent] }>()
const root = ref<HTMLDivElement>(); let chart: echarts.ECharts | undefined
let resizeObserver: ResizeObserver | undefined
function downloadImage(filename = '图表') {
  if (!chart) return
  const link = document.createElement('a')
  link.href = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
  link.download = `${filename}.png`
  link.click()
}
defineExpose({ downloadImage })
function render(){
  if(!root.value) return
  chart ??= echarts.init(root.value)
  chart.off('click')
  chart.on('click', params => emit('click', params))
  chart.off('mouseover')
  chart.on('mouseover', params => emit('mouseover', params))
  chart.off('globalout')
  chart.on('globalout', () => emit('globalout'))
  chart.off('legendselectchanged')
  chart.on('legendselectchanged', params => emit('legendselectchanged', params as LegendSelectionEvent))
  chart.setOption({ animationDuration: 420, animationEasing: 'cubicOut', textStyle: { fontFamily: '-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif', color: '#64748b' }, ...props.option }, true)
  chart.resize()
}
onMounted(()=>{render(); window.addEventListener('resize',render); resizeObserver = new ResizeObserver(() => chart?.resize()); if(root.value) resizeObserver.observe(root.value)})
watch(()=>props.option,render,{deep:true})
onBeforeUnmount(()=>{window.removeEventListener('resize',render); resizeObserver?.disconnect(); chart?.dispose()})
</script>
<template><div ref="root" class="chart-panel" :style="{height: `${height || 250}px`}" /></template>
