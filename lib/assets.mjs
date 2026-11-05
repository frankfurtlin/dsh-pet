/**
 * dsh-pet — 内置素材直供：`assets/` 白名单、MIME、ETag。
 *
 * 为什么要有这个模块：桌宠的图集和动作视频原本 base64 内联进 client.js，bundle
 * 涨到 3.8MB，而且同一份素材（12 条动作视频被两只形象共用）会被内联两遍。改成
 * `/pet/assets/<文件名>` 直供后 bundle 只剩代码，浏览器按需取、带 ETag 回源校验。
 *
 * 安全边界：只认 `assets/` 目录里、文件名匹配 `[a-z0-9-]+.(webp|png|webm)` 的文件；
 * 目录本身不对外列目录。这里只 import node 内置模块，host 路由和单元测试共用。
 */

import fs from 'node:fs'
import path from 'node:path'

/** 允许直供的素材名：小写名字 + 已知扩展名（正则本身就挡住 `..`、斜杠、绝对路径）。 */
export const ASSET_NAME = /^[a-z0-9][a-z0-9-]{0,63}\.(webp|png|webm)$/

/** 扩展名 → MIME。 */
export const ASSET_MIME = { webp: 'image/webp', png: 'image/png', webm: 'video/webm' }

/** 单文件体积上限：与构建预算一致（768KB），再大说明该降采样。 */
export const MAX_ASSET_BYTES = 768 * 1024

/** 素材相关错误：带稳定 code，路由据此回 400/404/413。 */
export class AssetError extends Error {
  /**
   * @param {string} message
   * @param {'BAD_NAME'|'NOT_FOUND'|'TOO_LARGE'} code
   */
  constructor(message, code) {
    super(message)
    this.name = 'AssetError'
    this.code = code
  }
}

/**
 * 解析一个素材名 → 元信息（不读内容）。
 *
 * @param {string} rootDir assets 目录
 * @param {string} name 形如 `anim-cheer.webm`
 */
export function resolveAsset(rootDir, name) {
  const wanted = String(name ?? '')
  if (!ASSET_NAME.test(wanted)) throw new AssetError(`素材名不合法：${wanted.slice(0, 80)}`, 'BAD_NAME')
  const root = path.resolve(rootDir)
  const file = path.resolve(root, wanted)
  // 正则已经挡住 ../，这里再确认解析结果仍在目录内（双保险）
  if (path.dirname(file) !== root) throw new AssetError(`素材路径越界：${wanted.slice(0, 80)}`, 'BAD_NAME')
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    throw new AssetError(`素材不存在：${wanted}`, 'NOT_FOUND')
  }
  if (!stat.isFile()) throw new AssetError(`素材不存在：${wanted}`, 'NOT_FOUND')
  if (stat.size > MAX_ASSET_BYTES) throw new AssetError(`素材太大：${wanted}`, 'TOO_LARGE')
  const ext = wanted.slice(wanted.lastIndexOf('.') + 1)
  return {
    name: wanted,
    file,
    size: stat.size,
    mime: ASSET_MIME[ext],
    // 体积 + mtime 足够区分内容变化，又不用每次算哈希（素材是随插件发版的静态文件）
    etag: `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
  }
}

/** 解析并读出内容（路由用；文件 ≤768KB，直读即可）。 */
export function readAsset(rootDir, name) {
  const meta = resolveAsset(rootDir, name)
  try {
    return { ...meta, bytes: fs.readFileSync(meta.file) }
  } catch {
    throw new AssetError(`素材读取失败：${meta.name}`, 'NOT_FOUND')
  }
}

/** 目录里现有素材名（自检路由用；目录不存在返回空数组）。 */
export function listAssets(rootDir) {
  try {
    return fs
      .readdirSync(rootDir)
      .filter((name) => ASSET_NAME.test(name))
      .sort()
  } catch {
    return []
  }
}
