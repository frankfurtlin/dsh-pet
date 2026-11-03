/**
 * dsh-pet — 活体活动状态机（纯函数式，不依赖 cordis / fs / 网络）。
 *
 * 职责：把 DSH host 侧的 `session/event` 流折叠成浏览器端宠物要用的极简快照：
 *
 *   host 事件（tool/call、approval/asked、turn/end …）
 *        ↓  observe()
 *   { sessions, active, usage, lastTurn, notices }
 *        ↓  GET /pet/activity
 *   浏览器轮询 → 状态仲裁 → 动画 / 气泡 / 标题闪烁
 *
 * 这个文件故意不 import 任何东西：单元测试可以在纯 Node 里直接跑，
 * 也不给插件增加任何运行时依赖（host 侧升级面越小越好）。
 */

/**
 * 活动状态优先级（高 → 低）。与浏览器侧 `PET_STATE_PRIORITY` 是两套坐标系：
 * 这里是「DSH 正在发生什么」，那边是「宠物该演什么」，`petDeriveState` 负责换算。
 */
export const PET_LIVE_PRIORITY = {
  approval: 100,
  error: 90,
  tool: 60,
  thinking: 50,
  done: 40,
  idle: 0,
}

/** 认为「这轮失败」的关键字（对齐 whale-girl / whale-on-desk 的判定）。 */
const FAILURE_PATTERN = /(?:error|abort|cancel|interrupt|fail)/i

/** 从事件里抠工具名；不同 DSH 版本字段名不同，都给一遍。 */
function toolNameOf(data) {
  const name = data?.name ?? data?.toolName ?? data?.tool?.name
  if (typeof name !== 'string' || name === '') return null
  return name.slice(0, 64)
}

/** 会话 id：事件第一参数可能是字符串 id，也可能是 session 对象。 */
export function sessionIdOf(session) {
  if (typeof session === 'string') return session
  const id = session?.id ?? session?.sessionId
  return typeof id === 'string' ? id : null
}

/**
 * 创建活动状态机。
 *
 * @param {{
 *   now?: () => number,
 *   maxNotices?: number,
 *   noticeTtlMs?: number,
 *   sessionTtlMs?: number,
 *   maxSessions?: number,
 * }} [options]
 */
export function createLiveState(options = {}) {
  const now = options.now ?? (() => Date.now())
  const maxNotices = options.maxNotices ?? 6
  const noticeTtlMs = options.noticeTtlMs ?? 90 * 1000
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 60 * 1000
  const maxSessions = options.maxSessions ?? 48

  /** @type {Map<string, {id: string, state: string, tool: string|null, tools: number, turn: number, startedAt: number, at: number, usage: object|null}>} */
  const sessions = new Map()
  /** @type {Array<{id: number, text: string, action: string|null, at: number}>} */
  let notices = []
  let noticeSeq = 0
  let seq = 0
  /** @type {null | {sessionId: string, durationMs: number, tools: number, ok: boolean, at: number}} */
  let lastTurn = null

  const touch = (id) => {
    const at = now()
    let session = sessions.get(id)
    if (session === undefined) {
      session = { id, state: 'idle', tool: null, tools: 0, turn: 0, startedAt: 0, at, usage: null }
      sessions.set(id, session)
      prune()
    }
    session.at = at
    return session
  }

  /** 超过 TTL 的会话丢掉，避免长期运行内存单调增长。 */
  const prune = () => {
    const at = now()
    for (const [id, session] of sessions) {
      if (at - session.at > sessionTtlMs) sessions.delete(id)
    }
    if (sessions.size <= maxSessions) return
    const ordered = [...sessions.values()].sort((a, b) => b.at - a.at)
    for (const session of ordered.slice(maxSessions)) sessions.delete(session.id)
  }

  const trimNotices = () => {
    const at = now()
    notices = notices.filter((notice) => at - notice.at <= noticeTtlMs)
    if (notices.length > maxNotices) notices = notices.slice(notices.length - maxNotices)
  }

  /**
   * 折叠一个 host 会话事件。
   *
   * @param {string} sessionId
   * @param {{type?: string, data?: any}} event
   * @returns {string} 该会话折叠后的状态
   */
  const observe = (sessionId, event) => {
    if (sessionId === null || sessionId === undefined) return 'idle'
    seq += 1
    const session = touch(String(sessionId))
    const data = event?.data ?? {}
    switch (event?.type) {
      case 'turn/start':
        session.state = 'thinking'
        session.tool = null
        session.tools = 0
        session.turn = Number.isFinite(data.turn) ? data.turn : session.turn + 1
        session.startedAt = now()
        break
      case 'assistant/attempt':
      case 'assistant/message':
        if (session.state !== 'approval') session.state = 'thinking'
        session.tool = null
        break
      case 'tool/call':
        session.state = 'tool'
        session.tool = toolNameOf(data)
        session.tools += 1
        break
      case 'tool/result':
        if (session.state !== 'approval') session.state = 'thinking'
        session.tool = null
        break
      case 'approval/asked':
        session.state = 'approval'
        break
      case 'approval/decided':
        session.state = 'thinking'
        break
      case 'turn/end': {
        const durationMs = session.startedAt > 0 ? Math.max(0, now() - session.startedAt) : 0
        const ok = !FAILURE_PATTERN.test(JSON.stringify(data.reason ?? data ?? ''))
        session.state = ok ? 'done' : 'error'
        session.tool = null
        session.startedAt = 0
        lastTurn = { sessionId: session.id, durationMs, tools: session.tools, ok, at: now() }
        break
      }
      default:
        break
    }
    return session.state
  }

  /**
   * 记录一次上下文压力（host 从 sessionProjections 的 contextPressure 投影取）。
   *
   * @param {string} sessionId
   * @param {{pressureTokens?: number, contextWindow?: number}} usage
   */
  const setUsage = (sessionId, usage) => {
    if (typeof sessionId !== 'string') return null
    const pressureTokens = Number(usage?.pressureTokens)
    const contextWindow = Number(usage?.contextWindow)
    if (!Number.isFinite(pressureTokens) || pressureTokens < 0) return null
    const session = touch(sessionId)
    const percent = Number.isFinite(contextWindow) && contextWindow > 0
      ? Math.round((pressureTokens / contextWindow) * 1000) / 10
      : null
    session.usage = {
      sessionId,
      pressureTokens,
      ...Number.isFinite(contextWindow) && contextWindow > 0 ? { contextWindow } : {},
      ...percent === null ? {} : { percent },
      at: now(),
    }
    return session.usage
  }

  /**
   * 往宠物嘴里塞一句话（`pet_say` 工具、host 侧主动提醒都走这里）。
   *
   * @param {string} text
   * @param {{action?: string|null}} [meta]
   */
  const pushNotice = (text, meta = {}) => {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (clean === '') return null
    noticeSeq += 1
    const notice = { id: noticeSeq, text: clean, action: typeof meta.action === 'string' ? meta.action : null, at: now() }
    notices.push(notice)
    trimNotices()
    return notice
  }

  /** 当前最该被看见的会话（审批 > 出错 > 工具 > 思考 > 完成）。 */
  const activeOf = () => {
    let best = null
    for (const session of sessions.values()) {
      const priority = PET_LIVE_PRIORITY[session.state] ?? 0
      if (priority === 0) continue
      if (best === null || priority > best.priority || (priority === best.priority && session.at > best.session.at)) {
        best = { priority, session }
      }
    }
    return best?.session ?? null
  }

  /** 最近一次「正在用工具」的会话（工具名给气泡/标题用）。 */
  const toolStateOf = () => {
    for (const session of [...sessions.values()].sort((a, b) => b.at - a.at)) {
      if (session.state === 'tool' && session.tool !== null) return session
    }
    return null
  }

  /**
   * 给浏览器端的快照。
   *
   * @param {{after?: number}} [query] after = 客户端已收到的最大 notice id
   */
  const snapshot = (query = {}) => {
    prune()
    trimNotices()
    const after = Number(query.after)
    const active = activeOf()
    const tool = toolStateOf()
    const newestUsage = [...sessions.values()]
      .filter((session) => session.usage !== null)
      .sort((a, b) => b.usage.at - a.usage.at)[0]
    return {
      seq,
      now: now(),
      sessions: [...sessions.values()]
        .sort((a, b) => b.at - a.at)
        .slice(0, 12)
        .map((session) => ({
          id: session.id,
          state: session.state,
          tool: session.tool,
          tools: session.tools,
          turn: session.turn,
          at: session.at,
        })),
      active: active === null
        ? null
        : { sessionId: active.id, state: active.state, tool: active.tool, tools: active.tools },
      tool: tool === null
        ? null
        : { sessionId: tool.id, name: tool.tool, count: tool.tools, at: tool.at },
      usage: newestUsage?.usage === undefined ? null : { ...newestUsage.usage },
      lastTurn: lastTurn === null ? null : { ...lastTurn },
      notices: notices
        .filter((notice) => !Number.isFinite(after) || notice.id > after)
        .map((notice) => ({ ...notice })),
    }
  }

  return { observe, setUsage, pushNotice, snapshot, sessions, size: () => sessions.size }
}
