import businessLineSource from './business-line-source.json'
import businessLineCategories from './business-line-categories.json'

// 来源：材料/映射_业务类型分级映射表.xlsx，Sheet1!B2:B155。
export const businessLinePaths = businessLineSource
export type BusinessLineNode = { value: string; label: string; children?: BusinessLineNode[] }

export function buildBusinessLineTree(paths: readonly string[]): BusinessLineNode[] {
  const roots: BusinessLineNode[] = []
  const nodesByPath = new Map<string, BusinessLineNode>()
  for (const fullPath of paths) {
    const parts = fullPath.split('-')
    let siblings = roots
    parts.forEach((label, index) => {
      const value = parts.slice(0, index + 1).join('-')
      let node = nodesByPath.get(value)
      if (!node) {
        node = { value, label }
        nodesByPath.set(value, node)
        siblings.push(node)
      }
      if (index < parts.length - 1) {
        node.children ??= []
        siblings = node.children
      }
    })
  }
  return roots
}
export const businessLineTree = buildBusinessLineTree(businessLinePaths)

// C 列分类与 B 列业务线一一对应，分类名称不一定等于业务线的第一级名称。
export function getBusinessLinePathsForCategory(category: string) {
  if (category === '全部') return businessLinePaths
  const categories: Record<string, string> = businessLineCategories
  return businessLinePaths.filter(path => categories[path] === category)
}

// 与业务线排名的现有计量规则一致。
export function businessLineUnit(name: string) {
  if (/报关/.test(name)) return '票'
  if (/电商/.test(name)) return '单'
  if (/租赁/.test(name)) return '天'
  return /集装箱|箱码|仓码/.test(name) ? 'TEU' : '吨'
}

// 月度趋势示例数据；成本与业务量分别保留，以便父级按业务量加权计算单位成本。
const monthlyMocks = businessLinePaths.map((name, index) => {
  const baseVolume = 1800 + index * 137
  const baseUnitCost = 42 + index % 23 * 4.25
  return {
    name,
    unit: businessLineUnit(name),
    months: Array.from({ length: 12 }, (_, month) => {
      const season = [.84, .78, 1.02, .98, 1.08, 1.12, 1.06, 1.10, 1.16, 1.13, 1.20, 1.25][month]
      const currentVolume = Math.round(baseVolume * season * (1 + index % 7 * .018))
      const previousVolume = Math.round(baseVolume * season * .91)
      return {
        currentVolume,
        previousVolume,
        currentCost: currentVolume * baseUnitCost * (1 + Math.sin(month + index) * .06),
        previousCost: previousVolume * baseUnitCost * (1.04 + Math.cos(month + index) * .04),
      }
    }),
  }
})

export function getBusinessLineTrend(path: string, allowedPaths: readonly string[] = businessLinePaths) {
  const allowed = new Set(allowedPaths)
  const matches = monthlyMocks.filter(row => allowed.has(row.name) && (row.name === path || row.name.startsWith(path + '-')))
  const units = [...new Set(matches.map(row => row.unit))]
  const months = Array.from({ length: 12 }, (_, month) => matches.reduce((sum, row) => ({
    currentVolume: sum.currentVolume + row.months[month].currentVolume,
    previousVolume: sum.previousVolume + row.months[month].previousVolume,
    currentCost: sum.currentCost + row.months[month].currentCost,
    previousCost: sum.previousCost + row.months[month].previousCost,
  }), { currentVolume: 0, previousVolume: 0, currentCost: 0, previousCost: 0 }))
  return { units, months }
}
