<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { Download, RefreshLeft } from '@element-plus/icons-vue'
import ChartPanel from '../../charts/ChartPanel.vue'
import { useDashboardStore } from '../../stores/dashboard'
import { organizationOptions } from '../../api/organizations'
import { applyForecastScenario, defaultAssumptions, defaultForecastBusiness, forecastBusinessGroups, forecastImpacts, forecastScenarios, getForecastSample, summarizeForecast, type ForecastAssumptions, type ForecastMonth } from '../../api/forecast'
import './style.css'

const store = useDashboardStore()
const business = ref(defaultForecastBusiness)
const assumptions = reactive<ForecastAssumptions>(defaultAssumptions())
const chart = ref<InstanceType<typeof ChartPanel>>()
const sample = computed(() => getForecastSample(store.filters.org, business.value, store.filters.period || ''))
const history = computed(() => sample.value?.history || [])
const baseline = computed(() => sample.value?.baseline || [])
const scenario = computed(() => applyForecastScenario(baseline.value, assumptions))
const baseTotal = computed(() => summarizeForecast(baseline.value))
const scenarioTotal = computed(() => summarizeForecast(scenario.value))
const recentTotal = computed(() => summarizeForecast(history.value.slice(-3)))
const hasScenario = computed(() => assumptions.volumeChange !== 0 || assumptions.freightChange !== 0 || assumptions.operationsChange !== 0 || assumptions.fixedChange !== 0)
const scenarioKey = computed(() => forecastScenarios.find(item => Object.keys(item.values).every(key => item.values[key as keyof ForecastAssumptions] === assumptions[key as keyof ForecastAssumptions]))?.key || 'custom')
const scenarioName = computed(() => forecastScenarios.find(item => item.key === scenarioKey.value)?.label || '自定义情景')
const scenarioDescription = computed(() => forecastScenarios.find(item => item.key === scenarioKey.value)?.description || '根据当前参数调整未来三个月的业务量、成本与售价。')
const comparedTotal = computed(() => hasScenario.value ? baseTotal.value : recentTotal.value)
const comparisonLabel = computed(() => hasScenario.value ? '较基准情景' : '较近3个月')
const impacts = computed(() => forecastImpacts(baseline.value, scenario.value))
const grossProfitDelta = computed(() => scenarioTotal.value.grossProfit - baseTotal.value.grossProfit)
const marginDelta = computed(() => scenarioTotal.value.margin - baseTotal.value.margin)
const impactMax = computed(() => Math.max(1,...impacts.value.map(item => Math.abs(item.value))))
const forecastPeriod = computed(() => baseline.value.length ? `${baseline.value[0].period} 至 ${baseline.value[2].period}` : '—')
const alertTone = computed(() => scenarioTotal.value.grossProfit < 0 ? 'danger' : marginDelta.value < -2 ? 'warning' : 'normal')
const selectedMetric = ref<'volume' | 'unitVariableCost' | 'grossProfit'>('volume')
const metricDefinitions = [
  { key: 'volume', label: '业务量', unit: 'TEU', icon: 'Box' },
  { key: 'unitVariableCost', label: '单位变动成本', unit: '元/TEU', icon: 'Coin' },
  { key: 'grossProfit', label: '毛利', unit: '万元', icon: 'TrendCharts' },
] as const
const metric = computed(() => metricDefinitions.find(item => item.key === selectedMetric.value)!)
const number = (value: number, digits = 2) => value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const signed = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${number(value, digits)}`
const percentageTooltip = (value: number) => `${value}%`
const rate = (current: number, previous: number) => previous ? (current / previous - 1) * 100 : 0
const kpis = computed(() => [
  { key: 'volume', label: '预测业务量', value: scenarioTotal.value.volume, unit: 'TEU', change: rate(scenarioTotal.value.volume,comparedTotal.value.volume), changeUnit: '%', tone: 'blue', icon: 'Box', description: '未来3个月合计' },
  { key: 'unitVariableCost', label: '预测单位变动成本', value: scenarioTotal.value.unitVariableCost, unit: '元/TEU', change: rate(scenarioTotal.value.unitVariableCost,comparedTotal.value.unitVariableCost), changeUnit: '%', tone: 'purple', icon: 'Coin', description: '按业务量加权计算' },
  { key: 'grossProfit', label: '预测毛利', value: scenarioTotal.value.grossProfit, unit: '万元', change: rate(scenarioTotal.value.grossProfit,comparedTotal.value.grossProfit), changeUnit: '%', tone: 'teal', icon: 'TrendCharts', description: '收入减营业成本' },
  { key: 'margin', label: '预测毛利率', value: scenarioTotal.value.margin, unit: '%', change: scenarioTotal.value.margin-comparedTotal.value.margin, changeUnit: '个百分点', tone: 'amber', icon: 'DataAnalysis', description: '按汇总收入与成本计算' },
])
function chooseScenario(key: string) { const item = forecastScenarios.find(item=>item.key===key); if(item)Object.assign(assumptions,item.values) }
function resetScenario() { Object.assign(assumptions,defaultAssumptions()) }
function kpiChangeTone(key: string, change: number) { if(Math.abs(change)<.005)return 'muted'; return (key==='unitVariableCost'?change<0:change>0)?'good':'bad' }
const trendOption = computed<EChartsOption>(() => {
  const key = selectedMetric.value
  const periods = [...history.value,...baseline.value].map(row=>row.period)
  const leading = Array.from({length:Math.max(0,history.value.length-1)},()=>null)
  const last = history.value[history.value.length-1]?.[key] || 0
  const lower = scenario.value.map((row,index)=>row[key]-Math.abs(row[key])*(.06+index*.025))
  const upper = scenario.value.map((row,index)=>row[key]+Math.abs(row[key])*(.06+index*.025))
  return {
    grid:{left:76,right:28,top:38,bottom:36},
    tooltip:{trigger:'axis',confine:true,textStyle:{fontSize:10},formatter:(raw:unknown)=>{
      const points=raw as {seriesName:string;dataIndex:number;value:number|null;marker:string;axisValue:string}[]
      if(!points.length)return ''
      const entries=points.filter(p=>['历史实际（模拟）','基准预测','情景测算'].includes(p.seriesName)&&p.value!==null)
      return `<b>${points[0].axisValue}</b><br/>${entries.map(p=>`${p.marker}${p.seriesName}：${number(Number(p.value))} ${metric.value.unit}`).join('<br/>')}`
    }},
    xAxis:{type:'category',data:periods,boundaryGap:false,axisTick:{show:false},axisLine:{lineStyle:{color:'#dce5f1'}},axisLabel:{fontSize:10,color:'#7b8da6',formatter:(value:string)=>value.slice(2)}},
    yAxis:{type:'value',name:metric.value.unit,nameTextStyle:{fontSize:10,color:'#94a3b8',align:'left'},axisLabel:{fontSize:10,color:'#7b8da6',formatter:(value:number)=>value>=10000?`${number(value/10000,1)}万`:number(value,0)},splitLine:{lineStyle:{color:'#eaf0f8',type:'dashed'}}},
    series:[
      {name:'区间下限',type:'line',stack:'range',stackStrategy:'all',symbol:'none',silent:true,lineStyle:{opacity:0},areaStyle:{opacity:0},data:[...leading,last,...lower],tooltip:{show:false}},
      {name:'示例波动范围',type:'line',stack:'range',stackStrategy:'all',symbol:'none',silent:true,lineStyle:{opacity:0},areaStyle:{color:hasScenario.value?'#b9a3f6':'#a9ceff',opacity:.24},data:[...leading,0,...upper.map((value,i)=>value-lower[i])],tooltip:{show:false}},
      {name:'历史实际（模拟）',type:'line',symbol:'circle',symbolSize:5,itemStyle:{color:'#4c8cf3'},lineStyle:{width:2},data:[...history.value.map(row=>row[key]),null,null,null],markLine:{silent:true,symbol:'none',lineStyle:{color:'#c3d0e2',type:'dashed'},label:{formatter:'预测起点',fontSize:10,color:'#94a3b8'},data:[{xAxis:history.value.length-1}]},markArea:{silent:true,itemStyle:{color:'#f5f9ff',opacity:.45},label:{show:false},data:[[{xAxis:history.value.length-1},{xAxis:periods.length-1}]]}},
      {name:'基准预测',type:'line',symbolSize:6,lineStyle:{color:'#4c8cf3',width:2,type:'dashed'},itemStyle:{color:'#4c8cf3'},data:[...leading,last,...baseline.value.map(row=>row[key])]},
      ...(hasScenario.value?[{name:'情景测算',type:'line' as const,symbolSize:6,lineStyle:{color:'#9270df',width:2,type:'dashed' as const},itemStyle:{color:'#9270df'},data:[...leading,last,...scenario.value.map(row=>row[key])]}]:[]),
    ],
  }
})
const tableMode = ref<'scenario'|'baseline'>('scenario')
const tableRows = computed(()=>tableMode.value==='scenario'?scenario.value:baseline.value)
const tableTotal = computed(()=>summarizeForecast(tableRows.value))
const detailColumns: {key:keyof ForecastMonth;label:string;unit:string;digits?:number}[] = [
  {key:'volume',label:'业务量',unit:'TEU',digits:0},{key:'unitRevenue',label:'单位收入',unit:'元/TEU'},
  {key:'unitVariableCost',label:'单位变动成本',unit:'元/TEU'},{key:'revenue',label:'营业收入',unit:'万元'},
  {key:'variableCost',label:'变动成本',unit:'万元'},{key:'fixedCost',label:'固定成本',unit:'万元'},
  {key:'totalCost',label:'营业成本',unit:'万元'},{key:'grossProfit',label:'毛利',unit:'万元'},{key:'margin',label:'毛利率',unit:'%'},
]
function exportDetail() {
  const quote=(value:unknown)=>`"${String(value).replace(/"/g,'""')}"`
  const rows=[['月份',...detailColumns.map(col=>`${col.label}(${col.unit})`)],...tableRows.value.map(row=>[row.period,...detailColumns.map(col=>row[col.key])]),['三个月合计 / 加权值',...detailColumns.map(col=>tableTotal.value[col.key as keyof typeof tableTotal.value])]]
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`预测分析样例-${business.value}-${tableMode.value==='scenario'?scenarioName.value:'基准情景'}.csv`;link.click();URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="forecast-page">
    <div class="filter-row forecast-filters"><el-select v-model="store.filters.org" filterable size="small" style="width:235px" aria-label="组织"><el-option v-for="org in organizationOptions" :key="org.code" :label="org.label" :value="org.value"/></el-select><el-date-picker v-model="store.filters.period" type="month" value-format="YYYY-MM" format="YYYY年M月" size="small" style="width:145px" aria-label="历史数据截至月份"/><el-select v-model="business" filterable size="small" style="width:270px" aria-label="业务线"><el-option-group v-for="group in forecastBusinessGroups" :key="group.label" :label="group.label"><el-option v-for="name in group.options" :key="name" :label="name" :value="name"/></el-option-group></el-select><span class="forecast-horizon"><el-icon><Calendar/></el-icon>未来3个月</span><span class="update-time">数据更新时间：2026-10-22</span></div>
    <header class="forecast-page-heading"><div><span class="forecast-eyebrow">经营预测</span><h1>预测分析 <span>样例</span></h1><p>结合业务量、采购运价与售价传导，观察未来三个月的成本与盈利变化。</p></div><div class="forecast-sample-badge"><i/>模拟数据 · 规则测算</div></header>
    <template v-if="sample">
      <section class="forecast-overview" :class="alertTone"><span class="forecast-overview-icon"><el-icon><TrendCharts/></el-icon></span><div><div class="forecast-overview-title">未来三个月经营展望 <small>{{ forecastPeriod }}</small></div><p v-if="hasScenario">当前为<strong>{{ scenarioName }}</strong>，预测毛利较基准{{ grossProfitDelta>=0?'增加':'减少' }} <b>{{ number(Math.abs(grossProfitDelta)) }}万元</b>，毛利率变化 <b>{{ signed(marginDelta) }}个百分点</b>。{{ scenarioTotal.grossProfit<0?'当前假设下出现亏损，建议优先检查报价传导与采购成本。':marginDelta < -2?'售价传导不足形成利润压力，可调整传导比例或采购假设对比。':'可通过右侧情景面板继续调整假设，观察经营结果。' }}</p><p v-else>按基准情景，预计完成 <b>{{ number(scenarioTotal.volume,0) }} TEU</b>，营业收入 <b>{{ number(scenarioTotal.revenue) }}万元</b>，毛利率 <b>{{ number(scenarioTotal.margin) }}%</b>。可切换情景观察需求与成本变化的影响。</p></div><span class="forecast-overview-tag">{{ scenarioName }}</span></section>
      <section class="forecast-kpis"><article v-for="card in kpis" :key="card.key" :class="card.tone"><header><span>{{ card.label }}</span><i><el-icon><component :is="card.icon"/></el-icon></i></header><div class="forecast-kpi-value"><strong>{{ number(card.value,card.key==='volume'?0:2) }}</strong><span>{{ card.unit }}</span></div><footer><span>{{ comparisonLabel }}</span><b :class="kpiChangeTone(card.key,card.change)">{{ signed(card.change) }}{{ card.changeUnit }}</b></footer><small>{{ card.description }}</small></article></section>
      <section class="forecast-main-grid">
        <article class="forecast-panel forecast-trend-panel"><header class="forecast-panel-heading"><div><h2>经营预测趋势</h2><p>历史12个月与未来3个月 · 截至 {{ store.filters.period }}</p></div><el-button :icon="Download" size="small" @click="chart?.downloadImage('经营预测趋势-样例')">导出图片</el-button></header><div class="forecast-trend-toolbar"><div class="forecast-tabs"><button v-for="item in metricDefinitions" :key="item.key" :class="{active:selectedMetric===item.key}" @click="selectedMetric=item.key">{{ item.label }}</button></div><span>{{ metric.unit }}</span></div><div class="forecast-chart-legend"><span><i class="actual"/>历史实际（模拟）</span><span><i class="baseline"/>基准预测</span><span v-if="hasScenario"><i class="scenario"/>情景测算</span><span><i class="range"/>示例波动范围</span></div><ChartPanel ref="chart" :option="trendOption" :height="335"/><footer class="forecast-chart-foot"><el-icon><InfoFilled/></el-icon>阴影为示例波动范围，随预测期延长扩大，不代表统计置信区间。</footer></article>
        <article class="forecast-panel forecast-scenario-panel"><header class="forecast-panel-heading"><div><h2>情景测算</h2><p>调整假设，即时观察成本与毛利变化</p></div><el-button :icon="RefreshLeft" text size="small" @click="resetScenario">重置</el-button></header><div class="forecast-scenario-options"><button v-for="item in forecastScenarios" :key="item.key" :class="{active:scenarioKey===item.key}" @click="chooseScenario(item.key)">{{ item.label }}</button></div><p class="forecast-scenario-description">{{ scenarioDescription }}</p>
          <div class="forecast-assumption"><label>业务量变化 <b>{{ signed(assumptions.volumeChange,0) }}%</b></label><el-slider v-model="assumptions.volumeChange" :min="-30" :max="30" :format-tooltip="percentageTooltip"/><div><span>−30%</span><span>相对基准业务量</span><span>+30%</span></div></div>
          <div class="forecast-assumption"><label>采购运价变化 <b>{{ signed(assumptions.freightChange,0) }}%</b></label><el-slider v-model="assumptions.freightChange" :min="-30" :max="30" :format-tooltip="percentageTooltip"/><div><span>−30%</span><span>仅作用于运价成本项</span><span>+30%</span></div></div>
          <div class="forecast-assumption"><label>对客售价传导比例 <b>{{ assumptions.passThrough }}%</b></label><el-slider v-model="assumptions.passThrough" :min="0" :max="100" :step="5" :format-tooltip="percentageTooltip"/><div><span>0%</span><span>采购运价变化传导至售价</span><span>100%</span></div></div>
          <div class="forecast-lag"><span>售价传导滞后</span><div><button v-for="lag in [0,1,2]" :key="lag" :class="{active:assumptions.priceLag===lag}" @click="assumptions.priceLag=lag">{{ lag===0?'即时':`${lag}个月` }}</button></div></div>
          <details class="forecast-advanced"><summary>更多成本假设 <el-icon><ArrowDown/></el-icon></summary><div class="forecast-assumption"><label>单位操作成本变化 <b>{{ signed(assumptions.operationsChange,0) }}%</b></label><el-slider v-model="assumptions.operationsChange" :min="-15" :max="15"/></div><div class="forecast-assumption"><label>固定成本变化 <b>{{ signed(assumptions.fixedChange,0) }}%</b></label><el-slider v-model="assumptions.fixedChange" :min="-20" :max="20"/></div></details>
          <div class="forecast-scenario-result"><span>相对基准毛利变化</span><strong :class="grossProfitDelta>=0?'good':'bad'">{{ signed(grossProfitDelta) }} <small>万元</small></strong></div>
        </article>
      </section>
      <section class="forecast-secondary-grid">
        <article class="forecast-panel forecast-market-panel"><header class="forecast-panel-heading"><div><h2>市场信号</h2><p>候选外部指标 · 以下均为模拟值，未读取实时行情</p></div><span class="forecast-subtle-tag">拟接入数据源</span></header><div class="forecast-table-scroll"><table class="forecast-market-table"><thead><tr><th>市场指标</th><th>示例值</th><th>示例环比</th><th>关注方向</th><th>拟接入来源</th></tr></thead><tbody><tr v-for="signal in sample.signals" :key="signal.name"><td><strong>{{ signal.name }}</strong><small>示例统计期 {{ store.filters.period }}</small></td><td>{{ number(signal.value,signal.unit==='点'?2:1) }}<small>{{ signal.unit }}</small></td><td><span :class="signal.change>=0?'forecast-signal-up':'forecast-signal-down'">{{ signed(signal.change,1) }}{{ signal.unit==='%'?'个百分点':'%' }}</span></td><td>{{ signal.target }}</td><td><a :href="signal.url" target="_blank" rel="noopener noreferrer">{{ signal.source }} <span>↗</span></a></td></tr></tbody></table></div><footer class="forecast-market-foot">市场综合指数仅作为背景信号，正式接入时需匹配航线、箱型、币种及合同价格机制。</footer></article>
        <article class="forecast-panel forecast-impact-panel"><header class="forecast-panel-heading"><div><h2>毛利影响拆解</h2><p>当前情景相对基准的增减 · 单位：万元</p></div></header><div class="forecast-impact-list"><div v-for="item in impacts" :key="item.name" class="forecast-impact-row"><div><span>{{ item.name }}</span><strong :class="item.value>=0?'good':'bad'">{{ signed(item.value) }}</strong></div><div class="forecast-impact-track"><i :style="{width:`${Math.abs(item.value)/impactMax*100}%`,background:item.value>=0?'#35b69a':'#e99595'}"/></div></div></div><footer class="forecast-impact-total"><span>毛利变化合计</span><strong :class="grossProfitDelta>=0?'good':'bad'">{{ signed(grossProfitDelta) }} <small>万元</small></strong></footer></article>
      </section>
      <section class="forecast-panel forecast-detail-panel"><header class="forecast-panel-heading"><div><h2>月度预测明细</h2><p>{{ business }} · {{ forecastPeriod }}</p></div><div class="forecast-detail-tools"><div class="forecast-tabs"><button :class="{active:tableMode==='scenario'}" @click="tableMode='scenario'">当前情景</button><button :class="{active:tableMode==='baseline'}" @click="tableMode='baseline'">基准情景</button></div><el-button :icon="Download" size="small" @click="exportDetail">导出</el-button></div></header><div class="forecast-table-scroll"><table class="forecast-detail-table"><thead><tr><th>预测月份</th><th v-for="column in detailColumns" :key="column.key">{{ column.label }}<small>（{{ column.unit }}）</small></th></tr></thead><tbody><tr v-for="row in tableRows" :key="row.period"><td><strong>{{ row.period }}</strong><span class="forecast-predicted-tag">预测</span></td><td v-for="column in detailColumns" :key="column.key" :class="{'forecast-emphasis':column.key==='grossProfit','bad':column.key==='grossProfit'&&row.grossProfit<0}">{{ number(Number(row[column.key]),column.digits??2) }}{{ column.key==='margin'?'%':'' }}</td></tr></tbody><tfoot><tr><td>三个月合计 / 加权值</td><td v-for="column in detailColumns" :key="column.key">{{ number(tableTotal[column.key as keyof typeof tableTotal],column.digits??2) }}{{ column.key==='margin'?'%':'' }}</td></tr></tfoot></table></div></section>
      <details class="forecast-methodology"><summary><el-icon><InfoFilled/></el-icon>样例测算说明与指标口径 <el-icon><ArrowDown/></el-icon></summary><div><p>业务范围：当前展示集装箱业务样例，业务量统一使用 TEU。历史与预测数据均为模拟数据，不代表中国外运真实经营情况。</p><p>基准预测：根据样例历史季节性与价格趋势生成未来3个月的数据，未使用训练模型或真实市场指数拟合。情景假设相对基准生效，采购运价变化按指定比例和滞后期传导至对客售价。</p><p>变动成本 = 业务量 ×（单位运价成本 + 单位操作成本）；样例营业成本 = 变动成本 + 纳入营业成本的固定成本；毛利 = 营业收入 − 营业成本。管理、销售及财务费用未计入本样例毛利。</p><p>业务量、收入和成本按月合计；单位收入与单位变动成本按业务量加权；毛利率按汇总收入及营业成本计算。毛利影响按业务量、运价及售价、操作成本、固定成本依次拆解，合计与情景差额一致。</p><p>示例波动范围仅用于演示不确定性表达，尚无回测误差或覆盖率依据。正式应用需接入订单、采购、报价和成本数据，并按当时已发布的外部信息开展回测。</p></div></details>
    </template>
    <el-empty v-else description="请选择有效的历史截至月份以展示预测样例"/>
  </div>
</template>
