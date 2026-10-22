<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption, ECElementEvent } from 'echarts'
import ChartPanel from '../../charts/ChartPanel.vue'
import { band, cellInfo, costCuts, growthCuts, marginCuts, businessLineColor, type AnalysisPeriod, type AnalysisMode, type AnalysisPoint } from '../../api/multi-analysis'

const props = defineProps<{ mode: AnalysisMode; points: AnalysisPoint[]; selected: string; hovered: string; periodMode: AnalysisPeriod }>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string]; periodChange: [period: AnalysisPeriod] }>()
const sizeOptions = [
  { key: 'revenue', label: '收入', detailLabel: '营业收入' },
  { key: 'variableCost', label: '变动成本', detailLabel: '变动成本' },
  { key: 'currentVolume', label: '业务量', detailLabel: '业务量' },
  { key: 'operatingCost', label: '总成本', detailLabel: '总成本' },
] as const
type SizeKey = (typeof sizeOptions)[number]['key']
const search = ref(''); const selectedRoot = ref(''); const hoveredRoot = ref(''); const sizeKey = ref<SizeKey>(props.mode === 'cost' ? 'variableCost' : 'revenue')
const sizeMetric = computed(() => sizeOptions.find(item => item.key === sizeKey.value)!)
const title = computed(() => props.mode === 'cost' ? '业务增长与成本控制' : '盈利能力与业务增长')
const yTitle = computed(() => props.mode === 'cost' ? '单位变动成本同比变化率（%）' : '毛利率（%）')
const yValue = (p: AnalysisPoint) => props.mode === 'cost' ? p.costChange : p.margin
const info = (p: AnalysisPoint) => cellInfo(props.mode, p.volumeGrowth, yValue(p))
const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sizeValue = (point: AnalysisPoint) => `${money(point[sizeKey.value])} ${sizeKey.value === 'currentVolume' ? point.unit : '万元'}`
const pct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
const rootName = (p: AnalysisPoint) => p.name.split('-')[0]
const groups = computed(() => [...new Set(props.points.map(rootName))])
const activeRoot = computed(() => hoveredRoot.value || selectedRoot.value)
const shown = computed(() => props.points.filter(p => !activeRoot.value || rootName(p) === activeRoot.value))
const filtered = computed(() => shown.value.filter(p => p.name.toLowerCase().includes(search.value.trim().toLowerCase())))
const selectedPoint = computed(() => shown.value.find(p => p.id === props.selected))
function toggleRoot(root: string) {
  selectedRoot.value = selectedRoot.value === root ? '' : root
  const point = props.points.find(p => p.id === props.selected)
  if (point && selectedRoot.value && rootName(point) !== selectedRoot.value) emit('select', '')
  emit('hover', '')
}
function previewRoot(root: string) {
  hoveredRoot.value = root
  emit('hover', '')
}
watch(() => props.points, () => { selectedRoot.value = ''; hoveredRoot.value = '' })
function pick(params: ECElementEvent) { if (params.seriesType === 'scatter') emit('select', (params.data as unknown as { id: string }).id) }
function hover(params: ECElementEvent) { if (params.seriesType === 'scatter') emit('hover', (params.data as unknown as { id: string }).id) }
function bounds(values: number[], cuts: readonly number[]) {
  const lo = Math.min(...values, cuts[0]); const hi = Math.max(...values, cuts[1]); const padding = Math.max(2, (hi - lo) * .15)
  return [Math.floor((lo-padding)/5)*5, cuts[0], cuts[1], Math.ceil((hi+padding)/5)*5]
}
// 分段映射使九个格子等宽，坐标刻度保留实际百分比。
function position(value: number, edges: number[]) { const i = band(value, edges.slice(1,3)); return i + (value-edges[i])/(edges[i+1]-edges[i]) }
const option = computed<EChartsOption>(() => {
  const x = bounds(props.points.map(p => p.volumeGrowth), growthCuts)
  const y = bounds(props.points.map(yValue), props.mode === 'cost' ? costCuts : marginCuts)
  const maxSize = Math.max(1,...props.points.map(p=>p[sizeKey.value]))
  const active = [props.hovered, props.selected].find(id => shown.value.some(p => p.id === id)) || ''
  const areas = []
  for (let row=0;row<3;row++) for(let col=0;col<3;col++) {
    const cell = cellInfo(props.mode, (x[col]+x[col+1])/2, (y[row]+y[row+1])/2)
    areas.push([{ name: cell.label, xAxis: col, yAxis: row, itemStyle: { color: cell.soft }, label: { color: cell.color } }, { xAxis: col+1, yAxis: row+1 }])
  }
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
  return {
    grid: { left: 76, right: 28, top: 34, bottom: 76 },
    tooltip: { trigger: 'item', renderMode: 'html', confine: true, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, padding: 0,
      extraCssText: 'border-radius:12px;box-shadow:0 8px 28px rgba(30,41,59,.10);max-width:calc(100% - 12px);white-space:normal;pointer-events:none;',
      textStyle: { fontSize: 10, color: '#1e293b' }, formatter: (raw: unknown) => {
      const data = (raw as { data?: { point?: AnalysisPoint } }).data?.point
      if (!data) return ''
      const cell = info(data)
      const growthBand = band(data.volumeGrowth, growthCuts)
      const metricBand = band(yValue(data), props.mode === 'cost' ? costCuts : marginCuts)
      const growthColor = ['#e27978','#1677ff','#20a88a'][growthBand]
      const metricColor = (props.mode === 'cost' ? ['#20a88a','#1677ff','#e27978'] : ['#e27978','#1677ff','#20a88a'])[metricBand]
      const row = (label: string, value: string, color?: string, strong = false) => `<div class="matrix-tip-row"><span>${escape(label)}</span><span class="matrix-tip-value${strong ? ' is-bold' : ''}"${color ? ` style="color:${color}"` : ''}>${escape(value)}</span></div>`
      const group = (content: string) => `<div class="matrix-tip-group">${content}</div>`
      const metricGroup = props.mode === 'cost'
        ? row('当期单位变动成本', `${money(data.currentUnitCost)} 元/${data.unit}`)
          + row('去年同期单位变动成本', `${money(data.previousUnitCost)} 元/${data.unit}`)
          + row('单位变动成本同比', pct(data.costChange))
          + row('成本变化所属区域', ['成本下降','成本平稳','成本上升'][metricBand], metricColor, true)
        : row('毛利率', `${data.margin.toFixed(1)}%`)
          + row('毛利率所属区域', ['低毛利','中等毛利','高毛利'][metricBand], metricColor, true)
          + row('营业成本', `${money(data.operatingCost)} 万元`)
      return `<div class="matrix-tip-card">
        <div class="matrix-tip-top"><span class="matrix-tip-badge"><i style="background:${businessLineColor(rootName(data))}"></i>气泡大小：${sizeMetric.value.label}</span></div>
        <div class="matrix-tip-title">${escape(data.name)}</div>
        <div class="matrix-tip-basic">${row('一级业务线', rootName(data))}${row('统计口径', props.periodMode === 'year' ? '年度累计' : '当月')}${row('业务量单位', data.unit)}</div>
        ${group(row('当期业务量', `${money(data.currentVolume)} ${data.unit}`) + row('去年同期业务量', `${money(data.previousVolume)} ${data.unit}`) + row('业务量同比', pct(data.volumeGrowth)) + row('增长所属区域', ['业务量下降','业务量平稳','业务量增长'][growthBand], growthColor, true))}
        ${group(metricGroup)}
        ${group(row(sizeMetric.value.detailLabel, sizeValue(data), undefined, true) + `<div class="matrix-tip-row"><span>所属区域</span><span class="matrix-tip-category" style="color:${cell.color};background:${cell.soft}">${escape(cell.label)}</span></div>`)}
      </div>`
    } },
    xAxis: { type: 'value', min: 0, max: 3, interval: 1,
      axisLabel: { formatter: (v: number) => `${x[Math.round(v)]}%`, fontSize: 11 }, axisLine: { show: true, lineStyle: { color: '#cbd5e1' } }, splitLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'value', min: 0, max: 3, interval: 1, name: `Y · ${yTitle.value}`, nameLocation: 'end', nameTextStyle: { align: 'left', padding: [0,0,0,-54], fontSize: 11, fontWeight: 700 },
      axisLabel: { formatter: (v: number) => `${y[Math.round(v)]}%`, fontSize: 11 }, splitLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'scatter', symbolSize: (value: number[]) => Math.sqrt(value[2] / maxSize) * 46 + 5,
      emphasis: { scale: 1.2 },
      markArea: { silent: true, label: { show: true, position: 'insideTopLeft', fontSize: 10, padding: [8,5] }, data: areas as never },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#9DAFC9', type: 'solid', width: 1 }, data: [{xAxis:1},{xAxis:2},{yAxis:1},{yAxis:2}] },
      data: [...shown.value].sort((a,b)=>b[sizeKey.value]-a[sizeKey.value]).map(p=>({
        id: p.id, name: p.name, point: p, value: [position(p.volumeGrowth,x),position(yValue(p),y),p[sizeKey.value]],
        itemStyle: { color: businessLineColor(rootName(p)), opacity: search.value && !filtered.value.some(f=>f.id===p.id) ? .08 : active && active !== p.id ? .2 : active === p.id ? 1 : .9,
          borderColor: active === p.id ? '#1677ff' : '#fff', borderWidth: active === p.id ? 3 : 1 },
        z: active === p.id ? 10 : 1,
      })) }],
  }
})
</script>

<template>
  <section class="analysis-panel matrix-section">
    <header class="matrix-head"><h2>{{ title }}九宫格分析</h2><p>{{ mode === 'cost' ? '横轴为业务量同比增长率，纵轴为单位变动成本同比变化率，结合成本规模定位增长过程中的成本变化。' : '横轴为业务量同比增长率，纵轴为毛利率，结合收入规模观察不同业务线的增长质量与盈利表现。' }}气泡颜色代表一级业务线，点击气泡或右侧业务线可联动查看。</p></header>
    <div class="matrix-toolbar">
      <div class="matrix-controls"><span>时间</span><div class="matrix-segmented"><button v-for="item in (['year','month'] as const)" :key="item" :class="{active:periodMode===item}" @click="emit('periodChange',item)">{{ item==='year'?'年度':'月度' }}</button></div><span>气泡大小</span><div class="matrix-segmented"><button v-for="item in sizeOptions" :key="item.key" :class="{active:sizeKey===item.key}" @click="sizeKey=item.key">{{ item.label }}</button></div></div>
      <div class="business-legend" aria-label="一级业务线图例"><button v-for="root in groups" :key="root" :class="{muted:activeRoot && activeRoot!==root, 'legend-selected':selectedRoot===root}" :aria-pressed="selectedRoot===root" @mouseenter="previewRoot(root)" @mouseleave="hoveredRoot=''" @focus="previewRoot(root)" @blur="hoveredRoot=''" @click="toggleRoot(root)"><i :style="{background:businessLineColor(root)}"/>{{ root }}</button></div>
    </div>
    <div class="matrix-body">
      <div class="matrix-plot"><ChartPanel :option="option" :height="640" @click="pick" @mouseover="hover" @globalout="emit('hover','')" /><div class="matrix-x-axis-title">X · 业务量同比增长率（%）</div><el-empty v-if="!shown.length" class="matrix-empty" description="暂无展示数据，请调整筛选或业务线图例" :image-size="70" /></div>
      <aside class="business-sidebar"><div class="business-search"><el-input v-model="search" clearable placeholder="请输入业务线名称搜索" size="small" aria-label="搜索业务线"/><div><strong>共 {{ filtered.length }} 条业务线</strong><button v-if="selected" @click="emit('select','')">清除选择</button></div></div>
        <ul class="business-list"><li v-for="p in filtered" :key="p.id"><button :title="p.name" :class="{selected:selected===p.id,hovered:hovered===p.id}" @click="emit('select',p.id)" @mouseenter="emit('hover',p.id)" @mouseleave="emit('hover','')" @focus="emit('hover',p.id)" @blur="emit('hover','')"><i :style="{background:businessLineColor(rootName(p))}"/><span>{{ p.name }}</span></button></li></ul>
        <div v-if="selectedPoint" class="business-selection"><b>{{ selectedPoint.name }}</b><span>业务量同比 <strong>{{ pct(selectedPoint.volumeGrowth) }}</strong></span><span>{{ mode==='cost'?'单位变动成本同比':'毛利率' }} <strong>{{ mode==='cost'?pct(selectedPoint.costChange):`${selectedPoint.margin.toFixed(1)}%` }}</strong></span><span>{{ sizeMetric.detailLabel }} <strong>{{ sizeValue(selectedPoint) }}</strong></span><small :style="{color:info(selectedPoint).color}">{{ info(selectedPoint).label }}</small></div>
      </aside>
    </div>
    <footer class="matrix-foot"><span>增长分界：−5% / 5% · {{ mode==='cost'?'成本变化分界：−3% / 3%':'毛利率分界：15% / 25%' }} · 年度为年初至所选月份累计</span><span>模拟数据 · 坐标按区间分段映射</span></footer>
  </section>
</template>

<style scoped>
.business-legend button.legend-selected{color:#1677ff;font-weight:650;text-decoration:none}
.matrix-x-axis-title{position:absolute;left:76px;right:28px;bottom:18px;text-align:right;color:#64748b;font-size:11px;font-weight:700;line-height:18px;pointer-events:none}
</style>

<style>
.matrix-tip-card{width:290px;max-width:100%;padding:12px 14px;color:#1e293b;font-size:10px;line-height:1.65;box-sizing:border-box}
.matrix-tip-top{display:flex;justify-content:flex-end;margin-bottom:5px}
.matrix-tip-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 6px;border:1px solid #e2e8f0;border-radius:5px;background:#f8fafc;color:#758194;white-space:nowrap}
.matrix-tip-badge i{height:7px;width:7px;border-radius:50%;display:inline-block}
.matrix-tip-title{font-size:13px;font-weight:700;color:#101828;line-height:1.6;margin:3px 0 6px;overflow-wrap:anywhere}
.matrix-tip-row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin:4px 0;color:#738194}
.matrix-tip-row>span:first-child{flex-shrink:0}
.matrix-tip-value{color:#263445;text-align:right;overflow-wrap:anywhere;min-width:0;font-variant-numeric:tabular-nums}
.matrix-tip-value.is-bold{font-weight:650}
.matrix-tip-group{border-top:1px solid #edf0f5;padding-top:8px;margin-top:9px}
.matrix-tip-category{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;line-height:1.6;text-align:right}
</style>
