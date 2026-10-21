import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { DashboardFilter } from '../types/dashboard'
import { rootOrganizationCode } from '../api/organizations'
export const useDashboardStore = defineStore('dashboard', () => {
  const filters = reactive<DashboardFilter>({ org: rootOrganizationCode, period: '2026-09', segment: '全部', company: '全部公司' })
  const loading = ref(false)
  function reset() { Object.assign(filters, { org: rootOrganizationCode, period: '2026-09', segment: '全部', company: '全部公司' }) }
  return { filters, loading, reset }
})
