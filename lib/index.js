/**
 * dsh-pet — Host 半。
 *
 * 宠物本体 100% 在浏览器侧（`client.js`）：形象、动画、状态机、养成、番茄钟。
 * host 半只做「浏览器看不到、或必须由 host 裁决」的几件事：
 *
 *   1. 让 DSH 把本包挂进 web 组合（`package.json` 的 `dsh.bundle.patch`）；
 *   2. 暴露浏览器 bundle（`dsh.client.platform: "web"` + exports `./client`）；
 *   3. `/pet/activity`：把 `session/event` 折叠成「正在用哪个工具 / 是否等审批 /
 *      上一轮耗时 / 上下文占用」，浏览器每 ~800ms 轮询一次（同机回环，成本可忽略）；
 *   4. `pet_say` 工具：让 Agent 主动往宠物嘴里塞一句话（反向通道）；
 *   5. `/pet/skins`：图集导入（Codex pet 协议 8×N，单格 192×208）落盘与回读；
 *   6. `/pet/diary`：每日日记（轮数 / 工具次数 / 活跃时长）；
 *   7. 仍然保留 `/pet/status` 只读自检，`curl` 一下就知道挂没挂上。
 *
 * 升级面控制：只依赖 `ctx.webServer` / `ctx.on('session/event')` / `ctx.get('tools')`
 * 三个官方稳定面，全部包在 try/catch 里 —— 任何一项在新版 DSH 里改名，最坏结果
 * 是「对应功能降级」，而不是整个 web 崩掉。
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createLiveState, sessionIdOf } from './live.mjs'
import { listSkins, readSkin, removeSkin, saveSkin, SkinError } from './skins.mjs'
import { applyDiaryEvent, diaryDate, diaryLines, readDiary, writeDiary } from './diary.mjs'

/** Cordis 插件名；必须与 package.json `name` / cordis.patch.yml `id` 一致。 */
export const name = 'dsh-pet'

/**
 * 必需服务：路由要挂到 host 的 webServer 上。
 *
 * 注意：`webServer` 是**必需**依赖，写不进 `ctx.inject()` 的可选列表里，
 * 必须在这里声明；一旦漏了，Cordis 会抛 `cannot get property "webServer"
 * without inject`，整个插件连加载都失败（2026-11-02 两次重启都是这么翻车的）。
 */
export const inject = ['webServer']

/** 自检路由。 */
export const STATUS_PATH = '/pet/status'
/** 活动流路由（浏览器轮询）。 */
export const ACTIVITY_PATH = '/pet/activity'
/** 图集导入路由。 */
export const SKINS_PATH = '/pet/skins'
/** 每日日记路由。 */
export const DIARY_PATH = '/pet/diary'
/** 反向通道工具名。 */
export const SAY_TOOL = 'pet_say'

/** 一次上传请求体上限（图集 ≤3MB）。 */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** 写日记的节流：最多每 3 秒落一次盘。 */
const DIARY_WRITE_MS = 3000
/** 读上下文压力的节流。 */
const USAGE_POLL_MS = 4000
/** 浏览器一次最多拉多少条一句话。 */
const MAX_NOTICES = 6

function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv
  return join(homedir(), '.dsh')
}

const skinsDir = () => process.env.DSH_PET_SKINS_DIR ?? join(dshHome(), 'pet-skins')
const diaryDir = () => process.env.DSH_PET_DIARY_DIR ?? join(dshHome(), 'pet-diary')

function readJsonVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    return pkg.version ?? null
  } catch {
    return null
  }
}

function readClientBytes() {
  try {
    return readFileSync(new URL('../client.js', import.meta.url)).byteLength
  } catch {
    return null
  }
}

/** 数一遍内置形象（`characters.js` 里只有角色对象带 `id: '...'`）。 */
function readCharacterCount() {
  try {
    const src = readFileSync(new URL('../client-src/characters.js', import.meta.url), 'utf8')
    return (src.match(/^\s*id:\s*'[a-z0-9-]+'/gm) ?? []).length
  } catch {
    return null
  }
}

/* ── HTTP 小工具 ─────────────────────────────────────────────────────── */

function sendJson(res, code, value) {
  const body = JSON.stringify(value)
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function sendError(res, code, errorCode, message) {
  sendJson(res, code, { ok: false, error: errorCode, message })
}

/** 读请求体，超过上限直接中止（不把整段上传读进内存）。 */
async function readBody(req, capBytes = MAX_BODY_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > capBytes) {
      const error = new Error('payload too large')
      error.code = 'TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * 同源/回环校验：只有从 DSH 自己的 web 入口来的请求才放行。
 *
 * `ctx.connection.requestRejection` 是 DSH 官方的「这个连接该不该拒绝」判定
 * （dsh-whale-girl 同款用法）；取不到时退化为放行（插件只挂在本机回环上）。
 */
function framed(ctx, req) {
  try {
    const rejection = ctx.connection?.requestRejection?.(req)
    if (rejection === undefined || rejection === null || rejection === false || rejection === '') return true
    return false
  } catch {
    return true
  }
}

/* ── 日记（host 侧累计，按天落盘） ───────────────────────────────────── */

function createDiaryKeeper() {
  let cache = null
  let timer = null
  let dirty = false

  const today = () => {
    const date = diaryDate()
    if (cache === null || cache.date !== date) cache = readDiary(diaryDir(), date)
    return cache
  }

  const flush = () => {
    timer = null
    if (!dirty || cache === null) return
    dirty = false
    try {
      writeDiary(diaryDir(), cache)
    } catch (error) {
      console.warn('[dsh-pet] diary write failed', error)
    }
  }

  const record = (input) => {
    try {
      cache = applyDiaryEvent(today(), input)
      dirty = true
      if (timer === null) timer = setTimeout(flush, DIARY_WRITE_MS)
      timer.unref?.()
    } catch (error) {
      console.warn('[dsh-pet] diary fold failed', error)
    }
  }

  return {
    record,
    read(date) {
      return date === undefined ? today() : readDiary(diaryDir(), date)
    },
    flush,
    dispose() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      flush()
    },
  }
}

/* ── 反向通道：pet_say ──────────────────────────────────────────────── */

function registerSayTool(ctx, tools, live) {
  if (tools === undefined || typeof tools.register !== 'function') return null
  const definition = {
    name: SAY_TOOL,
    description: '让屏幕右下角的宠物伙伴开口说一句话。适合在长任务的关键节点、需要提醒用户时使用；一次一句话，短、口语化。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', description: '要说的话，尽量 30 字以内，不要换行' },
        action: { type: 'string', description: '可选动作 id：newyear、lion、fireworks、redpacket、fu、dumpling、shy、cheer、dizzy、spin、roll、hop' },
      },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
        },
        required: ['ok', 'text'],
      },
      render(_args, value) {
        const text = String(value?.text ?? '')
        return [{ type: 'text', text: text === '' ? '宠物没说话' : `宠物说：${text}` }]
      },
    },
    async execute(args) {
      const text = String(args?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 110)
      if (text === '') return { ok: false, text: '' }
      const action = typeof args?.action === 'string' ? args.action : null
      live.pushNotice(text, { action })
      return { ok: true, text }
    },
  }
  try {
    const dispose = tools.register(definition)
    return typeof dispose === 'function' ? dispose : null
  } catch (error) {
    // 同名工具（别的宠物插件也注册了 pet_say）时不要炸掉整个插件
    console.warn('[dsh-pet] pet_say registration skipped:', error?.message ?? error)
    return null
  }
}

/* ── 插件主体 ───────────────────────────────────────────────────────── */

export function apply(ctx) {
  const live = createLiveState({ maxNotices: MAX_NOTICES })
  const diary = createDiaryKeeper()
  /** @type {Map<string, any>} 会话 id → 最近一次事件里的 session 对象（读投影用） */
  const liveSessions = new Map()
  let sayDispose = null
  let usageTimer = null

  /**
   * 可选服务一律走 `ctx.inject([...], child => …)`：
   * Cordis 的 `ctx.get(name)` 在服务没写进 inject 时会直接抛
   * `cannot get property "x" without inject`（这正是第一版重启后整个
   * dsh-pet host 半没挂上的原因）。inject 是**可选**语义：服务不在时
   * 回调不执行，插件照常加载，功能静默缺失。
   */
  let projections = null
  ctx.inject(['sessionProjections'], (child) => {
    projections = child.sessionProjections ?? null
  })

  /** 读一次上下文压力：token-meter 注册的 `contextPressure` 投影。 */
  const refreshUsage = () => {
    if (projections === null || typeof projections.stateOf !== 'function') return
    for (const [id, session] of liveSessions) {
      try {
        const state = projections.stateOf(session, 'contextPressure')
        if (state === undefined) continue
        const pressureTokens = state.pressureTokens ?? state.projectedTokens
        if (pressureTokens === undefined) continue
        live.setUsage(id, { pressureTokens, contextWindow: state.contextWindow })
      } catch {
        // 会话已结束 / 投影未就绪：忽略
      }
    }
  }

  // ── 事件折叠 ──────────────────────────────────────────────────────
  const stopEvents = ctx.on?.('session/event', (session, event) => {
    const id = sessionIdOf(session)
    if (id === null) return
    if (event?.type !== 'session/disposed') liveSessions.set(id, session)
    live.observe(id, event)
    const type = event?.type
    if (type === 'tool/call') {
      const data = event.data ?? {}
      diary.record({ type, sessionId: id, tool: data.name ?? data.toolName, at: Date.now() })
    } else if (type === 'turn/end') {
      const data = event.data ?? {}
      const ok = !/(?:error|abort|cancel|interrupt|fail)/i.test(JSON.stringify(data.reason ?? data ?? ''))
      refreshUsage()
      const durationMs = live.snapshot().lastTurn?.durationMs ?? 0
      diary.record({ type, sessionId: id, ok, durationMs, at: Date.now() })
    } else if (type === 'session/disposed') {
      liveSessions.delete(id)
    }
  })

  // 上下文压力轮询：投影里带着路由容量，只在有活跃会话时读
  usageTimer = setInterval(() => {
    if (liveSessions.size > 0) refreshUsage()
  }, USAGE_POLL_MS)
  usageTimer.unref?.()

  // ── pet_say（反向通道） ───────────────────────────────────────────
  // tools 是可选服务：没有 tools 运行时的 profile 里就不注册这个工具。
  ctx.inject(['tools'], (child) => {
    try {
      sayDispose = registerSayTool(child, child.tools, live)
    } catch (error) {
      console.warn('[dsh-pet] pet_say 注册失败', error)
    }
    return () => {
      sayDispose?.()
      sayDispose = null
    }
  })

  // ── HTTP 路由（一个前缀路由打天下，避免多次注册） ────────────────
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/pet',
      handler: (req, res) => {
        handleRequest(req, res, { ctx, live, diary }).catch((error) => {
          console.warn('[dsh-pet] request failed', error)
          try {
            sendError(res, 500, 'INTERNAL', String(error?.message ?? error))
          } catch {
            // 连接已断开
          }
        })
      },
    })
    return () => {
      dispose?.()
    }
  }, 'dsh-pet: /pet routes')

  ctx.effect(() => () => {
    try {
      stopEvents?.()
    } catch {
      // 已断开
    }
    if (usageTimer !== null) clearInterval(usageTimer)
    try {
      sayDispose?.()
    } catch {
      // 工具已随进程卸载
    }
    diary.dispose()
  }, 'dsh-pet: host resources')
}

/* ── 路由分发 ───────────────────────────────────────────────────────── */

async function handleRequest(req, res, deps) {
  const { ctx, live, diary } = deps
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname
  const method = (req.method ?? 'GET').toUpperCase()

  if (!framed(ctx, req)) {
    sendError(res, 403, 'FORBIDDEN', 'cross-origin request rejected')
    return
  }

  if (path === STATUS_PATH) {
    if (method !== 'GET' && method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      res.end('method not allowed')
      return
    }
    sendJson(res, 200, {
      plugin: name,
      version: readJsonVersion(),
      clientBytes: readClientBytes(),
      characters: readCharacterCount(),
      sayTool: SAY_TOOL,
      hint: '浏览器端状态见设置 → 宠物；此路由只证明插件已挂载',
    })
    return
  }

  if (path === ACTIVITY_PATH) {
    if (method !== 'GET') {
      sendError(res, 405, 'METHOD', 'GET only')
      return
    }
    const after = Number(url.searchParams.get('after'))
    sendJson(res, 200, {
      ok: true,
      ...live.snapshot({ after: Number.isFinite(after) ? after : 0 }),
    })
    return
  }

  if (path === DIARY_PATH) {
    if (method !== 'GET') {
      sendError(res, 405, 'METHOD', 'GET only')
      return
    }
    const date = url.searchParams.get('date') ?? undefined
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'zh'
    try {
      const today = diary.read(date)
      sendJson(res, 200, { ok: true, date: date ?? diaryDate(), diary: today, lines: diaryLines(today, lang) })
    } catch (error) {
      sendError(res, 500, 'DIARY_FAILED', String(error?.message ?? error))
    }
    return
  }

  if (path === SKINS_PATH) {
    if (method === 'GET') {
      sendJson(res, 200, { ok: true, skins: listSkins(skinsDir()) })
      return
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req)
        const label = String(req.headers['x-pet-label'] ?? '').slice(0, 40)
        const meta = saveSkin(skinsDir(), { data: body, label, now: Date.now() })
        sendJson(res, 200, { ok: true, skin: meta, skins: listSkins(skinsDir()) })
      } catch (error) {
        const code = error instanceof SkinError ? error.code : error?.code === 'TOO_LARGE' ? 'TOO_LARGE' : 'SKIN_FAILED'
        const status = code === 'TOO_LARGE' ? 413 : code === 'BAD_TYPE' || code === 'BAD_MAGIC' || code === 'BAD_DIMENSIONS' ? 400 : 500
        sendError(res, status, code, String(error?.message ?? error))
      }
      return
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id') ?? ''
      try {
        const removed = removeSkin(skinsDir(), id)
        sendJson(res, removed ? 200 : 404, { ok: removed, id })
      } catch (error) {
        sendError(res, 400, error instanceof SkinError ? error.code : 'SKIN_FAILED', String(error?.message ?? error))
      }
      return
    }
    sendError(res, 405, 'METHOD', 'GET, POST, DELETE only')
    return
  }

  // /pet/skins/<id>.<ext>：静态单文件服务
  const skinMatch = /^\/pet\/skins\/(skin-[0-9a-f]{8})\.(webp|png)$/.exec(path)
  if (skinMatch) {
    const id = skinMatch[1]
    if (method !== 'GET') {
      sendError(res, 405, 'METHOD', 'GET only')
      return
    }
    try {
      const skin = readSkin(skinsDir(), id)
      res.statusCode = 200
      res.setHeader('Content-Type', skin.mime)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.end(skin.data)
    } catch (error) {
      const notFound = error instanceof SkinError && error.code === 'NOT_FOUND'
      sendError(res, notFound ? 404 : 400, 'SKIN', String(error?.message ?? error))
    }
    return
  }

  sendError(res, 404, 'NOT_FOUND', `unknown pet route ${path}`)
}
