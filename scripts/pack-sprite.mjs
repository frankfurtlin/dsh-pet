#!/usr/bin/env node
/**
 * 把一张 Codex pet 协议的图集打包成插件内置素材，并打印可直接粘贴的 PET_CHARACTERS 条目。
 *
 * 用法：
 *   node scripts/pack-sprite.mjs <图集.png|webp> <素材 id> [--name 中文名] [--frame 192x208]
 *                                 [--budget 512] [--out assets]
 *
 * 做三件事：
 *   1. 校验图集尺寸符合协议（宽 = 帧宽 × 列数、高 = 帧高 × 行数；默认 8 列、单格 192×208）；
 *   2. 按体积预算挑一个 WebP 质量档（默认 512 KB，和构建脚本的 ASSET_BUDGET_BYTES 对齐），
 *      **不缩放**：单格原分辨率就是渲染时 200px 档要的尺寸，缩了就是上采样发虚；
 *   3. 打印角色条目（行号与帧数按 Codex pet 协议 v2 写死，可用 --dry-run 只看不写）。
 *
 * 只依赖 Python3 + Pillow（本机已有；Node 侧不引入图片库，保持插件零依赖）。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'

const FRAME_W = 192
const FRAME_H = 208
const COLS = 8
const DEFAULT_BUDGET_KB = 512
const VALID_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Codex pet 协议 v2：行 0–8 九个动作，有效帧数固定（多画的行不算）
const ACTIONS = [
  { key: 'idle', row: 0, frames: 6, label: '待机' },
  { key: 'runRight', row: 1, frames: 8, label: '向右跑' },
  { key: 'runLeft', row: 2, frames: 8, label: '向左跑' },
  { key: 'wave', row: 3, frames: 4, label: '挥手' },
  { key: 'jump', row: 4, frames: 5, label: '跳一下' },
  { key: 'failed', row: 5, frames: 8, label: '失败' },
  { key: 'waiting', row: 6, frames: 6, label: '等审批' },
  { key: 'working', row: 7, frames: 6, label: '干活' },
  { key: 'review', row: 8, frames: 6, label: '检查' },
]

// 单帧时长表也来自协议（所有宠物共用，客户端 ANIMATIONS 表就是这么写的）
const TIMING = {
  idle: [280, 110, 110, 140, 140, 320],
  runRight: [120, 120, 120, 120, 120, 120, 120, 220],
  runLeft: [120, 120, 120, 120, 120, 120, 120, 220],
  wave: [140, 140, 140, 280],
  jump: [140, 140, 140, 140, 280],
  failed: [140, 140, 140, 140, 140, 140, 140, 240],
  waiting: [150, 150, 150, 150, 150, 260],
  working: [120, 120, 120, 120, 120, 220],
  review: [150, 150, 150, 150, 150, 280],
}

function parseArgs(argv) {
  const [source, id, ...rest] = argv
  const options = { budgetKb: DEFAULT_BUDGET_KB, out: 'assets', name: '', dryRun: false }
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (flag === '--dry-run') options.dryRun = true
    else if (flag === '--name') options.name = rest[++index] ?? ''
    else if (flag === '--budget') options.budgetKb = Number(rest[++index]) || DEFAULT_BUDGET_KB
    else if (flag === '--out') options.out = rest[++index] ?? 'assets'
    else throw new Error(`不认识的参数：${flag}`)
  }
  return { source, id, options }
}

/** 用 Pillow 读尺寸 + 重新编码：Node 侧不装图片库，避免给插件加依赖 */
function python(script) {
  return execFileSync('python3', ['-c', script], { encoding: 'utf8' }).trim()
}

function inspect(source) {
  const out = python(
    `from PIL import Image; im=Image.open(${JSON.stringify(source)}); im.load(); print(im.size[0], im.size[1], im.mode)`,
  )
  const [width, height, mode] = out.split(' ')
  return { width: Number(width), height: Number(height), mode }
}

function encode(source, target, quality) {
  python(
    [
      'from PIL import Image',
      `im=Image.open(${JSON.stringify(source)})`,
      'im.load()',
      "im=im.convert('RGBA') if im.mode != 'RGBA' else im",
      `im.save(${JSON.stringify(target)}, 'WEBP', quality=${quality}, method=6, alpha_quality=92)`,
    ].join('; '),
  )
  return statSync(target).size
}

function characterEntry({ id, name, rows }) {
  const sprite = {
    url: `__DSH_PET_ASSET_${id.toUpperCase().replace(/-/g, '_')}__`,
    frameW: FRAME_W,
    frameH: FRAME_H,
    cols: COLS,
    rows,
    actions: Object.fromEntries(
      ACTIONS.map((action) => [action.key, { row: action.row, steps: TIMING[action.key] }]),
    ),
    idleSlow: { row: 0, steps: TIMING.idle.map((ms) => Math.round(ms * 1.8)) },
    states: {
      idle: 'idle',
      thinking: 'working',
      alert: 'waiting',
      celebrate: 'jump',
      happy: 'wave',
      sleep: 'idleSlow',
      focus: 'working',
      drag: 'runRight',
    },
  }
  if (rows >= 11) {
    // 图集有第 9–10 行的 16 向注视帧时才挂注视
    sprite.gaze = { rows: [9, 10], count: 16, originDeg: -90, stepDeg: 22.5, deadZonePx: 28 }
  }
  return {
    id,
    label: { zh: name || id, en: name || id },
    kind: 'sprite',
    sprite,
  }
}

function main() {
  const { source, id, options } = parseArgs(process.argv.slice(2))
  if (!source || !id) {
    console.error('用法：node scripts/pack-sprite.mjs <图集.png|webp> <素材 id> [--name 中文名] [--budget 512] [--out assets] [--dry-run]')
    process.exit(2)
  }
  if (!existsSync(source)) throw new Error(`图集不存在：${source}`)
  if (!VALID_ID.test(id)) throw new Error(`素材 id 必须是 kebab-case（小写字母、数字、连字符）：${id}`)

  const { width, height, mode } = inspect(source)
  if (width !== FRAME_W * COLS) {
    throw new Error(`图集宽度应为 ${FRAME_W * COLS}（${COLS} 列 × ${FRAME_W}），实际 ${width}`)
  }
  const rows = height / FRAME_H
  if (!Number.isInteger(rows)) throw new Error(`图集高度应为 ${FRAME_H} 的整数倍，实际 ${height}`)
  if (rows < 9) throw new Error(`至少要有 9 行动作（idle…review），实际 ${rows} 行`)
  if (mode !== 'RGBA') console.warn(`⚠ 图集不是 RGBA（实际 ${mode}），透明背景可能不干净`)

  const target = join(options.out, `${id}.webp`)
  if (!options.dryRun) mkdirSync(options.out, { recursive: true })

  const budget = options.budgetKb * 1024
  // 不缩放，只调质量：从高到低找一个能塞进预算的档位
  let chosen = null
  if (options.dryRun) {
    chosen = { quality: 'dry-run', bytes: statSync(source).size }
  } else {
    const tmp = mkdtempSync(join(tmpdir(), 'dsh-pet-pack-'))
    try {
      for (const quality of [92, 88, 82, 76, 70, 64]) {
        const probe = join(tmp, `q${quality}.webp`)
        const bytes = encode(source, probe, quality)
        if (bytes <= budget) {
          execFileSync('cp', [probe, target])
          chosen = { quality, bytes }
          break
        }
        chosen = { quality, bytes }
      }
      if (chosen.bytes > budget) {
        throw new Error(
          `最高压缩后仍有 ${(chosen.bytes / 1024).toFixed(0)} KB，超过预算 ${options.budgetKb} KB。` +
            `请先裁剪图集或提高 --budget（构建脚本的 ASSET_BUDGET_BYTES 也要同步）`,
        )
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }

  console.log(`✓ ${basename(source)} → ${target}`)
  console.log(`  图集 ${width}×${height}（${COLS} 列 × ${rows} 行，单格 ${FRAME_W}×${FRAME_H}，${mode}）`)
  console.log(
    options.dryRun
      ? '  --dry-run：只校验，没有写文件'
      : `  WebP quality=${chosen.quality}，${(chosen.bytes / 1024).toFixed(0)} KB（预算 ${options.budgetKb} KB）`,
  )
  if (rows >= 11) console.log('  检测到第 9–10 行注视帧：条目里会带 sprite.gaze（16 向注视）')

  console.log('\n把下面这一项加到 client-src/characters.js 的 PET_CHARACTERS 末尾（位图噜噜之前，保持默认形象在前）：\n')
  console.log(`${JSON.stringify(characterEntry({ id, name: options.name, rows }), null, 2)},\n`)
  console.log('然后把新形象写进 README 的「形象」段与设置页测试（形象数量会变）。')
}

main()
