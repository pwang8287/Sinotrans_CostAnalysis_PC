<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import { organizationOptions } from '../../api/organizations'
import { businessOptions } from '../../api/mock'
import { getAnalysisPoints, type AnalysisPeriod } from '../../api/multi-analysis'
import NineGridCard from './NineGridCard.vue'
import BusinessLineList from './BusinessLineList.vue'
import './style.css'
const store = useDashboardStore()
const selected = ref(''); const hovered = ref('')
const periodMode = ref<AnalysisPeriod>('year')
const dataUpdatedAt = '2026-10-22'
const points = computed(() => getAnalysisPoints(store.filters, periodMode.value))
function select(id:string) {selected.value=selected.value===id?'':id}
watch(() => [store.filters.org,store.filters.period,store.filters.segment,periodMode.value],()=>{selected.value='';hovered.value=''})
</script>
<template>
  <div class="multi-analysis-page">
    <div class="filter-row"><el-select v-model="store.filters.org" filterable aria-label="组织" size="small" style="width:260px"><el-option v-for="o in organizationOptions" :key="o.code" :label="o.label" :value="o.value" /></el-select><el-date-picker v-model="store.filters.period" type="month" value-format="YYYY-MM" format="YYYY年M月" size="small" style="width:145px" aria-label="期间" /><el-select v-model="store.filters.segment" size="small" style="width:170px" aria-label="业务线"><el-option v-for="name in businessOptions" :key="name" :label="name" :value="name" /></el-select><span class="mock-label">数据更新时间：{{ dataUpdatedAt }}</span></div>
    <NineGridCard v-for="mode in (['cost','profit'] as const)" :key="mode" :mode="mode" :points="points" :period-mode="periodMode" @period-change="periodMode=$event" :selected="selected" :hovered="hovered" @select="select" @hover="hovered=$event" />
    <BusinessLineList :points="points" :period-mode="periodMode" :selected="selected" :hovered="hovered" @period-change="periodMode=$event" @select="select" @hover="hovered=$event" />
    <div class="analysis-note">指标口径：单位变动成本 = 变动成本 / 业务量；毛利率 =（营业收入 − 营业成本）/ 营业收入。年度展示截至所选月份的累计数据，月度展示所选月份数据。气泡颜色区分一级业务线，大小表示所选业务量或金额，总成本为变动成本与固定成本合计。九宫格分界为演示阈值，坐标按区间分段映射。</div>
  </div>
</template>
