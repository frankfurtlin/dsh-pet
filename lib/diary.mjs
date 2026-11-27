/**
 * dsh-pet — 陪伴日记（纯 Node ESM，无第三方依赖）。
 *
 * 宠物每天记一笔「今天陪了主人多久、干了什么」：
 *
 *   host 事件 → applyDiaryEvent() → diary 对象 → writeDiary()
 *   浏览器 / 设置页 ← diaryLines() ← readDiary()
 *
 * 设计约束：
 *   · applyDiaryEvent 是纯函数，返回新对象，不修改入参（方便 host 直接塞进快照）；
 *   · 落盘按天一个文件 root/YYYY-MM-DD.json，写 .tmp 再 rename，断电不会留半截 JSON；
 *   · 读文件永远不抛：缺失 / 损坏 / 手改坏了都回落到 emptyDiary()。
 */

import fs from 'node:fs'
import path from 'node:path'

/** 文件名 / 日期参数只接受 YYYY-MM-DD（同时防路径穿越）。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
/** 工具名只留可读长度，避免异常输入把 JSON 撑大。 */
const MAX_TOOL_NAME = 64
/** 会污染原型链的键，工具名 / 会话 id 都绕开。 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** 两位补零。 */
function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * 本地时区的日期键（不要在日记里用 toISOString：东八区凌晨会记到前一天）。
 *
 * @param {number} [now]
 * @returns {string} YYYY-MM-DD
 */
export function diaryDate(now = Date.now()) {
  const stamp = Number.isFinite(now) ? now : Date.now()
  const date = new Date(stamp)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 空日记模板（每次调用都是新对象，tools / sessions 不共享引用）。 */
export function emptyDiary(date) {
  return {
    date,
    turns: 0,
    failed: 0,
    toolCalls: 0,
    tools: {},
    sessions: {},
    activeMs: 0,
    firstAt: null,
    lastAt: null,
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 非负数字，其余一律 0。 */
function countOf(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** 时间戳：非负有限数，否则 null。 */
function stampOf(value) {
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** 读盘后的形状归一：坏字段丢弃，好字段保留，日期以文件名为准。 */
function normalizeDiary(raw, date) {
  const diary = emptyDiary(date)
  if (!isPlainObject(raw)) return diary

  diary.turns = countOf(raw.turns)
  diary.failed = countOf(raw.failed)
  diary.toolCalls = countOf(raw.toolCalls)
  diary.activeMs = countOf(raw.activeMs)
  diary.firstAt = stampOf(raw.firstAt)
  diary.lastAt = stampOf(raw.lastAt)

  if (isPlainObject(raw.tools)) {
    for (const [name, count] of Object.entries(raw.tools)) {
      if (UNSAFE_KEYS.has(name)) continue
      const value = countOf(count)
      if (value > 0) diary.tools[name] = value
    }
  }

  if (isPlainObject(raw.sessions)) {
    for (const [id, session] of Object.entries(raw.sessions)) {
      if (UNSAFE_KEYS.has(id) || !isPlainObject(session)) continue
      diary.sessions[id] = {
        count: countOf(session.count),
        lastAt: stampOf(session.lastAt),
      }
    }
  }

  return diary
}

/** 工具名：缺省 / 空白记 'unknown'，最长 64 字符。 */
function toolNameOf(tool) {
  if (typeof tool !== 'string') return 'unknown'
  const name = tool.trim()
  if (name === '') return 'unknown'
  return name.slice(0, MAX_TOOL_NAME)
}

/**
 * 把一条事件折叠进日记，返回新对象（入参不变）。
 *
 * 计数约定：
 *   · 'turn/start' 只更新会话活跃时间，不增加 turns（避免一轮记两次）；
 *   · 'turn/end'   → turns + 1，ok === false 时 failed + 1，durationMs > 0 时累加 activeMs；
 *   · 'tool/call'  → toolCalls + 1，tools[tool] + 1；
 *   · 所有事件都会更新 sessions[sessionId] 与 firstAt / lastAt；
 *   · at 为 NaN / 负数的事件整条忽略（不猜时间）。
 *
 * @param {object} diary
 * @param {{type?: string, sessionId?: string, tool?: string, durationMs?: number, ok?: boolean, at?: number}} input
 * @returns {object}
 */
export function applyDiaryEvent(diary, input) {
  const date = typeof diary?.date === 'string' ? diary.date : diaryDate()
  const next = normalizeDiary(diary, date)

  if (!isPlainObject(input)) return next
  const type = input.type
  if (type !== 'turn/start' && type !== 'turn/end' && type !== 'tool/call') return next

  let at = null
  if (input.at !== undefined && input.at !== null) {
    const stamp = Number(input.at)
    if (!Number.isFinite(stamp) || stamp < 0) return next // 时间戳坏掉：整条丢弃
    at = stamp
  }

  if (type === 'turn/end') {
    next.turns += 1
    if (input.ok === false) next.failed += 1
    const duration = Number(input.durationMs)
    if (Number.isFinite(duration) && duration > 0) next.activeMs += duration
  } else if (type === 'tool/call') {
    next.toolCalls += 1
    const tool = toolNameOf(input.tool)
    if (!UNSAFE_KEYS.has(tool)) next.tools[tool] = (next.tools[tool] ?? 0) + 1
  }

  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : ''
  if (sessionId !== '' && !UNSAFE_KEYS.has(sessionId)) {
    const prev = next.sessions[sessionId]
    const lastAt = at === null ? (prev?.lastAt ?? null) : Math.max(prev?.lastAt ?? at, at)
    next.sessions[sessionId] = {
      count: (prev?.count ?? 0) + 1,
      lastAt,
    }
  }

  if (at !== null) {
    next.firstAt = next.firstAt === null ? at : Math.min(next.firstAt, at)
    next.lastAt = next.lastAt === null ? at : Math.max(next.lastAt, at)
  }

  return next
}

/**
 * 读某一天的日记；缺失 / 损坏 / 日期非法都返回空日记，不抛。
 *
 * @param {string} root 如 ~/.dsh/pet-diary
 * @param {string} date YYYY-MM-DD
 * @returns {object}
 */
export function readDiary(root, date) {
  const day = typeof date === 'string' ? date : ''
  if (!DATE_PATTERN.test(day) || typeof root !== 'string' || root === '') {
    return emptyDiary(day)
  }

  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, `${day}.json`), 'utf8'))
    return normalizeDiary(raw, day)
  } catch {
    return emptyDiary(day)
  }
}

/**
 * 原子写某一天的日记（mkdir -p + .tmp → rename）。
 *
 * @param {string} root
 * @param {object} diary
 * @returns {void}
 */
export function writeDiary(root, diary) {
  if (typeof root !== 'string' || root === '') return

  const day = typeof diary?.date === 'string' && DATE_PATTERN.test(diary.date)
    ? diary.date
    : diaryDate()
  fs.mkdirSync(root, { recursive: true })

  const target = path.join(root, `${day}.json`)
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(diary, null, 2)}\n`)
  fs.renameSync(tmp, target)
}

/**
 * 用得最多的工具：次数降序，同次数按名字升序。
 *
 * @param {object} diary
 * @param {number} [limit]
 * @returns {Array<{name: string, count: number}>}
 */
export function diaryTopTools(diary, limit = 3) {
  const tools = isPlainObject(diary?.tools) ? diary.tools : {}
  const rows = Object.entries(tools)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([name, count]) => ({ name, count }))

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })

  const size = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3
  return size === 0 ? [] : rows.slice(0, size)
}

/** 英文复数。 */
function plural(count, one, many) {
  return count === 1 ? one : many
}

/**
 * 生成 2–4 条人类可读短句；turns=0 时只回一条「还没开工」。
 *
 * @param {object} diary
 * @param {'zh'|string} [lang]
 * @returns {string[]}
 */
export function diaryLines(diary, lang = 'zh') {
  const zh = lang === 'zh'
  const turns = countOf(diary?.turns)
  if (turns === 0) {
    return [zh ? '今天还没开始干活' : 'No work yet today.']
  }

  const failed = countOf(diary?.failed)
  const toolCalls = countOf(diary?.toolCalls)
  const activeMs = countOf(diary?.activeMs)
  const top = diaryTopTools(diary, 1)[0]
  const sessionCount = isPlainObject(diary?.sessions) ? Object.keys(diary.sessions).length : 0
  const minutes = Math.round(activeMs / 60_000)

  const lines = []
  lines.push(zh
    ? `今天陪跑了 ${turns} 轮对话${failed > 0 ? `（其中 ${failed} 轮出错）` : ''}`
    : `Ran ${turns} conversation ${plural(turns, 'turn', 'turns')}${failed > 0 ? ` (${failed} failed)` : ''}`)

  if (toolCalls > 0) {
    lines.push(zh
      ? `我帮你调用了 ${toolCalls} 次工具${top ? `，最喜欢 ${top.name}（${top.count} 次）` : ''}`
      : `I made ${toolCalls} tool ${plural(toolCalls, 'call', 'calls')}${top ? `, favorite ${top.name} (${top.count})` : ''}`)
  }

  if (activeMs < 60_000) {
    lines.push(zh ? '活跃时长不到 1 分钟' : 'Active for less than a minute')
  } else {
    lines.push(zh
      ? `活跃时长约 ${minutes} 分钟`
      : `Active for about ${minutes} ${plural(minutes, 'minute', 'minutes')}`)
  }

  if (sessionCount > 0) {
    lines.push(zh
      ? `在 ${sessionCount} 个会话里待过`
      : `Visited ${sessionCount} ${plural(sessionCount, 'session', 'sessions')}`)
  }

  return lines
}
