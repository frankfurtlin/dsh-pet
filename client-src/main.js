/**
 * dsh-pet — 浏览器侧入口（Cordis 插件）。
 *
 * 这个文件是整条链路的接线板，只做五件事：
 *   1. 注入样式表；
 *   2. 建 store / sound / 会话状态订阅器；
 *   3. 往官方 `shell.overlay` 槽位注册宠物本体；
 *   4. 往官方 `settings.section` 槽位注册设置页；
 *   5. 提供「就地设置浮层」，右键菜单点一下就能改，不必钻进设置对话框。
 *
 * 所有对 DSH 的依赖都走公开服务名（slots / sessions / locale / uiSession），
 * 没有 import 任何 DSH 内部路径——升级时最坏情况是某个服务改名，页面降级为
 * 「宠物在但联动失效」，而不是整个 web 崩掉。
 */

const petReactMain = require('react')
const petReactDomMain = require('react-dom')

/** 构建时由 scripts/build.mjs 注入的样式表内容。 */
const PET_CSS = '__DSH_PET_CSS__'

/** 插件名：必须与 package.json / cordis.patch.yml 一致（模块表按这个名字找 bundle）。 */
const PET_PLUGIN = 'dsh-pet'

function apply(ctx) {
  petEnsureStyle(PET_CSS)
  petStabilizeLater()

  const store = petCreateStore()
  const sound = petCreateSound(store)
  const status = petSessionStatus(ctx)
  // host 活动流（工具名 / 回合汇报 / token 占用 / 宠物要说的话）。
  // host 半没重启起来时它一直 offline，宠物照样工作，只是少了这几项精确能力。
  const live = petCreateLive()

  const translator = () => petTranslator(petLocaleLang(petProbe(ctx, 'locale')))
  const t = (key, vars) => translator()(key, vars)

  /** 宠物覆盖层实例（懒建：shell.overlay 挂载时才需要 DOM）。 */
  let overlay = null

  /* ── 就地设置浮层 ─────────────────────────────────────────────────── */

  let popover = null

  /**
   * 关闭就地设置浮层。
   *
   * 注意：关闭时**不能**去动文档级监听器——那些监听器只在 apply() 里注册一次、
   * 在插件卸载时注销。早先的写法是「每开一次浮层就 addEventListener 一个
   * onPointerDown」，而 closeSettingsPopover 又不注销，于是旧浮层留下的监听器
   * 会拿它自己那份 element 去判断「点的是不是浮层外」：新浮层里的点击自然
   * 不在旧 element 里 → 被判定为外部点击 → 刚打开的设置窗口被上一次的监听器关掉。
   */
  const closeSettingsPopover = () => {
    if (!popover) return
    try {
      popover.root.unmount()
    } catch (error) {
      console.warn('[dsh-pet] popover unmount failed', error)
    }
    popover.element.remove()
    popover = null
  }

  /** 点浮层外 / 按 Esc 关闭（监听器全局只注册一次，永远针对当前浮层判断）。 */
  const onPopoverPointerDown = (event) => {
    if (!popover) return
    if (popover.element.contains(event.target)) return
    closeSettingsPopover()
  }

  const onPopoverKeyDown = (event) => {
    if (!popover || event.key !== 'Escape') return
    closeSettingsPopover()
  }

  const bindPopoverDismissers = () => {
    document.addEventListener('pointerdown', onPopoverPointerDown, true)
    document.addEventListener('keydown', onPopoverKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPopoverPointerDown, true)
      document.removeEventListener('keydown', onPopoverKeyDown)
    }
  }

  const openSettingsPopover = () => {
    if (popover) {
      popover.element.querySelector('.dsh-pet-popover-body')?.focus?.()
      return
    }
    const element = document.createElement('div')
    element.className = 'dsh-pet-popover'
    element.setAttribute('role', 'dialog')
    element.setAttribute('aria-modal', 'false')
    element.setAttribute('aria-label', t('settingsTitle'))

    const header = document.createElement('div')
    header.className = 'dsh-pet-popover-header'
    const title = document.createElement('strong')
    title.textContent = t('settingsTitle')
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'dsh-pet-btn'
    close.textContent = '✕'
    close.setAttribute('aria-label', 'close')
    close.addEventListener('click', () => closeSettingsPopover())
    header.append(title, close)

    const body = document.createElement('div')
    body.className = 'dsh-pet-popover-body'

    element.append(header, body)
    document.body.appendChild(element)

    const Panel = petCreateSettingsPanel({
      ctx,
      store,
      sound,
      t,
      live,
      onTestPet: () => overlay?.poke(),
      onPlayAction: (id) => overlay?.playAction(id),
      onSkinsChanged: () => {
        petEnsureSpriteCss()
        overlay?.refresh()
      },
    })
    const reactRoot = petReactDomMain.createRoot(body)
    reactRoot.render(petReactMain.createElement(Panel, null))
    popover = { element, root: reactRoot }
  }

  /* ── 宠物本体：挂到 shell.overlay ──────────────────────────────────── */

  const ensureOverlay = () => {
    if (overlay) return overlay
    overlay = petCreateOverlay({
      ctx,
      store,
      sound,
      status,
      live,
      t: (key, vars) => t(key, vars),
      openSettings: openSettingsPopover,
    })
    return overlay
  }

  /**
   * shell.overlay 槽位渲染的组件。
   *
   * 只负责在挂载/卸载时驱动原生 DOM 宠物；渲染结果必须是 React 节点，所以返回 null。
   * 用 `[ctx]` 作为依赖，热重载（HMR 换插件实例）时会重建。
   */
  function PetMount() {
    petReactMain.useEffect(() => {
      const api = ensureOverlay()
      api.mount()
      return () => {
        api.destroy()
        overlay = null
      }
    }, [])
    return null
  }

  /* ── 设置页：挂到官方 settings.section ─────────────────────────────── */

  const Panel = petCreateSettingsPanel({
    ctx,
    store,
    sound,
    t,
    live,
    onTestPet: () => overlay?.poke(),
    onPlayAction: (id) => overlay?.playAction(id),
    onSkinsChanged: () => {
      petEnsureSpriteCss()
      overlay?.refresh()
    },
  })

  const register = () => {
    const disposers = []
    try {
      disposers.push(
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: PET_PLUGIN, order: 100 }, () => petReactMain.createElement(PetMount, null)),
        ),
      )
    } catch (error) {
      console.warn('[dsh-pet] shell.overlay slot unavailable', error)
    }
    try {
      disposers.push(
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: PET_PLUGIN, label: () => t('settingsTitle'), order: 60 },
            () => petReactMain.createElement(Panel, null),
          ),
        ),
      )
    } catch (error) {
      console.warn('[dsh-pet] settings.section slot unavailable', error)
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose?.()
        } catch (error) {
          console.warn('[dsh-pet] slot dispose failed', error)
        }
      }
      closeSettingsPopover()
      overlay?.destroy()
      overlay = null
      const style = document.getElementById(PET_STYLE_ID)
      if (style) style.remove()
    }
  }

  // 文档级「点外部/Esc 关闭」监听器：整个插件生命周期只注册一份
  let unbindDismissers = null
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      unbindDismissers = bindPopoverDismissers()
      return () => {
        unbindDismissers?.()
        unbindDismissers = null
      }
    }, 'dsh-pet: popover dismissers')
  } else {
    unbindDismissers = bindPopoverDismissers()
  }

  // 活动流轮询：与插件生命周期绑定，插件停用就停止请求（别在后台空转）。
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      live.start()
      return () => live.stop()
    }, 'dsh-pet: activity feed')
  } else {
    live.start()
  }

  if (typeof ctx.effect === 'function') ctx.effect(register, 'dsh-pet: slots')
  else register()
}

module.exports = { name: PET_PLUGIN, inject: ['slots', 'sessions', 'locale'], apply }
