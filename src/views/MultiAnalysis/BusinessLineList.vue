<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { businessLineColor, cellInfo, type AnalysisPeriod, type AnalysisPoint } from '../../api/multi-analysis'

const props = defineProps<{ points: AnalysisPoint[]; periodMode: AnalysisPeriod; selected: string; hovered: string }>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string]; periodChange: [period: AnalysisPeriod] }>()
const search = ref(''); const page = ref(1); const pageSize = ref(10)
type Row = AnalysisPoint & { root: string; grossProfit: number; fixedCost: number; costRegion: string; profitRegion: string }
type Column = { key: keyof Row; label: string; width: number; kind?: 'percent' | 'change' | 'number' }
const columns: Column[] = [
  { key: 'root', label: '一级业务线', width: 130 },
  { key: 'unit', label: '业务量单位', width: 100 },
  { key: 'currentVolume', label: '当期业务量', width: 140, kind: 'number' },
  { key: 'previousVolume', label: '去年同期业务量', width: 150, kind: 'number' },
  { key: 'volumeGrowth', label: '业务量同比', width: 120, kind: 'change' },
  { key: 'currentUnitCost', label: '当期单位变动成本（元）', width: 190, kind: 'number' },
  { key: 'previousUnitCost', label: '去年同期单位变动成本（元）', width: 215, kind: 'number' },
  { key: 'costChange', label: '单位变动成本同比', width: 155, kind: 'change' },
  { key: 'margin', label: '毛利率', width: 105, kind: 'percent' },
  { key: 'grossProfit', label: '毛利（万元）', width: 140, kind: 'number' },
  { key: 'revenue', label: '营业收入（万元）', width: 150, kind: 'number' },
  { key: 'operatingCost', label: '总成本（万元）', width: 145, kind: 'number' },
  { key: 'variableCost', label: '变动成本（万元）', width: 150, kind: 'number' },
  { key: 'fixedCost', label: '固定成本（万元）', width: 150, kind: 'number' },
  { key: 'costRegion', label: '增长与成本所属区域', width: 165 },
  { key: 'profitRegion', label: '盈利与增长所属区域', width: 165 },
]
const sortKey = ref<keyof Row>('grossProfit'); const descending = ref(true)
const rows = computed<Row[]>(() => props.points.map(p => ({ ...p, root: p.name.split('-')[0], grossProfit: p.revenue-p.operatingCost, fixedCost: p.operatingCost-p.variableCost,
  costRegion: cellInfo('cost',p.volumeGrowth,p.costChange).label, profitRegion: cellInfo('profit',p.volumeGrowth,p.margin).label })))
const sorted = computed(() => rows.value.filter(p => p.name.toLowerCase().includes(search.value.trim().toLowerCase())).sort((a,b) => {
  const av=a[sortKey.value], bv=b[sortKey.value]
  const result = typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv),'zh-CN')
  return result * (descending.value ? -1 : 1)
}))
const visible = computed(() => sorted.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const number = (n:number) => n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})
function display(row:Row,col:Column) {
  const value=row[col.key]
  if (typeof value !== 'number') return value
  if (col.kind === 'percent') return `${value.toFixed(2)}%`
  if (col.kind === 'change') return `${value>0?'+':''}${value.toFixed(2)}%`
  return number(value)
}
function sort(key:keyof Row) { if(sortKey.value===key) descending.value=!descending.value; else {sortKey.value=key;descending.value=true} }
function rowClass(row:Row) {return {selected:row.id===props.selected,hovered:row.id===props.hovered}}
function cellColor(row:Row,col:Column) {
  if(col.key==='costRegion') return cellInfo('cost',row.volumeGrowth,row.costChange).color
  if(col.key==='profitRegion') return cellInfo('profit',row.volumeGrowth,row.margin).color
  return undefined
}
watch([() => props.points, search, pageSize, sortKey, descending],()=>{page.value=1})
watch(() => props.selected,id => {const index=sorted.value.findIndex(row=>row.id===id);if(index>=0)page.value=Math.floor(index/pageSize.value)+1})
function exportCsv() {
  const quote=(value:string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '')+value.replace(/"/g,'""')}"`
  const headers=['业务线名称',...columns.map(c=>c.label)]
  const body=sorted.value.map(row=>[row.name,...columns.map(col=>String(display(row,col)))])
  const csv='\uFEFF'+[headers,...body].map(row=>row.map(quote).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}))
  const link=document.createElement('a');link.href=url;link.download=`业务线清单-${props.periodMode==='year'?'年度':'月度'}.csv`;link.click();URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="analysis-panel business-line-sheet">
    <header class="sheet-header"><h2>业务线清单</h2><div class="matrix-segmented"><button v-for="period in (['year','month'] as const)" :key="period" :class="{active:periodMode===period}" @click="emit('periodChange',period)">{{ period==='year'?'年度':'月度' }}</button></div><div class="sheet-actions"><el-input v-model="search" clearable placeholder="搜索业务线名称" size="small" aria-label="搜索清单业务线" style="width:190px"/><el-button size="small" :icon="Download" :disabled="!sorted.length" @click="exportCsv">导出</el-button><span>共 {{ sorted.length }} 条业务线</span></div></header>
    <div class="sheet-scroll"><table class="sheet-table"><thead><tr><th class="sheet-name" style="min-width:250px" :class="{'sort-active':sortKey==='name'}" :aria-sort="sortKey==='name'?(descending?'descending':'ascending'):'none'"><button @click="sort('name')">业务线名称 <span class="sort-icon" aria-hidden="true"><i class="sort-up" :class="{active:sortKey==='name'&&!descending}"/><i class="sort-down" :class="{active:sortKey==='name'&&descending}"/></span></button></th><th v-for="col in columns" :key="col.key" :style="{minWidth:`${col.width}px`}" :class="{'sort-active':sortKey===col.key}" :aria-sort="sortKey===col.key?(descending?'descending':'ascending'):'none'"><button @click="sort(col.key)">{{ col.label }} <span class="sort-icon" aria-hidden="true"><i class="sort-up" :class="{active:sortKey===col.key&&!descending}"/><i class="sort-down" :class="{active:sortKey===col.key&&descending}"/></span></button></th></tr></thead><tbody><tr v-for="row in visible" :key="row.id" :class="rowClass(row)" tabindex="0" @click="emit('select',row.id)" @keydown.enter="emit('select',row.id)" @mouseenter="emit('hover',row.id)" @mouseleave="emit('hover','')" @focus="emit('hover',row.id)" @blur="emit('hover','')"><td class="sheet-name"><div :title="row.name"><i :style="{background:businessLineColor(row.root)}"/><b>{{ row.name }}</b></div></td><td v-for="col in columns" :key="col.key" :class="{'sort-active':sortKey===col.key,'sheet-region':col.key==='costRegion'||col.key==='profitRegion'}" :style="{color:cellColor(row,col)}">{{ display(row,col) }}</td></tr></tbody></table><el-empty v-if="!sorted.length" description="暂无匹配的业务线" :image-size="70"/></div>
    <footer class="sheet-footer"><span>共 {{ sorted.length }} 条</span><el-select v-model="pageSize" size="small" style="width:100px" aria-label="每页条数"><el-option v-for="n in [10,20,50]" :key="n" :value="n" :label="`${n}条/页`"/></el-select><el-pagination v-model:current-page="page" :page-size="pageSize" :total="sorted.length" layout="prev, pager, next" background small :pager-count="5"/></footer>
  </section>
</template>

<style scoped>
.business-line-sheet{padding:18px 20px;margin-bottom:18px;min-width:0}.sheet-header{display:flex;align-items:center;gap:15px;margin-bottom:16px;flex-wrap:wrap}.sheet-header h2{font-size:14px;color:#263445;margin:0;font-weight:650}.sheet-actions{margin-left:auto;display:flex;align-items:center;gap:12px;font-size:12px;color:#738194}.sheet-actions>span{white-space:nowrap}.sheet-scroll{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#cbd5e1 #f8fafc}.sheet-table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}.sheet-table th{text-align:right;color:#7b8899;font-weight:400;border-bottom:1px solid #e8eef6;padding:10px 12px;background:#fff}.sheet-table th button{display:inline-flex;align-items:center;font:inherit;color:inherit;border:0;background:transparent;cursor:pointer;white-space:nowrap;padding:0}.sheet-table th button span{font-size:9px;color:#c3cfdc;margin-left:4px}.sheet-table td{text-align:right;color:#3b4859;padding:12px;border-bottom:1px solid #edf2f7;background:#fff}.sheet-table tr{cursor:pointer}.sheet-table .sheet-name{position:sticky;left:0;z-index:1;text-align:left;box-shadow:5px 0 9px -9px #64748b;max-width:310px}.sheet-name>div{display:flex;align-items:center;gap:8px;max-width:285px}.sheet-name i{height:7px;width:7px;border-radius:50%;flex-shrink:0}.sheet-name b{font-weight:600;overflow:hidden;text-overflow:ellipsis}.sheet-table tr:hover td,.sheet-table tr.hovered td{background:#f3f9ff}.sheet-table tr.selected td{background:#def2ff}.sheet-table .sort-active,.sheet-table .sort-active button span{color:#0788ff;font-weight:600}.sheet-table .sheet-region{font-weight:600}.sheet-footer{display:flex;align-items:center;gap:14px;margin-top:18px;color:#738194;font-size:12px}.sheet-footer .el-pagination{margin-left:auto}@media(max-width:760px){.business-line-sheet{padding:16px 10px}.sheet-actions{width:100%;margin-left:0;flex-wrap:wrap;gap:8px}.sheet-actions .el-input{flex:1}.sheet-footer{gap:7px;flex-wrap:wrap}.sheet-table .sheet-name{min-width:190px!important;max-width:220px}.sheet-name>div{max-width:200px}}
.sheet-table th button .sort-icon{display:inline-flex;flex-direction:column;align-items:center;gap:2px;margin-left:6px;vertical-align:middle}
.sort-icon i{display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent}
.sort-icon .sort-up{border-bottom:6px solid #c8d6e7}
.sort-icon .sort-down{border-top:6px solid #c8d6e7}
.sort-icon .sort-up.active{border-bottom-color:#1677ff}
.sort-icon .sort-down.active{border-top-color:#1677ff}
</style>
