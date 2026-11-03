/**
 * 活体活动：host `/pet/activity` 的浏览器侧客户端。
 *
 * host 半把 `session/event` 折叠成「正在用哪个工具 / 是否在等审批 / 上下文占用 /
 * 上一轮耗时」；这里轮询它，翻译成宠物能演的东西。轮询间隔 900ms、响应几百字节、
 * 同机回环，成本可以忽略；比 SSE/WebSocket 省一整个连接生命周期管理。
 *
 * 设计约束：
 *   - host 半没起来（插件刚升级还没重启、或 host 侧 API 改名）时**必须静默降级**，
 *     宠物继续按 `uiSession.sessionStatus` 工作，不能报错、不能卡住；
 *   - 所有网络错误都不进控制台刷屏，连续 3 次失败才标记 offline 并退避到 8s。
 */

/** host 活动流路径。 */
const PET_ACTIVITY_PATH = '/pet/activity'
/** 正常轮询间隔。 */
const PET_ACTIVITY_POLL_MS = 900
/** host 侧不可用时的退避间隔（插件没重启时不要每 900ms 打一次 404）。 */
const PET_LIVE_RETRY_MS = 8000
/** 连续失败多少次判定 host 侧不可用。 */
const PET_LIVE_MISS_LIMIT = 3

/**
 * 工具名 → 宠物相位。
 *
 * 顺序即优先级，所以更具体的规则要放前面：`todo_write` 该判「排计划」，
 * 而 `write_file` 该判「改代码」。用正则而不是等值表：DSH 工具名带 mcp__
 * 前缀，插件工具还会换名，写死清单迟早漏。
 */
const PET_TOOL_PHASES = [
  { test: /todo|plan|goal|kanban/i, phase: 'plan', zh: '排计划', en: 'planning' },
  { test: /bash|shell|exec|terminal|command|pty/i, phase: 'run', zh: '跑命令', en: 'running a command' },
  { test: /edit|write|patch|apply|replace|insert|create_file/i, phase: 'edit', zh: '改代码', en: 'editing code' },
  { test: /web_|websearch|fetch|browser|crawl|http_/i, phase: 'web', zh: '上网查', en: 'browsing the web' },
  { test: /grep|glob|read|list|search|inspect|codebase|tree/i, phase: 'read', zh: '翻文件', en: 'reading files' },
  { test: /task|agent|subagent|delegate|workflow|skill/i, phase: 'agent', zh: '派活', en: 'delegating' },
]

/**
 * 工具名 → 相位。
 *
 * @param {string|null|undefined} name
 * @returns {{phase: string, zh: string, en: string}}
 */
function petToolPhase(name) {
  const text = typeof name === 'string' ? name : ''
  for (const rule of PET_TOOL_PHASES) {
    if (rule.test.test(text)) return { phase: rule.phase, zh: rule.zh, en: rule.en }
  }
  return { phase: 'tool', zh: '用工具', en: 'using a tool' }
}

/** 秒级时长：`12.4s` / `960ms`，给气泡用，别写 0.0123 分钟这种。 */
function petFormatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60000) return `${Math.round(value / 100) / 10}s`
  const minutes = Math.floor(value / 60000)
  const seconds = Math.round((value - minutes * 60000) / 1000)
  return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`
}

/**
 * 上下文占用等级。
 *
 * @param {{percent?: number}|null} usage
 * @param {{warn?: number, high?: number}} [thresholds]
 * @returns {'unknown'|'ok'|'warn'|'high'}
 */
function petUsageLevel(usage, thresholds = {}) {
  const percent = Number(usage?.percent)
  if (!Number.isFinite(percent)) return 'unknown'
  const warn = Number.isFinite(thresholds.warn) ? thresholds.warn : 70
  const high = Number.isFinite(thresholds.high) ? thresholds.high : 88
  if (percent >= high) return 'high'
  if (percent >= warn) return 'warn'
  return 'ok'
}

/** 回合汇报文案（成败分开写，成功的才报工具数）。 */
function petTurnText(turn, lang) {
  if (!turn || typeof turn !== 'object') return ''
  const zh = lang !== 'en'
  const duration = petFormatDuration(turn.durationMs)
  const tools = Number.isFinite(turn.tools) ? turn.tools : 0
  if (turn.ok === false) {
    return zh
      ? `这轮卡住了（${duration || '一会'}），要我看看吗？`
      : `That turn got stuck (${duration || 'a moment'}). Want me to take a look?`
  }
  if (tools <= 0) {
    return zh ? `搞定！这轮用了 ${duration}。` : `Done! That took ${duration}.`
  }
  return zh
    ? `搞定！这轮 ${duration}、${tools} 个工具。`
    : `Done! ${duration}, ${tools} tool call${tools > 1 ? 's' : ''}.`
}

/**
 * 创建活动流客户端。
 *
 * @param {{fetch?: typeof fetch, intervalMs?: number, now?: () => number}} [options]
 */
function petCreateLive(options = {}) {
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))
  const pollMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : PET_ACTIVITY_POLL_MS
  const now = options.now ?? (() => Date.now())

  /** 当前快照：online=false 时其余字段为 null/空，调用方按「host 还没起来」处理。 */
  let snapshot = { online: false, active: null, tool: null, usage: null, lastTurn: null, notices: [], at: 0 }
  /** 已消费的 notice id 水位。 */
  let after = 0
  let timer = null
  let inFlight = false
  let misses = 0
  let stopped = true
  const listeners = new Set()

  const emit = () => {
    for (const listener of [...listeners]) {
      try {
        listener(snapshot)
      } catch (error) {
        console.warn('[dsh-pet] live listener failed', error)
      }
    }
  }

  const schedule = () => {
    if (stopped) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(poll, snapshot.online ? pollMs : PET_LIVE_RETRY_MS)
  }

  async function poll() {
    timer = null
    if (stopped || inFlight) return
    inFlight = true
    let next = null
    try {
      const response = await fetchImpl(`${PET_ACTIVITY_PATH}?after=${after}`, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response?.ok) throw new Error(`activity ${response?.status ?? 'failed'}`)
      const body = await response.json()
      const notices = Array.isArray(body?.notices) ? body.notices : []
      for (const notice of notices) {
        const id = Number(notice?.id)
        if (Number.isFinite(id) && id > after) after = id
      }
      next = {
        online: true,
        active: body?.active ?? null,
        tool: body?.tool ?? null,
        usage: body?.usage ?? null,
        lastTurn: body?.lastTurn ?? null,
        notices,
        at: now(),
      }
      misses = 0
    } catch {
      misses += 1
      if (misses >= PET_LIVE_MISS_LIMIT && snapshot.online) {
        next = { ...snapshot, online: false, active: null, tool: null, notices: [], at: now() }
      } else if (misses >= PET_LIVE_MISS_LIMIT && !snapshot.online) {
        next = { ...snapshot, at: now() }
      }
    } finally {
      inFlight = false
    }
    if (next !== null) {
      const changed =
        next.online !== snapshot.online ||
        next.active !== snapshot.active ||
        next.tool !== snapshot.tool ||
        next.usage !== snapshot.usage ||
        next.lastTurn !== snapshot.lastTurn ||
        (next.notices?.length ?? 0) > 0
      snapshot = next
      if (changed) emit()
    }
    schedule()
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      poll()
    },
    stop() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** 测试用：直接喂一份快照。 */
    feed(patch) {
      snapshot = { ...snapshot, ...patch, at: now() }
      emit()
    },
  }
}

/** 标题闪烁器：审批/等待时闪标签页标题，处理完立刻恢复原文。 */
function petCreateTitleFlash() {
  let base = null
  let timer = null
  let flashing = false
  let label = ''

  const stop = () => {
    if (!flashing) return
    flashing = false
    if (timer !== null) clearInterval(timer)
    timer = null
    if (base !== null) document.title = base
    base = null
  }

  return {
    start(text) {
      const next = String(text ?? '')
      if (flashing && next === label) return
      label = next
      if (flashing) return
      flashing = true
      base = document.title
      let flip = false
      timer = setInterval(() => {
        flip = !flip
        document.title = flip ? label : base
      }, 900)
    },
    stop,
    active: () => flashing,
  }
}
