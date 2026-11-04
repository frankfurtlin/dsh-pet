/**
 * 页面上的那只宠物：DOM、动画状态、交互、计时器。
 *
 * 为什么宠物本体用原生 DOM 而不是 React：
 *   · 桌宠是常驻元素，动画和拖拽都是高频写入；React 的协调对 60fps 的
 *     transform 抖动没有帮助，反而会在会话流式输出时增加不必要的工作；
 *   · 原生 DOM 让"拖拽时绝对不重排 React 树"这件事天然成立。
 * React 只用两层壳：挂载我们的 root（shell.overlay 槽位要求返回 React 节点），
 * 以及设置面板。
 *
 * 生命周期的硬要求：`destroy()` 必须摘干净（监听器、定时器、订阅、DOM）。
 * DSH 支持运行中热插拔插件，漏一个 setInterval 就会在反复开关后越跑越慢。
 */

/** 样式表 id：重复注入时替换而不是叠加。 */
const PET_STYLE_ID = 'dsh-pet-style'

/** 气泡上「去看看」按钮跳转的目标状态优先级，与 state.js 的 targetKind 对应。 */
const PET_REACTION_MS = 1100

/** 位图关键帧样式表的 id（动画表在 characters.js 里只有一份，运行时生成 CSS）。 */
const PET_SPRITE_STYLE_ID = 'dsh-pet-sprite-style'

/**
 * 注入/更新位图角色的 keyframes。
 *
 * 幂等：同一个 id 的 <style> 只建一次，内容没变就不碰（避免每帧重排）。
 * 矢量角色不会用到这段 CSS，所以只有存在 sprite 角色时才创建。
 */
function petEnsureSpriteCss() {
  if (typeof document === 'undefined') return null
  const css = [petSpriteCss(), petAnimCss(), petClipCss()].filter(Boolean).join('\n')
  if (!css) return null
  let style = document.getElementById(PET_SPRITE_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = PET_SPRITE_STYLE_ID
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
  petStabilizeStyle(style)
  return style
}

/**
 * 把样式表插到 <head> 末尾。
 *
 * 只用 `[data-dsh-pet]` / `.dsh-pet-*` 开头的选择器，所以顺序其实不敏感；
 * 但放到末尾可以保证「我们自己元素」上的样式最后生效，少一类覆盖率问题。
 *
 * `restabilize()` 是这里唯一需要解释的部分：DSH 的其他客户端插件（主题、侧栏、
 * 移动端 UX）也会往 head 追加样式，谁后写谁赢。我们自己动画的 keyframes 名字是
 * 带前缀的，理论上不冲突，但 --pet-* 变量是挂在 `[data-dsh-pet]` 元素上的，
 * 一旦被后来的样式整块覆盖就会回到"没有宠物"的样子。所以我们在 DOMContentLoaded
 * 之后、以及挂载后 300ms / 1500ms 各复查一次，把样式表挪回末尾。纯幂等，重复
 * 执行没有副作用，也不会因为元素已存在而重复插入。
 */
function petEnsureStyle(css) {
  if (typeof document === 'undefined') return null
  const existing = document.getElementById(PET_STYLE_ID)
  if (existing && existing.textContent === css) {
    petStabilizeStyle(existing)
    return existing
  }
  const style = existing ?? document.createElement('style')
  style.id = PET_STYLE_ID
  style.textContent = css
  if (!existing) document.head.appendChild(style)
  petStabilizeStyle(style)
  return style
}

/** 把样式表挪到 head 末尾；已就位则什么都不做。 */
function petStabilizeStyle(style) {
  if (typeof document === 'undefined' || !style) return
  if (document.head.lastElementChild !== style) document.head.appendChild(style)
}

/**
 * 挂载后再稳定几次，防止官方插件晚一步追加的样式把我们压回去。
 *
 * 固定几个时间点不够：其他客户端插件是懒加载的，它们可能在页面空闲几秒后才注入
 * 样式（重启后实测就出现过 1500ms 之后才追加的情况）。所以 300ms 后再挂一个
 * MutationObserver，head 有新增元素就复查一次；`--pet-*` 变量挂在我们自己的根
 * 元素上，顺序其实不影响取值，这条多做的是「别让后来者把我们挤下去」的防腐。
 */
function petStabilizeLater() {
  const run = () => petStabilizeStyle(document.getElementById(PET_STYLE_ID))
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true })
  else run()
  setTimeout(run, 300)
  setTimeout(run, 1500)
  setTimeout(() => {
    if (typeof MutationObserver !== 'function' || !document.head) return
    if (petStabilizeLater.observer) return
    const observer = new MutationObserver(() => run())
    observer.observe(document.head, { childList: true })
    petStabilizeLater.observer = observer
  }, 300)
}

/** 生成一个元素，附带属性/子节点。省掉一堆 document.createElement 噪音。 */
function petEl(tag, attrs, children) {
  const node = document.createElement(tag)
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue
      if (key === 'class') node.className = value
      else if (key === 'text') node.textContent = value
      else if (key === 'html') node.innerHTML = value
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value)
      else node.setAttribute(key, value === true ? '' : String(value))
    }
  }
  for (const child of children ?? []) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** 视口尺寸（含降级：SSR/测试环境没有 innerWidth 时给保守值）。 */
function petViewport() {
  return {
    width: window.innerWidth || 1280,
    height: window.innerHeight || 800,
  }
}

/**
 * 菜单落点：优先放在宠物上方并水平居中；上方放不下就翻到下方；
 * 最后整体夹进视口（左右至少留 margin，纵向也不许出头）。
 *
 * 为什么要在 JS 里算：菜单是 `position: absolute` 挂在宠物容器里的，
 * 宠物贴右上角时 `bottom: calc(100% + 8px)` 会把菜单顶出屏幕上方，
 * 用户看到的就是"弹窗被边缘咬掉一大块"。这里改成每次打开都按视口算坐标。
 *
 * 纯函数（只吃矩形、不碰 DOM），所以单测可以直接喂边界数据。
 */
function petMenuLayout({ anchor, size, viewport, margin = 8, gap = 8 }) {
  const maxWidth = Math.max(120, viewport.width - margin * 2)
  const maxHeight = Math.max(120, viewport.height - margin * 2)
  const width = Math.min(size.width, maxWidth)
  const height = Math.min(size.height, maxHeight)
  const centered = anchor.left + anchor.width / 2 - width / 2
  const left = Math.max(margin, Math.min(centered, viewport.width - width - margin))
  const above = anchor.top - height - gap
  const flipped = above < margin
  const preferred = flipped ? anchor.bottom + gap : above
  const top = Math.max(margin, Math.min(preferred, viewport.height - height - margin))
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
    maxWidth: Math.round(maxWidth),
    maxHeight: Math.round(maxHeight),
    flipped,
  }
}

/**
 * 创建宠物覆盖层。
 *
 * @param {{
 *   ctx: any,
 *   store: ReturnType<typeof petCreateStore>,
 *   sound: ReturnType<typeof petCreateSound>,
 *   status: ReturnType<typeof petSessionStatus>,
 *   t: (key: string, vars?: Record<string, string | number>) => string,
 *   openSettings: () => void,
 * }} deps
 */
function petCreateOverlay(deps) {
  const { ctx, store, sound, status, live, t, openSettings } = deps

  const state = {
    /** 基础状态（由会话状态推导） */
    base: 'idle',
    /** 临时反应（摸头/跳跃/喂食），到期后回到 base */
    reaction: null,
    reactionTimer: null,
    sleeping: false,
    focus: null,
    hiddenUntil: 0,
    facts: { running: 0, pending: 0, unread: 0, target: null, targetKind: null, sessions: [] },
    previousFacts: null,
    lastActivity: Date.now(),
    bubbleTimer: null,
    idleChatterTimer: null,
    drag: null,
    menuOpen: false,
    mounted: false,
    /** 正在表演的动作 id（null = 没在表演） */
    action: null,
    actionTimer: null,
    /** 解码失败过的「角色:动作」，之后直接走胶片条 */
    videoBroken: new Set(),
    /** host 活动流快照（online=false 表示 host 半还没起来，所有 live 功能静默降级） */
    live: null,
    /** 上一次见到的工具名 / 时间（工具气泡节流用） */
    liveTool: null,
    liveToolAt: 0,
    /** 上一次汇报过的回合时间戳（避免同一轮重复汇报） */
    liveTurnAt: 0,
    /** 上下文占用等级：unknown / ok / warn / high */
    usageLevel: 'unknown',
    /** 上一次弹上下文告警的时刻（每跨一档只提醒一次） */
    usageWarnedAt: 0,
    usageWarnedLevel: null,
  }

  /** 标签页标题闪烁器：等审批时闪，处理完立刻恢复。 */
  const titleFlash = petCreateTitleFlash()

  /* ── DOM ───────────────────────────────────────────────────────────── */

  const badge = petEl('div', { class: 'dsh-pet-badge', text: '0' })
  // 上下文占用条：贴着宠物底部画一条 3px 的进度条，只在 host 活动流报了
  // percent 时才有宽度（拿不到就整条隐藏，不占视觉噪声）。
  const usageBar = petEl('div', { class: 'dsh-pet-usage', 'aria-hidden': 'true' })
  const bubbleText = petEl('div', { class: 'dsh-pet-bubble-text' })
  const bubbleActions = petEl('div', { class: 'dsh-pet-bubble-rec' })
  const bubbleNote = petEl('div', { class: 'dsh-pet-bubble-note' })
  const bubble = petEl('div', { class: 'dsh-pet-bubble', role: 'status' }, [bubbleText, bubbleNote, bubbleActions])

  const figure = petEl('div', {
    class: 'dsh-pet-figure',
    tabindex: '0',
    role: 'button',
    'aria-label': 'pet',
  })
  // 显式给尺寸：位图角色本体全是绝对定位元素，figure 自己不占尺寸的话
  // 高度会塌成 0，指针/键盘都命中不到（Playwright 也会判 not visible）。
  figure.style.width = '100%'
  figure.style.height = '100%'
  figure.appendChild(bubble)

  // 装扮层：围巾/帽子/眼镜这些常驻配饰，画在角色之上、动作道具之下。
  const outfitLayer = petEl('div', { class: 'dsh-pet-outfit-layer', 'aria-hidden': 'true' })
  figure.appendChild(outfitLayer)

  // 道具层：动作手里拿的东西（狮头、红包、毛笔、碗筷、烟花棒）画在这里，
  // 盖在角色之上、气泡之下。用 div 包一层 SVG，位图角色也能挂道具。
  const propLayer = petEl('div', { class: 'dsh-pet-prop-layer', 'aria-hidden': 'true' })
  figure.appendChild(propLayer)

  const ring = petEl('div', { class: 'dsh-pet-ring' })
  const menu = petEl('div', { class: 'dsh-pet-menu', role: 'menu' })

  const root = petEl('div', { 'data-dsh-pet': '', 'data-state': 'idle', 'data-dock': 'right', 'data-bubble': 'hide', 'data-menu': 'closed' }, [
    ring,
    figure,
    usageBar,
    badge,
    menu,
  ])

  /* ── 状态渲染 ───────────────────────────────────────────────────────── */

  const effectiveState = () => state.reaction ?? state.base

  /** 位图元素（矢量角色时为 null） */
  const spriteElement = () => figure.querySelector('.dsh-pet-sprite')

  /** 拖拽朝向：往左拖放 runLeft，往右 runRight */
  let dragDirection = 'right'

  /** 把「当前状态」翻译成图集动作；矢量角色什么也不做。 */
  const syncSpriteAction = () => {
    const element = spriteElement()
    if (!element) return
    const action = petSpriteAction(root.getAttribute('data-char') ?? '', effectiveState(), dragDirection)
    if (action && element.getAttribute('data-action') !== action) element.setAttribute('data-action', action)
  }

  /* ── 16 向注视跟随 ──────────────────────────────────────────────────── */

  /** 最新的指针位置（页面坐标）。没收到过 pointermove 就是 null。 */
  let pointer = null
  /** 矢量角色瞳孔跟随的最大偏移（SVG 用户单位，1.7 差不多顶到眼白内侧）。 */
  const GAZE_LOOK_MAX = 1.7
  /** 指针静止这么久之后回到 idle 动画，免得一直瞪着光标像木头人。 */
  const GAZE_HOLD_MS = 2200
  let gazeUntil = 0
  let gazeRaf = 0

  const gazeId = () => root.getAttribute('data-char') ?? ''

  /**
   * 只有「闲着的位图宠物」才看光标。
   *
   * 有任务（thinking/alert/celebrate）、睡觉、专注、拖拽时都有专门的动作，
   * 那些才是用户真正想看的信息，不能被注视抢掉。
   */
  const gazeAllowed = () =>
    Boolean(gazeId()) && !state.drag && !state.menuOpen && !state.action && effectiveState() === 'idle'

  const clearGaze = () => {
    gazeUntil = 0
    if (root.getAttribute('data-gaze') !== 'idle') root.setAttribute('data-gaze', 'idle')
    // 矢量角色的瞳孔偏移也一并归零
    if (root.style.getPropertyValue('--pet-look-x')) root.style.removeProperty('--pet-look-x')
    if (root.style.getPropertyValue('--pet-look-y')) root.style.removeProperty('--pet-look-y')
    const element = spriteElement()
    if (!element) return
    // 动画与注视帧用同一套 background-position：动帧靠 keyframes，注视靠 inline，
    // 所以两个都要摘干净，否则会残留某一格的静态画面。
    if (element.style.animation) element.style.animation = ''
    if (element.style.backgroundPosition) element.style.backgroundPosition = ''
  }

  /** 按指针相对宠物中心的方向挑一格注视帧。离得太近（dead zone）就回到 idle 动画。 */
  const updateGaze = () => {
    if (!pointer || !gazeAllowed()) {
      clearGaze()
      return
    }
    const rect = figure.getBoundingClientRect()
    if (!rect.width) {
      clearGaze()
      return
    }
    const dx = pointer.x - (rect.left + rect.width / 2)
    const dy = pointer.y - (rect.top + rect.height / 2)
    const dist = Math.hypot(dx, dy)

    // 位图角色：挑图集里的一格注视帧
    const sprite = petSprite(gazeId())
    const gaze = sprite?.gaze
    const element = spriteElement()
    if (gaze && element) {
      if (dist <= (gaze.deadZonePx ?? 28)) {
        clearGaze()
        return
      }
      const cell = petSpriteGazeCell(gazeId(), petSpriteGazeIndex(gazeId(), (Math.atan2(dy, dx) * 180) / Math.PI))
      if (!cell) {
        clearGaze()
        return
      }
      root.setAttribute('data-gaze', 'look')
      element.style.animation = 'none'
      element.style.backgroundPosition = `${cell.x}px ${cell.y}px`
      return
    }

    // 矢量角色：瞳孔按方向平移（CSS var + transform），越远看得越歪，上限 1.7 用户单位
    const deadZone = 28
    if (dist <= deadZone) {
      clearGaze()
      return
    }
    const pull = Math.min(1, (dist - deadZone) / 180)
    const limit = GAZE_LOOK_MAX * pull
    root.setAttribute('data-gaze', 'look')
    root.style.setProperty('--pet-look-x', `${((dx / dist) * limit).toFixed(2)}px`)
    root.style.setProperty('--pet-look-y', `${((dy / dist) * limit).toFixed(2)}px`)
  }

  const scheduleGaze = () => {
    if (gazeRaf) return
    gazeRaf = requestAnimationFrame(() => {
      gazeRaf = 0
      updateGaze()
    })
  }

  const onGlobalPointerMove = (event) => {
    pointer = { x: event.clientX, y: event.clientY }
    syncImageFollow()
    if (!gazeId()) return
    gazeUntil = Date.now() + GAZE_HOLD_MS
    scheduleGaze()
  }

  /**
   * 静态形象没有可动的眼睛，改用「整只轻微倾斜 + 平移」跟随光标，
   * 幅度很小（±3° / ±2px），只求有生命感、不抢注意力。
   */
  const syncImageFollow = () => {
    if (!renderedCharacter || !petIsImage(renderedCharacter) || !pointer) return
    const rect = figure.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = Math.max(-1, Math.min(1, (pointer.x - cx) / (window.innerWidth / 2)))
    const dy = Math.max(-1, Math.min(1, (pointer.y - cy) / (window.innerHeight / 2)))
    root.style.setProperty('--pet-img-tilt', `${(dx * 3).toFixed(2)}deg`)
    root.style.setProperty('--pet-img-shift', `${(dx * 2).toFixed(2)}px`)
    root.setAttribute('data-image-tilt', Math.abs(dx) > 0.25 ? (dx > 0 ? 'right' : 'left') : 'center')
    void dy
  }

  const renderState = () => {
    root.setAttribute('data-state', effectiveState())
    syncSpriteAction()
    updateGaze()
    const { pending, unread } = state.facts
    const count = pending + unread
    badge.textContent = String(count > 99 ? '99+' : count)
    root.setAttribute('data-badge', count > 0 ? 'show' : 'hide')
    // host 活动流投影：data-live 供调试/验收断言，data-tool 让 CSS 能按工具类型
    // 微调（例如跑命令时手抖一点），data-usage 控制进度条配色。
    const liveOnline = state.live?.online === true
    root.setAttribute('data-live', liveOnline ? 'on' : 'off')
    root.setAttribute('data-tool', liveOnline ? state.live?.tool?.name ?? '' : '')
    root.setAttribute('data-usage', state.usageLevel)
    const percent = Number(state.live?.usage?.percent)
    root.style.setProperty('--pet-usage', Number.isFinite(percent) ? String(Math.max(0, Math.min(100, percent)) / 100) : '0')
    usageBar.setAttribute('data-visible', state.usageLevel === 'warn' || state.usageLevel === 'high' ? 'show' : 'hide')
  }

  /** 临时反应：先切到反应态，`PET_REACTION_MS` 后回到基础态。 */
  const react = (name) => {
    state.reaction = name
    if (state.reactionTimer !== null) clearTimeout(state.reactionTimer)
    renderState()
    state.reactionTimer = setTimeout(() => {
      state.reactionTimer = null
      state.reaction = null
      renderState()
    }, PET_REACTION_MS)
  }

  /* ── 气泡 ───────────────────────────────────────────────────────────── */

  const hideBubble = () => {
    if (state.bubbleTimer !== null) {
      clearTimeout(state.bubbleTimer)
      state.bubbleTimer = null
    }
    root.setAttribute('data-bubble', 'hide')
    bubbleActions.replaceChildren()
    bubbleNote.textContent = ''
  }

  /**
   * 弹一句话。
   *
   * @param {string} text
   * @param {{actions?: Array<{label: string, tone?: string, onClick: () => void}>,
   *          note?: string, sticky?: boolean, seconds?: number}} [options]
   *   sticky=true 时不自动消失（等用户点按钮或再次互动）
   */
  const showBubble = (text, options = {}) => {
    const seconds = options.seconds ?? store.getSettings().bubbleSeconds
    bubbleText.textContent = text
    bubbleNote.textContent = options.note ?? ''
    bubbleActions.replaceChildren()
    for (const action of options.actions ?? []) {
      bubbleActions.appendChild(
        petEl(
          'button',
          {
            class: 'dsh-pet-btn',
            type: 'button',
            'data-tone': action.tone ?? 'default',
            text: action.label,
            onclick: (event) => {
              event.stopPropagation()
              try {
                action.onClick()
              } catch (error) {
                console.warn('[dsh-pet] bubble action failed', error)
              }
            },
          },
          [],
        ),
      )
    }
    root.setAttribute('data-bubble', 'show')
    if (!options.sticky) {
      if (state.bubbleTimer !== null) clearTimeout(state.bubbleTimer)
      state.bubbleTimer = setTimeout(() => {
        state.bubbleTimer = null
        root.setAttribute('data-bubble', 'hide')
      }, Math.max(2, seconds) * 1000)
    }
  }

  /* ── 会话状态 → 状态机 ──────────────────────────────────────────────── */

  const nextSleeping = () => {
    const settings = store.getSettings()
    if (state.facts.running > 0 || state.facts.pending > 0) return false
    const idleFor = Date.now() - state.lastActivity
    return idleFor > Math.max(1, settings.sleepAfterMin) * 60000
  }

  const recompute = () => {
    state.sleeping = nextSleeping()
    state.base = petDeriveState({
      facts: state.facts,
      sleeping: state.sleeping,
      focus: Boolean(state.focus),
      live: store.getSettings().liveFeed === false ? null : state.live,
    })
    renderState()
    syncTitle()
  }

  const syncFacts = (options = {}) => {
    const previous = state.previousFacts
    const facts = petReadStatus(status)
    state.facts = facts
    if (facts.running > 0 || facts.pending > 0) state.lastActivity = Date.now()
    recompute()
    syncTitle()

    if (!options.initial) {
      const event = petDetectEvent(previous, facts)
      const settings = store.getSettings()
      if (event && settings.notifications) {
        const target = facts.target
        const jump = () => {
          if (petOpenSession(ctx, target)) hideBubble()
        }
        const action = { label: t('openSession'), tone: 'primary', onClick: jump }
        const dismiss = { label: t('dismiss'), onClick: hideBubble }
        if (event === 'pending') {
          showBubble(facts.pending > 1 ? t('alert', { n: facts.pending }) : t('alertOne'), {
            actions: [action, dismiss],
            note: t('idle'),
          })
          sound.play('alert')
          react('alert')
        } else if (event === 'completed') {
          showBubble(facts.unread > 1 ? t('completeMany', { n: facts.unread }) : t('complete'), {
            actions: [action, dismiss],
          })
          sound.play('complete')
          react('celebrate')
          store.bump('tasks', 1)
          if (store.addAffinity(2)) onLevelUp()
        } else if (event === 'started') {
          showBubble(facts.running > 1 ? t('thinking', { n: facts.running }) : t('thinkingOne'), {
            actions: [action, dismiss],
          })
        }
      }
    }
    state.previousFacts = facts
  }

  const onLevelUp = () => {
    sound.play('levelup')
    showBubble(t('levelUp', { level: store.level().level }), { seconds: 5 })
    react('celebrate')
  }

  /* ── host 活动流：工具级状态 / 回合汇报 / 上下文预警 / 一句话 ─────────── */

  /** 换工具时气泡的最小间隔（刷太快就成弹幕了）。 */
  const TOOL_BUBBLE_MS = 3500

  /**
   * 同步标签页标题：有等审批的会话就闪，处理完立刻恢复。
   *
   * 这条比宠物本身更救命 —— 宠物在屏幕角落容易被忽略，标签页标题在后台标签
   * 也能看见（whale-on-desk 的做法）。只在通知开关打开时生效。
   */
  const syncTitle = () => {
    const settings = store.getSettings()
    const pending = state.facts.pending
    if (settings.notifications && pending > 0) {
      titleFlash.start(`🔔 ${pending > 1 ? t('titlePendingMany', { n: pending }) : t('titlePending')}`)
      return
    }
    titleFlash.stop()
  }

  /** 上下文占用：跨档只提醒一次，回落再抬升会重新提醒。 */
  const applyUsage = () => {
    const usage = state.live?.usage ?? null
    const settings = store.getSettings()
    const level = petUsageLevel(usage, { warn: settings.usageWarn, high: settings.usageHigh })
    state.usageLevel = level
    if (level === 'warn' || level === 'high') {
      if (state.usageWarnedLevel === level) return
      state.usageWarnedLevel = level
      state.usageWarnedAt = Date.now()
      if (!settings.notifications) return
      const percent = Math.round(Number(usage?.percent))
      showBubble(t(level === 'high' ? 'usageHigh' : 'usageWarn', { n: percent }), { seconds: 9 })
      sound.play('alert')
      react('alert')
      return
    }
    if (level === 'ok') state.usageWarnedLevel = null
  }

  /**
   * 把 host 活动流的一次快照落到宠物身上。
   *
   * 四件事，按「越紧急越先做」的顺序：
   *   1. `pet_say` / host 主动提醒 → 直接说；
   *   2. 工具名变化 → 气泡报「正在改代码 / 跑命令」（节流）；
   *   3. 新的一轮结束 → 汇报耗时与工具数（成功撒花、失败报警）；
   *   4. 上下文占用 → 跨 70% / 88% 提醒一次，并更新底部进度条。
   *
   * host 半没起来时 `next.online === false`，四件事全部跳过，宠物继续用
   * `uiSession.sessionStatus` 那套粗粒度状态工作 —— 功能降级，不是报错。
   */
  const syncLive = (next) => {
    if (store.getSettings().liveFeed === false) {
      // 只同步「连接是否在线」，其余（工具气泡/回合汇报/占用预警）全部静音；
      // 仍然 renderState 一次，好让 data-live / data-usage 这类展示属性保持准确。
      if (!next) return
      state.live = { ...next, notices: [], lastTurn: null, tool: null }
      renderState()
      return
    }
    state.live = next
    const settings = store.getSettings()
    const online = next?.online === true
    const lang = petLocaleLang(petProbe(ctx, 'locale'))

    // 1) 一句话（pet_say、host 提醒）
    for (const notice of next?.notices ?? []) {
      const text = String(notice?.text ?? '')
      if (text === '') continue
      showBubble(text, { seconds: Math.max(4, settings.bubbleSeconds) })
      const action = typeof notice?.action === 'string' ? petActionById(notice.action) : null
      if (action) setTimeout(() => playAction(action.id, { silent: true, say: false }), 120)
      else sound.play('pet')
    }

    // 2) 工具级状态
    const toolName = online ? next?.tool?.name ?? null : null
    if (toolName === null) {
      state.liveTool = null
    } else if (toolName !== state.liveTool) {
      const at = Date.now()
      const working = state.facts.running > 0 || next?.active?.state === 'tool'
      if (working && settings.notifications && at - state.liveToolAt >= TOOL_BUBBLE_MS) {
        const phase = petToolPhase(toolName)
        showBubble(`🔧 ${lang === 'en' ? phase.en : phase.zh}`, { seconds: 3 })
        state.liveToolAt = at
      }
      state.liveTool = toolName
    }

    // 3) 回合汇报
    const turn = online ? next?.lastTurn ?? null : null
    if (turn && Number.isFinite(turn.at) && turn.at !== state.liveTurnAt) {
      state.liveTurnAt = turn.at
      const text = petTurnText(turn, lang)
      if (text !== '' && settings.notifications && !state.focus) {
        showBubble(text, { seconds: 6 })
        if (turn.ok === false) {
          sound.play('alert')
          react('alert')
        } else {
          sound.play('complete')
          react('celebrate')
          store.bump('tasks', 1)
          if (store.addAffinity(2)) onLevelUp()
        }
      }
    }

    // 4) 上下文占用
    applyUsage()
    recompute()
  }

  /* ── 交互：摸头 / 跳跃 / 喂食 ───────────────────────────────────────── */

  let clickTimer = null

  const doPet = () => {
    const settings = store.getSettings()
    store.bump('pets', 1)
    const leveled = store.addAffinity(1)
    react('happy')
    sound.play('pet')
    // 只在没有正事要提醒时说话，免得把「待审批」气泡顶掉
    if (state.facts.pending + state.facts.unread === 0) {
      const lines = petLocaleLines()
      const text = lines[Math.floor(Math.random() * lines.length)] ?? t('idle')
      showBubble(text, { seconds: Math.min(4, settings.bubbleSeconds) })
    }
    if (leveled) onLevelUp()
    state.lastActivity = Date.now()
    state.sleeping = false
    recompute()
  }

  const petLocaleLines = () => {
    const lang = petLocaleLang(petProbe(ctx, 'locale'))
    return PET_MESSAGES[lang]?.idleLines ?? PET_MESSAGES.en.idleLines
  }

  const doJump = () => {
    sound.play('jump')
    react('celebrate')
    state.lastActivity = Date.now()
  }

  const doFeed = () => {
    store.bump('feeds', 1)
    const leveled = store.addAffinity(3)
    sound.play('feed')
    showBubble(t('feedDone', { n: 3 }), { seconds: 4 })
    react('happy')
    if (leveled) onLevelUp()
    state.lastActivity = Date.now()
  }

  /* ── 拖拽与吸附 ─────────────────────────────────────────────────────── */

  /** 贴边吸附的容差（px）：松手时离屏幕左/右边缘这么近才回角落。 */
  const SNAP_MARGIN = 56

  /** 根元素当前边长（移动端 CSS 会把它缩到 76px，不能只信 settings.size）。 */
  const currentSize = () => {
    const width = root.getBoundingClientRect().width
    return width > 0 ? width : store.getSettings().size
  }

  const clamp01 = (value) => Math.max(0, Math.min(1, value))

  /**
   * 记录落点。
   *
   * 三种落点都存**百分比**（换分辨率/换设备不跑偏）：
   *   · free  —— x、y 都有效，完全按落点摆；
   *   · left/right —— 水平贴边（交给 CSS），但**纵向位置照样记住**，这样把宠物
   *     拖到半人高再松手不会又掉回屏幕底部（这是"宠物没法移动"的直接原因）；
   *   · 贴边但纵向也没动过 —— pos 为空，回到 CSS 默认的角落高度。
   */
  const persistPosition = () => {
    const rect = root.getBoundingClientRect()
    const viewport = petViewport()
    const size = currentSize()
    const dock = root.getAttribute('data-dock')
    const y = clamp01(rect.top / Math.max(1, viewport.height - size))
    if (dock === 'left' || dock === 'right') {
      store.patchSettings({ dock, pos: { x: dock === 'left' ? 0 : 1, y } })
      return
    }
    store.patchSettings({ dock: 'free', pos: { x: clamp01(rect.left / Math.max(1, viewport.width - size)), y } })
  }

  const applyPosition = () => {
    const settings = store.getSettings()
    const viewport = petViewport()
    const size = currentSize()
    const dock = settings.dock === 'left' ? 'left' : settings.dock === 'right' ? 'right' : 'free'
    root.setAttribute('data-dock', dock)

    const pos = settings.pos
    if (dock === 'free' && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      root.style.left = `${Math.round(pos.x * (viewport.width - size))}px`
      root.style.top = `${Math.round(pos.y * (viewport.height - size))}px`
      return
    }
    // 贴边：水平交给 CSS（left/right + 安全区），纵向若记过就沿用
    root.style.left = ''
    if (dock !== 'free' && pos && Number.isFinite(pos.y)) {
      root.style.top = `${Math.round(pos.y * (viewport.height - size))}px`
    } else {
      root.style.top = ''
    }
  }

  const onPointerDown = (event) => {
    // 一上手就停掉正在演的动作：用户要拖它，不该被自己的动画抢
    if (state.action) endAction()
    if (event.button !== 0 && event.pointerType === 'mouse') return
    sound.prime()
    closeMenu()
    const rect = root.getBoundingClientRect()
    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
      width: rect.width,
      height: rect.height,
    }
    root.setAttribute('data-state', 'drag')
    dragDirection = 'right'
    syncSpriteAction()
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    window.addEventListener('pointercancel', onPointerUp, { once: true })
    event.preventDefault()
  }

  const onPointerMove = (event) => {
    const drag = state.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    const nextDirection = dx < -2 ? 'left' : dx > 2 ? 'right' : dragDirection
    if (nextDirection !== dragDirection) {
      dragDirection = nextDirection
      syncSpriteAction()
    }
    const viewport = petViewport()
    const left = Math.max(0, Math.min(viewport.width - drag.width, event.clientX - drag.offsetX))
    const top = Math.max(0, Math.min(viewport.height - drag.height, event.clientY - drag.offsetY))
    root.setAttribute('data-dock', 'free')
    root.style.left = `${Math.round(left)}px`
    root.style.top = `${Math.round(top)}px`
  }

  const onPointerUp = (event) => {
    const drag = state.drag
    state.drag = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    renderState()
    if (!drag) return
    if (!drag.moved) {
      // 没拖动 = 一次点击：交给 click 处理器（双击由 dblclick 覆盖）
      return
    }
    // 吸附：只有真的贴到左/右边缘（容差 SNAP_MARGIN）才回角落贴边，
    // 否则就停在松手的地方。原来按视口 35% 判断，等于「拖到哪都弹回角落」。
    const rect = root.getBoundingClientRect()
    const viewport = petViewport()
    const nearLeft = rect.left <= SNAP_MARGIN
    const nearRight = viewport.width - (rect.left + rect.width) <= SNAP_MARGIN
    if (nearLeft || nearRight) {
      root.setAttribute('data-dock', nearLeft ? 'left' : 'right')
      root.style.left = ''
    } else {
      root.setAttribute('data-dock', 'free')
    }
    persistPosition()
    state.lastActivity = Date.now()
    void event
  }

  const onClick = (event) => {
    if (state.drag?.moved) return
    event.stopPropagation()
    sound.prime()
    if (clickTimer !== null) return
    clickTimer = setTimeout(() => {
      clickTimer = null
      doPet()
    }, 220)
  }

  const onDoubleClick = (event) => {
    event.stopPropagation()
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    doJump()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      doPet()
    } else if (event.key === 'Escape') {
      closeMenu()
      hideBubble()
    }
  }

  /* ── 动作表演（右键点播 / 空闲自演）─────────────────────────────────── */

  /** 粒子层：一个绝对定位的容器，表演时临时插入，结束就整个摘掉。 */
  let fxLayer = null
  /** 空闲自演的定时器（1.5–4 分钟一次，仅完全空闲时） */
  let idleActionTimer = null

  const clearFx = () => {
    if (!fxLayer) return
    fxLayer.remove()
    fxLayer = null
  }

  /**
   * 画粒子。
   *
   * 每个粒子只是「一段 CSS 动画 + 几个自定义属性」，轨迹在合成层完成，
   * 所以 14 个烟花粒子也不会掉帧。粒子跟随 root，根元素的动作动画会带着一起动，
   * 视觉上正好是从宠物身上炸开。
   */
  const spawnFx = (kind) => {
    clearFx()
    if (!kind) return
    const layer = petEl('div', { class: 'dsh-pet-fx', 'data-fx': kind, 'aria-hidden': 'true' })
    for (const particle of petFxParticles(kind)) {
      const item = petEl('span', { class: 'dsh-pet-fx-item', text: particle.char })
      item.style.setProperty('--pet-fx-dx', `${particle.dx}px`)
      item.style.setProperty('--pet-fx-dy', `${particle.dy}px`)
      item.style.setProperty('--pet-fx-rot', `${particle.rot}deg`)
      item.style.setProperty('--pet-fx-delay', `${particle.delay}ms`)
      item.style.setProperty('--pet-fx-size', `${particle.size}px`)
      item.style.setProperty('--pet-fx-color', particle.color)
      layer.appendChild(item)
    }
    root.appendChild(layer)
    fxLayer = layer
  }

  /**
   * 换道具。动作手里没东西时传 null 清空。
   * 道具在 SVG 里按 0–100 坐标画，跟角色同一个 viewBox，所以缩放/大小档自动对齐。
   */
  /**
   * 换装扮：把 SVG 片段塞进装扮层。
   *
   * 装扮是**常驻**的（不随动作消失），和动作道具走同一个 100×100 坐标系，
   * 所以位图角色也能精确戴上围巾/眼镜。
   */
  const setOutfit = (id) => {
    const markup = petOutfitMarkup(id)
    if (!markup) {
      outfitLayer.replaceChildren()
      root.removeAttribute('data-outfit')
      return
    }
    outfitLayer.innerHTML = '<svg class="dsh-pet-outfit-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' + markup + '</svg>'
    root.setAttribute('data-outfit', id)
  }

  const setProp = (id) => {
    propLayer.innerHTML = id ? `<svg class="dsh-pet-prop-svg" viewBox="0 0 100 100" aria-hidden="true">${petPropMarkup(id)}</svg>` : ''
    if (id) root.setAttribute('data-prop', id)
    else root.removeAttribute('data-prop')
  }

  /** 换手臂姿态（CSS 里每个姿态一组左右手的关键帧）。 */
  const setPose = (pose) => {
    if (pose) root.setAttribute('data-pose', pose)
    else root.removeAttribute('data-pose')
  }

  /** 原生动作视频层（<video>）。 */
  const videoLayer = () => figure.querySelector('.dsh-pet-video')

  const clearNative = () => {
    const layer = videoLayer()
    if (layer) {
      try {
        layer.pause()
      } catch {}
      layer.removeAttribute('data-video')
    }
    const clip = figure.querySelector('.dsh-pet-clip')
    if (clip) clip.removeAttribute('data-clip')
    root.removeAttribute('data-clip-active')
  }

  /**
   * 原生动作视频：能播就铺一条透明 WebM，帧率/时长不受图集协议限制。
   *
   * 返回 true 表示已接管本动作；解码失败的一律记进 state.videoBroken，之后
   * 同一个动作直接走胶片条，不会每次都白试一遍。
   */
  const setVideoAction = (characterId, actionId) => {
    const video = petActionVideo(characterId, actionId)
    const layer = videoLayer()
    if (!video || !layer) return false
    if (state.videoBroken.has(`${characterId}:${actionId}`)) return false
    // 关了动效（或系统要求减少动态效果）就不放视频：退回胶片条，它的 CSS 动画会被暂停，
    // 等于定格在片段第一帧，比让整个角色消失好
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (root.getAttribute('data-motion') === 'off' || reduced) return false
    if (layer.getAttribute('src') !== video.url) {
      layer.setAttribute('src', video.url)
      layer.load()
    }
    // 先摘再挂 + 强制重排，连播同一个动作时视频也会从头放
    layer.removeAttribute('data-video')
    root.removeAttribute('data-clip-active')
    void layer.offsetWidth
    layer.setAttribute('data-video', actionId)
    root.setAttribute('data-clip-active', 'video')
    const markBroken = () => {
      state.videoBroken.add(`${characterId}:${actionId}`)
      // 本动作还在演：摘掉视频，退回胶片条（没有胶片条就露出位图本体）
      if (root.getAttribute('data-clip-active') === 'video') {
        clearNative()
        if (state.action) setClip(state.action)
      }
    }
    // onerror 是单值属性：连播多个动作也只会有一个处理器，不会越挂越多
    layer.onerror = markBroken
    try {
      layer.currentTime = 0
      const played = layer.play()
      if (played && typeof played.catch === 'function') played.catch(markBroken)
    } catch {
      markBroken()
      return false
    }
    return true
  }

  /**
   * 原生动作胶片条：有片段的动作期间，用横向 WebP 盖住位图本体和 SVG 道具。
   * 没片段的角色/动作保持原样（返回 false 让调用方继续走老路径）。
   */
  const setClip = (actionId) => {
    const layer = figure.querySelector('.dsh-pet-clip')
    if (!layer) return false
    if (actionId) {
      // 先摘再挂 + 强制重排，否则连播同一个动作时动画不会从头放
      layer.removeAttribute('data-clip')
      root.removeAttribute('data-clip-active')
      void layer.offsetWidth
      layer.setAttribute('data-clip', actionId)
      root.setAttribute('data-clip-active', 'strip')
      return true
    }
    layer.removeAttribute('data-clip')
    root.removeAttribute('data-clip-active')
    return false
  }

  const endAction = () => {
    if (state.actionTimer !== null) {
      clearTimeout(state.actionTimer)
      state.actionTimer = null
    }
    state.action = null
    root.removeAttribute('data-act')
    clearNative()
    setPose(null)
    setProp(null)
    clearFx()
    renderState()
  }

  /**
   * 演一个动作。
   *
   * @param {string} id PET_ACTIONS 里的 id
   * @param {{silent?: boolean, say?: boolean}} [options]
   *   silent=true 时不出声（空闲自演用，避免用户没注意时突然响）
   */
  const playAction = (id, options = {}) => {
    const action = petActionById(id)
    if (!action) return false
    if (state.action) endAction()
    sound.prime()
    const ms = Math.round((action.seconds ?? 2) * 1000)
    state.action = action.id
    state.lastActivity = Date.now()
    state.sleeping = false
    // 先摘再挂，强制重排一次，否则连续播同一个动作不会重启动画
    root.removeAttribute('data-act')
    void root.offsetWidth
    root.style.setProperty('--pet-act-ms', `${ms}ms`)
    root.setAttribute('data-act', action.effect)
    // 专属动作的优先级：原生视频 > 胶片条 > SVG 组件表演
    const characterId = root.getAttribute('data-char') ?? ''
    const native = setVideoAction(characterId, action.id)
      || Boolean(setClip(petActionClip(characterId, action.id) ? action.id : null))
    setPose(native ? null : (action.arms ?? null))
    setProp(native ? null : (action.prop ?? null))
    spawnFx(action.fx)
    if (!options.silent) sound.play(action.sound)
    const say = options.say === false ? '' : petActionSay(action, petLocaleLang(petProbe(ctx, 'locale')))
    if (say) showBubble(say, { seconds: Math.max(2, Math.round(ms / 1000)) })
    state.actionTimer = setTimeout(() => {
      state.actionTimer = null
      endAction()
    }, ms)
    renderState()
    return true
  }

  /* ── 右键菜单 ───────────────────────────────────────────────────────── */

  const menuItem = (label, onClick, options = {}) => {
    const button = petEl('button', {
      class: 'dsh-pet-menu-item',
      type: 'button',
      role: 'menuitem',
      text: label,
      'data-danger': options.danger ? 'true' : null,
      onclick: (event) => {
        event.stopPropagation()
        closeMenu()
        try {
          onClick()
        } catch (error) {
          console.warn('[dsh-pet] menu action failed', error)
        }
      },
    })
    return button
  }

  const buildMenu = () => {
    const items = []
    items.push(menuItem(t('menuPet'), doPet))
    items.push(menuItem(t('menuFeed'), doFeed))
    items.push(menuItem(state.focus ? t('menuFocusStop') : t('menuFocus'), () => toggleFocus()))
    // 动作点播：按分类分组（节日 / 卖萌 / 动一动），这是参考小鲸鱼桌宠加的核心能力
    const lang = petLocaleLang(petProbe(ctx, 'locale'))
    for (const category of petActionCategories()) {
      const actions = petActionsByCategory(category.id)
      if (!actions.length) continue
      items.push(petEl('div', { class: 'dsh-pet-menu-sep' }))
      items.push(petEl('div', { class: 'dsh-pet-menu-head', text: category.label[lang] ?? category.label.en }))
      for (const action of actions) {
        const item = menuItem(petActionLabel(action, lang), () => playAction(action.id))
        item.setAttribute('data-action-id', action.id)
        items.push(item)
      }
    }
    items.push(petEl('div', { class: 'dsh-pet-menu-sep' }))
    if (state.sleeping) items.push(menuItem(t('menuWake'), () => wakeUp()))
    else items.push(menuItem(t('menuSleep'), () => gotoSleep()))
    items.push(menuItem(t('menuHide'), () => hideFor(5 * 60000)))
    items.push(menuItem(t('menuResetPos'), () => resetPosition()))
    items.push(petEl('div', { class: 'dsh-pet-menu-sep' }))
    const currentOutfit = store.getSettings().outfit ?? 'none'
    const outfitName = currentOutfit === 'none' ? t('outfitNone') : petOutfitLabel(currentOutfit, petLocaleLang(ctx.locale))
    items.push(
      menuItem(
        `${t('menuOutfit')}：${outfitName}`,
        () => {
          store.patchSettings({ outfit: petOutfitNext(currentOutfit, 1) })
        },
      ),
    )
    items.push(menuItem(t('menuSettings'), () => openSettings()))
    menu.replaceChildren(...items)
  }

  /**
   * 把菜单摆到视口内的合适位置。
   *
   * 根容器是 `contain: layout style`，它会给 fixed 子元素当包含块，所以菜单
   * 继续用 absolute，坐标按「视口坐标 − 根容器坐标」换算成局部坐标。
   */
  const placeMenu = () => {
    const viewport = petViewport()
    const anchorRect = figure.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    menu.style.maxHeight = `${Math.min(Math.max(160, viewport.height - 16), 420)}px`
    const menuRect = menu.getBoundingClientRect()
    const layout = petMenuLayout({
      anchor: { left: anchorRect.left, top: anchorRect.top, bottom: anchorRect.bottom, width: anchorRect.width, height: anchorRect.height },
      size: { width: menuRect.width, height: menuRect.height },
      viewport,
    })
    menu.style.maxWidth = `${layout.maxWidth}px`
    menu.style.left = `${layout.left - rootRect.left}px`
    menu.style.top = `${layout.top - rootRect.top}px`
    root.setAttribute('data-menu-flipped', layout.flipped ? 'true' : 'false')
  }

  const openMenu = () => {
    buildMenu()
    state.menuOpen = true
    root.setAttribute('data-menu', 'open')
    // open 之后菜单才有盒模型，这里同步量一次并落点（同一帧内完成，不会闪跳）
    placeMenu()
  }

  const closeMenu = () => {
    if (!state.menuOpen) return
    state.menuOpen = false
    root.setAttribute('data-menu', 'closed')
  }

  const onContextMenu = (event) => {
    event.preventDefault()
    sound.prime()
    if (state.menuOpen) closeMenu()
    else openMenu()
  }

  /** 点页面其它地方关菜单（capture 阶段，避免被 DSH 自己的处理器 stopPropagation 掉）。 */
  const onDocumentPointerDown = (event) => {
    if (!state.menuOpen) return
    if (root.contains(event.target)) return
    closeMenu()
  }

  /* ── 行为：睡觉 / 隐藏 / 位置 ───────────────────────────────────────── */

  const gotoSleep = () => {
    state.sleeping = true
    state.base = 'sleep'
    state.lastActivity = Date.now() - 10 * 60000
    renderState()
    showBubble(t('sleep'), { seconds: 3 })
  }

  const wakeUp = () => {
    state.sleeping = false
    state.lastActivity = Date.now()
    recompute()
    react('happy')
  }

  const hideFor = (ms) => {
    state.hiddenUntil = Date.now() + ms
    root.style.display = 'none'
    setTimeout(() => {
      if (Date.now() < state.hiddenUntil) return
      state.hiddenUntil = 0
      root.style.display = ''
    }, ms + 50)
  }

  const resetPosition = () => {
    store.patchSettings({ dock: 'right', pos: null })
    applyPosition()
  }

  /* ── 番茄钟 ─────────────────────────────────────────────────────────── */

  const focusRemaining = () => (state.focus ? Math.max(0, state.focus.endsAt - Date.now()) : 0)

  const renderFocusRing = () => {
    if (!state.focus) {
      root.style.setProperty('--pet-progress', '0')
      return
    }
    const total = state.focus.durationMs || 1
    const done = 1 - Math.min(1, focusRemaining() / total)
    root.style.setProperty('--pet-progress', done.toFixed(4))
  }

  const toggleFocus = () => {
    if (state.focus) {
      const finished = state.focus
      state.focus = null
      renderFocusRing()
      recompute()
      showBubble(t('focusBreakDone'), { seconds: 4 })
      void finished
      return
    }
    const settings = store.getSettings()
    const minutes = Math.max(1, settings.focusWorkMin)
    state.focus = { endsAt: Date.now() + minutes * 60000, durationMs: minutes * 60000, phase: 'work', minutes }
    state.lastActivity = Date.now()
    recompute()
    renderFocusRing()
    sound.play('focus')
    showBubble(t('focusStart', { n: minutes }), { seconds: 5 })
  }

  const tick = () => {
    if (state.hiddenUntil && Date.now() >= state.hiddenUntil) {
      state.hiddenUntil = 0
      root.style.display = ''
    }
    // 指针静止一会儿就恢复 idle 动画（注视是「回应你」，不是「盯死你」）
    if (gazeUntil && Date.now() > gazeUntil) clearGaze()
    if (state.focus) {
      renderFocusRing()
      if (focusRemaining() <= 0) {
        const settings = store.getSettings()
        state.focus = null
        renderFocusRing()
        store.bump('focus', 1)
        const leveled = store.addAffinity(6)
        sound.play('focus')
        showBubble(t('focusDone'), { seconds: 8 })
        react('celebrate')
        recompute()
        if (leveled) onLevelUp()
        void settings
      }
    }
    const sleepingNow = nextSleeping()
    if (sleepingNow !== state.sleeping) {
      state.sleeping = sleepingNow
      recompute()
    }
  }

  /* ── 设置应用 ───────────────────────────────────────────────────────── */

  let renderedCharacter = null

  const applySettings = () => {
    const settings = store.getSettings()
    root.style.display = settings.enabled && Date.now() >= state.hiddenUntil ? '' : 'none'
    root.style.setProperty('--pet-size', `${Math.max(56, Math.min(200, settings.size))}px`)
    root.setAttribute('data-char', settings.character)
    root.setAttribute('data-motion', settings.motion === 'off' ? 'off' : 'auto')
    root.setAttribute('data-mobile', settings.mobile === 'show' ? 'show' : 'hide')
    // 关掉「工具级状态」后：不参与状态仲裁、不弹工具/回合气泡，活动流连接照旧（设置页要看在线状态）
    root.setAttribute('data-feed', settings.liveFeed === false ? 'off' : 'on')
    if (renderedCharacter !== settings.character) {
      const previousNodes = figure.querySelectorAll(
        '.dsh-pet-svg, .dsh-pet-sprite, .dsh-pet-clip, .dsh-pet-video, .dsh-pet-image, .dsh-pet-anim',
      )
      // 换角色时先摘原生动作层：旧节点一删，setClip/setVideoAction 就找不到 layer 了，
      // data-clip-active 会留在 root 上把新角色一起隐藏。
      clearNative()
      const isSprite = petIsSprite(settings.character)
      const isImage = petIsImage(settings.character)
      const isAnim = petIsAnim(settings.character)
      if (isSprite || isAnim) petEnsureSpriteCss()
      const markup = isSprite
        ? petSpriteMarkup(settings.character)
        : isAnim
          ? petAnimMarkup(settings.character)
          : isImage
            ? petImageMarkup(settings.character)
            : petSvg(settings.character)
      const holder = petEl('div', { html: markup })
      // 位图角色一次挂两个兄弟节点（本体 + 原生动作胶片条），不能只取 firstElementChild
      const nodes = [...holder.children]
      if (previousNodes.length) {
        const anchor = previousNodes[0]
        for (const node of nodes) figure.insertBefore(node, anchor)
        previousNodes.forEach((node) => node.remove())
      } else {
        for (const node of nodes) figure.insertBefore(node, propLayer)
      }
      renderedCharacter = settings.character
      root.setAttribute('data-render', isSprite ? 'sprite' : isAnim ? 'anim' : isImage ? 'image' : 'vector')
      root.removeAttribute('data-image-tilt')
      syncImageFollow()
    } else {
      // 同角色但换了尺寸：位图要重算缩放比（矢量是 SVG，跟着 --pet-size 自动缩）
      syncSpriteAction()
    }
    if (petIsSprite(settings.character)) {
      const size = Math.max(56, Math.min(200, settings.size))
      root.setAttribute('data-render', 'sprite')
      root.style.setProperty('--pet-sprite-scale', String(petSpriteScale(settings.character, size)))
    }
    if (petIsAnim(settings.character)) {
      const size = Math.max(56, Math.min(200, settings.size))
      root.setAttribute('data-render', 'anim')
      root.style.setProperty('--pet-anim-scale', String(petAnimScale(settings.character, size)))
    }
    setOutfit(settings.outfit ?? 'none')
    applyPosition()
    recompute()
  }

  /* ── 挂载 / 卸载 ────────────────────────────────────────────────────── */

  const listeners = []

  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options)
    listeners.push(() => target.removeEventListener(type, handler, options))
  }

  return {
    root,
    mount() {
      if (state.mounted) return
      state.mounted = true
      document.body.appendChild(root)
      figure.addEventListener('pointerdown', onPointerDown)
      figure.addEventListener('click', onClick)
      figure.addEventListener('dblclick', onDoubleClick)
      figure.addEventListener('contextmenu', onContextMenu)
      figure.addEventListener('keydown', onKeyDown)
      const preventMenu = (event) => event.preventDefault()
      figure.addEventListener('contextmenu', preventMenu)
      on(document, 'pointerdown', onDocumentPointerDown, true)

      applySettings()
      syncFacts({ initial: true })
      state.lastActivity = Date.now()

      const unbindStatus = status.subscribe(() => {
        try {
          syncFacts()
        } catch (error) {
          console.warn('[dsh-pet] status sync failed', error)
        }
      })
      const unbindStore = store.subscribe(() => {
        try {
          applySettings()
        } catch (error) {
          console.warn('[dsh-pet] settings apply failed', error)
        }
      })
      listeners.push(unbindStatus, unbindStore)

      // host 活动流：插件 host 半起来时才有数据；没起来就静默降级（online=false）
      if (live !== undefined && live !== null && typeof live.subscribe === 'function') {
        const unbindLive = live.subscribe((next) => {
          try {
            syncLive(next)
          } catch (error) {
            console.warn('[dsh-pet] live sync failed', error)
          }
        })
        listeners.push(unbindLive)
        try {
          syncLive(live.get())
        } catch (error) {
          console.warn('[dsh-pet] live prime failed', error)
        }
      }

      const timers = []
      timers.push(setInterval(tick, 1000))
      // 闲时聊天：8~15 分钟一次，只在完全没有任务时说话，避免打扰
      const scheduleChatter = () => {
        const delay = 8 * 60000 + Math.random() * 7 * 60000
        timers.push(
          setTimeout(() => {
            if (!state.hiddenUntil && state.facts.pending + state.facts.unread + state.facts.running === 0 && !state.focus) {
              const lines = petLocaleLines()
              // 一半概率「讨活」：主动求摸摸，并给一个按钮 —— 不只是自说自话，
              // 这样用户一秒就能回应，点完会走正常的摸头逻辑（亲密度 +1）。
              if (lines.length > 0 && Math.random() < 0.5) {
                const label = petLocaleLang(petProbe(ctx, 'locale')) === 'en' ? 'Pat me' : '摸摸我'
                showBubble(t('nudgeAsk'), {
                  seconds: 12,
                  actions: [{ label, tone: 'primary', onClick: () => doPet() }],
                })
              } else if (lines.length > 0) {
                showBubble(lines[Math.floor(Math.random() * lines.length)], { seconds: 6 })
              }
            }
            scheduleChatter()
          }, delay),
        )
      }
      scheduleChatter()

      // 空闲自演：参考小鲸鱼桌宠的「自主行为链」。默认 1.5–4 分钟演一下轻动作，
      // 但只在完全空闲、宠物可见、没在表演时演，而且静音——用户没在看时不该突然出声。
      const scheduleIdleAction = () => {
        const delay = 90000 + Math.random() * 150000
        idleActionTimer = setTimeout(() => {
          const idle = state.facts.pending + state.facts.unread + state.facts.running === 0
          const settings = store.getSettings()
          const visible = settings.enabled && Date.now() >= state.hiddenUntil
          if (idle && visible && !state.action && !state.focus && !state.drag && !state.menuOpen && !state.sleeping) {
            playAction(petRandomIdleAction(), { silent: true })
          }
          scheduleIdleAction()
        }, delay)
      }
      scheduleIdleAction()
      listeners.push(() => {
        if (idleActionTimer !== null) clearTimeout(idleActionTimer)
        idleActionTimer = null
      })

      listeners.push(() => {
        for (const timer of timers) {
          clearInterval(timer)
          clearTimeout(timer)
        }
      })

      // 视口变化时重新夹住自由位置，避免窗口缩小后宠物跑到看不见的地方；
      // 菜单开着时也要重新落点，否则窗口一缩菜单又出界了
      on(window, 'resize', () => {
        applyPosition()
        if (state.menuOpen) placeMenu()
      })
      // 注视：capture 不必要，passive 让滚动时不被拖慢
      on(window, 'pointermove', onGlobalPointerMove, { passive: true })
    },
    destroy() {
      if (!state.mounted) return
      state.mounted = false
      for (const off of listeners.splice(0)) {
        try {
          off()
        } catch (error) {
          console.warn('[dsh-pet] cleanup failed', error)
        }
      }
      if (state.bubbleTimer !== null) clearTimeout(state.bubbleTimer)
      if (state.reactionTimer !== null) clearTimeout(state.reactionTimer)
      if (state.actionTimer !== null) clearTimeout(state.actionTimer)
      state.actionTimer = null
      state.action = null
      clearFx()
      if (idleActionTimer !== null) clearTimeout(idleActionTimer)
      idleActionTimer = null
      if (clickTimer !== null) clearTimeout(clickTimer)
      if (gazeRaf) cancelAnimationFrame(gazeRaf)
      gazeRaf = 0
      state.bubbleTimer = null
      state.reactionTimer = null
      clickTimer = null
      figure.removeEventListener('pointerdown', onPointerDown)
      figure.removeEventListener('click', onClick)
      figure.removeEventListener('dblclick', onDoubleClick)
      figure.removeEventListener('contextmenu', onContextMenu)
      figure.removeEventListener('keydown', onKeyDown)
      titleFlash.stop()
      state.live = null
      state.liveTool = null
      state.usageLevel = 'unknown'
      const spriteStyle = document.getElementById(PET_SPRITE_STYLE_ID)
      if (spriteStyle) spriteStyle.remove()
      root.remove()
    },
    /** 供设置面板调用：改了设置后立刻反映到页面。 */
    refresh: applySettings,
    /** 供设置面板 / 诊断调用：当前 host 活动流快照（online=false 表示 host 半未激活）。 */
    liveState: () => state.live,
    /** 供设置面板调用：播一下预览音。 */
    previewSound: (kind) => sound.play(kind ?? 'pet'),
    /** 供设置面板调用：播一个动作（设置页的动作面板）。 */
    playAction: (id) => playAction(id),
    /** 供设置面板调用：把宠物叫出来（设置页"测试"按钮用）。 */
    poke: () => {
      applySettings()
      react('happy')
      showBubble(t('idle'), { seconds: 3 })
    },
  }
}
