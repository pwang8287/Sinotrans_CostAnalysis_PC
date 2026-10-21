import organizationRows from './organization-source.json'

// 数据来自组织表的 B（编码）、E（名称）、F（简称）、G（上级编码）列。
// 0011GB 以“中国外运”固定置顶；其下每条分支遇到第一个有简称的组织后停止向下查找。
export const rootOrganizationCode = '0011GB'

type Organization = (typeof organizationRows)[number]
const organizationsByCode = new Map(organizationRows.map(row => [row.code, row]))
const childrenByParent = new Map<string, Organization[]>()
for (const row of organizationRows) {
  const siblings = childrenByParent.get(row.parentCode) ?? []
  siblings.push(row)
  childrenByParent.set(row.parentCode, siblings)
}

function findNamedOrganizations(code: string, ancestors = new Set<string>()): Organization[] {
  if (ancestors.has(code)) throw new Error(`组织层级存在循环：${code}`)
  const row = organizationsByCode.get(code)
  if (!row) return []
  if (row.shortName.trim()) return [row]
  const path = new Set(ancestors).add(code)
  return (childrenByParent.get(code) ?? []).flatMap(child => findNamedOrganizations(child.code, path))
}

const namedOrganizationOptions = findNamedOrganizations(rootOrganizationCode).map(row => ({
  ...row,
  value: row.code,
  label: row.shortName.trim(),
}))

const rootOrganization = organizationsByCode.get(rootOrganizationCode)!
export const organizationOptions = [
  { ...rootOrganization, value: rootOrganizationCode, label: '中国外运' },
  ...namedOrganizationOptions.filter(row => row.code !== rootOrganizationCode),
]
