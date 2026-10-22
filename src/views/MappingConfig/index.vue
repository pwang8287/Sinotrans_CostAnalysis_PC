<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import { mappingFields, mappingTitles, mappingAuditFields, initialMappings, loadMappings, saveMappings, mappingTimestamp, validateMapping, type MappingKind, type MappingRow } from '../../api/mapping-config'
import { readMappingFile } from '../../utils/mapping-import'

const cost = loadMappings('cost'); const business = loadMappings('business'); const organization = loadMappings('organization')
if (cost.failed || business.failed || organization.failed) ElMessage.warning('本地配置无法读取，已显示初始数据；原缓存未覆盖')
const data = reactive<Record<MappingKind, MappingRow[]>>({ cost: cost.rows, business: business.rows, organization: organization.rows })
const tab = ref<MappingKind>('cost'); const search = ref(''); const page = ref(1); const pageSize = ref(20)
const title = computed(() => mappingTitles[tab.value])
const fields = computed(() => mappingFields[tab.value])
const visibleAuditFields = computed(() => mappingAuditFields(tab.value))
const searchPlaceholder = computed(() => ({ cost: '搜索科目 / 成本要素 / 编码 / 名称', business: '搜索板块段值 / 说明 / Seg_Level', organization: '搜索组织编码 / 名称 / 简称 / 上级编码' })[tab.value])
const filtered = computed(() => data[tab.value].filter(row => fields.value.some(field => row[field.key].toLowerCase().includes(search.value.trim().toLowerCase()))))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const selected = ref<MappingRow[]>([]); const table = ref<TableInstance>()
watch([tab, search, pageSize], () => { page.value = 1; selected.value = []; table.value?.clearSelection() })
watch(page, () => { selected.value = []; table.value?.clearSelection() })
function commit(kind: MappingKind, rows: MappingRow[]) {
  try { saveMappings(kind, rows) } catch { ElMessage.error('保存失败：浏览器存储不可用或空间不足，本次修改未生效'); return false }
  data[kind] = rows; selected.value = []; table.value?.clearSelection()
  page.value = Math.min(page.value, pageCount.value)
  return true
}
function nextId() { return globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}` }
const dialogOpen = ref(false); const editingId = ref(''); const form = reactive<Record<string, string>>({})
function openForm(row?: MappingRow) {
  editingId.value = row?.id || ''
  Object.keys(form).forEach(key => delete form[key])
  fields.value.forEach(field => { form[field.key] = row?.[field.key] || '' })
  form.version = row?.version || 'V1.0'; form.valid = row?.valid || 'Y'
  dialogOpen.value = true
}
function saveForm() {
  const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
  const error = validateMapping(tab.value, values)
  if (error) { ElMessage.warning(error); return }
  if (!values.version) { ElMessage.warning('请填写版本号'); return }
  if (data[tab.value].some(row => row.code === values.code && row.id !== editingId.value)) { ElMessage.warning('编码已存在，请使用唯一编码'); return }
  const existing = data[tab.value].find(row => row.id === editingId.value)
  const now = mappingTimestamp()
  const row = { ...existing, ...values, id: existing?.id || nextId(), code: values.code, createdBy: existing?.createdBy || 'admin', createdAt: existing?.createdAt || now, updatedBy: 'admin', updatedAt: now, version: values.version, valid: values.valid } as MappingRow
  const rows = existing ? data[tab.value].map(item => item.id === row.id ? row : item) : [row, ...data[tab.value]]
  if (commit(tab.value, rows)) { dialogOpen.value = false; ElMessage.success('保存成功') }
}
async function removeRows(rows: MappingRow[]) {
  if (!rows.length) return
  const kind = tab.value
  try { await ElMessageBox.confirm(`确定删除${rows.length === 1 ? `编码为 ${rows[0].code} 的映射` : `所选 ${rows.length} 条映射`}？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  const ids = new Set(rows.map(row => row.id))
  if (commit(kind, data[kind].filter(row => !ids.has(row.id)))) ElMessage.success('删除成功')
}
async function reset() {
  const kind = tab.value
  try { await ElMessageBox.confirm(`将${title.value}恢复为项目初始数据，当前新增、编辑和导入的内容将被替换。是否继续？`, '重置映射', { type: 'warning', confirmButtonText: '恢复初始数据', cancelButtonText: '取消' }) } catch { return }
  if (commit(kind, initialMappings(kind))) { search.value = ''; page.value = 1; ElMessage.success('已恢复初始数据') }
}
const fileInput = ref<HTMLInputElement>(); const importOpen = ref(false); const importBusy = ref(false)
const importKind = ref<MappingKind>('cost'); const importRows = ref<Record<string, string>[]>([])
const importFields = computed(() => mappingFields[importKind.value])
const importUpdated = computed(() => importRows.value.filter(row => data[importKind.value].some(item => item.code === row.code)).length)
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''
  if (!file) return
  importKind.value = tab.value; importBusy.value = true
  try {
    const raw = await readMappingFile(file)
    const mapped = raw.map((item, index) => {
      const row: Record<string, string> = {}
      importFields.value.forEach(field => { row[field.key] = item[field.label] || (field.key === 'nature' ? item['变动/固定'] : '') || item[field.key] || '' })
      row.valid = item['是否有效'] || item.valid || 'Y'; row.version = item['版本号'] || item.version || 'V1.0'
      const error = validateMapping(importKind.value, row)
      if (error) throw new Error(`数据第 ${index + 1} 行：${error}`)
      return row
    })
    const codes = new Set<string>()
    for (const row of mapped) { if (codes.has(row.code)) throw new Error(`文件中编码 ${row.code} 重复，请处理后重新导入`); codes.add(row.code) }
    importRows.value = mapped; importOpen.value = true
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '导入失败，请检查文件内容') }
  finally { importBusy.value = false }
}
function confirmImport() {
  const kind = importKind.value; const now = mappingTimestamp()
  const rows = new Map(data[kind].map(row => [row.code, row]))
  for (const item of importRows.value) {
    const old = rows.get(item.code)
    rows.set(item.code, { ...old, ...item, id: old?.id || nextId(), code: item.code, createdBy: old?.createdBy || 'admin', createdAt: old?.createdAt || now, updatedBy: 'admin', updatedAt: now, version: item.version, valid: item.valid } as MappingRow)
  }
  if (commit(kind, [...rows.values()])) { importOpen.value = false; search.value = ''; page.value = 1; ElMessage.success(`已导入 ${importRows.value.length} 条映射`) }
}
function downloadTemplate() {
  const headers = [...fields.value.map(field => field.label), ...(tab.value === 'organization' ? [] : ['版本号', '是否有效'])]
  const blob = new Blob(['\uFEFF' + headers.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${title.value}导入模板.csv`; link.click(); URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="mapping-page">
    <h1>映射管理配置</h1>
    <nav class="mapping-tabs" aria-label="映射类型"><button v-for="kind in (['cost','business','organization'] as const)" :key="kind" :class="{active:tab===kind}" @click="tab=kind">{{ mappingTitles[kind] }}</button></nav>
    <section class="mapping-card">
      <h2>{{ title }}</h2>
      <div class="mapping-toolbar"><el-input v-model="search" clearable :placeholder="searchPlaceholder" aria-label="搜索映射" class="mapping-search"/><el-button @click="openForm()">新增</el-button><el-button :loading="importBusy" @click="fileInput?.click()">导入</el-button><el-button @click="reset">重置</el-button><el-button :disabled="!selected.length" @click="removeRows(selected)">删除所选<span v-if="selected.length">（{{ selected.length }}）</span></el-button><span class="mapping-count">共 {{ filtered.length }} 条</span></div>
      <input ref="fileInput" type="file" accept=".xlsx,.csv,.tsv" hidden @change="chooseFile"/>
      <el-table ref="table" :key="tab" :data="visible" border stripe height="520" row-key="id" class="mapping-table" @selection-change="selected=$event">
        <el-table-column type="selection" width="48"/>
        <el-table-column v-for="field in fields" :key="field.key" :prop="field.key" :label="field.label" :min-width="field.width" show-overflow-tooltip>
          <template #default="{row}"><span v-if="field.key==='nature'" :class="['mapping-tag',row.nature==='变动'?'green':row.nature==='固定'?'blue':'inactive']">{{ row.nature }}</span><span v-else-if="field.key==='isProperty' && row.isProperty" :class="['mapping-tag',row.isProperty==='是'?'green':'inactive']">{{ row.isProperty }}</span><span v-else :class="{'mapping-code':field.key==='code','mapping-subject':field.key==='subject'}">{{ row[field.key] }}</span></template>
        </el-table-column>
        <el-table-column v-for="field in visibleAuditFields" :key="field.key" :prop="field.key" :label="field.label" :min-width="field.width" show-overflow-tooltip><template #default="{row}"><span v-if="field.key==='valid'" :class="['mapping-tag','valid',row.valid==='Y'?'green':'inactive']">{{ row.valid }}</span><span v-else class="mapping-audit">{{ row[field.key] }}</span></template></el-table-column>
        <el-table-column label="操作" width="140" fixed="right"><template #default="{row}"><el-button size="small" @click="openForm(row)">编辑</el-button><el-button size="small" class="mapping-delete" @click="removeRows([row])">删除</el-button></template></el-table-column>
      </el-table>
      <footer class="mapping-footer"><span>第 {{ page }} / {{ pageCount }} 页</span><el-button :disabled="page===1" @click="page=1">首页</el-button><el-button :disabled="page===1" @click="page--">上一页</el-button><el-button :disabled="page>=pageCount" @click="page++">下一页</el-button><el-button :disabled="page>=pageCount" @click="page=pageCount">末页</el-button><span>每页</span><el-select v-model="pageSize" style="width:80px" aria-label="每页条数"><el-option v-for="size in [10,20,50,100]" :key="size" :value="size" :label="String(size)"/></el-select><span>条</span></footer>
    </section>
    <div class="mapping-note"><span>配置保存在当前浏览器，仅作用于本配置页面。</span><button @click="downloadTemplate">下载{{ title }}导入模板</button><span>支持 XLSX / CSV / TSV，按编码新增或更新。</span></div>
    <el-dialog v-model="dialogOpen" :title="`${editingId?'编辑':'新增'}${title}`" width="620px" :close-on-click-modal="false" destroy-on-close>
      <el-form label-position="top" class="mapping-form" @submit.prevent="saveForm"><el-form-item v-for="field in fields" :key="field.key" :label="field.label" :required="field.required"><el-select v-if="field.options" v-model="form[field.key]" :clearable="!field.required" style="width:100%"><el-option v-for="value in field.options" :key="value" :label="value" :value="value"/></el-select><el-input v-else v-model="form[field.key]" :maxlength="300" :placeholder="field.key==='segLevel1'?'可留空':`请输入${field.label}`"/></el-form-item><el-form-item v-if="tab!=='organization'" label="版本号" required><el-input v-model="form.version" maxlength="30"/></el-form-item><el-form-item v-if="tab!=='organization'" label="是否有效" required><el-select v-model="form.valid" style="width:100%"><el-option label="Y — 有效" value="Y"/><el-option label="N — 无效" value="N"/></el-select></el-form-item></el-form>
      <template #footer><el-button @click="dialogOpen=false">取消</el-button><el-button type="primary" @click="saveForm">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="importOpen" title="导入预览" width="min(900px, 92vw)" :close-on-click-modal="false"><p class="import-summary">共 {{ importRows.length }} 条：新增 {{ importRows.length-importUpdated }} 条，更新 {{ importUpdated }} 条。同编码记录将按导入内容更新。</p><p v-if="importKind==='business'" class="import-summary">未提供 Seg_Level 1 时，该字段留空。</p><el-table :data="importRows.slice(0,10)" border max-height="350"><el-table-column v-for="field in importFields" :key="field.key" :prop="field.key" :label="field.label" :min-width="field.width"/></el-table><p class="import-summary">预览前10条，点击确认后保存全部数据。</p><template #footer><el-button @click="importOpen=false">取消</el-button><el-button type="primary" @click="confirmImport">确认导入</el-button></template></el-dialog>
  </div>
</template>

<style scoped>
.mapping-page{max-width:1560px;margin:12px auto 0;color:#263b59}.mapping-page h1{font-size:23px;font-weight:650;color:#192d49;margin:0 0 14px}.mapping-tabs{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}.mapping-tabs button{border:1px solid #d6e1f1;background:#fff;border-radius:9px;color:#61738e;padding:12px 23px;font-family:inherit;font-size:14px;font-weight:500;line-height:1.5;cursor:pointer}.mapping-tabs button.active{background:#2e76ee;color:#fff;border-color:#2e76ee;font-weight:600}.mapping-card{padding:20px;background:#fff;border:1px solid #dce6f3;border-radius:12px}.mapping-card h2{font-size:16px;font-weight:600;margin:0 0 14px}.mapping-toolbar{display:flex;gap:9px;align-items:center;margin-bottom:18px;flex-wrap:wrap}.mapping-search{width:350px;max-width:100%}.mapping-toolbar .el-button{margin:0;height:36px;color:#657792;border-color:#d7e3f4}.mapping-count{margin-left:auto;color:#8494ad;font-size:12px}.mapping-table{--el-table-border-color:#e3ebf6;--el-table-header-bg-color:#f1f6fc;--el-table-tr-bg-color:#fff;--el-table-row-hover-bg-color:#edf5ff;color:#405675}.mapping-table :deep(th.el-table__cell){background:#f1f6fc;font-size:12px;font-weight:600;color:#405775;height:40px}.mapping-table :deep(td.el-table__cell){height:43px;font-size:12px;color:#405675}.mapping-table :deep(.el-table__row--striped td.el-table__cell){background:#f8fbff}.mapping-table :deep(.cell){padding:0 11px}.mapping-table :deep(.el-button){margin:0 5px 0 0;border-color:#d4e1f3;color:#647792;font-size:11px;padding:5px 9px;border-radius:5px!important}.mapping-table :deep(.mapping-delete){border-color:#f0cdce;color:#d97175}.mapping-code{font-family:Menlo,Consolas,monospace;color:#3374c4}.mapping-subject{color:#3374c4}.mapping-audit{color:#8192af}.mapping-tag{display:inline-block;border-radius:5px;font-size:11px;font-weight:500;padding:2px 8px;line-height:1.5}.mapping-tag.green{background:#e5f6f0;color:#18a387}.mapping-tag.blue{background:#e9f0ff;color:#397df5}.mapping-tag.valid{border-radius:12px;padding:1px 10px}.mapping-tag.inactive{background:#f2f3f5;color:#9a9faa}.mapping-footer{display:flex;align-items:center;gap:9px;font-size:12px;color:#7a8da9;margin-top:15px;flex-wrap:wrap}.mapping-footer .el-button{margin:0;color:#6b7e98;border-color:#dce6f5}.mapping-footer .el-button.is-disabled{color:#b6c1d2;border-color:#edf1f8}.mapping-note{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:12px 2px;color:#94a3b8;font-size:11px;line-height:1.8}.mapping-note button{background:none;border:0;padding:0;color:#1677ff;cursor:pointer;font:inherit}.mapping-form{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.mapping-form :deep(.el-form-item__label){color:#52647d;font-size:12px}.mapping-form :deep(.el-form-item){margin-bottom:18px}.import-summary{font-size:12px;color:#64748b;line-height:1.8}@media(max-width:760px){.mapping-page{margin-top:0}.mapping-card{padding:14px 10px}.mapping-page h1{font-size:20px}.mapping-tabs button{padding:10px 16px}.mapping-toolbar{gap:7px}.mapping-search{width:100%}.mapping-count{margin-left:0;width:100%}.mapping-form{grid-template-columns:1fr}}
</style>
