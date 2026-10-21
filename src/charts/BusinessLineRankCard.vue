<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { businessLineRank } from '../api/mock'
import { getBusinessLinePathsForCategory } from '../api/business-lines'
import { useDashboardStore } from '../stores/dashboard'
import { formatValue } from '../utils/format'
import { Search } from '@element-plus/icons-vue'

const showAll = ref(false)
const store = useDashboardStore()
const period = ref<'month' | 'year'>('month')
const modalPeriod = ref<'month' | 'year'>('month')
const searchKeyword = ref('')
const selectedGroup = ref('全部')
const showStatPicker = ref(false)
const statPeriod = ref('2026-03')
const currentPage = ref(1)
const pageSize = 10
const scopedRows = computed(() => {
  const allowed = new Set(getBusinessLinePathsForCategory(store.filters.segment))
  return businessLineRank.filter(row => allowed.has(row.name))
})
const topRows = computed(() => scopedRows.value.slice(0, 10))
const firstLevelOptions = computed(() => ['全部', ...Array.from(new Set(scopedRows.value.map(row => row.name.split('-')[0])))])
const filteredRows = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return scopedRows.value.filter(row => {
    const matchesName = !keyword || row.name.toLowerCase().includes(keyword)
    const matchesGroup = selectedGroup.value === '全部' || row.name.split('-')[0] === selectedGroup.value
    return matchesName && matchesGroup
  })
})
const pageRows = computed(() => filteredRows.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
function periodValue(value: number, target: 'month' | 'year' = period.value) { return target === 'month' ? value / 12 : value }
function rowUnit(name: string) { if (/报关/.test(name)) return '票'; if (/电商/.test(name)) return '单'; if (/租赁/.test(name)) return '天'; return /集装箱|箱码|仓码/.test(name) ? 'TEU' : '吨' }
function resetPage() { currentPage.value = 1 }
watch([searchKeyword, selectedGroup, modalPeriod], resetPage)
watch(() => store.filters.segment, () => {
  selectedGroup.value = '全部'
  searchKeyword.value = ''
  resetPage()
})
watch(() => filteredRows.value.length, () => {
  const maxPage = Math.max(1, Math.ceil(filteredRows.value.length / pageSize))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})
</script>

<template>
  <div class="business-rank-grid-item">
  <article class="dash-card business-rank-card">
    <div class="dash-title"><b>业务线单位毛利率排名</b><a class="more-link" @click="showAll = true">查看更多 <span aria-hidden="true">›</span></a></div>
    <div class="rank-period-row"><div class="rank-period-switch" role="tablist"><button type="button" :class="{ active: period === 'month' }" @click="period = 'month'">当月</button><button type="button" :class="{ active: period === 'year' }" @click="period = 'year'">年累计</button></div></div>
    <div class="business-rank-table-wrap">
      <table class="business-rank-table">
        <thead><tr><th>业务线</th><th>单位</th><th>单位毛利率</th><th>单位收入(元)</th><th>单位变动成本(元)</th></tr></thead>
        <tbody><tr v-for="(row, index) in topRows" :key="row.name"><td><span :class="['rank-index', { 'rank-top-1': index === 0, 'rank-top-2': index === 1, 'rank-top-3': index === 2 }]">{{ index < 3 ? '♛' : index + 1 }}</span><span class="business-name" :title="row.name">{{ row.name }}</span></td><td>{{ rowUnit(row.name) }}</td><td class="rate">{{ formatValue(row.marginRate) }}%</td><td>{{ formatValue(periodValue(row.revenue)) }}</td><td>{{ formatValue(periodValue(row.cost)) }}</td></tr></tbody>
      </table>
    </div>
  </article>
  <el-dialog v-model="showAll" class="business-rank-dialog" width="calc(100vw - 48px)" top="5vh" destroy-on-close>
    <template #header><div class="rank-dialog-title"><span class="rank-dialog-icon">▥</span><span>业务线单位毛利率排名</span></div></template>
    <div class="rank-dialog-toolbar">
      <el-input v-model="searchKeyword" class="rank-search" placeholder="搜索业务线名称" clearable>
        <template #prefix><el-icon class="search-icon"><Search /></el-icon></template>
      </el-input>
      <el-select v-model="selectedGroup" class="rank-group-select" placeholder="选择一级业务">
        <el-option v-for="item in firstLevelOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <div v-if="!showStatPicker" class="rank-stat-period rank-stat-period-trigger" @click="showStatPicker = true"><span>统计期间：</span><b>{{ statPeriod.replace('-', '年') }}月</b></div>
      <el-date-picker v-else v-model="statPeriod" class="rank-stat-picker" type="month" value-format="YYYY-MM" format="YYYY年M月" size="small" @change="showStatPicker = false" />
      <div class="rank-dialog-period" role="tablist">
        <button type="button" :class="{ active: modalPeriod === 'month' }" @click="modalPeriod = 'month'">当月</button>
        <button type="button" :class="{ active: modalPeriod === 'year' }" @click="modalPeriod = 'year'">年累计</button>
      </div>
    </div>
    <div class="rank-dialog-summary">当前按单位毛利率展示业务线排名，共 {{ filteredRows.length }} 条业务线。</div>
    <div class="rank-modal-table-wrap">
      <table class="rank-modal-table">
        <thead><tr><th class="rank-col">排名</th><th class="name-col">业务线</th><th>单位</th><th>单位毛利率</th><th>单位收入(元)</th><th>单位变动成本(元)</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in pageRows" :key="row.name">
            <td class="rank-col"><span :class="['modal-rank-index', { 'rank-top-1': (currentPage - 1) * pageSize + index === 0, 'rank-top-2': (currentPage - 1) * pageSize + index === 1, 'rank-top-3': (currentPage - 1) * pageSize + index === 2 }]">{{ (currentPage - 1) * pageSize + index < 3 ? '♛' : (currentPage - 1) * pageSize + index + 1 }}</span></td>
            <td class="name-col">{{ row.name }}</td><td>{{ rowUnit(row.name) }}</td><td class="rate">{{ formatValue(row.marginRate) }}%</td><td>{{ formatValue(periodValue(row.revenue, modalPeriod)) }}</td><td>{{ formatValue(periodValue(row.cost, modalPeriod)) }}</td>
          </tr>
          <tr v-if="pageRows.length === 0"><td colspan="6" class="rank-empty">暂无匹配的业务线</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rank-dialog-footer"><span>共 {{ filteredRows.length }} 条</span><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="filteredRows.length" background layout="prev, pager, next" /></div>
  </el-dialog>
  </div>
</template>

<style scoped>
.business-rank-card{min-width:0}.rank-period-row{height:30px;display:flex;justify-content:flex-end;align-items:flex-start;margin:0 0 2px}.rank-period-switch{display:flex;align-items:center;gap:2px;padding:3px;background:#f1f5f9;border-radius:7px}.rank-period-switch button{height:21px;padding:0 10px;border:0;border-radius:5px;background:transparent;color:#64748b;font-size:11px;cursor:pointer;white-space:nowrap}.rank-period-switch button.active{background:#e3efff;color:#1677ff;font-weight:650;box-shadow:0 1px 2px rgba(30,41,59,.06)}.business-rank-table-wrap{height:252px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:transparent transparent}.business-rank-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;color:#64748b;white-space:nowrap}.business-rank-table th{height:28px;color:#94a3b8;font-weight:500;text-align:right;border-bottom:1px solid #eaf0f7;position:sticky;top:0;z-index:2;background:#fff}.business-rank-table td{height:25px;text-align:right;border-bottom:0}.business-rank-table th:first-child,.business-rank-table td:first-child{text-align:left;width:38%}.business-rank-table th,.business-rank-table td{padding:0 3px}.business-rank-table th:last-child,.business-rank-table td:last-child{padding-right:0}.business-rank-table tbody tr:hover{background:#f8fbff}.business-rank-table .rate{color:#1677ff;font-weight:650}.rank-index{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:4px;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:10px}.rank-index.rank-top-1,.rank-index.rank-top-2,.rank-index.rank-top-3{background:transparent;font-size:19px;line-height:18px;font-family:Georgia,'Times New Roman',serif;font-weight:700}.rank-index.rank-top-1{color:#f59e0b}.rank-index.rank-top-2{color:#94a3b8}.rank-index.rank-top-3{color:#d97757}.business-name{display:inline-block;max-width:calc(100% - 26px);overflow:hidden;text-overflow:ellipsis;vertical-align:middle;color:#334155;font-weight:500}.business-rank-card :deep(.el-dialog){border-radius:14px}
.business-rank-table-wrap:hover{scrollbar-color:#cbd5e1 transparent}.business-rank-table-wrap::-webkit-scrollbar{width:6px;height:6px}.business-rank-table-wrap::-webkit-scrollbar-thumb{background:transparent;border-radius:6px}.business-rank-table-wrap:hover::-webkit-scrollbar-thumb{background:#cbd5e1}.business-rank-table-wrap::-webkit-scrollbar-track{background:transparent}
</style>

<style scoped>
.business-rank-dialog :deep(.el-dialog){border-radius:16px;overflow:hidden;max-width:calc(100vw - 48px);margin:0 auto}.business-rank-dialog :deep(.el-dialog__header){margin:0;padding:18px 26px 14px;border-bottom:1px solid #eef2f7}.business-rank-dialog :deep(.el-dialog__body){padding:0 26px 18px}.rank-dialog-title{display:flex;align-items:center;gap:10px;color:#26364d;font-size:22px;font-weight:700}.rank-dialog-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#e8f4ff;color:#1687e8;font-size:18px}.rank-dialog-toolbar{display:flex;align-items:center;gap:12px;padding:18px 0 12px}.rank-search{width:245px}.rank-group-select{width:180px}.rank-stat-period{height:32px;display:flex;align-items:center;gap:5px;padding:0 12px;border:1px solid #e4eaf2;border-radius:6px;color:#7b8ba1;font-size:13px}.rank-stat-period b{color:#43546b;font-weight:650}.rank-stat-period-trigger{cursor:pointer}.rank-stat-period-trigger:hover{border-color:#b8d8ff;background:#f8fbff}.rank-stat-picker{width:160px}.rank-dialog-period{display:flex;align-items:center;margin-left:auto;padding:3px;background:#f1f5f9;border-radius:7px}.rank-dialog-period button{height:27px;padding:0 14px;border:0;border-radius:5px;background:transparent;color:#7b8ba1;font-size:13px;cursor:pointer}.rank-dialog-period button.active{background:#fff;color:#1687e8;font-weight:650;box-shadow:0 1px 3px rgba(30,41,59,.1)}.rank-dialog-summary{padding:0 0 12px;color:#7b8ba1;font-size:13px}.rank-modal-table-wrap{height:calc(90vh - 250px);min-height:360px;overflow:auto;border:1px solid #e7edf5;border-radius:8px;scrollbar-gutter:stable}.rank-modal-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;color:#334155;font-size:13px;white-space:nowrap}.rank-modal-table th{position:sticky;top:0;z-index:2;height:44px;padding:0 14px;background:#f4f7fb;color:#60738c;font-weight:650;text-align:right;border-bottom:1px solid #e2e9f2}.rank-modal-table td{height:49px;padding:0 14px;text-align:right;border-bottom:1px solid #edf1f6}.rank-modal-table th:first-child,.rank-modal-table td:first-child{text-align:left}.rank-modal-table th:nth-child(2),.rank-modal-table td:nth-child(2){text-align:left}.rank-modal-table th:last-child,.rank-modal-table td:last-child{padding-right:20px}.rank-modal-table .name-col{width:36%;overflow:hidden;text-overflow:ellipsis}.rank-modal-table .rank-col{width:80px}.rank-modal-table tbody tr:hover td{background:#f7fbff}.modal-rank-index{display:inline-grid;place-items:center;width:24px;height:24px;color:#8090a5;font-size:13px}.modal-rank-index.rank-top-1,.modal-rank-index.rank-top-2,.modal-rank-index.rank-top-3{font-size:20px;font-family:Georgia,'Times New Roman',serif;font-weight:700}.modal-rank-index.rank-top-1{color:#f59e0b}.modal-rank-index.rank-top-2{color:#94a3b8}.modal-rank-index.rank-top-3{color:#d97757}.rank-modal-table .rate{color:#1687e8;font-weight:650}.rank-empty{text-align:center!important;color:#9aa8b8}.rank-dialog-footer{display:flex;align-items:center;justify-content:space-between;padding-top:14px;color:#7b8ba1;font-size:13px}.rank-dialog-footer :deep(.el-pagination){margin-left:auto}.rank-dialog-footer :deep(.el-pagination button),.rank-dialog-footer :deep(.el-pagination .number){border-radius:5px}.rank-dialog-footer :deep(.el-pagination .is-active){background:#dff0ff;color:#1687e8}.search-icon{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;font-size:16px;color:#94a3b8}
</style>
