<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import { businessOptions, page1Modules, detailRows } from '../../api/mock'
import { organizationOptions } from '../../api/organizations'
import { formatValue, formatChange } from '../../utils/format'
import ChartPanel from '../../charts/ChartPanel.vue'
import LinkCostCard from '../../charts/LinkCostCard.vue'
import CostElementCard from '../../charts/CostElementCard.vue'
import BusinessLineRankCard from '../../charts/BusinessLineRankCard.vue'
import IndustryAnalysisCard from '../../charts/IndustryAnalysisCard.vue'
import ChannelAnalysisCard from '../../charts/ChannelAnalysisCard.vue'
import ActionAnalysisCard from '../../charts/ActionAnalysisCard.vue'
import BusinessLineTrendCard from '../../charts/BusinessLineTrendCard.vue'
import type { EChartsOption } from 'echarts'
const store=useDashboardStore(); const business=computed({ get: () => store.filters.segment, set: (value: string) => { store.filters.segment = value } }); const showDetail=ref(false); const selected=ref(''); const metricsExpanded=ref(false)
const yearCost=1286.42; const monthCost=112.58; const fixedYear=586.12; const fixedMonth=52.36; const variableYear=700.30; const variableMonth=60.22
const summaryCards = [{ icon:'▣', title:'总成本', status:'正常', tone:'blue', mainLabel:'年累计成本', main:yearCost, sideLabel:'当月成本', side:monthCost, change:-12.37, progress:78, progressLabel:'成本控制率', note:'成本结构保持稳定，当前月度成本低于年度平均水平。', unit:'' }, { icon:'▥', title:'固定成本', status:'正常', tone:'purple', mainLabel:'年累计固定成本', main:fixedYear, sideLabel:'当月固定成本', side:fixedMonth, change:2.43, progress:64, progressLabel:'固定成本占比', note:'固定成本按组织和成本科目持续跟踪。', unit:'' }, { icon:'◇', title:'变动成本', status:'偏高', tone:'amber', mainLabel:'年累计变动成本', main:variableYear, sideLabel:'当月变动成本', side:variableMonth, change:2.35, progress:69.92, progressLabel:'变动成本占比', note:'建议关注业务量变化和单位变动成本波动。', unit:'' }]
const additionalCards = [{ icon:'▤', title:'营业收入', status:'正常', tone:'green', mainLabel:'年累计营业收入', main:2386.42, sideLabel:'当月营业收入', side:206.58, change:6.82, note:'收入规模保持稳定，业务结构持续优化。', unit:'' }, { icon:'◆', title:'净利润', status:'正常', tone:'coral', mainLabel:'年累计净利润', main:312.68, sideLabel:'当月净利润', side:28.64, change:8.16, note:'利润水平较上期提升，盈利质量持续改善。', unit:'' }, { icon:'％', title:'净利率', status:'良好', tone:'teal', mainLabel:'年累计净利率', main:13.11, sideLabel:'当月净利率', side:13.86, change:1.24, note:'净利率维持在合理区间，经营效率良好。', unit:'%' }]
const visibleSummaryCards = computed(() => metricsExpanded.value ? [...summaryCards, ...additionalCards] : summaryCards)
function cardChange(value:number, unit?:string){ return formatChange(value, unit === '%' ? 'pct' : '%') }
const elementOption: EChartsOption = {color:['#5b8def','#2dbda8','#f08a8a','#f4b042','#a78bfa','#94a3b8'],tooltip:{trigger:'item'},legend:{right:8,top:'middle',orient:'vertical',textStyle:{fontSize:10}},series:[{type:'pie',radius:['43%','69%'],center:['40%','50%'],label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:3,borderRadius:4},data:page1Modules.costElementComposition}]}
const industryOption: EChartsOption = {color:['#5b8def','#2dbda8'],tooltip:{trigger:'axis'},legend:{show:false},grid:{left:38,right:12,top:20,bottom:36},xAxis:{type:'category',data:page1Modules.industryComposition.map(x=>x.name),axisLabel:{fontSize:9}},yAxis:{type:'value',splitLine:{lineStyle:{color:'#d9dfe8'}}},series:[{name:'当期',type:'bar',barGap:'8%',itemStyle:{borderRadius:[6,6,0,0]},data:page1Modules.industryComposition.map(x=>x.current)},{name:'去年同期',type:'bar',itemStyle:{borderRadius:[6,6,0,0]},data:page1Modules.industryComposition.map(x=>x.previous)}]}
function openDetail(title:string){selected.value=title;showDetail.value=true}
</script>
<template>
  <div class="filter-row"><el-select v-model="store.filters.org" filterable placeholder="请选择组织" class="filter-control organization-filter" aria-label="组织" size="small" style="width:260px;max-width:100%"><el-option v-for="item in organizationOptions" :key="item.code" :label="item.label" :value="item.value"><span :title="item.name">{{ item.label }}</span></el-option></el-select><el-date-picker v-model="store.filters.period" class="filter-control" type="month" value-format="YYYY-MM" format="YYYY年M月" size="small" style="width:135px"/><el-select v-model="business" class="filter-control" size="small" style="width:155px"><el-option v-for="x in businessOptions" :key="x" :label="x" :value="x"/></el-select><span class="update-time">数据更新时间：2026-07-24</span></div>
  <section class="summary-row"><article v-for="card in visibleSummaryCards" :key="card.title" :class="['summary-card', `summary-card--${card.tone}`]">
    <div class="summary-head"><div class="summary-title"><span class="summary-icon">{{ card.icon }}</span><b>{{ card.title }}</b><el-tooltip content="指标按原始精度计算，展示层统一格式化" placement="top"><span class="info-dot">i</span></el-tooltip></div></div>
    <div class="summary-body"><div class="summary-main"><small>{{ card.mainLabel }}</small><strong>{{ formatValue(card.main) }}</strong><span class="unit">{{ card.unit || '亿元' }}</span></div><div class="summary-side"><small>{{ card.sideLabel }}</small><b>{{ formatValue(card.side) }}</b><span class="unit">{{ card.unit || '万元' }}</span></div></div>
    <div class="summary-meta"><span>同比</span><em :class="['trend-pill', cardChange(card.change, card.unit).tone]">{{ cardChange(card.change, card.unit).icon }} {{ cardChange(card.change, card.unit).text }}</em><span>环比</span><em :class="['trend-pill', cardChange(0.38, card.unit).tone]">{{ cardChange(0.38, card.unit).icon }} {{ cardChange(0.38, card.unit).text }}</em></div>
  </article></section>
  <div class="metrics-toggle"><button type="button" :aria-expanded="metricsExpanded" @click="metricsExpanded = !metricsExpanded"><span class="metrics-chevron" :class="{ rotated: metricsExpanded }" aria-hidden="true" />{{ metricsExpanded ? '收起指标' : '更多指标' }}</button></div>
  <section class="dashboard-grid primary-analysis-grid"><LinkCostCard /><CostElementCard /><BusinessLineRankCard /></section>
  <section class="dashboard-grid industry-analysis-grid" :class="{ 'without-channel': business !== '全部' }"><IndustryAnalysisCard /><ChannelAnalysisCard v-if="business === '全部'" /><ActionAnalysisCard /></section>
  <BusinessLineTrendCard />
  <el-dialog v-model="showDetail" title="标准成本明细" width="680px"><p class="dialog-sub">{{ selected }} · {{ business }} · {{ store.filters.period }}</p><el-table :data="detailRows" size="small"><el-table-column prop="name" label="成本要素"/><el-table-column prop="type" label="变动/固定" width="110"/><el-table-column prop="source" label="源系统科目名称"/><el-table-column prop="amount" label="标准成本（万元）" align="right"/></el-table></el-dialog>
</template>
