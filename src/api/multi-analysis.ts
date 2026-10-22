import { getBusinessLinePathsForCategory, businessLineUnit, businessLinePaths } from './business-lines'
import type { DashboardFilter } from '../types/dashboard'

export type AnalysisPoint = {
  id: string; name: string; unit: string; volumeGrowth: number; costChange: number
  margin: number; revenue: number; variableCost: number; operatingCost: number
  currentVolume: number; previousVolume: number; currentUnitCost: number; previousUnitCost: number
}
export type AnalysisMode = 'cost' | 'profit'
export type AnalysisPeriod = 'year' | 'month'
// 参考图的明亮蓝、粉红和薄荷绿，扩展为各一级业务线的固定配色。
const businessColors = [
  '#8BAFF2', '#448AFF', '#46C69B', '#FA5C7C', '#A48AF0', '#F6B85F',
  '#5AC6DE', '#EB89C0', '#72A8EC', '#87CF92', '#BA8FE9', '#F39E78',
  '#6BCABF', '#F18DA3', '#94A3EB', '#C3CB70', '#75BFE6', '#D39ADB',
  '#A4CF9A', '#CEAD78', '#F3B17E', '#9EB8D0',
]
const roots = [...new Set(businessLinePaths.map(path => path.split('-')[0]))]
export const businessLineColor = (root: string) => businessColors[Math.max(0, roots.indexOf(root)) % businessColors.length]
export const growthCuts = [-5, 5] as const
export const costCuts = [-3, 3] as const
export const marginCuts = [15, 25] as const
export const band = (value: number, cuts: readonly number[]) => value < cuts[0] ? 0 : value > cuts[1] ? 2 : 1
const costLabels = [
  ['缩量降本', '稳量降本', '增量降本'],
  ['缩量稳本', '量本平稳', '增量稳本'],
  ['缩量增本', '稳量增本', '增量增本'],
]
const profitLabels = [
  ['收缩低毛利', '平稳低毛利', '增长低毛利'],
  ['收缩中毛利', '平稳中毛利', '增长中毛利'],
  ['收缩高毛利', '平稳高毛利', '增长高毛利'],
]
export function cellInfo(mode: AnalysisMode, x: number, y: number) {
  const row = band(y, mode === 'cost' ? costCuts : marginCuts)
  const col = band(x, growthCuts)
  const score = col + (mode === 'cost' ? 2 - row : row)
  const tone = score >= 3 ? 'good' : score <= 1 ? 'risk' : 'watch'
  return { label: (mode === 'cost' ? costLabels : profitLabels)[row][col], tone,
    color: tone === 'good' ? '#10BD8F' : tone === 'risk' ? '#FF527B' : '#267EFF',
    soft: tone === 'good' ? '#F0FAF6' : tone === 'risk' ? '#FFF3F6' : '#F0F5FF' }
}
function hash(text: string) { return [...text].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) }
// 演示数据按组织、期间与业务生成；营业成本含变动成本与模拟分摊的固定成本。
export function getAnalysisPoints(filters: DashboardFilter, period: AnalysisPeriod = 'year'): AnalysisPoint[] {
  if (!filters.period) return []
  return getBusinessLinePathsForCategory(filters.segment).map(name => {
    const seed = hash(`${filters.org}:${filters.period}:${period}:${name}`)
    const volumeGrowth = ((seed % 451) - 200) / 10
    const costChange = (((seed >>> 5) % 261) - 130) / 10
    const margin = 5 + ((seed >>> 9) % 351) / 10
    const months = period === 'year' ? Number(filters.period.slice(5, 7)) || 1 : 1
    const previousVolume = (3000 + seed % 90000) * months
    const currentVolume = previousVolume * (1 + volumeGrowth / 100)
    const previousUnitCost = 35 + (seed >>> 3) % 600
    const currentUnitCost = previousUnitCost * (1 + costChange / 100)
    const variableCost = currentVolume * currentUnitCost / 10000
    const operatingCost = variableCost * (1.08 + (seed % 15) / 100)
    const revenue = operatingCost / (1 - margin / 100)
    return { id: name, name, unit: businessLineUnit(name), volumeGrowth, costChange, margin,
      revenue, variableCost, operatingCost, previousVolume, currentVolume, previousUnitCost, currentUnitCost }
  })
}
