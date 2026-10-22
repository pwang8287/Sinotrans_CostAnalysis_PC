<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Search, Setting, Fold, Expand } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import ChartPanel from '../../charts/ChartPanel.vue'
import QuerySection from './QuerySection.vue'
import TemplateMenu from './TemplateMenu.vue'
import { organizationOptions } from '../../api/organizations'
import { businessOptions } from '../../api/mock'
import { getBusinessLinePathsForCategory } from '../../api/business-lines'
import { aggregateFacts, builtinQueryTemplates, calculateFormula, copyConfig, defaultQueryConfig, metricUnit, metricValue, periodLabel, queryConfigError, queryDimensions, queryFacts, queryMetrics, type DimensionKey, type QueryConfig, type QueryFact, type QueryMetric, type QueryTemplate } from '../../api/self-query'
import './style.css'

type TemplateLog = { time: string; action: string; name: string }
const storageKey = 'sinotrans.self-query.v1'
function loadSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}')
    const templates: QueryTemplate[] = Array.isArray(value.templates) ? value.templates.filter((t: QueryTemplate) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.config && Array.isArray(t.config.orgs) && Array.isArray(t.config.metrics) && Array.isArray(t.config.dimensions)) : []
    const derived: QueryMetric[] = Array.isArray(value.derived) ? value.derived.filter((m: QueryMetric) => m && typeof m.key === 'string' && /^derived\d+$/.test(m.key) && typeof m.label === 'string' && typeof m.formula === 'string' && typeof m.unit === 'string') : []
    return { templates, derived, defaultId: typeof value.defaultId === 'string' ? value.defaultId : 'business-overview', logs: Array.isArray(value.logs) ? value.logs.slice(0, 50) as TemplateLog[] : [] }
  } catch { ElMessage.warning('本地查询模板无法读取，已恢复系统推荐模板'); return { templates: [], derived: [], defaultId: 'business-overview', logs: [] } }
}
const settings = loadSettings()
const customTemplates = ref<QueryTemplate[]>(settings.templates); const derived = ref<QueryMetric[]>(settings.derived)
const defaultId = ref(settings.defaultId); const logs = ref<TemplateLog[]>(settings.logs)
const templates = computed(() => [...builtinQueryTemplates(), ...customTemplates.value])
const initialTemplate = templates.value.find(t => t.id === defaultId.value) || templates.value[0]
const draft = reactive<QueryConfig>({ ...defaultQueryConfig(), ...copyConfig(initialTemplate.config) })
const activeTemplateId = ref(initialTemplate.id)
const activeTemplate = computed(() => templates.value.find(t => t.id === activeTemplateId.value))
const availableMetrics = computed(() => [...queryMetrics, ...derived.value])
const applied = ref(copyConfig(draft)); const facts = ref<QueryFact[]>(queryFacts(applied.value))
const sidebarTab = ref<'templates' | 'config'>('templates'); const collapsed = ref(false); const busy = ref(false)
const resultTab = ref<'detail' | 'trend' | 'composition'>('detail')
const hasQueried = ref(false); const focusMetric = ref(''); const editingConfigId = ref('')
const openSection = ref(''); const subSections = reactive({ dimensions: false, metrics: false, sort: false })
const periodPickerOpen=ref(false);const periodPickerYear=ref('2026')
const quickPeriods=computed(()=>draft.periodType==='year'?['2026','2025','2024']:draft.periodType==='quarter'?['2026Q3','2026Q2','2026Q1']:['2026-09','2026-08','2026-07'])
function choosePeriod(value:string){if(draft.periodType==='year')draft.year=value;else if(draft.periodType==='quarter')draft.quarter=value;else draft.month=value;periodPickerOpen.value=false}
function isPeriodSelected(value:string){return (draft.periodType==='year'?draft.year:draft.periodType==='quarter'?draft.quarter:draft.month)===value}
const orgSearch = ref(''); const orgOnlySelected = ref(false); const metricSearch = ref('')
const metricGroups = reactive<Record<string, boolean>>({ '收入与成本': true, '经营规模': true, '盈利与效率': true, '我的衍生指标': true })
const otherTemplates = computed(() => templates.value.filter(t => t.id !== activeTemplateId.value))
const organizationChoices = computed(() => organizationOptions.filter(org => (!orgOnlySelected.value || draft.orgs.includes(org.code)) && `${org.label}${org.name}${org.code}`.toLowerCase().includes(orgSearch.value.trim().toLowerCase())))
const draftOrganizationLabel = computed(() => draft.orgs.length === 1 ? organizationOptions.find(o=>o.code===draft.orgs[0])?.label || '所选组织' : draft.orgs.length ? `${draft.orgs.length}个组织` : '待完善')
const metricSections = computed(() => [
  {label:'收入与成本',metrics:queryMetrics.filter(m=>['revenue','totalCost','variableCost','fixedCost'].includes(m.key))},
  {label:'经营规模',metrics:queryMetrics.filter(m=>['volume','volumeGrowth'].includes(m.key))},
  {label:'盈利与效率',metrics:queryMetrics.filter(m=>['grossProfit','margin','unitCost','costChange'].includes(m.key))},
  {label:'我的衍生指标',metrics:derived.value},
].map(group=>({...group,metrics:group.metrics.filter(m=>m.label.includes(metricSearch.value.trim()))})).filter(group=>group.metrics.length || (!metricSearch.value && group.label==='我的衍生指标')))
function toggleSection(section:string){openSection.value=openSection.value===section?'':section}
function toggleDimension(key:DimensionKey){draft.dimensions=draft.dimensions.includes(key)?draft.dimensions.filter(d=>d!==key):[...draft.dimensions,key]}
function toggleMetric(key:string){draft.metrics=draft.metrics.includes(key)?draft.metrics.filter(m=>m!==key):[...draft.metrics,key]}
function toggleOrg(code:string){if(code==='0011GB'){draft.orgs=draft.orgs.includes(code)?[]:[code];return}draft.orgs=draft.orgs.includes(code)?draft.orgs.filter(c=>c!==code):[...draft.orgs.filter(c=>c!=='0011GB'),code]}
function templateSummary(template:QueryTemplate){const config=template.config;const org=config.orgs.length===1?organizationOptions.find(o=>o.code===config.orgs[0])?.label||'所选组织':`${config.orgs.length}个组织`;return `${org}｜${periodLabel(config)}｜${config.category}`}
function templateMetrics(template:QueryTemplate){return template.config.metrics.map(key=>availableMetrics.value.find(m=>m.key===key)?.label).filter(Boolean)}
function beginConfig(template:QueryTemplate){useTemplate(template);sidebarTab.value='config';editingConfigId.value=template.builtin?'':template.id}
async function cancelConfig(){if(dirty.value){try{await ElMessageBox.confirm('取消修改将恢复模板已保存的查询配置。','取消修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'})}catch{return}}const template=templates.value.find(t=>t.id===editingConfigId.value);if(template)Object.assign(draft,copyConfig(template.config));editingConfigId.value=''}
function templateCommand(command:string,template:QueryTemplate){if(command==='delete'){deleteTemplate(template);return}if(command==='config'){beginConfig(template);return}if(command==='reset'){Object.assign(draft,copyConfig(template.config));return}useTemplate(template);openTemplate(command==='edit')}
function selectFocus(key:string){focusMetric.value=focusMetric.value===key?'':key;if(focusMetric.value){chartMetric.value=key;if(compositionMetrics.value.some(m=>m.key===key))compositionMetric.value=key}}
function previousMonth(value:string,step:number){const year=Number(value.slice(0,4));const month=Number(value.slice(5,7));const n=year*12+month-1+step;return `${Math.floor(n/12)}-${String((n%12+12)%12+1).padStart(2,'0')}`}
const previousTotal=computed(()=>{const config=copyConfig(applied.value);if(config.periodType==='month')config.month=previousMonth(config.month,-1);else if(config.periodType==='year')config.year=String(Number(config.year)-1);else if(config.periodType==='quarter'){const n=Number(config.quarter.slice(0,4))*4+Number(config.quarter.slice(-1))-2;config.quarter=`${Math.floor(n/4)}Q${n%4+1}`}else{if(!config.range?.length)return undefined;const span=(Number(config.range[1].slice(0,4))-Number(config.range[0].slice(0,4)))*12+Number(config.range[1].slice(5))-Number(config.range[0].slice(5))+1;config.range=config.range.map(m=>previousMonth(m,-span))}return aggregateFacts(queryFacts(config),[],derived.value)[0]})
function metricDelta(metric:QueryMetric){const now=total.value?.values[metric.key];const before=previousTotal.value?.values[metric.key];if(now==null||before==null||!before)return null;return metric.unit==='%'?now-before:(now/before-1)*100}
function deltaLabel(metric:QueryMetric){const value=metricDelta(metric);return value==null?'—':`${value>0?'+':''}${value.toFixed(2)}${metric.unit==='%'?'个百分点':'%'}`}
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(applied.value))
const effectiveDimensions = computed<DimensionKey[]>(() => {
  const dimensions = [...applied.value.dimensions]
  const quantity = applied.value.metrics.some(key => queryMetrics.find(m => m.key === key)?.quantity || derived.value.find(m => m.key === key)?.formula?.match(/\[(volume|unitCost|volumeGrowth|costChange)\]/))
  if (quantity && !dimensions.includes('unit')) dimensions.push('unit')
  return dimensions
})
const selectedMetrics = computed(() => availableMetrics.value.filter(m => applied.value.metrics.includes(m.key)))
const rows = computed(() => aggregateFacts(facts.value, effectiveDimensions.value, derived.value.filter(m => applied.value.metrics.includes(m.key))))
const total = computed(() => aggregateFacts(facts.value, [], derived.value.filter(m => applied.value.metrics.includes(m.key)))[0])
const tableSearch = ref(''); const page = ref(1); const pageSize = ref(10)
const sortKey = ref(applied.value.sortKey); const descending = ref(applied.value.descending)
const sorted = computed(() => rows.value.filter(row => Object.values(row.dims).join(' ').toLowerCase().includes(tableSearch.value.trim().toLowerCase())).sort((a,b) => {
  const key = sortKey.value; const av = a.values[key] ?? a.dims[key as DimensionKey]; const bv = b.values[key] ?? b.dims[key as DimensionKey]
  if (av == null) return bv == null ? 0 : 1
  if (bv == null) return -1
  return (typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv),'zh-CN')) * (descending.value ? -1 : 1)
}))
const visible = computed(() => sorted.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
watch([tableSearch, pageSize, sortKey, descending, rows],()=>{page.value=1})
const businesses = computed(() => getBusinessLinePathsForCategory(draft.category))
watch(() => draft.category, () => { const allowed=getBusinessLinePathsForCategory(draft.category);draft.businesses=draft.businesses.filter(path=>allowed.includes(path)) })
watch(() => [...draft.dimensions,...draft.metrics], keys => {if(!keys.includes(draft.sortKey))draft.sortKey=draft.metrics[0]||draft.dimensions[0]||'revenue'})
const organizationLabel = computed(() => applied.value.orgs.length === 1 ? organizationOptions.find(o => o.code === applied.value.orgs[0])?.label || '所选组织' : `${applied.value.orgs.length}个组织`)
const chips = computed(() => [organizationLabel.value, periodLabel(applied.value), applied.value.category, `${effectiveDimensions.value.length}个维度`, `${selectedMetrics.value.length}个指标`])
const pinned = ref<string[]>([])
const cards = computed(() => selectedMetrics.value.filter(m => !pinned.value.length || pinned.value.includes(m.key)).slice(0,6))
const cardDialog = ref(false); const pinnedDraft = ref<string[]>([])
function openCards() { pinnedDraft.value = cards.value.map(m=>m.key); cardDialog.value=true }
function saveCards() { if (!pinnedDraft.value.length || pinnedDraft.value.length>6) {ElMessage.warning('请选择1至6个展示指标');return} pinned.value=[...pinnedDraft.value];cardDialog.value=false }
async function runQuery() {
  const error = queryConfigError(draft)
  if (error) { ElMessage.warning(error); return }
  if (!draft.metrics.every(key => availableMetrics.value.some(m => m.key === key))) { ElMessage.warning('存在已删除的指标，请重新选择'); return }
  busy.value=true
  try {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    const next=copyConfig(draft); const nextFacts=queryFacts(next)
    applied.value=next; facts.value=nextFacts; sortKey.value=next.sortKey;descending.value=next.descending;page.value=1;hasQueried.value=true
    pinned.value=pinned.value.filter(key=>next.metrics.includes(key)); tableSearch.value=''
    if(!next.metrics.includes(chartMetric.value))chartMetric.value=next.metrics[0]
    ElMessage.success(`查询完成，共 ${nextFacts.length.toLocaleString()} 条业务月度记录`)
  } catch { ElMessage.error('查询失败，请减少组织或时间范围后重试') }
  finally {busy.value=false}
}
function resetDraft() { Object.assign(draft,defaultQueryConfig());activeTemplateId.value='business-overview' }
function useTemplate(template:QueryTemplate) {Object.assign(draft,defaultQueryConfig(),copyConfig(template.config));activeTemplateId.value=template.id;ElMessage.info('已载入模板，点击查询数据更新结果')}
function persist(nextTemplates=customTemplates.value,nextDerived=derived.value,nextDefault=defaultId.value,nextLogs=logs.value) {
  try {localStorage.setItem(storageKey,JSON.stringify({templates:nextTemplates,derived:nextDerived,defaultId:nextDefault,logs:nextLogs}));return true}
  catch {ElMessage.error('保存失败：当前浏览器存储不可用或空间不足');return false}
}
function log(action:string,name:string) { return [{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),action,name},...logs.value].slice(0,50) }
const templateDialog=ref(false);const editingTemplate=ref('');const templateForm=reactive({name:'',description:'',isDefault:false})
function openTemplate(edit=false) {editingTemplate.value=edit&&!activeTemplate.value?.builtin?activeTemplateId.value:'';Object.assign(templateForm,{name:edit?activeTemplate.value?.name||'':'',description:edit?activeTemplate.value?.description||'':'',isDefault:edit&&defaultId.value===activeTemplateId.value});templateDialog.value=true}
function saveTemplate() {
  const name=templateForm.name.trim();if(!name){ElMessage.warning('请填写模板名称');return}
  const error=queryConfigError(draft);if(error){ElMessage.warning(error);return}
  if(templates.value.some(t=>t.name===name&&t.id!==editingTemplate.value)){ElMessage.warning('模板名称已存在');return}
  const id=editingTemplate.value||`custom-${Date.now()}`
  const item:QueryTemplate={id,name,description:templateForm.description.trim(),config:copyConfig(draft),updatedAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  const next=editingTemplate.value?customTemplates.value.map(t=>t.id===id?item:t):[...customTemplates.value,item]
  const nextDefault=templateForm.isDefault?id:defaultId.value===id?'business-overview':defaultId.value
  const nextLogs=log(editingTemplate.value?'更新模板':'创建模板',name)
  if(persist(next,derived.value,nextDefault,nextLogs)){customTemplates.value=next;defaultId.value=nextDefault;logs.value=nextLogs;activeTemplateId.value=id;templateDialog.value=false;editingConfigId.value='';ElMessage.success('模板已保存到当前浏览器')}
}
async function deleteTemplate(template:QueryTemplate) {
  try{await ElMessageBox.confirm(`确认删除模板“${template.name}”？`,'删除模板',{confirmButtonText:'删除',cancelButtonText:'取消',type:'warning'})}catch{return}
  const next=customTemplates.value.filter(t=>t.id!==template.id);const nextDefault=defaultId.value===template.id?'business-overview':defaultId.value;const nextLogs=log('删除模板',template.name)
  if(persist(next,derived.value,nextDefault,nextLogs)){customTemplates.value=next;defaultId.value=nextDefault;logs.value=nextLogs;if(activeTemplateId.value===template.id)activeTemplateId.value='business-overview'}
}
function setDefault(id:string) {if(persist(customTemplates.value,derived.value,id)){defaultId.value=id;ElMessage.success('已设为默认模板')}}
const logDialog=ref(false)
const derivedDialog=ref(false);const derivedForm=reactive({name:'',unit:'%',formula:'',description:''})
const formulaError=computed(()=>{try{calculateFormula(derivedForm.formula,Object.fromEntries(queryMetrics.map(m=>[m.key,10])));return ''}catch(e){return e instanceof Error?e.message:'公式不正确'}})
function saveDerived() {
  if(!derivedForm.name.trim()){ElMessage.warning('请输入指标名称');return}
  if(availableMetrics.value.some(m=>m.label===derivedForm.name.trim())){ElMessage.warning('指标名称已存在');return}
  if(formulaError.value){ElMessage.warning(formulaError.value);return}
  const item:QueryMetric={key:`derived${Date.now()}`,label:derivedForm.name.trim(),unit:derivedForm.unit.trim(),formula:derivedForm.formula,description:derivedForm.description}
  if(persist(customTemplates.value,[...derived.value,item])){derived.value.push(item);draft.metrics.push(item.key);derivedDialog.value=false;Object.assign(derivedForm,{name:'',unit:'%',formula:'',description:''})}
}
const chartMetric=ref(applied.value.metrics[0]);const chartUnit=ref('');const compositionMetric=ref('revenue');const compositionDimension=ref<DimensionKey>('root')
const compositionMetrics=computed(()=>selectedMetrics.value.filter(m=>['revenue','totalCost','variableCost','fixedCost'].includes(m.key)))
watch(compositionMetrics,metrics=>{if(!metrics.some(m=>m.key===compositionMetric.value))compositionMetric.value=metrics[0]?.key||''},{immediate:true})
const trendMetric=computed(()=>availableMetrics.value.find(m=>m.key===chartMetric.value)||queryMetrics[0])
const chartUnits=computed(()=>[...new Set(facts.value.map(f=>f.dims.unit))])
watch(chartUnits,units=>{if(!units.includes(chartUnit.value))chartUnit.value=units[0]||''},{immediate:true})
const needsUnit=computed(()=>trendMetric.value.quantity||/\[(volume|unitCost|volumeGrowth|costChange)\]/.test(trendMetric.value.formula||''))
const trendType=ref<'bar'|'line'>('bar');const trendGrain=ref<'month'|'quarter'|'year'>('month');const trendDimension=ref<DimensionKey|'none'>('org');const compositionType=ref<'donut'|'bar'>('donut')
const trendChart=ref<InstanceType<typeof ChartPanel>>();const compositionChart=ref<InstanceType<typeof ChartPanel>>()
const chartColors=['#5088eb','#30b49d','#8b73df','#eea842','#e9858c','#38a6c2','#8294ae']
const trendData=computed(()=>{
  const base=needsUnit.value?facts.value.filter(f=>f.dims.unit===chartUnit.value):facts.value
  const dim=trendDimension.value
  const top=dim==='none'?[]:aggregateFacts(base,[dim],derived.value.filter(m=>m.key===chartMetric.value)).sort((a,b)=>(b.values[chartMetric.value]||0)-(a.values[chartMetric.value]||0)).slice(0,6).map(row=>String(row.dims[dim]))
  const transformed=base.map(f=>{const period=trendGrain.value==='month'?f.dims.period:trendGrain.value==='quarter'?`${f.dims.period.slice(0,4)}Q${Math.ceil(Number(f.dims.period.slice(5))/3)}`:f.dims.period.slice(0,4);return {...f,dims:{...f.dims,period,...(dim!=='none'&&!top.includes(f.dims[dim])?{[dim]:'其他'}:{})}}})
  const rows=aggregateFacts(transformed,dim==='none'?['period']:['period',dim],derived.value.filter(m=>m.key===chartMetric.value))
  return {periods:[...new Set(rows.map(r=>String(r.dims.period)))].sort(),names:dim==='none'?['合计']:[...new Set(rows.map(r=>String(r.dims[dim])))],rows}
})
const trendOption=computed<EChartsOption>(()=>({
  color:chartColors,tooltip:{trigger:'axis',confine:true,textStyle:{fontSize:10},valueFormatter:value=>metricValue(value as number)},legend:{bottom:0,textStyle:{fontSize:11},type:'scroll'},grid:{left:68,right:20,top:28,bottom:55},xAxis:{type:'category',data:trendData.value.periods,axisLine:{lineStyle:{color:'#e5eaf2'}},axisLabel:{fontSize:12,color:'#6b7c95'},axisTick:{show:false}},yAxis:{type:'value',name:metricUnit(trendMetric.value,chartUnit.value),nameTextStyle:{align:'left',fontSize:11,color:'#94a3b8'},axisLabel:{fontSize:12,color:'#6b7c95'},splitLine:{lineStyle:{color:'#eef1f6',type:'dashed'}}},series:trendData.value.names.map(name=>({type:trendType.value,name,smooth:trendType.value==='line',symbolSize:6,barMaxWidth:36,lineStyle:{width:2},itemStyle:trendType.value==='bar'?{borderRadius:[3,3,0,0]}:undefined,data:trendData.value.periods.map(period=>trendData.value.rows.find(row=>row.dims.period===period&&(trendDimension.value==='none'||row.dims[trendDimension.value]===name))?.values[chartMetric.value]??null)}))
}))
const compositionRows=computed(()=>compositionMetric.value?aggregateFacts(facts.value,[compositionDimension.value]).map(r=>({name:String(r.dims[compositionDimension.value]),value:r.values[compositionMetric.value]||0})).filter(r=>r.value>0).sort((a,b)=>b.value-a.value):[])
const compositionTotal=computed(()=>compositionRows.value.reduce((sum,row)=>sum+row.value,0))
const compositionDisplay=computed(()=>compositionType.value==='bar'?compositionRows.value:compositionRows.value.slice(0,7).concat(compositionRows.value.length>7?[{name:'其他',value:compositionRows.value.slice(7).reduce((sum,row)=>sum+row.value,0)}]:[]))
const compositionOption=computed<EChartsOption>(()=>compositionType.value==='bar'?{
  color:chartColors,tooltip:{trigger:'axis',confine:true,textStyle:{fontSize:10}},grid:{left:115,right:25,top:12,bottom:30},xAxis:{type:'value',axisLabel:{fontSize:11},splitLine:{lineStyle:{color:'#eef1f6',type:'dashed'}}},yAxis:{type:'category',inverse:true,data:compositionDisplay.value.map(r=>r.name),axisLabel:{fontSize:11,width:100,overflow:'truncate'},axisLine:{show:false},axisTick:{show:false}},series:[{type:'bar',data:compositionDisplay.value.map(r=>r.value),barMaxWidth:23,itemStyle:{borderRadius:[0,3,3,0]}}]
}:{color:chartColors,tooltip:{trigger:'item',confine:true,textStyle:{fontSize:10},valueFormatter:value=>`${metricValue(value as number)} 万元`},legend:{bottom:0,textStyle:{fontSize:11},type:'scroll'},series:[{type:'pie',radius:[60,120],center:['50%','46%'],label:{show:false},emphasis:{scale:true,scaleSize:7},data:compositionDisplay.value}]})
function exportChart(kind:'trend'|'composition'){const chart=kind==='trend'?trendChart.value:compositionChart.value;chart?.downloadImage(kind==='trend'?'自助查询-趋势图表':'自助查询-构成图表')}
function sortTable(key:string) {if(sortKey.value===key)descending.value=!descending.value;else{sortKey.value=key;descending.value=true}}
function exportResult() {
  const dims=effectiveDimensions.value.map(key=>queryDimensions.find(d=>d.key===key)!);const metrics=selectedMetrics.value
  const quote=(value:unknown)=>`"${String(value??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')}"`
  const header=[...dims.map(d=>d.label),...metrics.map(m=>`${m.label}（${metricUnit(m)}）`)]
  const body=sorted.value.map(row=>[...dims.map(d=>row.dims[d.key]||''),...metrics.map(m=>row.values[m.key]??'')])
  const csv='\uFEFF'+[header,...body].map(row=>row.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`自助查询-${periodLabel(applied.value)}.csv`;a.click();URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="self-query-page" :class="{'sidebar-collapsed':collapsed}">
    <aside class="query-sidebar">
      <div v-if="collapsed" class="query-collapsed"><el-button :icon="Expand" text aria-label="展开查询配置" @click="collapsed=false"/><span>查询配置</span></div>
      <template v-else>
        <div class="query-sidebar-tabs"><button :class="{active:sidebarTab==='templates'}" @click="sidebarTab='templates'">我的模板</button><button :class="{active:sidebarTab==='config'}" @click="sidebarTab='config'">配置查询</button><el-button :icon="Fold" text aria-label="收起侧边栏" @click="collapsed=true"/></div>
        <div class="query-sidebar-scroll">
          <div v-if="sidebarTab==='templates'" class="query-template-panel">
            <article v-if="activeTemplate" class="query-current-template">
              <header><span :class="defaultId===activeTemplate.id?'template-default':'template-current'">{{ defaultId===activeTemplate.id?'默认':'当前模板' }}</span><TemplateMenu :template="activeTemplate" @command="templateCommand($event,activeTemplate!)"/></header>
              <h3>{{ activeTemplate.name }}</h3>
              <dl><div><dt>核心指标</dt><dd class="template-metric-tags"><span v-for="label in templateMetrics(activeTemplate).slice(0,6)" :key="label">{{ label }}</span><small v-if="templateMetrics(activeTemplate).length>6">+{{ templateMetrics(activeTemplate).length-6 }}</small></dd></div><div><dt>默认筛选</dt><dd>{{ templateSummary(activeTemplate) }}</dd></div></dl>
            </article>
            <div class="query-other-heading"><strong><el-icon><Document/></el-icon>我的其他模板</strong><button @click="logDialog=true"><el-icon><Clock/></el-icon>操作日志</button></div>
            <article v-for="template in otherTemplates" :key="template.id" class="query-other-template" tabindex="0" @click="useTemplate(template)" @keydown.enter.self="useTemplate(template)">
              <span class="query-template-icon"><el-icon><Document/></el-icon></span><div class="query-other-content"><h4>{{ template.name }}<small v-if="defaultId===template.id" class="template-default">默认</small><small v-if="template.builtin" class="template-current">推荐</small></h4><p>{{ template.description }}</p><span>核心指标 {{ template.config.metrics.length }} 项</span></div><TemplateMenu :template="template" @command="templateCommand($event,template)"/>
            </article>
          </div>
          <div v-else class="query-config-panel">
            <QuerySection title="组织范围" icon="OfficeBuilding" :summary="draftOrganizationLabel" :open="openSection==='org'" @toggle="toggleSection('org')">
              <el-input v-model="orgSearch" :prefix-icon="Search" clearable placeholder="搜索组织名称 / 编码" size="small"/>
              <div class="query-select-tools"><button @click="draft.orgs=organizationOptions.filter(o=>o.code!=='0011GB').map(o=>o.code)">全选</button><span>·</span><button @click="draft.orgs=[]">清空</button><span>·</span><button :class="{active:orgOnlySelected}" @click="orgOnlySelected=!orgOnlySelected">{{ orgOnlySelected?'✓ 仅看已选':'仅看已选' }}</button></div>
              <div class="query-org-tree"><button v-for="org in organizationChoices" :key="org.code" :class="{selected:draft.orgs.includes(org.code),root:org.code==='0011GB'}" @click="toggleOrg(org.code)"><el-icon v-if="org.code==='0011GB'"><ArrowDown/></el-icon><span v-else class="query-org-indent"/><el-checkbox :model-value="draft.orgs.includes(org.code)" tabindex="-1" @click.stop @change="toggleOrg(org.code)"/><span>{{ org.label }}</span><small v-if="org.code==='0011GB'">汇总</small></button><p v-if="!organizationChoices.length" class="query-empty-hint">未找到匹配组织</p></div>
            </QuerySection>
            <QuerySection title="统计周期" icon="Calendar" :summary="periodLabel(draft)||'待完善'" :open="openSection==='period'" @toggle="toggleSection('period')">
              <div class="query-mini-tabs"><button v-for="item in (['year','quarter','month'] as const)" :key="item" :class="{active:draft.periodType===item}" @click="draft.periodType=item">{{ item==='month'?'月份':item==='quarter'?'季度':'年度' }}</button></div>
              <p class="query-period-current">当前选择：<strong>{{ periodLabel(draft) }}</strong></p>
              <div class="query-period-quick"><button v-for="value in quickPeriods" :key="value" :class="{selected:isPeriodSelected(value)}" @click="choosePeriod(value)">{{ draft.periodType==='year'?`${value}年`:value }}</button><el-popover v-model:visible="periodPickerOpen" trigger="click" placement="bottom-start" :width="300"><template #reference><button class="query-more-period">{{ draft.periodType==='year'?'更多年份':draft.periodType==='quarter'?'更多季度':'更多月份' }}<el-icon><ArrowDown/></el-icon></button></template><div class="query-period-popup"><p>选择年份</p><div class="query-year-grid"><button v-for="year in ['2026','2025','2024','2023','2022','2021']" :key="year" :class="{selected:(draft.periodType==='year'?draft.year:periodPickerYear)===year}" @click="draft.periodType==='year'?choosePeriod(year):periodPickerYear=year">{{ year }}年</button></div><template v-if="draft.periodType!=='year'"><hr/><p>{{ draft.periodType==='quarter'?'选择季度':'选择月份' }}</p><div class="query-month-grid"><button v-for="n in (draft.periodType==='quarter'?4:12)" :key="n" :class="{selected:isPeriodSelected(draft.periodType==='quarter'?`${periodPickerYear}Q${n}`:`${periodPickerYear}-${String(n).padStart(2,'0')}`)}" @click="choosePeriod(draft.periodType==='quarter'?`${periodPickerYear}Q${n}`:`${periodPickerYear}-${String(n).padStart(2,'0')}`)">{{ draft.periodType==='quarter'?`Q${n}`:`${String(n).padStart(2,'0')}月` }}</button></div></template></div></el-popover></div>
              <el-date-picker v-if="draft.periodType==='range'" v-model="draft.range" type="monthrange" value-format="YYYY-MM" style="width:100%"/>
              <p class="query-field-help">统计周期用于确定当前查询数据所属期间，并影响趋势图展示粒度。</p>
            </QuerySection>
            <QuerySection title="统计口径" icon="DataAnalysis" summary="业务成本口径" :open="openSection==='caliber'" @toggle="toggleSection('caliber')"><div class="query-pill-options"><el-tooltip content="金额以万元展示，毛利按营业收入减营业成本计算。"><button class="selected">业务成本口径 <el-icon><InfoFilled/></el-icon></button></el-tooltip></div></QuerySection>
            <QuerySection title="业务线" icon="Grid" :summary="draft.category" :open="openSection==='business'" @toggle="toggleSection('business')"><p class="query-field-help">用于筛选当前查询的业务范围。</p><div class="query-pill-options"><button v-for="category in businessOptions" :key="category" :class="{selected:draft.category===category}" @click="draft.category=category">{{ category }}</button></div><div class="query-business-display"><el-checkbox :model-value="draft.dimensions.includes('category')" @change="toggleDimension('category')">在结果中展示业务分类</el-checkbox><p class="query-field-help">勾选后，表格增加业务分类列，并按分类拆分展示。</p></div></QuerySection>
            <QuerySection title="更多配置" icon="Setting" summary="维度 / 指标 / 排序" :open="openSection==='more'" @toggle="toggleSection('more')">
              <QuerySection nested title="分析维度" :summary="`已选 ${draft.dimensions.length} 项`" :open="subSections.dimensions" @toggle="subSections.dimensions=!subSections.dimensions"><p class="query-field-help">选择分析维度，并设置各维度的展示范围。</p><div class="query-pill-options"><button v-for="dim in queryDimensions" :key="dim.key" :class="{selected:draft.dimensions.includes(dim.key)}" @click="toggleDimension(dim.key)">{{ dim.label }}</button></div><label class="query-range-label">业务线范围</label><el-select v-model="draft.businesses" multiple filterable collapse-tags collapse-tags-tooltip placeholder="全部业务线" style="width:100%" size="small"><el-option v-for="business in businesses" :key="business" :label="business" :value="business"/></el-select><p class="query-field-help">业务量与单位成本自动按计量单位拆分。</p></QuerySection>
              <QuerySection nested title="指标选择" :summary="`已选 ${draft.metrics.length} 项`" :open="subSections.metrics" @toggle="subSections.metrics=!subSections.metrics">
                <el-input v-model="metricSearch" :prefix-icon="Search" clearable placeholder="搜索指标名称" size="small"/>
                <div class="query-metric-tools"><div class="query-select-tools"><button @click="draft.metrics=availableMetrics.map(m=>m.key)">全选</button><span>·</span><button @click="draft.metrics=[]">清空</button><span>·</span><button @click="draft.metrics=[...defaultQueryConfig().metrics]">恢复默认</button></div><button class="query-add-derived" @click="derivedDialog=true">＋ 衍生指标</button></div>
                <div class="query-metric-tree"><section v-for="group in metricSections" :key="group.label"><button class="query-metric-group" @click="metricGroups[group.label]=!metricGroups[group.label]"><el-icon><ArrowDown v-if="metricGroups[group.label]"/><ArrowRight v-else/></el-icon>{{ group.label }}<small>{{ group.metrics.filter(m=>draft.metrics.includes(m.key)).length }} / {{ group.metrics.length }}</small></button><template v-if="metricGroups[group.label]"><button v-for="metric in group.metrics" :key="metric.key" class="query-metric-item" :class="{selected:draft.metrics.includes(metric.key)}" @click="toggleMetric(metric.key)"><el-checkbox :model-value="draft.metrics.includes(metric.key)" tabindex="-1" @click.stop @change="toggleMetric(metric.key)"/><span v-if="metric.formula" class="query-fx-badge">fx</span><span>{{ metric.label }}</span><el-tooltip :content="metric.formula||`${metric.label}，单位：${metric.unit}`"><el-icon><InfoFilled/></el-icon></el-tooltip></button><p v-if="!group.metrics.length" class="query-empty-hint">暂无衍生指标，点击右上角创建</p></template></section><p v-if="!metricSections.length" class="query-empty-hint">未找到匹配指标</p></div>
              </QuerySection>
              <QuerySection nested title="排序配置" summary="单条件" :open="subSections.sort" @toggle="subSections.sort=!subSections.sort"><p class="query-field-help">按已选指标或分析维度调整排序字段与方向。</p><div class="query-sort-config"><el-select v-model="draft.sortKey" size="small"><el-option-group label="指标字段"><el-option v-for="metric in availableMetrics.filter(m=>draft.metrics.includes(m.key))" :key="metric.key" :label="metric.label" :value="metric.key"/></el-option-group><el-option-group label="分析维度"><el-option v-for="dim in queryDimensions.filter(d=>draft.dimensions.includes(d.key))" :key="dim.key" :label="dim.label" :value="dim.key"/></el-option-group></el-select><div class="query-direction"><button :class="{active:!draft.descending}" @click="draft.descending=false">升序</button><button :class="{active:draft.descending}" @click="draft.descending=true">降序</button></div></div></QuerySection>
            </QuerySection>
          </div>
        </div>
        <div v-if="dirty" class="query-dirty"><el-icon><InfoFilled/></el-icon>查询配置已变更，请点击查询数据刷新结果。</div>
        <div class="query-sidebar-actions"><template v-if="editingConfigId"><button class="query-cancel-edit" @click="cancelConfig">取消修改</button><el-button @click="openTemplate(true)">保存配置</el-button></template><el-button v-else-if="sidebarTab==='config'" @click="openTemplate()">保存为新模板</el-button><el-button type="primary" :loading="busy" @click="runQuery">查询数据</el-button></div>
      </template>
    </aside>
    <main v-loading="busy" class="query-main">
      <header class="query-page-heading"><span class="query-title-accent"/><div><h1>自助查询</h1><p>支持按组织、时间、业务线等维度灵活组合查询，并自动生成重点指标与趋势分析。</p></div></header>
      <div v-if="editingConfigId" class="query-edit-banner"><el-icon><EditPen/></el-icon><span>正在修改模板：<strong>{{ activeTemplate?.name }}</strong></span><button @click="cancelConfig">取消修改</button><el-button type="primary" size="small" @click="openTemplate(true)">保存配置</el-button></div>
      <section class="query-context"><span class="query-template-icon"><el-icon><Document/></el-icon></span><strong>{{ activeTemplate?.name || '自定义查询' }}</strong><span>当前筛选：{{ organizationLabel }}｜{{ periodLabel(applied) }}｜业务成本口径｜{{ applied.category }}</span></section>
      <div class="query-main-body">
        <section class="query-results-card">
          <header class="query-card-heading"><div><span class="query-section-accent"/><h2>{{ hasQueried?'查询结果':'默认重点指标' }}</h2><p>{{ hasQueried?`基于当前查询条件实时计算，已应用 ${selectedMetrics.length} 个指标 · ${effectiveDimensions.length} 个分析维度`:'基于当前组织范围、维度和指标配置自动推荐' }}</p></div><div class="query-card-actions"><span>已展示 {{ cards.length }} / {{ Math.min(selectedMetrics.length,6) }}</span><button v-if="pinned.length" @click="pinned=[]">返回默认重点指标</button><el-button :icon="Setting" @click="openCards">管理展示指标</el-button></div></header>
          <div v-if="dirty" class="query-result-notice"><el-icon><InfoFilled/></el-icon>查询配置已变更，请点击「查询数据」刷新结果。<button @click="runQuery">立即查询</button></div>
          <div class="query-kpis"><button v-for="metric in cards" :key="metric.key" class="query-kpi" :class="{focused:focusMetric===metric.key}" :title="metric.formula||metric.description||metric.label" @click="selectFocus(metric.key)"><div class="query-kpi-label"><span v-if="metric.formula" class="query-fx-badge">fx</span>{{ metric.label }}<el-icon><InfoFilled/></el-icon></div><div class="query-kpi-value"><strong>{{ metricValue(total?.values[metric.key]) }}</strong><small>{{ metricUnit(metric,total?.dims.unit) }}</small></div><div class="query-kpi-delta" :class="{positive:(metricDelta(metric)||0)>0,negative:(metricDelta(metric)||0)<0}"><el-icon v-if="metricDelta(metric)"><Top v-if="(metricDelta(metric)||0)>0"/><Bottom v-else/></el-icon>{{ applied.periodType==='year'?'同比':'环比' }} {{ deltaLabel(metric) }}</div></button></div>
        </section>
        <section class="query-results-card query-data-card">
          <header class="query-view-tabs"><div><button :class="{active:resultTab==='detail'}" @click="resultTab='detail'"><el-icon><Grid/></el-icon>明细表格</button><button :class="{active:resultTab==='trend'}" @click="resultTab='trend'"><el-icon><DataLine/></el-icon>趋势图表</button><button :class="{active:resultTab==='composition'}" @click="resultTab='composition'"><el-icon><PieChart/></el-icon>构成图表</button></div><span>{{ resultTab==='detail'?'用于展示当前查询条件下的明细数据':resultTab==='trend'?'用于将当前查询结果按时间维度展示为趋势图':'用于查看单个指标在不同维度下的占比构成' }}</span></header>
          <div class="query-data-body">
            <template v-if="resultTab==='detail'">
              <div class="query-table-toolbar"><span>根据当前分析维度和指标自动生成明细结果 · 共 <b>{{ sorted.length }}</b> 条 <small>· 已按 {{ availableMetrics.find(m=>m.key===sortKey)?.label||queryDimensions.find(d=>d.key===sortKey)?.label }} {{ descending?'降序':'升序' }}排序</small></span><span>单位：万元 / %</span><el-button :icon="Download" :disabled="!sorted.length" @click="exportResult">导出</el-button></div>
              <div class="query-table-box"><div class="query-table-scroll"><table class="query-detail-table"><thead><tr><th>序号</th><th v-for="dim in effectiveDimensions" :key="dim"><button @click="sortTable(dim)">{{ queryDimensions.find(d=>d.key===dim)?.label }}<el-icon><ArrowUp v-if="sortKey===dim&&!descending"/><ArrowDown v-else/></el-icon></button></th><th v-for="metric in selectedMetrics" :key="metric.key" class="query-number" :class="{focused:focusMetric===metric.key}"><button @click="sortTable(metric.key)"><span v-if="metric.formula" class="query-fx-badge">fx</span>{{ metric.label }}({{ metricUnit(metric) }})<el-icon :class="{inactive:sortKey!==metric.key}"><ArrowUp v-if="sortKey===metric.key&&!descending"/><ArrowDown v-else/></el-icon></button></th></tr></thead><tbody><tr v-for="(row,index) in visible" :key="row.id"><td class="query-row-index">{{ (page-1)*pageSize+index+1 }}</td><td v-for="dim in effectiveDimensions" :key="dim">{{ row.dims[dim] }}</td><td v-for="metric in selectedMetrics" :key="metric.key" class="query-number" :class="{focused:focusMetric===metric.key}">{{ metricValue(row.values[metric.key]) }}{{ metric.unit==='%'&&row.values[metric.key]!=null?'%':'' }}</td></tr><tr v-if="!visible.length"><td :colspan="1+effectiveDimensions.length+selectedMetrics.length" class="query-no-results">当前条件下暂无数据</td></tr></tbody></table></div><footer class="query-pagination"><span>共 {{ sorted.length }} 条</span><el-pagination v-model:current-page="page" :page-size="pageSize" :total="sorted.length" layout="prev,pager,next" small :pager-count="5"/><el-select v-model="pageSize" size="small" style="width:96px"><el-option v-for="size in [10,20,50,100]" :key="size" :label="`${size}条/页`" :value="size"/></el-select></footer></div>
            </template>
            <template v-else-if="resultTab==='trend'">
              <div class="query-chart-toolbar"><div><label>趋势指标<el-select v-model="chartMetric" size="small" style="width:145px"><el-option v-for="metric in selectedMetrics" :key="metric.key" :label="metric.label" :value="metric.key"/></el-select></label><label>时间粒度<el-select v-model="trendGrain" size="small" style="width:85px"><el-option label="月度" value="month"/><el-option label="季度" value="quarter"/><el-option label="年度" value="year"/></el-select></label><label>图表类型<el-select v-model="trendType" size="small" style="width:100px"><el-option label="柱状图" value="bar"/><el-option label="折线图" value="line"/></el-select></label><label>拆分维度<el-select v-model="trendDimension" size="small" style="width:105px"><el-option label="不拆分" value="none"/><el-option v-for="dim in queryDimensions.filter(d=>d.key!=='unit'&&d.key!=='period')" :key="dim.key" :label="dim.label" :value="dim.key"/></el-select></label><label v-if="needsUnit">计量单位<el-select v-model="chartUnit" size="small" style="width:85px"><el-option v-for="unit in chartUnits" :key="unit" :label="unit" :value="unit"/></el-select></label></div><el-button :icon="Download" :disabled="!facts.length" @click="exportChart('trend')">导出图片</el-button></div>
              <div v-if="facts.length" class="query-chart-frame"><header><div><h3>{{ trendMetric.label }} · {{ trendGrain==='month'?'月度':trendGrain==='quarter'?'季度':'年度' }}趋势</h3><p>按{{ queryDimensions.find(d=>d.key===trendDimension)?.label||'汇总' }}拆分，共 {{ trendData.periods.length }} 个期间，单位：{{ metricUnit(trendMetric,chartUnit) }}。</p></div><span>结束周期：{{ trendData.periods[trendData.periods.length-1] }}</span></header><ChartPanel ref="trendChart" :option="trendOption" :height="360"/><p class="query-chart-note">当前趋势基于查询结果按时间聚合生成，明细数据以明细表格为准。</p></div><el-empty v-else description="暂无趋势数据"/>
            </template>
            <template v-else>
              <div class="query-chart-toolbar"><div><label>构成指标<el-select v-model="compositionMetric" size="small" style="width:140px"><el-option v-for="metric in compositionMetrics" :key="metric.key" :label="metric.label" :value="metric.key"/></el-select></label><label>构成维度<el-select v-model="compositionDimension" size="small" style="width:105px"><el-option v-for="dim in queryDimensions.filter(d=>d.key!=='unit'&&d.key!=='period')" :key="dim.key" :label="dim.label" :value="dim.key"/></el-select></label><label>图表类型<el-select v-model="compositionType" size="small" style="width:105px"><el-option label="条形图" value="bar"/><el-option label="环形图" value="donut"/></el-select></label></div><el-button :icon="Download" :disabled="!compositionRows.length" @click="exportChart('composition')">导出图片</el-button></div>
              <div v-if="compositionRows.length" class="query-chart-frame"><header><div><h3>{{ compositionMetrics.find(m=>m.key===compositionMetric)?.label }}构成｜按{{ queryDimensions.find(d=>d.key===compositionDimension)?.label }}</h3><p>占比 = 当前维度该指标值 / 当前筛选范围下该指标总值</p></div><span>共 {{ compositionRows.length }} 项 · 合计 {{ metricValue(compositionTotal) }} 万元</span></header><div class="query-composition"><ChartPanel ref="compositionChart" :option="compositionOption" :height="360"/><div class="query-composition-list"><header><strong>构成明细</strong><span>按占比降序</span></header><div><table><tbody><tr v-for="(row,index) in compositionDisplay" :key="row.name"><td :title="row.name"><i :style="{background:chartColors[index%chartColors.length]}"/>{{ row.name }}</td><td>{{ metricValue(row.value) }}万元</td><td>{{ (row.value/compositionTotal*100).toFixed(1) }}%</td></tr></tbody></table></div></div></div></div><el-empty v-else description="暂无可用于构成分析的数据"/>
            </template>
          </div>
        </section>
        <p class="query-bottom-note">当前为模拟数据。不同计量单位业务量分别汇总，无法计算的指标展示“—”。个人模板保存在当前浏览器。</p>
      </div>
    </main>
    <el-dialog v-model="templateDialog" :title="editingTemplate?'保存模板配置':'保存为新模板'" width="460px" :close-on-click-modal="false"><el-form label-position="top"><el-form-item label="模板名称" required><el-input v-model="templateForm.name" maxlength="40"/></el-form-item><el-form-item label="模板说明"><el-input v-model="templateForm.description" type="textarea" maxlength="200"/></el-form-item><el-checkbox v-model="templateForm.isDefault">设为默认模板</el-checkbox></el-form><template #footer><el-button @click="templateDialog=false">取消</el-button><el-button type="primary" @click="saveTemplate">保存</el-button></template></el-dialog>
    <el-dialog v-model="cardDialog" title="管理展示指标" width="460px"><p>选择1至6个指标用于顶部卡片展示，不影响表格字段。</p><el-checkbox-group v-model="pinnedDraft" class="query-check-grid"><el-checkbox v-for="metric in selectedMetrics" :key="metric.key" :value="metric.key">{{ metric.label }}</el-checkbox></el-checkbox-group><template #footer><el-button @click="cardDialog=false">取消</el-button><el-button type="primary" @click="saveCards">保存</el-button></template></el-dialog>
    <el-dialog v-model="derivedDialog" title="新增衍生指标" width="580px" :close-on-click-modal="false"><el-form label-position="top"><el-form-item label="指标名称" required><el-input v-model="derivedForm.name" maxlength="30"/></el-form-item><el-form-item label="单位"><el-input v-model="derivedForm.unit" maxlength="15" placeholder="例如：%、万元"/></el-form-item><el-form-item label="公式" required><el-input v-model="derivedForm.formula" type="textarea" :rows="3" maxlength="300" placeholder="例如：[fixedCost] / [totalCost] * 100"/></el-form-item><div class="query-formula-chips"><button v-for="metric in queryMetrics" :key="metric.key" @click="derivedForm.formula+=`[${metric.key}]`">{{ metric.label }}</button><button v-for="symbol in ['+','-','*','/','(',')']" :key="symbol" @click="derivedForm.formula+=symbol">{{ symbol }}</button></div><p :class="{'query-formula-error':formulaError}" class="query-formula-help">{{ formulaError||'公式校验通过；除数为零或基础指标无法汇总时显示“—”。' }}</p><el-form-item label="说明"><el-input v-model="derivedForm.description" maxlength="150"/></el-form-item></el-form><template #footer><el-button @click="derivedDialog=false">取消</el-button><el-button type="primary" :disabled="!!formulaError" @click="saveDerived">保存指标</el-button></template></el-dialog>
    <el-dialog v-model="logDialog" title="我的模板操作日志" width="650px"><el-table :data="logs" max-height="400"><el-table-column prop="time" label="时间" width="180"/><el-table-column prop="name" label="模板"/><el-table-column prop="action" label="操作" width="110"/></el-table></el-dialog>
  </div>
</template>
