<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { ECElementEvent, EChartsOption } from 'echarts'
import { page1Modules } from '../api/mock'
import { formatValue } from '../utils/format'
import ChartPanel from './ChartPanel.vue'
import { Search } from '@element-plus/icons-vue'

const colors = ['#5b8def', '#2dbda8', '#f08a8a', '#f4b042', '#a78bfa', '#94a3b8']
const sourceRows = page1Modules.costElementComposition
const hoveredIndex = ref<number | null>(null)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function enterRow(index: number) { if (hoverTimer) clearTimeout(hoverTimer); hoveredIndex.value = index }
function leaveRow() { if (hoverTimer) clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { hoveredIndex.value = null }, 80) }
function hoverSlice(params: ECElementEvent) {
  if (params.componentType === 'series' && typeof params.dataIndex === 'number') enterRow(params.dataIndex)
}
onBeforeUnmount(() => { if (hoverTimer) clearTimeout(hoverTimer) })
const period = ref<'month' | 'year'>('month')
const showDetail = ref(false)
const expandedSubjects = ref<Set<string>>(new Set())
const detailChildren: Record<string, string[]> = {
  '直接成本': ['水路运输', '运输环节', '航空运输', '铁路运输', '公路运输', '多式联运', '关务环节', '代理服务环节', '仓储环节', '港区环节', '箱管环节', '增值环节', '租赁费', '资产类'],
  '操作费用': ['业务招待费', '差旅交通费', '通讯费', '会议费', '物业管理费', '租金、租赁费', '修理维护费'],
  '管理费用': ['业务招待费', '办公费', '差旅费', '专项费用-咨询费', '专项费用-审计费', '职工薪酬'],
  '营业费用': ['广告费', '宣传费', '展览费', '业务招待费', '办公费', '差旅费'],
  '财务费用': ['利息支出', '利息支出', '利息收入', '手续费支出'],
  '税金及附加': ['城市维护建设税', '教育费附加', '地方教育费附加', '印花税', '房产税', '其他税费'],
}
const detailGroups = computed(() => rows.value.map((row, index) => ({ ...row, children: detailChildren[row.name] ?? [], expanded: expandedSubjects.value.has(row.name), detailValue: row.year + 18 + index * 3 })))
function toggleSubject(name: string) { const next = new Set(expandedSubjects.value); next.has(name) ? next.delete(name) : next.add(name); expandedSubjects.value = next }
const total = sourceRows.reduce((sum, row) => sum + row.value, 0)
const rows = computed(() => sourceRows.map((row, index) => ({
  ...row,
  month: row.value,
  monthShare: row.value / total * 100,
  qoq: [-3.2, 4.8, 2.1, -1.6, 3.7, 1.2][index],
  year: row.value * 12,
  yearShare: row.value / total * 100,
  yoy: [6.4, 3.1, -2.6, 4.2, 1.8, 2.9][index],
})))
expandedSubjects.value = new Set(rows.value.slice(0, 2).map(row => row.name))
const pieOption = computed<EChartsOption>(() => ({
  color: colors,
  tooltip: { trigger: 'item', confine: true, textStyle: { fontSize: 10 }, formatter: (params: any) => `${params.name}：${formatValue(Number(params.value))} 万元` },
  series: [{ type: 'pie', emphasis: { scale: true, scaleSize: 6, focus: 'self', itemStyle: { opacity: 1, borderWidth: 0, borderColor: 'transparent', shadowBlur: 0, shadowColor: 'transparent' } }, blur: { itemStyle: { opacity: .24 } }, radius: ['40%', '68%'], center: ['50%', '50%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 0 }, data: sourceRows.map((row, index) => ({ ...row, value: period.value === 'month' ? row.value : row.value * 12, itemStyle: hoveredIndex.value === null ? {} : { opacity: hoveredIndex.value === index ? 1 : .24 } })) }],
}))
</script>

<template>
  <div class="element-card-grid-item">
  <article class="dash-card element-card">
    <div class="dash-title"><b>按科目分析</b><a class="more-link" @click="showDetail = true">查看更多 <span aria-hidden="true">›</span></a></div><div class="period-switch-row"><div class="period-switch" role="tablist"><button type="button" :class="{ active: period === 'month' }" @click="period = 'month'">当月</button><button type="button" :class="{ active: period === 'year' }" @click="period = 'year'">年累计</button></div></div>
    <div class="element-card-body">
      <div class="element-chart"><ChartPanel :option="pieOption" :height="258" @mouseover="hoverSlice" @globalout="leaveRow" /></div>
      <div class="element-table-wrap">
        <table class="element-table">
          <thead><tr><th>成本科目</th><th>{{ period === 'month' ? '本月' : '年累计' }}</th><th>{{ period === 'month' ? '本月占比' : '年累计占比' }}</th><th>{{ period === 'month' ? '环比' : '同比' }}</th></tr></thead>
          <tbody><tr v-for="(row, index) in rows" :key="row.name" :class="{ 'is-hovered': hoveredIndex === index }" @mouseenter="enterRow(index)" @mouseleave="leaveRow"><td><span class="element-name"><i :style="{ background: colors[index] }" />{{ row.name }}</span></td><td>{{ formatValue(period === 'month' ? row.month : row.year) }}</td><td>{{ formatValue(period === 'month' ? row.monthShare : row.yearShare) }}%</td><td :class="(period === 'month' ? row.qoq : row.yoy) < 0 ? 'is-down' : 'is-up'">{{ (period === 'month' ? row.qoq : row.yoy) > 0 ? '+' : '' }}{{ formatValue(period === 'month' ? row.qoq : row.yoy) }}%</td></tr></tbody>
        </table>
      </div>
    </div>
  </article>
  <el-dialog v-model="showDetail" class="subject-detail-dialog" width="calc(100vw - 48px)" top="5vh" destroy-on-close>
    <template #header><div class="subject-dialog-title"><span class="subject-title-line"></span><span>成本科目明细表</span></div></template>
    <div class="subject-dialog-toolbar"><div></div><div class="subject-toolbar-right"><el-input placeholder="请输入关键字搜索" clearable style="width:220px"><template #prefix><el-icon class="subject-search-icon"><Search /></el-icon></template></el-input></div></div>
    <div class="subject-dialog-summary">当前展示成本科目及其二级成本要素，共 {{ detailGroups.length }} 个一级科目。</div>
    <div class="subject-table-wrap"><table class="subject-detail-table"><thead><tr><th class="subject-name-col">序号 / 成本科目</th><th>本月</th><th>本月占比</th><th>环比</th><th>年累计</th><th>年累计占比</th><th>同比</th></tr></thead><tbody><template v-for="(group,index) in detailGroups" :key="group.name"><tr class="subject-level-one" @click="toggleSubject(group.name)"><td class="subject-name-col"><span class="expand-icon" :class="{ expanded: group.expanded }">›</span><span class="subject-index">{{ String(index + 1).padStart(2,'0') }}</span><b>{{ group.name }}</b></td><td>{{ formatValue(group.month) }}</td><td>{{ formatValue(group.monthShare) }}%</td><td :class="group.qoq < 0 ? 'is-down' : 'is-up'">{{ group.qoq > 0 ? '+' : '' }}{{ formatValue(group.qoq) }}%</td><td>{{ formatValue(group.year) }}</td><td>{{ formatValue(group.yearShare) }}%</td><td :class="group.yoy < 0 ? 'is-down' : 'is-up'">{{ group.yoy > 0 ? '+' : '' }}{{ formatValue(group.yoy) }}%</td></tr><tr v-for="(child, childIndex) in (group.expanded ? group.children : [])" :key="group.name + child" class="subject-level-two"><td class="subject-name-col"><span class="child-indent"></span>{{ child }}</td><td>{{ formatValue(group.month * (0.12 + childIndex * .035)) }}</td><td>{{ formatValue(4.8 + childIndex * 1.2) }}%</td><td class="is-down">-{{ formatValue(1.1 + childIndex * .4) }}%</td><td>{{ formatValue(group.year * (0.12 + childIndex * .035)) }}</td><td>{{ formatValue(4.8 + childIndex * 1.2) }}%</td><td class="is-up">+{{ formatValue(2.1 + childIndex * .5) }}%</td></tr></template></tbody></table></div>
    <div class="subject-dialog-footer"><span>共 {{ detailGroups.length }} 个一级科目</span><el-pagination :page-size="10" :total="detailGroups.length" background layout="prev, pager, next" /></div>
  </el-dialog>
  </div>
</template>

<style scoped>
.element-card{min-width:0}.element-card .dash-title{margin-bottom:4px}.period-switch-row{height:30px;display:flex;justify-content:flex-end;align-items:flex-start;margin:0 0 2px}.element-card-body{display:flex;align-items:center;min-width:0;height:258px}.element-chart{flex:0 0 40%;min-width:105px;height:258px}.element-table-wrap{flex:1;min-width:0;overflow-x:auto;scrollbar-gutter:stable}.element-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;font-size:9px;color:#64748b;white-space:nowrap}.element-table th{height:23px;color:#94a3b8;font-weight:500;text-align:right;}.element-table td{height:24px;text-align:right}.element-table th:first-child,.element-table td:first-child{text-align:left}.element-name{display:inline-flex;align-items:center;gap:4px;color:#334155}.element-name i{width:7px;height:7px;border-radius:2px;flex:none}.element-table .is-up{color:#e05252}.element-table .is-down{color:#159570}.element-table th,.element-table td{padding:0 3px}.element-table th:first-child,.element-table td:first-child{padding-left:5px}.element-table th:last-child,.element-table td:last-child{padding-right:5px}
@media(max-width:1200px){.element-chart{flex-basis:38%;min-width:95px}.element-table{font-size:8px}.element-table th,.element-table td{padding:0 2px}}
@media(max-width:760px){.element-card-body{height:auto;align-items:stretch}.element-chart{flex-basis:38%;height:240px}.element-table{font-size:9px}}
.element-table tbody tr{transition:background-color .18s,box-shadow .18s}.element-table tbody tr:hover td,.element-table tbody tr.is-hovered td{background:#eef6ff;box-shadow:inset 0 1px #b9d8ff,inset 0 -1px #b9d8ff;color:#1e293b}.element-table tbody tr:hover td:first-child,.element-table tbody tr.is-hovered td:first-child{box-shadow:inset 1px 0 #b9d8ff,inset 0 1px #b9d8ff,inset 0 -1px #b9d8ff;border-radius:10px 0 0 10px}.element-table tbody tr:hover td:last-child,.element-table tbody tr.is-hovered td:last-child{box-shadow:inset -1px 0 #b9d8ff,inset 0 1px #b9d8ff,inset 0 -1px #b9d8ff;border-radius:0 10px 10px 0}.element-table tbody tr.is-hovered .element-name{font-weight:600}
.period-switch{display:flex;align-items:center;gap:2px;padding:3px;background:#f1f5f9;border-radius:7px;flex:none}.period-switch button{height:21px;padding:0 10px;border:0;border-radius:5px;background:transparent;color:#64748b;font-size:11px;cursor:pointer;white-space:nowrap}.period-switch button.active{background:#e3efff;color:#1677ff;font-weight:650;box-shadow:0 1px 2px rgba(30,41,59,.06)}
.subject-detail-dialog :deep(.el-dialog){border-radius:16px;overflow:hidden;max-width:calc(100vw - 48px)}.subject-detail-dialog :deep(.el-dialog__header){padding:18px 26px 14px;margin:0;border-bottom:1px solid #e8edf4}.subject-detail-dialog :deep(.el-dialog__body){padding:0 26px 18px}.subject-dialog-title{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;color:#26364d}.subject-title-line{width:4px;height:24px;border-radius:3px;background:#1677ff}.subject-dialog-toolbar{display:flex;align-items:center;justify-content:space-between;padding:16px 0 12px}.subject-tabs,.subject-period{display:flex;gap:2px;padding:3px;background:#f1f5f9;border-radius:7px}.subject-tabs button,.subject-period button{height:30px;padding:0 15px;border:0;border-radius:5px;background:transparent;color:#60738c;font-size:13px;cursor:pointer}.subject-tabs button.active,.subject-period button.active{background:#fff;color:#1677ff;font-weight:650;box-shadow:0 1px 3px rgba(30,41,59,.1)}.subject-toolbar-right{display:flex;align-items:center;gap:10px}.subject-dialog-summary{padding:0 0 12px;color:#7b8ba1;font-size:13px}.subject-table-wrap{height:calc(90vh - 245px);min-height:360px;overflow:auto;border:1px solid #e2e9f2;border-radius:8px;scrollbar-gutter:stable}.subject-detail-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px;color:#53657b;white-space:nowrap}.subject-detail-table th{position:sticky;top:0;z-index:2;height:40px;padding:0 12px;background:#f1f5f9;color:#60738c;text-align:right;font-weight:650;border-bottom:1px solid #e2e9f2}.subject-detail-table td{height:40px;padding:0 12px;text-align:right;border-bottom:1px solid #edf1f6}.subject-detail-table th:first-child,.subject-detail-table td:first-child{text-align:left}.subject-name-col{width:42%}.subject-level-one{cursor:pointer;background:#fff}.subject-level-one:hover td{background:#f5f9ff}.subject-level-one td b{color:#26364d}.subject-level-two td{background:#fbfcfe;color:#71839a}.subject-level-two .subject-name-col{padding-left:24px}.expand-icon{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:7px;color:#71839a;font-size:20px;line-height:16px;transition:transform .2s}.expand-icon.expanded{transform:rotate(90deg);color:#1677ff}.subject-index{display:inline-block;width:30px;color:#8494a8}.child-indent{display:inline-block;width:22px}.child-tag{display:inline-block;margin-right:8px;padding:3px 6px;border-radius:4px;background:#edf4ff;color:#4f83c7;font-size:11px}.subject-detail-table .is-up{color:#e05252}.subject-detail-table .is-down{color:#159570}.subject-dialog-footer{display:flex;align-items:center;justify-content:space-between;padding-top:14px;color:#7b8ba1;font-size:13px}.subject-dialog-footer :deep(.el-pagination){margin-left:auto}
.subject-search-icon{display:inline-flex;width:20px;height:20px;font-size:16px;line-height:20px;color:#94a3b8;align-items:center;justify-content:center}
</style>
