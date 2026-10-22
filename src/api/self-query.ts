import { getAnalysisPoints } from './multi-analysis'
import { organizationOptions, rootOrganizationCode } from './organizations'
import { getBusinessLinePathsForCategory } from './business-lines'
import businessCategories from './business-line-categories.json'

export const queryDimensions = [
  { key: 'org', label: '组织' }, { key: 'period', label: '期间' },
  { key: 'category', label: '业务分类' }, { key: 'root', label: '一级业务线' },
  { key: 'business', label: '业务线' }, { key: 'unit', label: '计量单位' },
] as const
export type DimensionKey = (typeof queryDimensions)[number]['key']
export type QueryMetric = { key: string; label: string; unit: string; quantity?: boolean; formula?: string; description?: string }
export const queryMetrics: QueryMetric[] = [
  { key: 'revenue', label: '营业收入', unit: '万元' }, { key: 'totalCost', label: '总成本', unit: '万元' },
  { key: 'variableCost', label: '变动成本', unit: '万元' }, { key: 'fixedCost', label: '固定成本', unit: '万元' },
  { key: 'grossProfit', label: '毛利', unit: '万元' }, { key: 'margin', label: '毛利率', unit: '%' },
  { key: 'volume', label: '业务量', unit: '业务单位', quantity: true },
  { key: 'unitCost', label: '单位变动成本', unit: '元/业务单位', quantity: true },
  { key: 'volumeGrowth', label: '业务量同比', unit: '%', quantity: true },
  { key: 'costChange', label: '单位变动成本同比', unit: '%', quantity: true },
]
export type QueryConfig = {
  orgs: string[]; periodType: 'month' | 'quarter' | 'year' | 'range'; month: string; quarter: string; year: string; range: string[]
  category: string; businesses: string[]; dimensions: DimensionKey[]; metrics: string[]; sortKey: string; descending: boolean
}
export type QueryTemplate = { id: string; name: string; description: string; config: QueryConfig; builtin?: boolean; isDefault?: boolean; updatedAt?: string }
export type QueryFact = { dims: Record<DimensionKey, string>; amounts: { revenue: number; totalCost: number; variableCost: number; previousVariableCost: number; volume: number; previousVolume: number } }
export type QueryResult = { id: string; dims: Partial<Record<DimensionKey, string>>; values: Record<string, number | null> }
export const copyConfig = (config: QueryConfig): QueryConfig => JSON.parse(JSON.stringify(config))
export function defaultQueryConfig(): QueryConfig {
  return { orgs: [rootOrganizationCode], periodType: 'month', month: '2026-09', quarter: '2026Q3', year: '2026', range: ['2026-01', '2026-09'], category: '全部', businesses: [], dimensions: ['org', 'business', 'unit'], metrics: ['revenue', 'totalCost', 'variableCost', 'grossProfit', 'margin', 'volume', 'unitCost'], sortKey: 'revenue', descending: true }
}
export function builtinQueryTemplates(): QueryTemplate[] {
  const config = defaultQueryConfig()
  const templates: QueryTemplate[] = [
    { id: 'business-overview', name: '业务经营总览', description: '查看业务线收入、成本和盈利情况。', config },
    { id: 'cost-control', name: '成本控制分析', description: '关注变动成本、单位成本及同比变化。', config: { ...copyConfig(config), metrics: ['totalCost', 'variableCost', 'fixedCost', 'volume', 'unitCost', 'costChange'], sortKey: 'variableCost' } },
    { id: 'profit-analysis', name: '业务盈利分析', description: '按一级业务线对比盈利规模与毛利率。', config: { ...copyConfig(config), dimensions: ['root'], metrics: ['revenue', 'totalCost', 'grossProfit', 'margin'], sortKey: 'grossProfit' } },
    { id: 'monthly-trend', name: '月度成本趋势', description: '按月跟踪收入与成本变化。', config: { ...copyConfig(config), periodType: 'year', dimensions: ['period'], metrics: ['revenue', 'totalCost', 'variableCost', 'fixedCost'], sortKey: 'period', descending: false } },
  ]
  return templates.map(item => ({ ...item, builtin: true }))
}
export function queryMonths(config: QueryConfig): string[] {
  if (config.periodType === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(config.month) ? [config.month] : []
  if (config.periodType === 'quarter') { const match = /^(\d{4})Q([1-4])$/.exec(config.quarter); return match ? Array.from({ length: 3 }, (_, i) => `${match[1]}-${String((Number(match[2])-1)*3+i+1).padStart(2,'0')}`) : [] }
  if (config.periodType === 'year') return /^\d{4}$/.test(config.year) ? Array.from({ length: 12 }, (_, i) => `${config.year}-${String(i + 1).padStart(2, '0')}`) : []
  if (!Array.isArray(config.range) || config.range.length !== 2 || !config.range.every(v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v))) return []
  const [start, end] = config.range.map(v => Number(v.slice(0, 4)) * 12 + Number(v.slice(5)) - 1)
  if (end < start || end - start >= 36) return []
  return Array.from({ length: end - start + 1 }, (_, i) => `${Math.floor((start + i) / 12)}-${String((start + i) % 12 + 1).padStart(2, '0')}`)
}
export function periodLabel(config: QueryConfig) { return config.periodType === 'month' ? config.month || '' : config.periodType === 'quarter' ? config.quarter || '' : config.periodType === 'year' ? config.year ? `${config.year}年` : '' : config.range?.join(' 至 ') || '' }
export function queryConfigError(config: QueryConfig) {
  if (!config.orgs.length) return '请至少选择一个组织'
  if (config.orgs.includes(rootOrganizationCode) && config.orgs.length > 1) return '中国外运汇总范围与下属组织不能同时查询，请分别选择'
  if (!queryMonths(config).length) return '请选择有效统计周期，自定义范围最多36个月'
  if (!config.metrics.length) return '请至少选择一个指标'
  return ''
}
export function queryFacts(config: QueryConfig): QueryFact[] {
  const names = new Map(organizationOptions.map(org => [org.value, org.label]))
  const businesses = new Set(config.businesses)
  const allowed = getBusinessLinePathsForCategory(config.category)
  return config.orgs.flatMap(org => queryMonths(config).flatMap(period => getAnalysisPoints({ org, period, segment: config.category, company: '全部公司' }, 'month')
    .filter(point => allowed.includes(point.name) && (!businesses.size || businesses.has(point.name)))
    .map(point => ({ dims: { org: names.get(org) || org, period, category: (businessCategories as Record<string, string>)[point.name] || point.name.split('-')[0], root: point.name.split('-')[0], business: point.name, unit: point.unit },
      amounts: { revenue: point.revenue, totalCost: point.operatingCost, variableCost: point.variableCost, previousVariableCost: point.previousVolume * point.previousUnitCost / 10000, volume: point.currentVolume, previousVolume: point.previousVolume } }))))
}

// 支持指标引用、数字、括号及四则运算，不执行 JavaScript。
export function calculateFormula(formula: string, values: Record<string, number | null>): number | null {
  const text = formula.replace(/\s/g, '')
  const tokens = text.match(/\[[A-Za-z][A-Za-z0-9]*\]|\d+(?:\.\d+)?|[()+*/-]/g) || []
  if (!text || tokens.join('') !== text || tokens.length > 100) throw new Error('公式仅支持指标、数字、括号和 + - * /')
  let index = 0
  function atom(): number | null {
    const token = tokens[index++]
    if (token === '+' || token === '-') { const value = atom(); return value === null ? null : token === '-' ? -value : value }
    if (token === '(') { const value = expression(); if (tokens[index++] !== ')') throw new Error('括号不匹配'); return value }
    if (token?.startsWith('[')) { const key = token.slice(1, -1); if (!(key in values)) throw new Error(`未知指标：${key}`); return values[key] }
    if (!token || !/^\d/.test(token)) throw new Error('公式缺少数值或指标')
    return Number(token)
  }
  function product(): number | null {
    let value = atom()
    while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++]; const right = atom(); value = value === null || right === null || (op === '/' && right === 0) ? null : op === '*' ? value * right : value / right }
    return value
  }
  function expression(): number | null {
    let value = product()
    while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; const right = product(); value = value === null || right === null ? null : op === '+' ? value + right : value - right }
    return value
  }
  const value = expression()
  if (index !== tokens.length) throw new Error('公式结构不完整')
  return value === null || !Number.isFinite(value) ? null : value
}
export function aggregateFacts(facts: QueryFact[], dimensions: DimensionKey[], derived: QueryMetric[] = []): QueryResult[] {
  type Acc = { dims: QueryResult['dims']; units: Set<string>; revenue: number; totalCost: number; variableCost: number; previousVariableCost: number; volume: number; previousVolume: number }
  const groups = new Map<string, Acc>()
  for (const fact of facts) {
    const key = JSON.stringify(dimensions.map(dim => fact.dims[dim]))
    let group = groups.get(key)
    if (!group) { group = { dims: Object.fromEntries(dimensions.map(dim => [dim, fact.dims[dim]])), units: new Set(), revenue: 0, totalCost: 0, variableCost: 0, previousVariableCost: 0, volume: 0, previousVolume: 0 }; groups.set(key, group) }
    group.units.add(fact.dims.unit)
    for (const key of ['revenue', 'totalCost', 'variableCost', 'previousVariableCost', 'volume', 'previousVolume'] as const) group[key] += fact.amounts[key]
  }
  return [...groups.entries()].map(([id, group]) => {
    const homogeneous = group.units.size === 1
    const unitCost = homogeneous && group.volume ? group.variableCost * 10000 / group.volume : null
    const previousUnitCost = homogeneous && group.previousVolume ? group.previousVariableCost * 10000 / group.previousVolume : null
    const values: QueryResult['values'] = { revenue: group.revenue, totalCost: group.totalCost, variableCost: group.variableCost, fixedCost: group.totalCost - group.variableCost, grossProfit: group.revenue - group.totalCost,
      margin: group.revenue ? (group.revenue - group.totalCost) / group.revenue * 100 : null, volume: homogeneous ? group.volume : null, unitCost,
      volumeGrowth: homogeneous && group.previousVolume ? (group.volume / group.previousVolume - 1) * 100 : null,
      costChange: unitCost !== null && previousUnitCost ? (unitCost / previousUnitCost - 1) * 100 : null }
    for (const metric of derived) { try { values[metric.key] = calculateFormula(metric.formula || '', values) } catch { values[metric.key] = null } }
    return { id, dims: { ...group.dims, unit: homogeneous ? [...group.units][0] : '混合单位' }, values }
  })
}
export function metricUnit(metric: QueryMetric, unit?: string) { return metric.unit.replace('业务单位', unit && unit !== '混合单位' ? unit : '业务单位') }
export function metricValue(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
