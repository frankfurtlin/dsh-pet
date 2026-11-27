#!/usr/bin/env node
/**
 * dsh-pet 构建：client-src/*.js + styles/pet.css → client.js
 *
 *   node scripts/build.mjs          生成 client.js
 *   node scripts/build.mjs --check  只校验产物是否与源一致（提交前/CI 用）
 *
 * 为什么自己拼而不是上 bundler：
 *   · 产物必须是一段 `window.__ModuleLoader__.load({id, factory})` 的同步 CJS，
 *     DSH 的客户端模块系统只接受这一种形状；用 tsdown/vite 反而要额外维护一份
 *     构建配置，还得对齐 DSH 的基线模块表（react 等必须保持 external）；
 *   · 源文件按固定顺序拼进同一个 factory 作用域，几乎零构建成本，`--check`
 *     在每次改完源码后都能立刻确认产物没走样。
 *
 * 除了拼接，构建做三件防腐烂的校验：
 *   1. **JS 语法校验**：`new Function` 只解析不执行，语法错在构建期就炸；
 *   2. **token 名校验**：样式里用到的每个 `--dsw-*` 必须能在当前安装的 DSH
 *      ui-theme 里找到——官方改名时立刻失败，而不是等哪天颜色不对再排查；
 *   3. **占位符校验**：CSS 占位符必须正好出现一次，防止漏注入/重复注入；
 *   4. **素材校验**：位图角色引用的 assets/ 文件必须存在、格式受支持、体积在预算内，
 *      再把占位符换成 `/pet/assets/<文件名>`（host 半按白名单直供）；缺文件会变成
 *      页面上一块空白，构建期就该拦住。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT_PATH = join(ROOT, 'client.js')
const CSS_PATH = join(ROOT, 'styles/pet.css')
const CONFIG_PATH = join(ROOT, 'scripts/build.config.json')
const PKG_PATH = join(ROOT, 'package.json')

/** 源码拼接顺序（main.js 必须最后：它引用前面所有东西）。 */
const SOURCES = [
  'generated-images.js',
  'generated-anims.js',
  'characters.js',
  'props.js',
  'outfits.js',
  'i18n.js',
  'live.js',
  'store.js',
  'sound.js',
  'actions.js',
  'state.js',
  'overlay.js',
  'settings.js',
  'main.js',
]

const CSS_PLACEHOLDER = "'__DSH_PET_CSS__'"

const readPkg = () => JSON.parse(readFileSync(PKG_PATH, 'utf8'))

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** 官方 ui-theme 的客户端 bundle：token 名的唯一事实来源。 */
function findThemeBundle() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  const candidates = []
  if (process.env.DSH_UI_THEME_BUNDLE) candidates.push(process.env.DSH_UI_THEME_BUNDLE)
  for (const entry of config.themeBundleCandidates ?? []) candidates.push(entry.replace('~', homedir()))
  for (const candidate of candidates) if (candidate && existsSync(candidate)) return candidate
  // 兜底：按当前 node 的安装前缀（nvm 等）推全局安装目录，不写死版本号与本机绝对路径
  const globalRoot = join(
    process.execPath,
    '../../lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  )
  return existsSync(globalRoot) ? globalRoot : null
}

/** 官方 token 名集合；拿不到返回 null（在别的机器上构建时跳过校验并告警）。 */
function officialTokens() {
  const bundle = findThemeBundle()
  if (!bundle) return null
  const text = readFileSync(bundle, 'utf8')
  return new Set(text.match(/--dsw-[a-z0-9-]+/g) ?? [])
}

/** 我们自己定义的 token、以及 var() 引用到的 token。 */
function collectTokens(css) {
  const defined = new Set()
  const used = new Set()
  for (const match of css.matchAll(/(--(?:dsw|pet|skin)-[a-z0-9-]+)\s*:/g)) defined.add(match[1])
  for (const match of css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) used.add(match[1])
  return { defined, used }
}

function checkTokens(css) {
  const official = officialTokens()
  const { defined, used } = collectTokens(css)
  const problems = []

  if (!official) {
    console.warn('⚠ 未找到 DSH ui-theme 客户端 bundle，跳过 --dsw-* token 名校验（设置 DSH_UI_THEME_BUNDLE 可强制校验）')
    return { problems, definedCount: defined.size }
  }
  for (const token of defined) {
    if (token.startsWith('--dsw-') && !official.has(token)) problems.push(`样式里定义了官方不存在的 token：${token}`)
  }
  for (const token of used) {
    if (token.startsWith('--dsw-') && !official.has(token) && !defined.has(token)) {
      problems.push(`样式里 var() 引用了不存在的官方 token：${token}`)
    }
    // 这些是运行时由 JS 写在宿主元素上的「入参」变量，不是样式表里定义的，放行
    const runtimeVars = ['--pet-progress', '--pet-bottom', '--pet-size', '--pet-scale', '--pet-look-x', '--pet-look-y', '--pet-ink-delay']
    if (token.startsWith('--pet-') && !defined.has(token) && !runtimeVars.some((name) => token.startsWith(name))) {
      problems.push(`样式里 var() 引用了未定义的宠物 token：${token}`)
    }
  }
  return { problems, definedCount: defined.size }
}

/** 读出所有源文件并做基础校验。 */
/**
 * 素材直供：源码里写 `__DSH_PET_ASSET_<NAME>__` 占位符，构建时换成
 * `/pet/assets/<name>.<ext>`（host 半的 ASSETS_PATH 白名单直供，带 ETag）。
 *
 * 2026-11-05 之前是 base64 内联：12 条动作视频被两只形象共用，同一份素材内联两遍，
 * bundle 涨到 3.8MB。换成 URL 后 bundle 只剩代码，抓一次就进浏览器缓存。
 * 单文件预算 768KB，超了说明该降采样。
 */
const ASSET_URL_PREFIX = '/pet/assets'
const ASSET_BUDGET_BYTES = 768 * 1024
const ASSET_PLACEHOLDER = /__DSH_PET_ASSET_([A-Z0-9_]+)__/g
const ASSET_TYPES = { webp: 'image/webp', png: 'image/png', webm: 'video/webm' }

function assetUrls(body) {
  const problems = []
  const used = new Map()
  const out = body.replace(ASSET_PLACEHOLDER, (whole, name) => {
    const base = name.toLowerCase()
    // 占位符里连字符会变成下划线（标识符限制），两种写法都找一遍
    const bases = [base, base.replace(/_/g, '-')]
    for (const [ext] of Object.entries(ASSET_TYPES)) {
      const path = bases.map((candidate) => join(ROOT, 'assets', `${candidate}.${ext}`)).find((file) => existsSync(file))
      if (!path) continue
      const bytes = readFileSync(path)
      if (bytes.byteLength > ASSET_BUDGET_BYTES) {
        problems.push(`素材超预算：assets/${base}.${ext} 是 ${(bytes.byteLength / 1024).toFixed(0)}KB，上限 ${ASSET_BUDGET_BYTES / 1024}KB（降采样再接）`)
        return whole
      }
      const file = basename(path)
      used.set(file, bytes.byteLength)
      return `${ASSET_URL_PREFIX}/${file}`
    }
    problems.push(`素材缺失：assets/${base}.webp / .png / .webm（源码里的 ${whole} 没有对应文件）`)
    return whole
  })
  return {
    out,
    used: [...used.entries()].map(([file, bytes]) => `${file} (${(bytes / 1024).toFixed(0)}KB)`),
    problems,
  }
}

function readSources() {
  const parts = []
  for (const name of SOURCES) {
    const path = join(ROOT, 'client-src', name)
    if (!existsSync(path)) fail(`缺少源文件：client-src/${name}`)
    const text = readFileSync(path, 'utf8')
    if (text.includes('</script')) fail(`client-src/${name} 含 </script 序列，会截断 script 标签`)
    if (text.includes('__DSH_PET_CSS__') && name !== 'main.js') fail(`client-src/${name} 里出现了 CSS 占位符，只允许 main.js 持有`)
    parts.push(`/* ── client-src/${name} ── */\n${text.trim()}\n`)
  }
  return parts.join('\n')
}

/** CSS → 可以安全嵌进单引号字符串的内容。 */
function escapeCss(css) {
  return css.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')
}

function render() {
  const pkg = readPkg()
  const css = readFileSync(CSS_PATH, 'utf8')
  const sources = readSources()
  const assets = assetUrls(sources)
  const body = assets.out

  if (!body.includes(CSS_PLACEHOLDER)) fail('main.js 缺少 CSS 占位符')

  const { problems, definedCount } = checkTokens(css)
  for (const problem of [...problems, ...assets.problems]) console.error(`✗ ${problem}`)
  if (problems.length || assets.problems.length) process.exit(1)

  const inlined = body.replace(CSS_PLACEHOLDER, `'${escapeCss(css)}'`)
  if (inlined.includes('__DSH_PET_CSS__')) fail('CSS 占位符没有被完整替换')

  const bundle = `// GENERATED for dsh-pet ${pkg.version} by scripts/build.mjs — do not edit by hand.
// 源码：client-src/${SOURCES.join(', client-src/')}
// 样式：styles/pet.css（构建时内联；改样式请改源文件再 npm run build）
window.__ModuleLoader__.load({id:"${pkg.name}",factory:function(require){var module={exports:{}};var exports=module.exports;
${inlined}
return module.exports;}});
`

  // 语法校验：只解析不执行（不会因为 window 不存在而失败）
  try {
    new Function('require', inlined)
  } catch (error) {
    fail(`生成的 bundle 语法错误：${error.message}`)
  }

  return { bundle, definedCount, assets: assets.used }
}

const args = new Set(process.argv.slice(2))
const { bundle, definedCount, assets } = render()

if (args.has('--check')) {
  if (!existsSync(OUT_PATH)) fail('client.js 不存在，请先运行 node scripts/build.mjs')
  const current = readFileSync(OUT_PATH, 'utf8')
  if (current !== bundle) fail('client.js 与源码不一致，请运行 node scripts/build.mjs 重新生成')
  console.log(`✓ client.js 与源码一致（${(bundle.length / 1024).toFixed(1)}KB，${definedCount} 个 --dsw-* token、${assets.length} 个素材 URL 核对）`)
  process.exit(0)
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, bundle)
const tokens = collectTokens(readFileSync(CSS_PATH, 'utf8'))
console.log(`✓ client.js 已生成：${(bundle.length / 1024).toFixed(1)}KB`)
console.log(`  源文件 ${SOURCES.length} 个：${SOURCES.join(', ')}`)
console.log(`  样式 token：定义 ${tokens.defined.size} 个，引用 ${tokens.used.size} 个`)
for (const asset of assets) console.log(`  素材：${asset}（${ASSET_URL_PREFIX}/…）`)
if (!existsSync(CONFIG_PATH)) console.warn(`⚠ 缺少 ${CONFIG_PATH}（token 校验会走兜底路径）`)
void readdirSync
