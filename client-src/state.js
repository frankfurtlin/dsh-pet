/**
 * 状态推导：把 DSH 的会话状态翻译成宠物状态。
 *
 * 数据来源只有一处 —— `ctx.uiSession.sessionStatus`（DSH 官方
 * dsh-client-ui-session 暴露的只读快照，条目形如
 * `{ sessionId, running, pendingInteraction, completionUnread }`）。
 * 它把「运行中 / 有待审批 / 有未读完成」三件事都算好了，我们不去猜内核事件、
 * 也不订阅会话内容流：只读投影的好处是上游换实现时这里几乎不用改。
 *
 * 优先级（高 → 低）：alert > thinking > celebrate > focus > sleep > idle
 * 理由：待审批会卡住用户，必须最显眼；运行中次之；完成提示再次之。
 */

/** 从 cordis ctx 上取某个服务；取不到返回 undefined（版本差异时降级而不是抛错）。 */
function petProbe(ctx, name) {
  try {
    return ctx?.[name]
  } catch {
    return undefined
  }
}

/**
 * 会话状态的可订阅适配器。
 *
 * uiSession 服务可能比插件晚就绪（客户端模块按依赖懒加载），所以除了转发它的
 * subscribe，还每 250ms 复查一次服务实例是否换了，换掉就重挂监听。
 * 这与 codex-pet 的处理一致，是被验证过能在 DSH 启动顺序下稳定工作的写法。
 */
function petSessionStatus(ctx) {
  const resolve = () => petProbe(ctx, 'uiSession')?.sessionStatus
  return {
    getSnapshot() {
      try {
        return resolve()?.getSnapshot() ?? new Map()
      } catch {
        return new Map()
      }
    },
    subscribe(listener) {
      let source = resolve()
      let off = source?.subscribe(listener)
      const timer = setInterval(() => {
        const next = resolve()
        if (next === source) return
        off?.()
        source = next
        off = next?.subscribe(listener)
        try {
          listener()
        } catch (error) {
          console.warn('[dsh-pet] status listener failed', error)
        }
      }, 250)
      return () => {
        clearInterval(timer)
        off?.()
      }
    },
  }
}

/** 会话目录（用于「最近一个会话」兜底，以及点气泡跳转）。 */
function petSessionList(ctx) {
  return petProbe(ctx, 'sessions')?.list
}

/** 打开某个会话；拿不到导航 API 时返回 false，由调用方提示而不是静默失败。 */
function petOpenSession(ctx, sessionId) {
  if (!sessionId) return false
  try {
    const workspace = petProbe(ctx, 'uiWorkspace')
    if (workspace?.openSession) {
      workspace.openSession(sessionId)
      return true
    }
    const sessions = petProbe(ctx, 'sessions')
    if (sessions?.open) {
      sessions.open(sessionId)
      return true
    }
  } catch (error) {
    console.warn('[dsh-pet] openSession failed', error)
  }
  return false
}

/**
 * 遍历状态快照，汇总成宠物需要的事实。
 *
 * @returns {{
 *   running: number, pending: number, unread: number,
 *   target: string | null, targetKind: 'pending' | 'unread' | 'running' | null,
 *   sessions: Array<{id: string, running: boolean, pendingInteraction: boolean, completionUnread: boolean}>
 * }}
 */
function petReadStatus(status) {
  const snapshot = status.getSnapshot()
  const rows = []
  // 用鸭子类型判断 Map 而不是 instanceof：跨 realm（iframe / 单元测试的 vm）
  // 时 instanceof Map 会假，快照就读成空的了。entries() 有就是 Map 语义。
  const entries =
    snapshot && typeof snapshot.entries === 'function' ? snapshot.entries() : Object.entries(snapshot ?? {})
  for (const [id, value] of entries) {
    if (!value || typeof value !== 'object') continue
    const row = {
      id: value.sessionId ?? id,
      running: value.running === true,
      pendingInteraction: value.pendingInteraction === true,
      completionUnread: value.completionUnread === true,
    }
    rows.push(row)
  }
  const pendingRows = rows.filter((row) => row.pendingInteraction)
  const unreadRows = rows.filter((row) => row.completionUnread)
  const runningRows = rows.filter((row) => row.running)
  const targetRow = pendingRows[0] ?? unreadRows[0] ?? runningRows[0] ?? null
  return {
    running: runningRows.length,
    pending: pendingRows.length,
    unread: unreadRows.length,
    target: targetRow?.id ?? null,
    targetKind: pendingRows[0] ? 'pending' : unreadRows[0] ? 'unread' : runningRows[0] ? 'running' : null,
    sessions: rows,
  }
}

/**
 * 宠物状态的优先级表（数值越大越优先）。
 *
 * 参考 whale-on-desk 的 `STATE_PRIORITY` + `snapshot = forced ?? transient ?? durable`：
 * 把「谁盖住谁」写成一张显式的表，而不是散在 if 顺序里 —— 加新状态时只改表，
 * 不必重新推导一遍所有分支的先后。
 *
 * 数值约定：审批会卡住用户，必须最高；出错/完成这类一次性事件次之；
 * 「在跑」是持续态；专注/睡觉是用户主动进入的低优先态。
 */
const PET_STATE_PRIORITY = {
  alert: 100,
  // 「在跑」高于「有未读完成」：手上正干着的活比"刚才干完了"更该被看见，
  // 否则一个未读徽标就能把正在跑的任务藏起来（celebrate 的即时反馈另有
  // 短暂的 react('celebrate') 负责，不靠这个常驻状态）。
  thinking: 60,
  celebrate: 55,
  focus: 45,
  sleep: 30,
  idle: 0,
}

/**
 * 在候选状态里挑一个最该演的。
 *
 * 同优先级时取**先出现的**：调用方按「外部强制事件 → 会话事实 → 用户主动态」顺序给候选，
 * 这样 host 侧更精确的判断优先于本地粗粒度判断。
 *
 * @param {string[]} candidates
 * @returns {string}
 */
function petArbitrate(candidates) {
  let best = 'idle'
  let bestRank = -1
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const rank = PET_STATE_PRIORITY[candidate] ?? -1
    if (rank > bestRank) {
      best = candidate
      bestRank = rank
    }
  }
  return best
}

/**
 * host 活动流里的状态 → 宠物状态。
 *
 * host 侧（`/pet/activity`）比浏览器侧的 sessionStatus 精确：它知道「正在用哪个工具」，
 * 也能把一轮的成败区分开。这里只做语义映射，拿不到就返回 null 表示「这条不参与仲裁」。
 *
 * @param {{state?: string}|null|undefined} active
 * @returns {'alert'|'thinking'|'celebrate'|null}
 */
function petHostStateToPet(active) {
  const state = active?.state
  if (typeof state !== 'string') return null
  if (state === 'approval') return 'alert'
  if (state === 'error') return 'alert'
  if (state === 'tool' || state === 'thinking') return 'thinking'
  if (state === 'done') return 'celebrate'
  return null
}

/**
 * 推导基础状态。
 *
 * @param {{facts: ReturnType<typeof petReadStatus>, sleeping: boolean, focus: boolean,
 *          live?: {active?: {state?: string}|null}|null}} input
 * @returns {'idle'|'thinking'|'alert'|'celebrate'|'focus'|'sleep'}
 */
function petDeriveState({ facts, sleeping, focus, live }) {
  const candidates = []
  if (facts.pending > 0) candidates.push('alert')
  const host = petHostStateToPet(live?.active)
  if (host !== null) candidates.push(host)
  if (facts.running > 0) candidates.push('thinking')
  if (facts.unread > 0) candidates.push('celebrate')
  if (focus) candidates.push('focus')
  if (sleeping) candidates.push('sleep')
  candidates.push('idle')
  return petArbitrate(candidates)
}

/**
 * 比较前后两次事实，决定要不要弹提醒气泡。
 *
 * 只对「新发生的事」提醒：任务开始、任务完成（未读数增加）、出现待审批。
 * 数量减少（用户处理完了）不提醒，避免打扰。
 *
 * @returns {'started'|'completed'|'pending'|null}
 */
function petDetectEvent(previous, next) {
  if (!previous) return null
  if (next.pending > previous.pending) return 'pending'
  if (next.unread > previous.unread) return 'completed'
  if (next.running > previous.running && next.pending === 0) return 'started'
  return null
}
