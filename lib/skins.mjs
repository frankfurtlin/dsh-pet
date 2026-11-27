/**
 * dsh-pet — 皮肤图集（Codex pet 协议）校验与本地存储。
 *
 * 皮肤就是一张按协议切格的图集：固定 8 列，单格 192×208 RGBA，
 * 行数 9 / 10 / 11 分别对应 v1 / 10 行过渡版 / v2（v2 多出两行注视帧）。
 *
 * 这个模块只碰内置模块（fs / path / crypto），不 import 任何 DSH 包，
 * 方便 host 侧路由和单元测试直接复用：
 *
 *   root/
 *     index.json            { skins: [meta, ...] }（原子写：先 .tmp 再 rename）
 *     skin-1a2b3c4d.webp    图集本体
 *
 * 校验尽量放在「写之前」：尺寸 / 类型 / 体积不合法直接抛 SkinError，
 * 不留下半截文件，也不把坏数据塞进 index。
 */

import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 协议单格尺寸（像素）。 */
export const SPRITE_CELL = { width: 192, height: 208 }

/** 单张图集体积上限：3 MiB。 */
export const MAX_SKIN_BYTES = 3 * 1024 * 1024

/** 图集固定列数。 */
const SPRITE_COLS = 8
/** 合法行数区间（闭区间）。 */
const MIN_ROWS = 9
const MAX_ROWS = 11
/** 皮肤 id：skin- + 8 位小写十六进制。 */
const SKIN_ID = /^skin-[0-9a-f]{8}$/
/** 日期/路径安全：id 已经用正则挡过，index 里的 label 只做展示。 */
const DEFAULT_LABEL = '自定义'
const MAX_LABEL = 24
const INDEX_FILE = 'index.json'

/**
 * 行数 → 协议版本。10 行是 v1 与 v2 之间的过渡图集，没有正式版本号，
 * 这里记作 v1.5；消费方需要精确行为时请直接用 rows。
 */
const VERSION_BY_ROWS = { 9: 'v1', 10: 'v1.5', 11: 'v2' }

/** 皮肤相关错误：带稳定的 code，host 路由可以据此回 400/404。 */
export class SkinError extends Error {
  /**
   * @param {string} message
   * @param {'BAD_TYPE'|'BAD_MAGIC'|'BAD_DIMENSIONS'|'TOO_LARGE'|'BAD_ID'|'NOT_FOUND'} code
   */
  constructor(message, code) {
    super(message)
    this.name = 'SkinError'
    this.code = code
  }
}

/** 从 PNG 头里读 IHDR 尺寸；不是 PNG 返回 null。 */
function pngSize(buffer) {
  if (buffer.length < 24) return null
  // 89 50 4E 47 0D 0A 1A 0A
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null
  if (buffer.readUInt32BE(4) !== 0x0d0a1a0a) return null
  // 第一个 chunk 必须是 IHDR（长度 4 字节 + 类型 4 字节，尺寸紧随其后）
  if (buffer.readUInt32BE(12) !== 0x49484452) return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** 从 WebP 头里读画布尺寸；支持 VP8 / VP8L / VP8X 三种，失败返回 null。 */
function webpSize(buffer) {
  if (buffer.length < 30) return null
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null
  const fourcc = buffer.toString('ascii', 12, 16)

  // 有损 VP8：帧头 3 字节 + 起始码 9D 01 2A，随后 14 位宽 / 14 位高。
  if (fourcc === 'VP8 ') {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }

  // 无损 VP8L：签名 0x2F，随后 14 位 (宽-1) + 14 位 (高-1)。
  if (fourcc === 'VP8L') {
    if (buffer[20] !== 0x2f) return null
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    }
  }

  // 扩展 VP8X：4 字节 flag 后是 24 位 (宽-1) + 24 位 (高-1)。
  if (fourcc === 'VP8X') {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    }
  }

  return null
}

/**
 * 识别图集格式并校验协议尺寸。
 *
 * @param {Buffer} buffer
 * @returns {{mime: 'image/webp'|'image/png', width: number, height: number, cols: number, rows: number, version: string}}
 */
export function detectSpriteSheet(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new SkinError('图集内容必须是 Buffer', 'BAD_MAGIC')
  }

  const png = pngSize(buffer)
  const size = png ?? webpSize(buffer)
  if (size === null) {
    throw new SkinError('无法识别的图集格式（只支持 PNG / WebP）', 'BAD_MAGIC')
  }

  const { width, height } = size
  const cell = SPRITE_CELL
  if (width <= 0 || height <= 0) {
    throw new SkinError(`图集尺寸 ${width}×${height} 无效`, 'BAD_DIMENSIONS')
  }
  if (width % cell.width !== 0 || height % cell.height !== 0) {
    throw new SkinError(
      `图集尺寸 ${width}×${height} 不是单格 ${cell.width}×${cell.height} 的整数倍`,
      'BAD_DIMENSIONS',
    )
  }

  const cols = width / cell.width
  const rows = height / cell.height
  if (cols !== SPRITE_COLS) {
    throw new SkinError(`图集必须是 ${SPRITE_COLS} 列，当前 ${cols} 列`, 'BAD_DIMENSIONS')
  }
  if (rows < MIN_ROWS || rows > MAX_ROWS) {
    throw new SkinError(`图集行数必须是 ${MIN_ROWS}–${MAX_ROWS}，当前 ${rows}`, 'BAD_DIMENSIONS')
  }

  return {
    mime: png === null ? 'image/webp' : 'image/png',
    width,
    height,
    cols,
    rows,
    version: VERSION_BY_ROWS[rows],
  }
}

/** 元数据是否完整可信；index.json 可能被手改，读的时候一律过一遍。 */
function isSkinMeta(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false
  if (typeof entry.id !== 'string' || !SKIN_ID.test(entry.id)) return false
  if (entry.mime !== 'image/png' && entry.mime !== 'image/webp') return false
  if (typeof entry.label !== 'string') return false
  if (!Number.isFinite(entry.width) || entry.width <= 0) return false
  if (!Number.isFinite(entry.height) || entry.height <= 0) return false
  if (entry.cols !== SPRITE_COLS) return false
  if (!Number.isInteger(entry.rows) || entry.rows < MIN_ROWS || entry.rows > MAX_ROWS) return false
  if (typeof entry.version !== 'string') return false
  if (!Number.isFinite(entry.createdAt)) return false
  return true
}

/** mime → 扩展名。 */
function extOf(mime) {
  return mime === 'image/png' ? 'png' : 'webp'
}

/** 图集文件路径：root/<id>.<ext>。 */
function skinFile(root, meta) {
  return path.join(root, `${meta.id}.${extOf(meta.mime)}`)
}

/** index.json 路径。 */
function indexPath(root) {
  return path.join(root, INDEX_FILE)
}

/** 读 index；缺失 / 损坏 / 形状不对都当成空列表（坏 index 不该让宠物整只消失）。 */
function readIndex(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath(root), 'utf8'))
    return Array.isArray(raw?.skins) ? raw.skins : []
  } catch {
    return []
  }
}

/** 原子写 index：先写 index.json.tmp，再 renameSync 顶掉旧文件。 */
function writeIndex(root, skins) {
  fs.mkdirSync(root, { recursive: true })
  const target = indexPath(root)
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify({ skins }, null, 2)}\n`)
  fs.renameSync(tmp, target)
}

/** 校验 id 形状，非法直接抛 BAD_ID（也顺手挡住 ../ 之类的路径穿越）。 */
function assertId(id) {
  if (typeof id !== 'string' || !SKIN_ID.test(id)) {
    throw new SkinError(`皮肤 id 不合法：${String(id)}`, 'BAD_ID')
  }
}

/** label 去空白、按 Unicode 码点截 24 字，空值回落默认名。 */
function normalizeLabel(label) {
  const text = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : ''
  if (text === '') return DEFAULT_LABEL
  return Array.from(text).slice(0, MAX_LABEL).join('')
}

/**
 * 列出 root 下的皮肤，按创建时间倒序（新的在前）。
 * root 不存在返回 []；index 里已经找不到文件的悬空条目会被忽略。
 *
 * @param {string} root
 * @returns {Array<{id: string, label: string, mime: string, width: number, height: number, cols: number, rows: number, version: string, bytes: number, createdAt: number}>}
 */
export function listSkins(root) {
  if (typeof root !== 'string' || root === '') return []

  const skins = []
  for (const entry of readIndex(root)) {
    if (!isSkinMeta(entry)) continue
    let stat
    try {
      stat = fs.statSync(skinFile(root, entry))
    } catch {
      continue // 悬空条目：文件已被手动删掉
    }
    if (!stat.isFile()) continue
    skins.push({
      id: entry.id,
      label: entry.label,
      mime: entry.mime,
      width: entry.width,
      height: entry.height,
      cols: entry.cols,
      rows: entry.rows,
      version: entry.version,
      bytes: stat.size,
      createdAt: entry.createdAt,
    })
  }

  skins.sort((a, b) => b.createdAt - a.createdAt)
  return skins
}

/**
 * 校验并保存一张皮肤，返回落盘后的元数据。
 *
 * @param {string} root 皮肤目录（如 ~/.dsh/pet-skins）
 * @param {{data: Buffer, label?: string, now?: number}} options
 * @returns {{id: string, label: string, mime: string, width: number, height: number, cols: number, rows: number, version: string, bytes: number, createdAt: number}}
 */
export function saveSkin(root, options = {}) {
  if (typeof root !== 'string' || root === '') {
    throw new SkinError('皮肤目录无效', 'BAD_TYPE')
  }
  const data = options?.data
  if (!Buffer.isBuffer(data)) {
    throw new SkinError('data 必须是 Buffer', 'BAD_TYPE')
  }
  if (data.length === 0) {
    throw new SkinError('图集内容为空', 'BAD_MAGIC')
  }
  if (data.length > MAX_SKIN_BYTES) {
    throw new SkinError(`图集超过 ${MAX_SKIN_BYTES} 字节上限`, 'TOO_LARGE')
  }

  const info = detectSpriteSheet(data)
  const label = normalizeLabel(options.label)
  const createdAt = Number.isFinite(options.now) && options.now >= 0 ? options.now : Date.now()

  fs.mkdirSync(root, { recursive: true })

  // randomBytes(4) 撞 id 的概率可以忽略，但既然要写文件就顺手让开已有文件。
  let id = ''
  for (let attempt = 0; attempt < 8; attempt += 1) {
    id = `skin-${randomBytes(4).toString('hex')}`
    if (!fs.existsSync(skinFile(root, { id, mime: info.mime }))) break
  }

  const meta = {
    id,
    label,
    mime: info.mime,
    width: info.width,
    height: info.height,
    cols: info.cols,
    rows: info.rows,
    version: info.version,
    bytes: data.length,
    createdAt,
  }

  fs.writeFileSync(skinFile(root, meta), data)

  const skins = readIndex(root).filter(isSkinMeta).filter((entry) => entry.id !== id)
  skins.unshift(meta)
  writeIndex(root, skins)

  return meta
}

/**
 * 读一张皮肤本体。
 *
 * @param {string} root
 * @param {string} id
 * @returns {{mime: 'image/png'|'image/webp', data: Buffer}}
 */
export function readSkin(root, id) {
  assertId(id)
  if (typeof root !== 'string' || root === '') {
    throw new SkinError(`皮肤 ${id} 不存在`, 'NOT_FOUND')
  }

  const meta = readIndex(root).find((entry) => entry?.id === id && isSkinMeta(entry))
  const candidates = []
  if (meta !== undefined) candidates.push(skinFile(root, meta))
  // index 丢了也别急着报错：按协议约定的两种扩展名再探一次。
  for (const ext of ['webp', 'png']) {
    const file = path.join(root, `${id}.${ext}`)
    if (!candidates.includes(file)) candidates.push(file)
  }

  for (const file of candidates) {
    try {
      return { mime: file.endsWith('.png') ? 'image/png' : 'image/webp', data: fs.readFileSync(file) }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  throw new SkinError(`皮肤 ${id} 不存在`, 'NOT_FOUND')
}

/**
 * 删除一张皮肤（文件 + index 条目）。
 *
 * @param {string} root
 * @param {string} id
 * @returns {boolean} 是否真的删掉了什么
 */
export function removeSkin(root, id) {
  assertId(id)
  if (typeof root !== 'string' || root === '') return false

  const entries = readIndex(root)
  const meta = entries.find((entry) => entry?.id === id)
  let removed = false

  const exts = new Set(['webp', 'png'])
  if (meta !== undefined && isSkinMeta(meta)) exts.add(extOf(meta.mime))
  for (const ext of exts) {
    try {
      fs.unlinkSync(path.join(root, `${id}.${ext}`))
      removed = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const kept = entries.filter((entry) => entry?.id !== id)
  if (kept.length !== entries.length) {
    removed = true
    writeIndex(root, kept)
  }

  return removed
}
