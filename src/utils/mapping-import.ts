// 仅读取首个工作表的单元格文本，不执行公式、宏或外部链接。
function parseDelimited(text: string): string[][] {
  const delimiter = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ','
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (c === delimiter && !quoted) { row.push(value); value = '' }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(value); rows.push(row); row = []; value = ''
    } else value += c
  }
  if (quoted) throw new Error('CSV 引号未闭合，请检查文件格式')
  if (value || row.length) { row.push(value); rows.push(row) }
  return rows
}
async function readXlsx(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer); const view = new DataView(buffer)
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < Math.max(0, bytes.length - 65557)) throw new Error('文件不是有效的 XLSX 工作簿')
  const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder(); const entries = new Map<string, { offset: number; size: number; fullSize: number; method: number }>()
  let total = 0
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('工作簿压缩目录损坏')
    const nameLength = view.getUint16(offset + 28, true)
    const fullSize = view.getUint32(offset + 24, true); total += fullSize
    if (total > 60 * 1024 * 1024) throw new Error('工作簿解压内容过大，请减少文件数据')
    entries.set(decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)), { offset: view.getUint32(offset + 42, true), size: view.getUint32(offset + 20, true), fullSize, method: view.getUint16(offset + 10, true) })
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  async function xml(path: string) {
    const entry = entries.get(path)
    if (!entry) throw new Error(`工作簿缺少 ${path}`)
    const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
    const compressed = bytes.slice(start, start + entry.size)
    let content: string
    if (entry.method === 0) content = decoder.decode(compressed)
    else if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 XLSX 解压，请导入 CSV 文件')
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
      content = await new Response(stream).text()
    } else throw new Error('不支持此工作簿的压缩格式，请另存为 XLSX 或 CSV')
    const doc = new DOMParser().parseFromString(content, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length) throw new Error('工作簿 XML 内容损坏')
    return doc
  }
  const strings = entries.has('xl/sharedStrings.xml') ? Array.from((await xml('xl/sharedStrings.xml')).getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join('')) : []
  const workbook = await xml('xl/workbook.xml'); const first = workbook.getElementsByTagName('sheet')[0]
  const relationId = first?.getAttribute('r:id')
  const relation = Array.from((await xml('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === relationId)
  const target = relation?.getAttribute('Target')
  if (!target) throw new Error('工作簿中没有可读取的工作表')
  const parts: string[] = []
  for (const part of (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part) }
  const sheet = await xml(parts.join('/'))
  return Array.from(sheet.getElementsByTagName('row')).map(row => {
    const values: string[] = []
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      let col = 0; for (const c of cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0] || 'A') col = col * 26 + c.charCodeAt(0) - 64
      const value = cell.getElementsByTagName('v')[0]?.textContent || ''
      values[col - 1] = cell.getAttribute('t') === 's' ? strings[Number(value)] || '' : cell.getAttribute('t') === 'inlineStr' ? Array.from(cell.getElementsByTagName('t')).map(t => t.textContent || '').join('') : value
    }
    return values
  })
}
export async function readMappingFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10MB')
  const name = file.name.toLowerCase()
  if (!/\.(xlsx|csv|tsv)$/.test(name)) throw new Error('请选择 XLSX、CSV 或 TSV 文件')
  const rows = name.endsWith('.xlsx') ? await readXlsx(await file.arrayBuffer()) : parseDelimited((await file.text()).replace(/^\uFEFF/, ''))
  const filled = rows.filter(row => row.some(value => value?.trim()))
  if (filled.length < 2) throw new Error('文件中需要包含表头及至少一条数据')
  if (filled.length > 10001) throw new Error('单次最多导入10000条数据')
  const headers = filled[0].map(value => value.trim())
  return filled.slice(1).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]?.trim() || ''])))
}
