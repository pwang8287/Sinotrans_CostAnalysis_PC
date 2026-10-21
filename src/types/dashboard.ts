export type DashboardFilter = { org: string; period: string; segment: string; company: string }
export type MetricValue = number | null
export type KpiMetric = { key: string; label: string; value: MetricValue; unit: string; yoy: number | null; tone: 'normal'|'good'|'bad' }
export type TrendPoint = { period: string; current: number; previous: number | null }
export type RankingItem = { name: string; value: number | null; yoy: number | null }
export type ProfitLossCell = { company: string; segment: string; profit: number | null; margin: number | null }
export type ApiResponse<T> = { code: number; message: string; data: T; traceId?: string }
