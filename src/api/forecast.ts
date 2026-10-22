import { businessLinePaths } from './business-lines'

export const defaultForecastBusiness = '海运代理-重点航线'
export const forecastBusinessGroups = [
  { label: '海运代理样例', options: [defaultForecastBusiness] },
  { label: '水运货代', options: businessLinePaths.filter(path => path.startsWith('水运货代-')) },
]
export type ForecastAssumptions = { volumeChange: number; freightChange: number; passThrough: number; priceLag: number; operationsChange: number; fixedChange: number }
export const defaultAssumptions = (): ForecastAssumptions => ({ volumeChange: 0, freightChange: 0, passThrough: 70, priceLag: 1, operationsChange: 0, fixedChange: 0 })
export const forecastScenarios: { key: string; label: string; description: string; values: ForecastAssumptions }[] = [
  { key: 'base', label: '基准情景', description: '延续样例季节性与价格趋势，不增加额外冲击。', values: defaultAssumptions() },
  { key: 'growth', label: '需求增长', description: '业务量增加12%，采购运价上涨3%，80%及时传导至售价。', values: { volumeChange: 12, freightChange: 3, passThrough: 80, priceLag: 0, operationsChange: 0, fixedChange: 0 } },
  { key: 'pressure', label: '成本承压', description: '业务量减少8%，采购运价上涨15%，40%滞后1个月传导，操作成本上涨3%。', values: { volumeChange: -8, freightChange: 15, passThrough: 40, priceLag: 1, operationsChange: 3, fixedChange: 0 } },
]
export type ForecastMonth = { period: string; volume: number; unitProcurement: number; unitOperations: number; unitRevenue: number; unitVariableCost: number; fixedCost: number; variableCost: number; totalCost: number; revenue: number; grossProfit: number; margin: number }
export type ForecastSignal = { name: string; value: number; unit: string; change: number; target: string; source: string; url: string; date: string }
export type ForecastSample = { history: ForecastMonth[]; baseline: ForecastMonth[]; signals: ForecastSignal[] }
const seasons = [.90, .73, 1.01, .98, 1.04, 1.08, 1.04, 1.09, 1.13, 1.10, 1.17, 1.21]
function seedValue(text: string) { return [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 13) }
export function shiftForecastMonth(period: string, offset: number) {
  const n = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + offset
  return `${Math.floor(n / 12)}-${String((n % 12 + 12) % 12 + 1).padStart(2, '0')}`
}
function monthRecord(period: string, volume: number, unitProcurement: number, unitOperations: number, unitRevenue: number, fixedCost: number): ForecastMonth {
  const unitVariableCost = unitProcurement + unitOperations
  const revenue = volume * unitRevenue / 10000
  const variableCost = volume * unitVariableCost / 10000
  const totalCost = variableCost + fixedCost
  const grossProfit = revenue - totalCost
  return { period, volume, unitProcurement, unitOperations, unitRevenue, unitVariableCost, fixedCost, variableCost, totalCost, revenue, grossProfit, margin: revenue ? grossProfit / revenue * 100 : 0 }
}
// 全部为可复现的演示数据与规则测算，未接入实际订单、实时行情或训练模型。
export function getForecastSample(org: string, business: string, cutoff: string): ForecastSample | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cutoff)) return null
  const seed = seedValue(`${org}:${business}`)
  const volumeBase = 10500 + seed % 6500
  const procurementBase = 6900 + seed % 1300
  const fixedBase = 100 + seed % 45
  const history = Array.from({ length: 12 }, (_, i) => {
    const period = shiftForecastMonth(cutoff, i - 11)
    const month = Number(period.slice(5)) - 1
    const t = (Number(period.slice(0, 4)) - 2025) * 12 + month
    const volume = Math.round(volumeBase * seasons[month] * Math.max(.3, 1 + t * .005) * (1 + Math.sin(t + seed % 9) * .024))
    const procurement = procurementBase * (1 + Math.sin(t * .55 + seed % 5) * .045)
    const operations = Math.max(200, 480 + seed % 140 + t * 1.2)
    const revenue = procurement * 1.18 + operations + 160 + Math.cos(t * .6) * 55
    return monthRecord(period, volume, procurement, operations, revenue, fixedBase)
  })
  const last = history[history.length - 1]
  const freightTrend = ((seed % 7) - 2) * .003
  const baseline = Array.from({ length: 3 }, (_, i) => {
    const period = shiftForecastMonth(cutoff, i + 1)
    const season = seasons[Number(period.slice(5)) - 1] / seasons[Number(cutoff.slice(5)) - 1]
    const volume = Math.round(last.volume * season * (1 + .008 * (i + 1)))
    const procurement = last.unitProcurement * (1 + freightTrend * (i + 1))
    return monthRecord(period, volume, procurement, last.unitOperations * (1 + .003 * (i + 1)), last.unitRevenue + (procurement - last.unitProcurement) * .7, last.fixedCost)
  })
  const date = `${cutoff}-${new Date(Date.UTC(Number(cutoff.slice(0,4)),Number(cutoff.slice(5)),0)).getUTCDate()}`
  const signals: ForecastSignal[] = [
    { name: 'SCFI 综合指数', value: 2150 + seed % 700, unit: '点', change: 2.6 + seed % 13 / 10, target: '即期采购成本', source: '上海航运指数', url: 'https://www.sse.net.cn/datacenter', date },
    { name: 'CCFI 综合指数', value: 1320 + seed % 360, unit: '点', change: 1.2 + seed % 9 / 10, target: '合同价格背景', source: '上海航运指数', url: 'https://www.sse.net.cn/datacenter', date },
    { name: '制造业新出口订单', value: 48 + seed % 30 / 10, unit: '%', change: -.3 + seed % 7 / 10, target: '外贸需求', source: '国家统计局', url: 'https://data.stats.gov.cn/', date },
    { name: '港口集装箱吞吐量', value: 2850 + seed % 350, unit: '万TEU', change: 2.5 + seed % 35 / 10, target: '箱量景气', source: '交通运输部', url: 'https://xxgk.mot.gov.cn/', date },
  ]
  return { history, baseline, signals }
}
export function applyForecastScenario(baseline: ForecastMonth[], assumptions: ForecastAssumptions) {
  return baseline.map((month, i) => {
    const volume = Math.round(month.volume * (1 + assumptions.volumeChange / 100))
    const procurement = month.unitProcurement * (1 + assumptions.freightChange / 100)
    const pass = i >= assumptions.priceLag ? month.unitProcurement * assumptions.freightChange / 100 * assumptions.passThrough / 100 : 0
    return monthRecord(month.period, volume, procurement, month.unitOperations * (1 + assumptions.operationsChange / 100), month.unitRevenue + pass, month.fixedCost * (1 + assumptions.fixedChange / 100))
  })
}
export function summarizeForecast(months: ForecastMonth[]) {
  const volume = months.reduce((sum, month) => sum + month.volume, 0)
  const revenue = months.reduce((sum, month) => sum + month.revenue, 0)
  const variableCost = months.reduce((sum, month) => sum + month.variableCost, 0)
  const fixedCost = months.reduce((sum, month) => sum + month.fixedCost, 0)
  const grossProfit = revenue - variableCost - fixedCost
  return { volume, revenue, variableCost, fixedCost, totalCost: variableCost + fixedCost, grossProfit, unitRevenue: volume ? revenue * 10000 / volume : 0, unitVariableCost: volume ? variableCost * 10000 / volume : 0, margin: revenue ? grossProfit / revenue * 100 : 0 }
}
export function forecastImpacts(baseline: ForecastMonth[], scenario: ForecastMonth[]) {
  const amount = (getValue: (base: ForecastMonth, next: ForecastMonth) => number) => baseline.reduce((sum, base, i) => sum + getValue(base, scenario[i]), 0)
  return [
    { name: '业务量变化', value: amount((base, next) => (next.volume - base.volume) * (base.unitRevenue - base.unitVariableCost) / 10000), description: '按基准单位贡献测算业务量变化影响' },
    { name: '运价及售价传导', value: amount((base, next) => next.volume * (next.unitRevenue - base.unitRevenue - next.unitProcurement + base.unitProcurement) / 10000), description: '采购运价与对客售价的净变化影响' },
    { name: '操作成本变化', value: amount((base, next) => -next.volume * (next.unitOperations - base.unitOperations) / 10000), description: '按情景业务量测算单位操作成本变化' },
    { name: '固定成本变化', value: amount((base, next) => base.fixedCost - next.fixedCost), description: '情景与基准的固定成本差额' },
  ]
}
