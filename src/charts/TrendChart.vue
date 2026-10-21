<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { TrendPoint } from '../types/dashboard'
const props = defineProps<{ data: TrendPoint[] }>()
const root = ref<HTMLDivElement>()
let chart: echarts.ECharts | undefined
function render() { if (!root.value) return; chart ??= echarts.init(root.value); chart.setOption({ color:['#5b8def','#2dbda8'], grid:{left:42,right:18,top:24,bottom:28}, tooltip:{trigger:'axis',valueFormatter:(v:number)=>`${v.toFixed(2)} 元/吨`}, legend:{top:0,right:0,itemWidth:14,itemHeight:3,textStyle:{fontSize:11,color:'#64748b'}}, xAxis:{type:'category',data:props.data.map(x=>x.period.slice(5)),axisLine:{lineStyle:{color:'#e2e8f0'}},axisLabel:{fontSize:10,color:'#64748b'}}, yAxis:{type:'value',axisLabel:{fontSize:10,color:'#64748b'},splitLine:{lineStyle:{color:'#eef1f6'}}}, series:[{name:'本期',type:'line',smooth:true,lineStyle:{width:2,color:'#5b8def'},symbol:'circle',symbolSize:5,areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(91,141,239,.28)'},{offset:1,color:'rgba(91,141,239,.04)'}]}},data:props.data.map(x=>x.current)},{name:'去年同期',type:'line',smooth:true,lineStyle:{width:2,color:'#2dbda8',type:'dashed'},symbol:'circle',symbolSize:4,areaStyle:{color:'rgba(45,189,168,.10)'},data:props.data.map(x=>x.previous)}] }) }
onMounted(()=>{render(); window.addEventListener('resize',render)})
watch(()=>props.data,render,{deep:true})
onBeforeUnmount(()=>{window.removeEventListener('resize',render); chart?.dispose()})
</script>
<template><div ref="root" class="chart-root" /></template>
