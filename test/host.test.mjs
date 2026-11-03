/**
 * dsh-pet — host 侧纯 Node 模块测试（node --test，无需浏览器）。
 *
 * 覆盖 lib/skins.mjs 与 lib/diary.mjs 的契约边界：
 *   · 图集头解析（PNG / VP8 / VP8L / VP8X）与协议尺寸校验；
 *   · 皮肤落盘 → 列表 → 读回 → 删除的完整往返，以及坏 id / 悬空索引；
 *   · 日记事件的纯函数语义、按天原子读写、Top 工具排序与中英文文案。
 *
 * 只使用 os.tmpdir() 下的临时目录，不碰仓库里任何真实数据。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  MAX_SKIN_BYTES,
  SPRITE_CELL,
  SkinError,
  detectSpriteSheet,
  listSkins,
  readSkin,
  removeSkin,
  saveSkin,
} from '../lib/skins.mjs'
import {
  applyDiaryEvent,
  diaryDate,
  diaryLines,
  diaryTopTools,
  emptyDiary,
  readDiary,
  writeDiary,
} from '../lib/diary.mjs'

/** 建一个测试用临时目录，测试结束自动清理。 */
function tempDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** 断言抛出的是指定 code 的 SkinError。 */
function assertSkinCode(fn, code) {
  assert.throws(fn, (error) => error instanceof SkinError && error.code === code)
}

/** 造一个只带合法 IHDR 头的 PNG（尺寸字段之后的内容无所谓）。 */
function pngSheet(width, height, extraBytes = 0) {
  const buffer = Buffer.alloc(33 + extraBytes)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(13, 8) // IHDR 数据长度
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  buffer[24] = 8 // 位深
  buffer[25] = 6 // RGBA
  return buffer
}

/** 造一个 VP8 有损 WebP 头。 */
function webpLossy(width, height) {
  const buffer = Buffer.alloc(30)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8 ', 12, 'ascii')
  buffer.writeUInt32LE(10, 16)
  buffer[23] = 0x9d
  buffer[24] = 0x01
  buffer[25] = 0x2a
  buffer.writeUInt16LE(width & 0x3fff, 26)
  buffer.writeUInt16LE(height & 0x3fff, 28)
  return buffer
}

/** 造一个 VP8L 无损 WebP 头。 */
function webpLossless(width, height) {
  const buffer = Buffer.alloc(30)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8L', 12, 'ascii')
  buffer.writeUInt32LE(10, 16)
  buffer[20] = 0x2f
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)
  buffer.writeUInt32LE(bits >>> 0, 21)
  return buffer
}

/** 造一个 VP8X 扩展 WebP 头（24 位画布宽高）。 */
function webpExtended(width, height) {
  const buffer = Buffer.alloc(30)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8X', 12, 'ascii')
  buffer.writeUInt32LE(10, 16)
  buffer.writeUIntLE(width - 1, 24, 3)
  buffer.writeUIntLE(height - 1, 27, 3)
  return buffer
}

// ---------------------------------------------------------------- skins

test('detectSpriteSheet：9 / 10 / 11 行 PNG 都按协议识别', () => {
  assert.deepEqual(SPRITE_CELL, { width: 192, height: 208 })

  for (const [rows, version] of [[11, 'v2'], [9, 'v1'], [10, 'v1.5']]) {
    const info = detectSpriteSheet(pngSheet(1536, rows * 208))
    assert.deepEqual(info, {
      mime: 'image/png',
      width: 1536,
      height: rows * 208,
      cols: 8,
      rows,
      version,
    })
  }
})

test('detectSpriteSheet：WebP 三种封装都能读尺寸', () => {
  const expected = {
    mime: 'image/webp',
    width: 1536,
    height: 2288,
    cols: 8,
    rows: 11,
    version: 'v2',
  }
  assert.deepEqual(detectSpriteSheet(webpLossy(1536, 2288)), expected)
  assert.deepEqual(detectSpriteSheet(webpLossless(1536, 2288)), expected)
  assert.deepEqual(detectSpriteSheet(webpExtended(1536, 2288)), expected)
})

test('detectSpriteSheet：非法尺寸 / 非图集 / 超长 buffer 的错误边界', () => {
  // 单格整数倍但行数不够（1000 / 208 不是整数）
  assertSkinCode(() => detectSpriteSheet(pngSheet(1536, 1000)), 'BAD_DIMENSIONS')
  // 行数合法但不是 8 列
  assertSkinCode(() => detectSpriteSheet(pngSheet(1920, 2288)), 'BAD_DIMENSIONS')
  // 12 行超出协议
  assertSkinCode(() => detectSpriteSheet(pngSheet(1536, 12 * 208)), 'BAD_DIMENSIONS')
  // 垃圾字节 / 空 buffer / VP8 起始码坏掉
  assertSkinCode(() => detectSpriteSheet(Buffer.from('definitely not an image')), 'BAD_MAGIC')
  assertSkinCode(() => detectSpriteSheet(Buffer.alloc(0)), 'BAD_MAGIC')
  assertSkinCode(() => detectSpriteSheet(webpLossy(1536, 2288).fill(0, 23, 26)), 'BAD_MAGIC')

  // 超长 buffer 只读头部，不应该崩，也不应该把尾部当尺寸
  const huge = Buffer.concat([pngSheet(1536, 2288), Buffer.alloc(4 * 1024 * 1024, 0xab)])
  const info = detectSpriteSheet(huge)
  assert.equal(info.width, 1536)
  assert.equal(info.rows, 11)
})

test('skins：saveSkin → listSkins → readSkin 往返', (t) => {
  const root = tempDir(t, 'pet-skins-')
  const data = pngSheet(1536, 2288)

  const meta = saveSkin(root, { data, label: '  我的皮肤  ', now: 1_730_000_000_000 })
  assert.match(meta.id, /^skin-[0-9a-f]{8}$/)
  assert.equal(meta.label, '我的皮肤')
  assert.equal(meta.mime, 'image/png')
  assert.equal(meta.rows, 11)
  assert.equal(meta.version, 'v2')
  assert.equal(meta.bytes, data.length)
  assert.equal(meta.createdAt, 1_730_000_000_000)
  assert.equal(existsSync(join(root, `${meta.id}.png`)), true)
  assert.equal(existsSync(join(root, 'index.json.tmp')), false)

  const list = listSkins(root)
  assert.equal(list.length, 1)
  assert.deepEqual(list[0], meta)

  const read = readSkin(root, meta.id)
  assert.equal(read.mime, 'image/png')
  assert.deepEqual(read.data, data)

  // label 缺省 → 自定义；index 丢了也能按扩展名把文件读回来
  const plain = saveSkin(root, { data: webpLossless(1536, 1872), now: 1 })
  assert.equal(plain.label, '自定义')
  assert.equal(plain.mime, 'image/webp')
  rmSync(join(root, 'index.json'))
  assert.equal(readSkin(root, plain.id).mime, 'image/webp')
})

test('skins：重复保存得到不同 id，removeSkin 同时删文件与索引', (t) => {
  const root = tempDir(t, 'pet-skins-')
  const data = pngSheet(1536, 2288)

  const first = saveSkin(root, { data, label: '一号', now: 1_000 })
  const second = saveSkin(root, { data, label: '二号', now: 2_000 })
  assert.notEqual(first.id, second.id)
  assert.deepEqual(listSkins(root).map((skin) => skin.id), [second.id, first.id])

  assert.equal(removeSkin(root, second.id), true)
  assert.equal(existsSync(join(root, `${second.id}.png`)), false)
  assert.deepEqual(listSkins(root).map((skin) => skin.id), [first.id])
  assert.equal(removeSkin(root, second.id), false)
})

test('skins：坏 id / 不存在 / 悬空索引', (t) => {
  const root = tempDir(t, 'pet-skins-')
  const meta = saveSkin(root, { data: pngSheet(1536, 2288), now: 10 })

  assertSkinCode(() => readSkin(root, '../etc/passwd'), 'BAD_ID')
  assertSkinCode(() => readSkin(root, 'skin-ZZZZZZZZ'), 'BAD_ID')
  assertSkinCode(() => removeSkin(root, 'not-a-skin'), 'BAD_ID')
  assertSkinCode(() => readSkin(root, 'skin-deadbeef'), 'NOT_FOUND')

  // 手改 index 塞一个没有文件的条目：list 必须忽略，但不能影响真条目
  const indexPath = join(root, 'index.json')
  const index = JSON.parse(readFileSync(indexPath, 'utf8'))
  index.skins.push({
    id: 'skin-deadbeef',
    label: '幽灵',
    mime: 'image/png',
    width: 1536,
    height: 2288,
    cols: 8,
    rows: 11,
    version: 'v2',
    bytes: 1234,
    createdAt: 5,
  })
  writeFileSync(indexPath, JSON.stringify(index))

  assert.deepEqual(listSkins(root).map((skin) => skin.id), [meta.id])
  assertSkinCode(() => readSkin(root, 'skin-deadbeef'), 'NOT_FOUND')
})

test('skins：saveSkin 拒绝坏类型 / 超限 / 坏尺寸 / 垃圾内容', (t) => {
  const root = tempDir(t, 'pet-skins-')

  assertSkinCode(() => saveSkin(root, { data: 'not a buffer' }), 'BAD_TYPE')
  assertSkinCode(() => saveSkin(root, {}), 'BAD_TYPE')
  assertSkinCode(() => saveSkin(root, { data: Buffer.alloc(MAX_SKIN_BYTES + 1) }), 'TOO_LARGE')
  assertSkinCode(() => saveSkin(root, { data: pngSheet(1536, 1000) }), 'BAD_DIMENSIONS')
  assertSkinCode(() => saveSkin(root, { data: Buffer.from('garbage') }), 'BAD_MAGIC')

  assert.deepEqual(listSkins(root), [])
})

// ---------------------------------------------------------------- diary

test('diaryDate：按本地时区取日期，不落到 UTC 前一天', () => {
  const localLate = new Date(2026, 10, 2, 0, 30)
  assert.equal(diaryDate(localLate.getTime()), '2026-11-02')
  assert.equal(diaryDate(new Date(2026, 0, 9, 23, 59).getTime()), '2026-01-09')
})

test('emptyDiary：字段齐全且彼此不共享引用', () => {
  assert.deepEqual(emptyDiary('2026-11-02'), {
    date: '2026-11-02',
    turns: 0,
    failed: 0,
    toolCalls: 0,
    tools: {},
    sessions: {},
    activeMs: 0,
    firstAt: null,
    lastAt: null,
  })

  const left = emptyDiary('2026-11-02')
  const right = emptyDiary('2026-11-02')
  left.tools.bash = 1
  left.sessions.a = { count: 1, lastAt: 1 }
  assert.deepEqual(right.tools, {})
  assert.deepEqual(right.sessions, {})
})

test('applyDiaryEvent：纯函数，turn/end 计数、失败与活跃时长累加', () => {
  const start = emptyDiary('2026-11-02')
  const snapshot = structuredClone(start)

  const one = applyDiaryEvent(start, {
    type: 'turn/end',
    sessionId: 's1',
    durationMs: 60_000,
    ok: true,
    at: 1_000,
  })
  assert.deepEqual(start, snapshot) // 入参纹丝不动
  assert.notEqual(one, start)
  assert.equal(one.turns, 1)
  assert.equal(one.failed, 0)
  assert.equal(one.activeMs, 60_000)
  assert.equal(one.firstAt, 1_000)
  assert.equal(one.lastAt, 1_000)
  assert.deepEqual(one.sessions.s1, { count: 1, lastAt: 1_000 })

  const two = applyDiaryEvent(one, {
    type: 'turn/end',
    sessionId: 's1',
    durationMs: 30_000,
    ok: false,
    at: 2_000,
  })
  assert.equal(two.turns, 2)
  assert.equal(two.failed, 1)
  assert.equal(two.activeMs, 90_000)
  assert.deepEqual(two.sessions.s1, { count: 2, lastAt: 2_000 })
  assert.equal(one.turns, 1) // 上一步的返回值也没被改

  // turn/start 只活跃会话，不重复计 turn；乱序时间戳按 min / max 收敛
  const three = applyDiaryEvent(two, { type: 'turn/start', sessionId: 's2', at: 500 })
  assert.equal(three.turns, 2)
  assert.equal(three.firstAt, 500)
  assert.equal(three.lastAt, 2_000)
  assert.deepEqual(three.sessions.s2, { count: 1, lastAt: 500 })
})

test('applyDiaryEvent：NaN / 负数时间戳整条忽略，坏字段不污染日记', () => {
  const base = applyDiaryEvent(emptyDiary('2026-11-02'), {
    type: 'turn/end',
    sessionId: 's1',
    durationMs: 1_000,
    at: 1_000,
  })

  const nan = applyDiaryEvent(base, { type: 'turn/end', sessionId: 's1', at: Number.NaN })
  assert.deepEqual(nan, base)
  const negative = applyDiaryEvent(base, { type: 'tool/call', tool: 'bash', at: -5 })
  assert.deepEqual(negative, base)
  const unknown = applyDiaryEvent(base, { type: 'something/else', at: 2_000 })
  assert.deepEqual(unknown, base)
})

test('applyDiaryEvent：tool/call 计数、缺省名与 top tools 排序', () => {
  let diary = emptyDiary('2026-11-02')
  for (const tool of ['read', 'bash', 'bash', 'read', 'edit']) {
    diary = applyDiaryEvent(diary, {
      type: 'tool/call',
      sessionId: 's1',
      tool,
      at: 1_000,
    })
  }
  assert.equal(diary.toolCalls, 5)
  assert.deepEqual(diary.tools, { read: 2, bash: 2, edit: 1 })
  // 次数降序，同次数按名字升序
  assert.deepEqual(diaryTopTools(diary), [
    { name: 'bash', count: 2 },
    { name: 'read', count: 2 },
    { name: 'edit', count: 1 },
  ])
  assert.deepEqual(diaryTopTools(diary, 2), [
    { name: 'bash', count: 2 },
    { name: 'read', count: 2 },
  ])
  assert.deepEqual(diaryTopTools(diary, 0), [])
  assert.deepEqual(diaryTopTools(emptyDiary('2026-11-02')), [])

  const unnamed = applyDiaryEvent(emptyDiary('2026-11-02'), {
    type: 'tool/call',
    sessionId: 's1',
    at: 10,
  })
  assert.deepEqual(unnamed.tools, { unknown: 1 })
})

test('writeDiary → readDiary：按天原子往返', (t) => {
  const root = tempDir(t, 'pet-diary-')
  let diary = emptyDiary('2026-11-02')
  diary = applyDiaryEvent(diary, {
    type: 'turn/end',
    sessionId: 's1',
    durationMs: 120_000,
    ok: false,
    at: 1_000,
  })
  diary = applyDiaryEvent(diary, { type: 'tool/call', sessionId: 's1', tool: 'bash', at: 1_100 })

  writeDiary(root, diary)
  assert.equal(existsSync(join(root, '2026-11-02.json')), true)
  assert.equal(existsSync(join(root, '2026-11-02.json.tmp')), false)
  assert.deepEqual(readDiary(root, '2026-11-02'), diary)
})

test('readDiary：缺失 / 损坏 / 非 JSON / 非法日期都回落到空日记', (t) => {
  const root = tempDir(t, 'pet-diary-')

  assert.deepEqual(readDiary(root, '2026-11-03'), emptyDiary('2026-11-03'))

  writeFileSync(join(root, '2026-11-04.json'), '{ 坏掉的 json')
  assert.deepEqual(readDiary(root, '2026-11-04'), emptyDiary('2026-11-04'))

  writeFileSync(join(root, '2026-11-05.json'), 'null')
  assert.deepEqual(readDiary(root, '2026-11-05'), emptyDiary('2026-11-05'))

  // 路径不能穿出 root
  assert.deepEqual(readDiary(root, '../../etc/passwd'), emptyDiary('../../etc/passwd'))
})

test('diaryLines：中文四句话覆盖轮次 / 工具 / 时长 / 会话', () => {
  const diary = {
    ...emptyDiary('2026-11-02'),
    turns: 12,
    failed: 1,
    toolCalls: 34,
    tools: { bash: 18, read: 9, edit: 7 },
    sessions: {
      a: { count: 5, lastAt: 3 },
      b: { count: 4, lastAt: 2 },
      c: { count: 3, lastAt: 1 },
    },
    activeMs: 26 * 60_000,
  }

  const zh = diaryLines(diary)
  assert.equal(zh.length, 4)
  assert.equal(zh[0], '今天陪跑了 12 轮对话（其中 1 轮出错）')
  assert.equal(zh[1], '我帮你调用了 34 次工具，最喜欢 bash（18 次）')
  assert.equal(zh[2], '活跃时长约 26 分钟')
  assert.equal(zh[3], '在 3 个会话里待过')

  const en = diaryLines(diary, 'en')
  assert.equal(en.length, 4)
  assert.equal(en[0], 'Ran 12 conversation turns (1 failed)')
  assert.match(en[1], /34 tool calls/)
  assert.match(en[1], /favorite bash \(18\)/)
  assert.match(en[2], /about 26 minutes/)
  assert.match(en[3], /3 sessions/)
})

test('diaryLines：turns=0 只有一句，活跃不足一分钟有专门说法', () => {
  assert.deepEqual(diaryLines(emptyDiary('2026-11-02')), ['今天还没开始干活'])
  assert.deepEqual(diaryLines(emptyDiary('2026-11-02'), 'en'), ['No work yet today.'])

  const quick = { ...emptyDiary('2026-11-02'), turns: 1, activeMs: 30_000 }
  const zh = diaryLines(quick)
  assert.equal(zh.length, 2) // 有轮次 + 时长，至少两句
  assert.equal(zh[1], '活跃时长不到 1 分钟')

  const en = diaryLines(quick, 'en')
  assert.equal(en.length, 2)
  assert.equal(en[1], 'Active for less than a minute')
})
