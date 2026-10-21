export const actionTypes = ['运', '拖', '吊', '拆', '仓', '票'] as const
export type ActionType = (typeof actionTypes)[number]
export type ActionPoint = {
  business: string
  action: ActionType
  previousVariableCost: number
  currentVariableCost: number
}

const businesses = [
  { name: '水运货代-进口', revenue: 286, cost: 184 },
  { name: '水运货代-出口', revenue: 324, cost: 208 },
  { name: '公路货代-国内', revenue: 218, cost: 166 },
  { name: '铁路货代-自营班列-国内', revenue: 362, cost: 246 },
  { name: '汽车运输-自营-国内', revenue: 258, cost: 178 },
  { name: '多式联运-国内', revenue: 418, cost: 286 },
  { name: '合同物流-运输-公路-自营', revenue: 312, cost: 224 },
  { name: '专业物流-冷链物流-运输-公路-自营', revenue: 468, cost: 338 },
]

// 示例数据：每个业务和动作组合只有一个点，保留原始精度，展示时统一格式化。
export const actionScatterPoints: ActionPoint[] = businesses.flatMap((business, businessIndex) =>
  actionTypes.map((action, actionIndex) => {
    const actionWeight = [1, .74, .52, .38, .61, .24][actionIndex]
    return {
      business: business.name,
      action,
      previousVariableCost: business.cost * actionWeight * (1.02 + (businessIndex % 5 - 2) * .055 + actionIndex * .012),
      currentVariableCost: business.cost * actionWeight * (1 + (businessIndex % 4 - 1.5) * actionIndex * .045),
    }
  }),
)

export function getActionComparison(action: ActionType) {
  const points = actionScatterPoints.filter(point => point.action === action)
  return {
    points,
    previousAverage: points.reduce((sum, point) => sum + point.previousVariableCost, 0) / points.length,
    currentAverage: points.reduce((sum, point) => sum + point.currentVariableCost, 0) / points.length,
  }
}
