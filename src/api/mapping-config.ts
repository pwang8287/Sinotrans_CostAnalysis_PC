import source from './mapping-source.json'
import organizationSource from './organization-mapping-source.json'

export type MappingKind = 'cost' | 'business' | 'organization'
export const mappingTitles: Record<MappingKind, string> = { cost: '成本费用映射', business: '业务类型映射', organization: '组织映射' }
export type MappingRow = { id: string; code: string; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string; version: string; valid: string; [key: string]: string }
export type MappingField = { key: string; label: string; width: number; required?: boolean; options?: string[] }
export const mappingFields: Record<MappingKind, MappingField[]> = {
  cost: [
    { key: 'subject', label: '科目', width: 140, required: true },
    { key: 'element', label: '成本要素', width: 145, required: true },
    { key: 'code', label: '源系统科目编码', width: 160, required: true },
    { key: 'name', label: '源系统科目名称', width: 240, required: true },
    { key: 'nature', label: '成本性质', width: 110, required: true, options: ['变动', '固定', 'NA'] },
  ],
  business: [
    { key: 'code', label: '板块段值', width: 115, required: true },
    { key: 'description', label: '板块说明', width: 250, required: true },
    { key: 'segLevel1', label: 'Seg_Level 1', width: 150 },
    { key: 'segLevel2', label: 'Seg_Level 2', width: 160, required: true },
    { key: 'segLevel3', label: 'Seg_Level 3', width: 170, required: true },
  ],
  organization: [
    { key: 'code', label: '组织编码', width: 145, required: true },
    { key: 'name', label: '组织名称', width: 270, required: true },
    { key: 'shortName', label: '组织简称', width: 150 },
    { key: 'parentCode', label: '上级组织编码', width: 150 },
    { key: 'sourceCode', label: '原系统组织编码', width: 165 },
    { key: 'level', label: '组织层级', width: 100 },
    { key: 'isProperty', label: '是否产权组织', width: 140, options: ['是', '否'] },
  ],
}
export const auditFields: MappingField[] = [
  { key: 'createdBy', label: '创建人', width: 120 }, { key: 'createdAt', label: '创建时间', width: 165 },
  { key: 'updatedBy', label: '更新人', width: 120 }, { key: 'updatedAt', label: '更新时间', width: 165 },
  { key: 'version', label: '版本号', width: 90 }, { key: 'valid', label: '是否有效', width: 100 },
]
export function mappingAuditFields(kind: MappingKind): MappingField[] {
  return kind === 'organization' ? auditFields.slice(0, 4).map(field => field.key === 'updatedAt' ? { ...field, label: '最后更新时间' } : field) : auditFields
}
const storageKey = (kind: MappingKind) => `sinotrans.mapping.${kind}.v1`
export function initialMappings(kind: MappingKind): MappingRow[] {
  const rows = kind === 'organization' ? organizationSource : source[kind]
  return rows.map((row, index) => ({ ...row, id: `${kind}-${index}`, createdBy: '系统初始化', createdAt: '2026-06-01 08:00', updatedBy: '系统初始化', updatedAt: '2026-06-01 08:00', version: 'V1.0', valid: 'Y' }))
}
export function loadMappings(kind: MappingKind) {
  try {
    const raw = localStorage.getItem(storageKey(kind))
    if (!raw) return { rows: initialMappings(kind), failed: false }
    const rows: unknown = JSON.parse(raw)
    if (!Array.isArray(rows) || !rows.every(row => row && typeof row === 'object' && [...mappingFields[kind].map(f => f.key), ...auditFields.map(f => f.key), 'id'].every(key => typeof row[key] === 'string'))) throw new Error('无效配置')
    return { rows: rows as MappingRow[], failed: false }
  } catch { return { rows: initialMappings(kind), failed: true } }
}
export function saveMappings(kind: MappingKind, rows: MappingRow[]) {
  localStorage.setItem(storageKey(kind), JSON.stringify(rows))
}
export function mappingTimestamp() {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  return parts.replace(',', '')
}
export function validateMapping(kind: MappingKind, row: Record<string, string>) {
  for (const field of mappingFields[kind]) {
    const value = row[field.key]?.trim() || ''
    if (field.required && !value) return `请填写${field.label}`
    if (value.length > 300) return `${field.label}不能超过300个字符`
    if (field.options && value && !field.options.includes(value)) return `${field.label}仅支持${field.options.join('、')}`
  }
  if (kind === 'organization' && row.level && !/^[1-9]\d*$/.test(row.level)) return '组织层级须为正整数'
  if (kind === 'organization' && row.parentCode && row.code === row.parentCode) return '上级组织编码不能与组织编码相同'
  if (row.valid && !['Y', 'N'].includes(row.valid)) return '是否有效仅支持 Y 或 N'
  return ''
}
