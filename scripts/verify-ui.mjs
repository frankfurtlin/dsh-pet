#!/usr/bin/env node
/**
 * dsh-pet 浏览器验收（Playwright + 真 Chromium）。
 *
 *   node scripts/verify-ui.mjs                                  # 自动从 journal 取 launch token
 *   node scripts/verify-ui.mjs --url 'http://127.0.0.1:3080/?token=…'
 *   node scripts/verify-ui.mjs --url … --out docs/verification/pet --widths 1440x900,390x844
 *   node scripts/verify-ui.mjs --headed                         # 观察模式，排查用
 *
 * 为什么必须是真浏览器：这个插件的能力绝大部分在 DOM/CSS/事件上（拖拽吸附、
 * 右键菜单、气泡、深浅色 token、手机端隐藏、设置浮层），单元测试只能证明数据和
 * 字符串对，证明不了"用户看到并点到了"。
 *
 * 两个踩过的坑，这里都处理了：
 *   · launch token 是 base64url（含 `-` `_`），正则写成 [A-Za-z0-9] 会截断它，
 *     截断的 token 换不到 cookie，页面就停在 "authentication required"；
 *   · token 换成 cookie 之后**同一个 context 里**才有效，所以多视口验收要复用
 *     同一个 context 只改 viewport，不能每个视口新开 context。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const UNIT = 'deepseek-harness.service'
const PORT = process.env.DSH_PORT ?? '3080'

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
const flag = (name) => args.includes(`--${name}`)

const OUT_DIR = resolve(ROOT, option('out') ?? 'docs/verification/pet')
const WIDTHS = (option('widths') ?? '1440x900,390x844').split(',').map((pair) => {
  const [width, height] = pair.split('x').map(Number)
  return { width, height }
})

/** Playwright 可能在几个项目里；按候选路径找，找不到给出可执行的提示。 */
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    join(homedir(), 'workspace/hermes-site/tools/node_modules/playwright'),
    join(homedir(), 'workspace/story-between/client/node_modules/playwright'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      return createRequire(join(candidate, 'package.json'))('playwright')
    } catch {
      /* 换下一个候选 */
    }
  }
  // 本仓库 / 上层 node_modules 里装了 playwright 时，退回模块自带解析
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    throw new Error(`找不到 playwright，可设置 PLAYWRIGHT_PATH=<node_modules/playwright 目录>；已尝试：\n${candidates.join('\n')}`)
  }
}

/**
 * 从 journal 里取本次启动打印的 launch token。
 *
 * 时间窗锚在服务的 ActiveEnterTimestamp 上，而不是"最近 15 分钟"——服务跑了几天
 * 之后时间窗会取不到 token，锚在启动时刻才稳定。正则必须允许 `-` 和 `_`。
 */
function launchTokenUrl() {
  const explicit = option('url')
  if (explicit) return explicit
  let since = ''
  try {
    since = execFileSync('systemctl', ['show', UNIT, '-p', 'ActiveEnterTimestamp', '--value'], { encoding: 'utf8' }).trim()
  } catch {
    /* 用 journal 的默认窗口 */
  }
  const journalArgs = ['-u', UNIT, '--no-pager', '-o', 'cat']
  if (since) journalArgs.push('--since', since)
  const log = execFileSync('journalctl', journalArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const tokens = [...log.matchAll(/http:\/\/127\.0\.0\.1:(?:3080|3081)\/\?token=([A-Za-z0-9_-]+)/g)].map((match) => match[1])
  if (tokens.length === 0) throw new Error(`最近一次启动（${since || 'journal 默认窗口'}）里没有找到 launch token，请用 --url 显式传入`)
  const token = tokens[tokens.length - 1]
  return `http://127.0.0.1:${PORT}/?token=${token}`
}

/** 在页面里把某个 token 解析成浏览器实际算出的值（用于断言 16px 而不是 calc 表达式）。 */
const RESOLVE_TOKEN = `(token, prop) => {
  const probe = document.createElement('div')
  probe.style.position = 'fixed'
  probe.style.visibility = 'hidden'
  probe.style.setProperty(prop, 'var(' + token + ')')
  document.body.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop).trim()
  probe.remove()
  return value
}`

const results = []
function check(width, name, ok, detail) {
  results.push({ viewport: width, name, ok, detail: detail ?? null })
  const mark = ok ? '✓' : '✗'
  console.log(`  ${mark} [${width}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const playwright = loadPlaywright()
  const url = launchTokenUrl()
  console.log(`→ 目标：${url.replace(/token=[A-Za-z0-9_-]+/, 'token=***')}`)
  mkdirSync(OUT_DIR, { recursive: true })

  const browser = await playwright.chromium.launch({ headless: !flag('headed') })
  // 一个 context 复用 cookie：token 换来的登录态只在这个 context 内有效
  const context = await browser.newContext({ viewport: WIDTHS[0], deviceScaleFactor: 1 })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location?.()?.url ?? ''
    const text = `${message.text()} ${url}`.trim()
    // 直连 3080（绕过网关登录）时下面这些属于预期失败，不算缺陷：
    //   · /api/** 一律 401 —— host-mode 补丁只认网关签发的 cookie；
    //   · /gateway/api/** 404 —— 网关在 3081，由反向代理转发。
    if (/\/api\//.test(url) || /\/gateway\/api\//.test(url)) return
    // /pet/** 在 host 半还没重启起来时必然 404：这是验收脚本自己轮询造成的，
    // 属于「功能降级」的预期路径（页面已经断言 data-live=off），不算缺陷。
    // 重启后同一路径会 200；只有非 404 的 /pet 错误才该算失败。
    if (/\/pet\//.test(url) && /404/.test(text)) return
    // 素材路由的负向探测（路径穿越 400 / 非 GET 405）是验收自己发起的 fetch，
    // 浏览器会把 4xx 记为控制台错误；只放过这两条精确路径，其它 4xx 照旧算失败。
    if (/\/pet\/assets\/\.\.%2Fpackage\.json/.test(text) && /400/.test(text)) return
    if (/\/pet\/assets\/anim-cheer\.webm/.test(text) && /405/.test(text)) return
    // DSH 自身的 cordis-client-runner 周期性同步 inspect provider 时会偶发
    // 「Failed to fetch」（网页端与 /api 的探测路径差异导致），与本插件无关，
    // 但会随机让「无意外报错」这条断言变红 —— 单独放过，其余照旧严格。
    if (/cordis-client-runner/.test(text) && /syncInspectManifest failed/.test(text)) return
    // 同一类偶发：验收脚本要反复 reload 页面，dsh-client-ui-cordis 每次启动都会拉一次
    // 插件清单，网关偶尔回 Failed to fetch（与宠物插件无关），同样放过。
    if (/\[ui-cordis\] reading the Cordis inventory failed/.test(text)) return
    if (/\/api\/dsh-passwords\/state/.test(text) || /\/gateway\/api\/messages/.test(text)) return
    consoleErrors.push(text)
  })
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

  // 默认把「工具级状态」关掉：验收脚本本身就跑在 Agent 的 bash 工具调用里，
  // host 活动流会一直报「有工具在跑」，不静音则基准 idle / 16 向注视断言永远失败。
  // 需要验活动流的分段会把 dsh-pet:verify:live 置为 on，随后自行打开开关。
  await page.addInitScript(() => {
    if (localStorage.getItem('dsh-pet:verify:live') === 'on') return
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (current.liveFeed === false) return
    localStorage.setItem(key, JSON.stringify({ ...current, liveFeed: false }))
  })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 45000 })
  await page.waitForTimeout(600)

  const boot = await page.evaluate(() => ({
    href: location.href.replace(/token=[A-Za-z0-9_-]+/, 'token=***'),
    title: document.title,
    styleInHead: [...document.head.querySelectorAll('style')].some((node) => node.id === 'dsh-pet-style'),
    styleLastInHead: document.head.lastElementChild?.id === 'dsh-pet-style',
  }))
  check('common', '页面已通过 launch token 进入（未停在 authentication required）', !/authentication required/.test(boot.title) && (await page.locator('[data-dsh-pet]').count()) > 0, boot.href)
  check('common', '样式表 #dsh-pet-style 在 <head> 中', boot.styleInHead)
  check('common', '样式表是 <head> 的最后一个元素（不被官方样式压掉）', boot.styleLastInHead)

  for (const viewport of WIDTHS) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(400)
    console.log(`\n── viewport ${viewport.width}x${viewport.height} ──`)

    const root = page.locator('[data-dsh-pet]').first()
    const isMobile = viewport.width < 1024

    // 手机端默认隐藏，桌面端默认显示
    const visible = await root.isVisible()
    check(viewport.width, isMobile ? '手机端默认隐藏宠物' : '桌面端默认显示宠物', isMobile ? !visible : visible)

    if (isMobile) {
      // 打开手机端显示开关后应可见
      await page.evaluate(() => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        localStorage.setItem(key, JSON.stringify({ ...current, mobile: 'show', liveFeed: false }))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
      await page.waitForTimeout(500)
      await page.setViewportSize(viewport)
      await page.waitForTimeout(300)
      const shownAgain = await page.locator('[data-dsh-pet]').first().isVisible()
      check(viewport.width, '打开「手机端显示」后宠物出现', shownAgain)
      // 复原，避免污染下一次验收
      await page.evaluate(() => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        localStorage.setItem(key, JSON.stringify({ ...current, mobile: 'hide', liveFeed: false }))
      })
    }

    if (!(await page.locator('[data-dsh-pet]').first().isVisible())) {
      continue
    }

    // 现在只剩位图噜噜：每个视口都从它开跑
    // 手机视口下还要保持「显示」，否则后面的点击类断言会因元素不可见而超时
    await page.evaluate((showOnMobile) => {
      const key = 'dsh-pet:settings:v1'
      const current = JSON.parse(localStorage.getItem(key) ?? '{}')
      localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 104, dock: 'right', pos: null, liveFeed: false, mobile: showOnMobile ? 'show' : current.mobile ?? 'hide' }))
    }, isMobile)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
    await page.waitForTimeout(400)

    const look = await page.evaluate(
      ({ resolveTokenSource }) => {
        const node = document.querySelector('[data-dsh-pet]')
        const resolveToken = eval(resolveTokenSource)
        const figure = node.querySelector('.dsh-pet-figure')
        const box = figure.getBoundingClientRect()
        return {
          char: node.getAttribute('data-char'),
          dock: node.getAttribute('data-dock'),
          state: node.getAttribute('data-state'),
          motion: node.getAttribute('data-motion'),
          width: Math.round(box.width),
          height: Math.round(box.height),
          render: node.getAttribute('data-render'),
          sprite: Boolean(node.querySelector('.dsh-pet-sprite')),
          radius: resolveToken('--dsw-radius-lg', 'border-top-left-radius'),
          shadow: getComputedStyle(node.querySelector('.dsh-pet-bubble') ?? node).getPropertyValue('box-shadow').trim(),
        }
      },
      { resolveTokenSource: RESOLVE_TOKEN },
    )
    check(viewport.width, '位图噜噜正常渲染（图集元素挂上了）', look.char === 'lulu' && look.sprite, `data-char=${look.char} sprite=${look.sprite}`)
    check(viewport.width, '默认停在右下角', look.dock === 'right', `data-dock=${look.dock}`)
    check(viewport.width, '空闲状态', look.state === 'idle' || look.state === 'sleep', `data-state=${look.state}`)
    check(viewport.width, '尺寸符合 104px 档位', look.width >= 96 && look.width <= 140, `${look.width}×${look.height}px`)
    check(viewport.width, '形象走图集渲染（data-render=sprite）', look.render === 'sprite', `data-render=${look.render}`)

    // 洋葱皮：摸头 → 气泡 + 亲密度增加
    const beforeAffinity = await page.evaluate(() => JSON.parse(localStorage.getItem('dsh-pet:growth:v1') ?? '{}').affinity ?? 0)
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click()
    await page.waitForTimeout(700)
    const afterPet = await page.evaluate(() => ({
      affinity: JSON.parse(localStorage.getItem('dsh-pet:growth:v1') ?? '{}').affinity ?? 0,
      bubble: document.querySelector('[data-dsh-pet]')?.getAttribute('data-bubble'),
      text: document.querySelector('[data-dsh-pet] .dsh-pet-bubble')?.textContent?.trim() ?? '',
    }))
    check(viewport.width, '点一下会摸头并弹气泡', afterPet.bubble === 'show', afterPet.text.slice(0, 24))
    check(viewport.width, '摸头增加亲密度', afterPet.affinity > beforeAffinity, `${beforeAffinity} → ${afterPet.affinity}`)

    // 右键菜单
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(300)
    const menu = await page.evaluate(() => {
      const node = document.querySelector('[data-dsh-pet]')
      return {
        open: node.getAttribute('data-menu') === 'open',
        items: node.querySelectorAll('.dsh-pet-menu-item').length,
      }
    })
    check(viewport.width, '右键弹出菜单', menu.open)
    check(viewport.width, '菜单项齐全（≥6 项）', menu.items >= 6, `${menu.items} 项`)

    // 动作点播：分组标题 + 每个动作一个条目；点一下要真的演起来
    const actionMenu = await page.evaluate(() => {
      const node = document.querySelector('[data-dsh-pet]')
      return {
        heads: [...node.querySelectorAll('.dsh-pet-menu-head')].map((el) => el.textContent.trim()),
        actions: [...node.querySelectorAll('[data-action-id]')].map((el) => el.getAttribute('data-action-id')),
      }
    })
    check(
      viewport.width,
      '菜单里有动作分组（节日/卖萌/动一动）',
      actionMenu.heads.length === 3,
      actionMenu.heads.join(' / '),
    )
    check(
      viewport.width,
      '菜单里有 12 个可点播动作',
      actionMenu.actions.length === 12 && actionMenu.actions.includes('newyear') && actionMenu.actions.includes('fireworks'),
      actionMenu.actions.join(','),
    )

    // 拜年：躬身动画 + 彩纸粒子 + 台词气泡
    await page.locator('[data-dsh-pet] [data-action-id="newyear"]').first().click()
    await page.waitForTimeout(200)
    const bowing = await page.evaluate(() => {
      const node = document.querySelector('[data-dsh-pet]')
      const animations = (node.getAnimations?.() ?? []).map((animation) => ({
        name: animation.animationName ?? '',
        duration: Math.round((animation.effect?.getTiming?.().duration ?? 0) || 0),
      }))
      return {
        act: node.getAttribute('data-act'),
        animations,
        fx: node.querySelectorAll('.dsh-pet-fx-item').length,
        bubble: node.querySelector('.dsh-pet-bubble-text')?.textContent?.trim() ?? '',
      }
    })
    check(viewport.width, '点「拜年」后进入动作态', bowing.act === 'bow', String(bowing.act))
    check(
      viewport.width,
      '拜年动画在跑（dsh-pet-act-bow，约 2.2s）',
      bowing.animations.some((item) => item.name === 'dsh-pet-act-bow' && item.duration >= 1800 && item.duration <= 2600),
      JSON.stringify(bowing.animations.filter((item) => item.name.startsWith('dsh-pet-act'))),
    )
    check(viewport.width, '拜年撒彩纸粒子', bowing.fx === 12, `${bowing.fx} 个`)
    // 界面语言由 DSH locale 决定，中文/英文台词都算通过
    check(viewport.width, '拜年有台词气泡', /新年好|Happy new year/.test(bowing.bubble), bowing.bubble.slice(0, 24))

    // 等动作演完：动作态、粒子层都要自动收干净
    await page.waitForTimeout(2400)
    const afterAct = await page.evaluate(() => {
      const node = document.querySelector('[data-dsh-pet]')
      return { act: node.getAttribute('data-act'), fx: node.querySelectorAll('.dsh-pet-fx').length }
    })
    check(viewport.width, '动作演完自动收尾', afterAct.act === null && afterAct.fx === 0, JSON.stringify(afterAct))

    // 放烟花：跳起 + 14 个火花
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(200)
    await page.locator('[data-dsh-pet] [data-action-id="fireworks"]').first().click()
    await page.waitForTimeout(150)
    const fireworks = await page.evaluate(() => {
      const node = document.querySelector('[data-dsh-pet]')
      return { act: node.getAttribute('data-act'), fx: node.querySelectorAll('.dsh-pet-fx-item').length }
    })
    check(viewport.width, '放烟花：动作 + 14 个火花粒子', fireworks.act === 'hop' && fireworks.fx === 14, JSON.stringify(fireworks))
    await page.waitForTimeout(2300)

    // 道具层：用户要的是「手里真的有东西」，这里逐个道具数出来。
    // （矢量形象已按要求删除，所以不再有手臂姿态；道具层是独立 SVG，位图角色照样能挂）
    if (!isMobile) {
      await page.evaluate(() => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 136 }))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(document.querySelector('[data-dsh-pet] .dsh-pet-sprite')), null, { timeout: 30000 })
      await page.waitForTimeout(900)

      // 有了原生动作视频后，道具层是「视频不可用/关掉动效」时的回落路径。
      // 关掉动效再逐个点动作，验证回落时手里真的有东西、姿态标记也在。
      await page.evaluate(() => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        localStorage.setItem(key, JSON.stringify({ ...current, motion: 'off' }))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(document.querySelector('[data-dsh-pet] .dsh-pet-sprite')), null, { timeout: 30000 })
      await page.waitForTimeout(900)

      const propCases = [
        { id: 'lion', prop: 'lion', pose: 'lift', detail: '鬃毛花瓣', selector: '.dsh-pet-lion-petal', min: 20 },
        { id: 'newyear', prop: 'clasp', pose: 'clasp', detail: '抱在一起的拳头', selector: '.dsh-pet-fist', min: 2 },
        { id: 'redpacket', prop: 'envelope', pose: 'clasp', detail: '红包本体', selector: '.dsh-pet-envelope-body', min: 1 },
        { id: 'fu', prop: 'brush', pose: 'write', detail: '写上去的笔画', selector: '.dsh-pet-ink', min: 7 },
        { id: 'dumpling', prop: 'bowl', pose: 'eat', detail: '碗里的饺子', selector: '.dsh-pet-dumpling', min: 2 },
        { id: 'fireworks', prop: 'firework', pose: 'hold', detail: '烟花火花', selector: '.dsh-pet-firework-ray', min: 8 },
      ]
      for (const item of propCases) {
        await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
        await page.waitForTimeout(180)
        await page.locator(`[data-dsh-pet] [data-action-id="${item.id}"]`).first().click()
        await page.waitForTimeout(420)
        const seen = await page.evaluate((selector) => {
          const node = document.querySelector('[data-dsh-pet]')
          const layer = node.querySelector('.dsh-pet-prop-layer')
          const arm = node.querySelector(".dsh-pet-arm[data-arm='l'] .dsh-pet-arm-shape")
          return {
            prop: node.getAttribute('data-prop'),
            pose: node.getAttribute('data-pose'),
            layerProp: layer?.querySelector('[data-prop]')?.getAttribute('data-prop') ?? null,
            count: layer ? layer.querySelectorAll(selector).length : 0,
            armRotate: arm ? getComputedStyle(arm).rotate : 'none',
            hatHidden: (() => {
              const hat = node.querySelector('.dsh-pet-hat')
              return hat ? getComputedStyle(hat).display === 'none' : true
            })(),
          }
        }, item.selector)
        check(viewport.width, `${item.id}：手里有道具（${item.prop}）`, seen.prop === item.prop && seen.layerProp === item.prop, JSON.stringify({ prop: seen.prop, layer: seen.layerProp }))
        check(viewport.width, `${item.id}：道具画出来了（${item.detail} ≥ ${item.min}）`, seen.count >= item.min, `${seen.count} 个`)
        check(viewport.width, `${item.id}：姿态标记为「${item.pose}」`, seen.pose === item.pose, `pose=${seen.pose}`)
        if (item.id === 'lion') check(viewport.width, '舞狮时头上的小橘子藏起来，狮头才完整', seen.hatHidden)
        await page.waitForTimeout(2800)
      }

      // 演完要把道具和姿态收干净，不然会一直举着狮头
      const propCleared = await page.evaluate(() => {
        const node = document.querySelector('[data-dsh-pet]')
        return {
          prop: node.getAttribute('data-prop'),
          pose: node.getAttribute('data-pose'),
          html: node.querySelector('.dsh-pet-prop-layer')?.innerHTML.trim() ?? '',
        }
      })
      check(viewport.width, '动作演完道具与姿态都收干净', propCleared.prop === null && propCleared.pose === null && propCleared.html === '', JSON.stringify(propCleared))

      // 复原成默认位图噜噜（动效开回来），后面的用例按默认形象断言
      await page.evaluate(() => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 104, motion: 'on' }))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(document.querySelector('[data-dsh-pet] .dsh-pet-figure')), null, { timeout: 30000 })
      await page.waitForTimeout(700)
    }

    // 从菜单打开设置浮层，改大小
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(200)
    await page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /宠物设置|Pet settings/ }).first().click()
    await page.waitForSelector('.dsh-pet-popover .dsh-pet-settings', { timeout: 8000 })
    const settingsShape = await page.evaluate(() => {
      const popover = document.querySelector('.dsh-pet-popover')
      return {
        visible: !!popover && popover.getBoundingClientRect().width > 200,
        characters: popover.querySelectorAll('[data-testid="pet-characters"] [data-char]').length,
        charIds: [...popover.querySelectorAll('[data-testid="pet-characters"] [data-char]')].map((node) => node.getAttribute('data-char')),
        hasEnable: !!popover.querySelector('[data-testid="pet-enable"]'),
        hasSound: !!popover.querySelector('[data-testid="pet-sound"]'),
        hasExport: !!popover.querySelector('[data-testid="pet-export"]'),
        actions: popover.querySelectorAll('[data-testid="pet-actions"] [data-action-id]').length,
        volume: (() => {
          const input = popover.querySelector('input[type="range"]')
          return input ? { min: Number(input.min), max: Number(input.max), value: Number(input.value) } : null
        })(),
      }
    })
    check(viewport.width, '设置浮层可见', settingsShape.visible)
    // 用户仍可自己导入形象/动图（u-* / a-*）；内置形象只有一只噜噜
    check(viewport.width, '设置里只有一只内置噜噜', settingsShape.characters === 1 && settingsShape.charIds[0] === 'lulu', settingsShape.charIds.join(','))
    check(viewport.width, '设置含启用/音效/导出', settingsShape.hasEnable && settingsShape.hasSound && settingsShape.hasExport)
    check(viewport.width, '设置里有 12 个动作可试演', settingsShape.actions === 12, `${settingsShape.actions} 个`)
    check(
      viewport.width,
      '音量滑块下限抬到 10%（拉到底也听得见），默认 45%',
      settingsShape.volume !== null && settingsShape.volume.min === 10 && settingsShape.volume.max === 100 && settingsShape.volume.value === 45,
      JSON.stringify(settingsShape.volume),
    )

    // 形象区：一张内置卡，点卡要立刻生效（不能把宠物点没了）
    await page.locator('.dsh-pet-popover [data-testid="pet-characters"] [data-char="lulu"]').first().click()
    await page.waitForTimeout(400)
    const afterSwitch = await page.evaluate(() => {
      const root = document.querySelector('[data-dsh-pet]')
      return {
        char: root?.getAttribute('data-char'),
        render: root?.getAttribute('data-render'),
        sprite: Boolean(root?.querySelector('.dsh-pet-sprite')),
        cards: document.querySelectorAll('.dsh-pet-popover [data-testid="pet-characters"] [data-char]').length,
      }
    })
    check(viewport.width, '形象区只有一张内置卡（用户自备形象会合法增加）', afterSwitch.cards === 1, `卡片数=${afterSwitch.cards}`)
    check(viewport.width, '点形象卡后仍然是位图噜噜（不会点没）', afterSwitch.char === 'lulu' && afterSwitch.render === 'sprite' && afterSwitch.sprite, `data-char=${afterSwitch.char} render=${afterSwitch.render}`)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const closed = await page.evaluate(() => !document.querySelector('.dsh-pet-popover'))
    check(viewport.width, 'Esc 关闭设置浮层', closed)

    // 深色模式：位图角色的配色烘焙在素材里，验的是「深色下仍然正常渲染、图集没丢」
    const dark = await page.evaluate(() => {
      document.body.setAttribute('data-ds-dark-theme', '')
      const root = document.querySelector('[data-dsh-pet]')
      const sprite = root.querySelector('.dsh-pet-sprite')
      const style = sprite ? getComputedStyle(sprite) : null
      const out = {
        char: root.getAttribute('data-char'),
        served: /\/pet\/assets\/lulu\.webp/.test(style?.backgroundImage ?? ''),
        width: Math.round(sprite?.getBoundingClientRect().width ?? 0),
      }
      document.body.removeAttribute('data-ds-dark-theme')
      return out
    })
    check(viewport.width, '深色主题下位图噜噜照常渲染（图集走 host 直供）', dark.char === 'lulu' && dark.served && dark.width > 40, `char=${dark.char} served=${dark.served} w=${dark.width}px`)

    // 截图留证
    const shot = join(OUT_DIR, `pet-${viewport.width}x${viewport.height}.png`)
    await page.screenshot({ path: shot })

    // 复原形象，避免不同视口互相影响
    await page.evaluate(() => {
      const key = 'dsh-pet:settings:v1'
      const current = JSON.parse(localStorage.getItem(key) ?? '{}')
      localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu' }))
    })
  }

  // 量真实响度：在音频输出前插一个 AnalyserNode，点宠物后采样波形峰值。
  // 用户两次反馈"声音太小"，只验滑块/增益数值不够，必须量到实际输出。
  await page.addInitScript(() => {
    const Ctor = window.AudioContext ?? window.webkitAudioContext
    if (!Ctor) return
    const originalConnect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function patchedConnect(target, ...rest) {
      const ctx = this.context
      if (target && ctx && target === ctx.destination) {
        let analyser = window.__petAnalyser
        if (!analyser || analyser.context !== ctx) {
          analyser = ctx.createAnalyser()
          analyser.fftSize = 2048
          window.__petAnalyser = analyser
          originalConnect.call(analyser, target)
        }
        return originalConnect.call(this, analyser, ...rest)
      }
      return originalConnect.call(this, target, ...rest)
    }
  })

  await page.setViewportSize(WIDTHS[0])
  // 清空本地设置 = 新用户首次打开
  // ── 活动流 / 上下文预警 / 日记 / 图集导入 ────────────────────────────
  // host 半（/pet/*）需要重启后才有；没重启时必须**静默降级**，所以这里对
  // 两种情况都做断言：在线就验数据，离线就验「不报错、有离线提示」。
  await page.evaluate(() => {
    localStorage.setItem('dsh-pet:verify:live', 'on')
    const raw = localStorage.getItem('dsh-pet:settings:v1')
    const settings = raw === null ? {} : JSON.parse(raw)
    settings.character = 'lulu'
    settings.liveFeed = true
    localStorage.setItem('dsh-pet:settings:v1', JSON.stringify(settings))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(400)

  const liveAttrs = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    return root
      ? { live: root.getAttribute('data-live'), usage: root.getAttribute('data-usage'), tool: root.getAttribute('data-tool') }
      : null
  })
  check('common', '宠物声明了活动流状态（on/off 两种模式都不抛错）', liveAttrs !== null && ['on', 'off'].includes(liveAttrs.live), `data-live=${liveAttrs?.live}`)
  check('common', '上下文占用等级取值合法', ['unknown', 'ok', 'warn', 'high'].includes(liveAttrs?.usage ?? ''), `data-usage=${liveAttrs?.usage}`)
  check('common', '存在上下文占用条元素（仅在预警档显示）', await page.evaluate(() => !!document.querySelector('[data-dsh-pet] .dsh-pet-usage')))

  // 收尾：活动流分段验完，把 init script 的静音开关放回默认，
  // 否则后面的位图/注视分段会被 host 的「工具进行中」打成 thinking。
  await page.evaluate(() => {
    localStorage.setItem('dsh-pet:verify:live', 'off')
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, liveFeed: false }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(600)

  const activity = await page.evaluate(async () => {
    try {
      const response = await fetch('/pet/activity?after=0', { headers: { accept: 'application/json' } })
      if (!response.ok) return { ok: false, status: response.status }
      const body = await response.json()
      return {
        ok: true,
        seq: typeof body?.seq === 'number',
        usage: body?.usage ?? null,
        sessions: Array.isArray(body?.sessions) ? body.sessions.length : -1,
        notices: Array.isArray(body?.notices) ? body.notices.length : -1,
        hasLastTurn: body?.lastTurn !== undefined,
      }
    } catch (error) {
      return { ok: false, status: String(error?.message ?? error) }
    }
  })
  if (activity.ok) {
    check('common', '/pet/activity 在线返回合法快照', activity.seq === true && activity.sessions >= 0 && activity.notices >= 0, `sessions=${activity.sessions} notices=${activity.notices}`)
    await page.waitForFunction(() => document.querySelector('[data-dsh-pet]')?.getAttribute('data-live') === 'on', { timeout: 8000 }).catch(() => {})
    check('common', '活动流在线时宠物切到 data-live=on', (await page.evaluate(() => document.querySelector('[data-dsh-pet]')?.getAttribute('data-live'))) === 'on')
  } else {
    check('common', '活动流离线时宠物降级为 data-live=off（不报错）', (await page.evaluate(() => document.querySelector('[data-dsh-pet]')?.getAttribute('data-live'))) === 'off', `activity status=${activity.status}`)

  // 关掉「工具级状态」：即使 host 活动流正报着某个工具在跑，宠物也不能显示 thinking。
  // 这条是真实场景的回归——用户自己和 Agent 同时在用这台机器时，宠物不该一直"思考"。
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, liveFeed: false }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(900)
  const muted = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    return { feed: root?.getAttribute('data-feed'), state: root?.getAttribute('data-state'), live: root?.getAttribute('data-live') }
  })
  check('common', '关掉工具级状态后 root 标 data-feed=off', muted.feed === 'off', `data-feed=${muted.feed}`)
  check('common', '关掉工具级状态后宿主在跑工具也不显示 thinking', muted.state === 'idle', `data-state=${muted.state}`)

  }

  // 设置浮层里的三段新内容（这里不调用下面的 openSettingsMenu 帮助函数：
  // 它在脚本更后面才定义，提前调用会踩 const 的 TDZ）
  await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
  await page.waitForTimeout(260)
  await page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /宠物设置|Pet settings/ }).first().click()
  await page.waitForSelector('.dsh-pet-popover .dsh-pet-settings', { timeout: 8000 })
  await page.waitForTimeout(250)
  const sections = await page.evaluate(() => {
    const body = document.querySelector('.dsh-pet-popover-body')
    if (!body) return null
    const text = (selector) => body.querySelector(selector)?.textContent ?? null
    return {
      liveStatus: text('[data-testid="pet-live-status"]'),
      diary: text('[data-testid="pet-diary"]'),
      skins: !!body.querySelector('[data-testid="pet-skins-input"]'),
      warnValue: body.querySelector('[data-testid="pet-usage-warn"]')?.value ?? null,
      highValue: body.querySelector('[data-testid="pet-usage-high"]')?.value ?? null,
    }
  })
  check('common', '设置里有活动流状态行', typeof sections?.liveStatus === 'string' && sections.liveStatus.length > 0, `「${sections?.liveStatus}」`)
  check('common', '设置里有每日日记块', typeof sections?.diary === 'string' && sections.diary.length > 0, `「${(sections?.diary ?? '').slice(0, 24)}」`)
  check('common', '设置里有图集导入入口', sections?.skins === true)
  check('common', '上下文预警阈值可调（默认 70/88）', sections?.warnValue === '70' && sections?.highValue === '88', `${sections?.warnValue}/${sections?.highValue}`)
  if (activity.ok) {
    const diaryLines = await page.evaluate(async () => {
      const response = await fetch('/pet/diary?lang=zh')
      if (!response.ok) return []
      const body = await response.json()
      return Array.isArray(body?.lines) ? body.lines : []
    })
    check('common', '日记接口返回可读短句', diaryLines.length >= 1 && typeof diaryLines[0] === 'string', `lines=${diaryLines.length}`)
  }
  await page.mouse.click(40, 40)
  await page.waitForTimeout(300)

  await page.evaluate(() => localStorage.removeItem('dsh-pet:settings:v1'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-sprite', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(400)
  const firstRun = await page.evaluate(() => ({
    char: document.querySelector('[data-dsh-pet]')?.getAttribute('data-char'),
    render: document.querySelector('[data-dsh-pet]')?.getAttribute('data-render'),
  }))
  check(WIDTHS[0].width, '新用户默认形象是噜噜', firstRun.char === 'lulu' && firstRun.render === 'sprite', `data-char=${firstRun.char} data-render=${firstRun.render}`)

  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 136 }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-sprite', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(400)

  const sprite = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const element = root.querySelector('.dsh-pet-sprite')
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const keyframes = document.getElementById('dsh-pet-sprite-style')?.textContent ?? ''
    return {
      render: root.getAttribute('data-render'),
      action: element.getAttribute('data-action'),
      image: style.backgroundImage,
      position: style.backgroundPosition,
      animation: style.animationName,
      duration: style.animationDuration,
      scale: root.style.getPropertyValue('--pet-sprite-scale'),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      actionCount: (keyframes.match(/@keyframes dsh-pet-sprite-lulu-/g) ?? []).length,
      hasIdleSlow: keyframes.includes('dsh-pet-sprite-lulu-idleSlow'),
      positions: keyframes.length,
    }
  })
  check(WIDTHS[0].width, '噜噜走位图渲染分支', sprite.render === 'sprite', `data-render=${sprite.render}`)
  check(WIDTHS[0].width, '图集走 host 直供（/pet/assets/lulu.webp）', /^url\("https?:\/\/[^"]*\/pet\/assets\/lulu\.webp"\)/.test(sprite.image), `${sprite.image.slice(0, 60)}…`)

  // 素材直供路由：ETag 回源、404、穿越、非 GET 都要挡住（这是 host 半唯一的新增面）
  const assetRoute = await page.evaluate(async () => {
    const call = async (path, headers) => {
      const response = await fetch(path, { headers })
      const body = response.status === 200 ? await response.arrayBuffer() : null
      return {
        status: response.status,
        type: response.headers.get('content-type'),
        length: Number(response.headers.get('content-length') ?? 0),
        etag: response.headers.get('etag'),
        bytes: body?.byteLength ?? 0,
      }
    }
    const cheer = await call('/pet/assets/anim-cheer.webm')
    const revalidated = await call('/pet/assets/anim-cheer.webm', { 'if-none-match': cheer.etag })
    const atlas = await call('/pet/assets/lulu.webp')
    const missing = await call('/pet/assets/nope.webp')
    const traversal = await call('/pet/assets/..%2Fpackage.json')
    const post = await fetch('/pet/assets/anim-cheer.webm', { method: 'POST' })
    return { cheer, revalidated, atlas, missing, traversal, postStatus: post.status }
  })
  check(
    WIDTHS[0].width,
    '素材直供：动作视频 200 + video/webm + 带 ETag',
    assetRoute.cheer.status === 200 && assetRoute.cheer.type === 'video/webm' && assetRoute.cheer.bytes > 50_000 && Boolean(assetRoute.cheer.etag),
    JSON.stringify(assetRoute.cheer),
  )
  check(
    WIDTHS[0].width,
    '素材直供：带 If-None-Match 回源拿 304（不重复传内容）',
    assetRoute.revalidated.status === 304 && assetRoute.revalidated.bytes === 0,
    JSON.stringify(assetRoute.revalidated),
  )
  check(
    WIDTHS[0].width,
    '素材直供：图集 200 image/webp',
    assetRoute.atlas.status === 200 && assetRoute.atlas.type === 'image/webp' && assetRoute.atlas.bytes > 100_000,
    JSON.stringify({ status: assetRoute.atlas.status, type: assetRoute.atlas.type, bytes: assetRoute.atlas.bytes }),
  )
  check(
    WIDTHS[0].width,
    '素材直供：未知素材 404 / 路径穿越 400 / 非 GET 405',
    assetRoute.missing.status === 404 && assetRoute.traversal.status === 400 && assetRoute.postStatus === 405,
    JSON.stringify({ missing: assetRoute.missing.status, traversal: assetRoute.traversal.status, post: assetRoute.postStatus }),
  )
  check(WIDTHS[0].width, '默认动作是 idle', sprite.action === 'idle', `data-action=${sprite.action}`)
  const durationMs = Math.round(parseFloat(sprite.duration) * (sprite.duration.endsWith('ms') ? 1 : 1000))
  check(WIDTHS[0].width, 'idle 关键帧绑定且一轮 1100ms', sprite.animation === 'dsh-pet-sprite-lulu-idle' && durationMs === 1100, `${sprite.animation} ${sprite.duration}`)
  check(WIDTHS[0].width, '动作表生成完整（9 动作 + 慢速 idle）', sprite.actionCount === 10 && sprite.hasIdleSlow, `${sprite.actionCount} 个 keyframes`)
  check(WIDTHS[0].width, '尺寸 136 档下缩放比正确', Math.abs(Number(sprite.scale) - 136 / 208) < 0.01, `scale=${sprite.scale}`)
  check(WIDTHS[0].width, '位图按比例渲染', Math.abs(sprite.height - 136) <= 2 && Math.abs(sprite.width - Math.round(192 * (136 / 208))) <= 2, `${sprite.width}×${sprite.height}px`)

  const posA = await page.evaluate(() => getComputedStyle(document.querySelector('.dsh-pet-sprite')).backgroundPosition)
  await page.waitForTimeout(420)
  const posB = await page.evaluate(() => getComputedStyle(document.querySelector('.dsh-pet-sprite')).backgroundPosition)
  check(WIDTHS[0].width, 'idle 动画在换帧（background-position 变化）', posA !== posB, `${posA} → ${posB}`)

  // 点一下：反应态应切到 wave
  await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click()
  await page.waitForTimeout(420)
  const afterPoke = await page.evaluate(() => ({
    action: document.querySelector('.dsh-pet-sprite')?.getAttribute('data-action'),
    state: document.querySelector('[data-dsh-pet]')?.getAttribute('data-state'),
  }))
  check(WIDTHS[0].width, '摸头时噜噜播 wave 动作', afterPoke.action === 'wave', `data-action=${afterPoke.action} data-state=${afterPoke.state}`)

  // 量真实输出：先开采样，再点两下（第一下解锁 AudioContext，第二下出声）
  const sampling = page.evaluate(async () => {
    const started = performance.now()
    let analyser = null
    while (!analyser && performance.now() - started < 1500) {
      analyser = window.__petAnalyser ?? null
      if (!analyser) await new Promise((resolve) => setTimeout(resolve, 20))
    }
    if (!analyser) return { peak: 0, samples: 0, missing: true }
    const data = new Float32Array(analyser.fftSize)
    let peak = 0
    let samples = 0
    const deadline = performance.now() + 900
    while (performance.now() < deadline) {
      analyser.getFloatTimeDomainData(data)
      for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]))
      samples += 1
      await new Promise((resolve) => setTimeout(resolve, 16))
    }
    return { peak, samples, missing: false }
  })
  await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click()
  await page.waitForTimeout(200)
  await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click()
  const loudness = await sampling
  check(
    WIDTHS[0].width,
    '点击音效实际输出峰值够响（量 AnalyserNode，默认 45% 应 ≥0.45）',
    !loudness.missing && loudness.peak >= 0.45 && loudness.peak <= 1,
    `peak=${loudness.peak.toFixed(3)} 采样 ${loudness.samples} 帧（旧实现约 0.15）`,
  )

  await page.waitForTimeout(1200)

  // ── 16 向注视：指针方向 → 图集行 9–10 的某一格 ────────────────────────
  const petCenter = await page.evaluate(() => {
    const rect = document.querySelector('[data-dsh-pet] .dsh-pet-figure').getBoundingClientRect()
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })
  const readGaze = () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-dsh-pet]')
      const element = root.querySelector('.dsh-pet-sprite')
      return {
        gaze: root.getAttribute('data-gaze'),
        position: element?.style.backgroundPosition ?? '',
        animation: element ? getComputedStyle(element).animationName : '',
      }
    })

  await page.mouse.move(petCenter.x - 420, petCenter.y - 2)
  await page.waitForTimeout(220)
  const gazeLeft = await readGaze()
  check(WIDTHS[0].width, '指针在正左 → 噜噜看左（行 10 第 5 格）', gazeLeft.gaze === 'look' && gazeLeft.position === '-768px -2080px', `data-gaze=${gazeLeft.gaze} pos=${gazeLeft.position}`)
  check(WIDTHS[0].width, '注视时停掉 idle 动画（静态帧，不叠在动画上）', gazeLeft.animation === 'none', `animation-name=${gazeLeft.animation}`)

  await page.mouse.move(petCenter.x + 2, petCenter.y - 420)
  await page.waitForTimeout(220)
  const gazeUp = await readGaze()
  check(WIDTHS[0].width, '指针在正上 → 噜噜看上（行 9 第 1 格）', gazeUp.gaze === 'look' && gazeUp.position === '0px -1872px', `data-gaze=${gazeUp.gaze} pos=${gazeUp.position}`)

  await page.mouse.move(petCenter.x + 2, petCenter.y + 2)
  await page.waitForTimeout(200)
  const gazeCenter = await readGaze()
  check(WIDTHS[0].width, '指针进 dead zone（28px 内）→ 回到 idle 动画', gazeCenter.gaze === 'idle' && gazeCenter.animation === 'dsh-pet-sprite-lulu-idle', `data-gaze=${gazeCenter.gaze} animation=${gazeCenter.animation}`)

  // 注意别移到视口外：宠物贴在右下角，y+240 会超出 900 高度，Playwright 就不发事件了
  await page.mouse.move(petCenter.x - 300, Math.min(petCenter.y + 140, 880))
  await page.waitForTimeout(280)
  const gazeBeforeIdle = await readGaze()
  await page.waitForTimeout(2600)
  const gazeAfterIdle = await readGaze()
  check(WIDTHS[0].width, '指针静止 2.2s 后不再死盯光标，自动回到 idle', gazeBeforeIdle.gaze === 'look' && gazeAfterIdle.gaze === 'idle', `${gazeBeforeIdle.gaze} → ${gazeAfterIdle.gaze}`)

  await page.screenshot({ path: join(OUT_DIR, `pet-lulu-${WIDTHS[0].width}x${WIDTHS[0].height}.png`) })

  // 后面的用例（超大档、菜单落点）假定形象是位图噜噜，这里把现场复原
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu' }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-sprite', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(300)

  // ── 只剩噜噜：位图噜噜按 11 行图集缩放（缩略图 800%×1100%） ──────────
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 136 }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-sprite', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(400)
  const luluOnly = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const sprite = root.querySelector('.dsh-pet-sprite')
    const style = getComputedStyle(sprite)
    const styles = [...document.querySelectorAll('style')].map((node) => node.textContent).join('\n')
    return {
      char: root.getAttribute('data-char'),
      animation: style.animationName,
      backgroundSize: style.backgroundSize,
      servedImage: /^url\("https?:\/\/[^"]*\/pet\/assets\/lulu\.webp"\)/.test(style.backgroundImage),
      idleLayers: root.querySelectorAll('.dsh-pet-idle').length,
      // 11 行图集：缩略图按 8 列 × 11 行缩放
      thumbRule: styles.includes("[data-char='lulu'] .dsh-pet-sprite-thumb { background-size: 800% 1100%"),
      // 至少 lulu 一张（用户自备的 u-*/a-* 形象会合法增加）
      cards: document.querySelectorAll('.dsh-pet-settings-char').length,
    }
  })
  check(WIDTHS[0].width, '位图噜噜走自己的动作表（idle 动画名带 lulu）', luluOnly.char === 'lulu' && luluOnly.animation === 'dsh-pet-sprite-lulu-idle', `data-char=${luluOnly.char} animation=${luluOnly.animation}`)
  check(WIDTHS[0].width, '图集走 host 直供', luluOnly.servedImage, `background-image=${luluOnly.servedImage}`)
  check(WIDTHS[0].width, '位图噜噜挂了一层常驻 idle 视频（闲时顶掉图集 idle 帧）', luluOnly.idleLayers === 1, `idle 层=${luluOnly.idleLayers}`)
  check(WIDTHS[0].width, '位图缩略图按 11 行图集缩放（800%×1100%）', luluOnly.thumbRule, `backgroundSize=${luluOnly.backgroundSize}`)

  // ── 右键菜单落点：贴边（尤其右上角）不许被视口裁掉 ──────────────────
  // 用户原话："噜噜如果在右上角，右键点击它弹窗会被页面边缘遮挡很多"
  const placePet = async (pos, dock, outfit) => {
    await page.evaluate(
      ({ pos, dock, outfit }) => {
        const key = 'dsh-pet:settings:v1'
        const current = JSON.parse(localStorage.getItem(key) ?? '{}')
        // 小视口（<1024px）默认 mobile:'hide' 会把宠物藏起来，摆位测试必须显式打开
        const next = { ...current, character: 'lulu', size: 104, dock, pos, mobile: 'show' }
        if (outfit !== undefined) next.outfit = outfit
        localStorage.setItem(key, JSON.stringify(next))
      },
      { pos, dock, outfit },
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-dsh-pet] .dsh-pet-figure', { timeout: 30000 })
    await page.waitForTimeout(350)
  }
  const openMenuAt = async () => {
    const figure = await page.locator('[data-dsh-pet] .dsh-pet-figure').first().boundingBox()
    await page.mouse.click(figure.x + figure.width / 2, figure.y + figure.height / 2, { button: 'right' })
    await page.waitForTimeout(320)
    return page.evaluate(() => {
      const menu = document.querySelector('[data-dsh-pet] .dsh-pet-menu')
      const rect = menu.getBoundingClientRect()
      return {
        open: document.querySelector('[data-dsh-pet]')?.getAttribute('data-menu'),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        vw: window.innerWidth,
        vh: window.innerHeight,
        items: menu.querySelectorAll('.dsh-pet-menu-item').length,
      }
    })
  }

  await placePet({ x: 0.965, y: 0.035 }, 'free')
  const topRightMenu = await openMenuAt()
  check(WIDTHS[0].width, '右上角右键菜单完全在视口内（左/上不越界）', topRightMenu.open === 'open' && topRightMenu.x >= 0 && topRightMenu.y >= 0, `x=${topRightMenu.x} y=${topRightMenu.y}`)
  check(WIDTHS[0].width, '右上角右键菜单完全在视口内（右/下不越界）', topRightMenu.x + topRightMenu.w <= topRightMenu.vw && topRightMenu.y + topRightMenu.h <= topRightMenu.vh, `right=${topRightMenu.x + topRightMenu.w}/${topRightMenu.vw} bottom=${topRightMenu.y + topRightMenu.h}/${topRightMenu.vh}`)
  check(WIDTHS[0].width, '右上角菜单条目仍可点（没有被裁成半截）', topRightMenu.items >= 6, `items=${topRightMenu.items}`)
  await page.screenshot({ path: join(OUT_DIR, `pet-menu-top-right-${WIDTHS[0].width}x${WIDTHS[0].height}.png`) })
  // 菜单里点一项要真的生效（说明没被裁到不可点）
  await page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /摸摸|Pet|Pat/ }).first().click()
  await page.waitForTimeout(300)
  check(WIDTHS[0].width, '右上角菜单点「摸摸」能触发（可点区域没被裁）', (await page.evaluate(() => document.querySelector('[data-dsh-pet]')?.getAttribute('data-bubble'))) === 'show')

  await placePet(null, 'right')
  const bottomRightMenu = await openMenuAt()
  check(WIDTHS[0].width, '默认右下角菜单同样不出界', bottomRightMenu.x >= 0 && bottomRightMenu.y >= 0 && bottomRightMenu.x + bottomRightMenu.w <= bottomRightMenu.vw && bottomRightMenu.y + bottomRightMenu.h <= bottomRightMenu.vh, `x=${bottomRightMenu.x} y=${bottomRightMenu.y} w=${bottomRightMenu.w} h=${bottomRightMenu.h}`)
  await page.evaluate(() => document.querySelector('[data-dsh-pet] .dsh-pet-menu-item')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 小视口：菜单限高 + 贴边，仍不许溢出
  await page.setViewportSize({ width: 420, height: 420 })
  await page.waitForTimeout(300)
  await placePet({ x: 0.5, y: 0.06 }, 'free')
  const tinyMenu = await openMenuAt()
  check('420x420', '小视口里菜单也不出界（限高生效）', tinyMenu.x >= 0 && tinyMenu.y >= 0 && tinyMenu.x + tinyMenu.w <= tinyMenu.vw && tinyMenu.y + tinyMenu.h <= tinyMenu.vh, `box=${tinyMenu.x},${tinyMenu.y} ${tinyMenu.w}×${tinyMenu.h} vp=${tinyMenu.vw}×${tinyMenu.vh}`)
  await page.setViewportSize(WIDTHS[0])
  await page.waitForTimeout(300)
  // 小视口那段把宠物留在了屏幕中上方，下面的拖拽回归需要它回到右下角
  await placePet(null, 'right')

  // 前面的段已经复原成位图噜噜，后面的用例（超大档）还有位图断言
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu' }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-sprite', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(300)

  // ── 装扮：位图角色加常驻配饰（用户嫌「太素」） ─────────────────
  const outfitLook = async () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-dsh-pet]')
      const svg = root.querySelector('.dsh-pet-outfit-svg')
      return {
        outfit: root.getAttribute('data-outfit'),
        hasLayer: Boolean(svg),
        markup: svg ? svg.innerHTML.slice(0, 2000) : '',
        chars: root.getAttribute('data-char'),
      }
    })

  await placePet(null, 'right', 'scarf')
  const scarfLook = await outfitLook()
  check(WIDTHS[0].width, '默认装扮是红围巾（不戴会显得素）', scarfLook.outfit === 'scarf' && scarfLook.hasLayer, `data-outfit=${scarfLook.outfit}`)
  check(WIDTHS[0].width, '围巾画在独立装扮层里（不污染角色 DOM）', scarfLook.markup.includes('dsh-pet-scarf-band'), scarfLook.hasLayer ? 'scarf-band ✓' : '无装扮层')

  await placePet(null, 'right', 'santa')
  const santaLook = await outfitLook()
  check(WIDTHS[0].width, '换圣诞帽能换掉上一件（不是叠加）', santaLook.outfit === 'santa' && santaLook.markup.includes('dsh-pet-santa-cone') && !santaLook.markup.includes('dsh-pet-scarf-band'), `data-outfit=${santaLook.outfit}`)
  await page.screenshot({ path: join(OUT_DIR, `pet-outfit-santa-${WIDTHS[0].width}x${WIDTHS[0].height}.png`) })

  await placePet(null, 'right', 'glasses')
  const glassesLook = await outfitLook()
  check(WIDTHS[0].width, '眼镜叠在眼睛位置（装扮坐标系对得上）', glassesLook.outfit === 'glasses' && glassesLook.markup.includes('dsh-pet-glasses-lens'), `data-outfit=${glassesLook.outfit}`)

  // 右键菜单「换装扮」要能循环切换
  await placePet(null, 'right', 'none')
  const figureBox = await page.locator('[data-dsh-pet] .dsh-pet-figure').first().boundingBox()
  await page.mouse.click(figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2, { button: 'right' })
  await page.waitForTimeout(300)
  const outfitItem = page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /换装扮|Change outfit/ }).first()
  const outfitMenuText = await outfitItem.textContent()
  await outfitItem.click()
  await page.waitForTimeout(300)
  const afterCycle = await outfitLook()
  check(WIDTHS[0].width, '右键菜单能换装扮，且菜单项写着当前装扮', /不戴|None/.test(outfitMenuText ?? '') && afterCycle.outfit === 'scarf', `菜单项「${outfitMenuText}」→ data-outfit=${afterCycle.outfit}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // 清掉本地设置，回到「新用户默认」，别把验收现场留给下一个人
  await page.evaluate(() => localStorage.removeItem('dsh-pet:settings:v1'))

  // 拖拽：用户报过「宠物没办法移动」（旧的 35% 吸附判据 = 拖到哪都弹回角落），
  // 这里把三个真实场景都钉死：小幅横拖不回弹、竖直拖不住下坠、贴边才吸附且保住纵向位置。
  await page.setViewportSize(WIDTHS[0])
  await page.waitForTimeout(300)

  const petLook = () => page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const rect = root.getBoundingClientRect()
    return {
      dock: root.getAttribute('data-dock'),
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      left: root.style.left,
      top: root.style.top,
      pos: JSON.parse(localStorage.getItem('dsh-pet:settings:v1') ?? '{}').pos ?? null,
    }
  })

  const dragTo = async (targetX, targetY) => {
    const box = await page.locator('[data-dsh-pet] .dsh-pet-figure').first().boundingBox()
    const fromX = box.x + box.width / 2
    const fromY = box.y + box.height / 2
    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move((fromX + targetX) / 2, (fromY + targetY) / 2, { steps: 6 })
    await page.mouse.move(targetX, targetY, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(420)
    return petLook()
  }

  const resetCorner = async () => {
    await page.evaluate(() => {
      const key = 'dsh-pet:settings:v1'
      const current = JSON.parse(localStorage.getItem(key) ?? '{}')
      localStorage.setItem(key, JSON.stringify({ ...current, dock: 'right', pos: null }))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
    await page.waitForTimeout(400)
  }

  const corner = await petLook()
  const small = await dragTo(corner.x - 180, corner.y - 0)
  check(WIDTHS[0].width, '横拖 180px 后停在松手处（不回弹）', small.dock === 'free' && small.x < corner.x - 120, `dock=${small.dock} x=${small.x}（角落原为 ${corner.x}）`)

  await resetCorner()
  const up = await dragTo(corner.x, corner.y - 220)
  check(WIDTHS[0].width, '竖直拖 220px 后停在松手处（不掉回底部）', up.dock === 'free' && up.y < corner.y - 150, `dock=${up.dock} y=${up.y}（底部原为 ${corner.y}）`)

  await resetCorner()
  const edge = await dragTo(24, Math.round(WIDTHS[0].height * 0.42))
  check(WIDTHS[0].width, '拖到左边缘才吸附 left', edge.dock === 'left', `dock=${edge.dock} x=${edge.x}`)
  check(WIDTHS[0].width, '吸附后保住纵向位置（不再掉回底部）', edge.y < Math.round(WIDTHS[0].height * 0.6), `y=${edge.y}（底部角落为 ${corner.y}）`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(500)
  const afterReload = await petLook()
  check(WIDTHS[0].width, '刷新后位置保持（吸附状态与纵向位置都记住）', afterReload.dock === 'left' && Math.abs(afterReload.y - edge.y) <= 16, `dock=${afterReload.dock} y=${afterReload.y}`)

  // 「回到角落」菜单项要能把宠物收回右下角
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, dock: 'right', pos: null }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(400)
  const backHome = await petLook()
  check(WIDTHS[0].width, '恢复右下角默认落点', backHome.dock === 'right' && Math.abs(backHome.y - corner.y) <= 8, `dock=${backHome.dock} y=${backHome.y}`)

  // 设置浮层的点关闭：用户报过「打开设置后点内部任何一处都会关掉」。
  // 根因是每次打开都往 document 挂一份 pointerdown 监听、关闭却不注销，
  // 上一次浮层留下的监听器会把新浮层里的点击判成"外部点击"。
  const openSettingsMenu = async () => {
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(260)
    await page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /宠物设置|Pet settings/ }).first().click()
    await page.waitForSelector('.dsh-pet-popover .dsh-pet-settings', { timeout: 8000 })
    await page.waitForTimeout(200)
  }
  const popoverCount = () => page.evaluate(() => document.querySelectorAll('.dsh-pet-popover').length)

  await openSettingsMenu()
  await page.locator('.dsh-pet-popover [data-testid="pet-size"]').selectOption('136')
  await page.waitForTimeout(300)
  check(WIDTHS[0].width, '点设置浮层内部的控件不会关掉浮层', (await popoverCount()) === 1, `浮层数=${await popoverCount()}`)
  const sized = await page.evaluate(() => JSON.parse(localStorage.getItem('dsh-pet:settings:v1') ?? '{}').size)
  check(WIDTHS[0].width, '浮层里的改动真的落盘（改了尺寸）', sized === 136, `size=${sized}`)

  // 超大档：200px（clamp 上限），位图按 200/208 放大
  await page.locator('.dsh-pet-popover [data-testid="pet-size"]').selectOption('200')
  await page.waitForTimeout(350)
  const huge = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const rect = root.getBoundingClientRect()
    const sprite = root.querySelector('.dsh-pet-sprite')
    const spriteRect = sprite?.getBoundingClientRect()
    const select = document.querySelector('.dsh-pet-popover [data-testid="pet-size"]')
    return {
      size: JSON.parse(localStorage.getItem('dsh-pet:settings:v1') ?? '{}').size,
      width: Math.round(rect.width),
      options: select ? Array.from(select.options).map((option) => option.value) : [],
      label: select?.selectedOptions?.[0]?.textContent ?? '',
      sprite: spriteRect ? { w: Math.round(spriteRect.width), h: Math.round(spriteRect.height) } : null,
    }
  })
  check(WIDTHS[0].width, '大小档位有 4 档（含超大 200px）', huge.options.join(',') === '76,104,136,200', `options=${huge.options.join(',')}`)
  check(WIDTHS[0].width, '超大档生效且不越界（clamp 上限 200px）', huge.size === 200 && huge.width === 200, `size=${huge.size} 实际宽=${huge.width}px`)
  check(WIDTHS[0].width, '超大档位下位图按比例放大', !!huge.sprite && Math.abs(huge.sprite.h - 200) <= 2 && Math.abs(huge.sprite.w - 186) <= 3, `sprite=${huge.sprite?.w}×${huge.sprite?.h}px`)
  await page.screenshot({ path: join(OUT_DIR, 'pet-huge-1440x900.png'), clip: { x: 0, y: Math.max(0, 900 - 420), width: 520, height: 420 } })

  // 关掉再打开（这一步会留下旧监听器，是用户遇到问题的路径）
  await page.locator('.dsh-pet-popover-header button').last().click()
  await page.waitForTimeout(300)
  check(WIDTHS[0].width, '点 ✕ 能关掉浮层', (await popoverCount()) === 0)
  await openSettingsMenu()
  await page.locator('.dsh-pet-popover-body div').first().click()
  await page.waitForTimeout(400)
  check(WIDTHS[0].width, '重新打开的浮层，点内部仍然不关闭（回归）', (await popoverCount()) === 1, `浮层数=${await popoverCount()}`)

  // 点浮层外面要关
  await page.mouse.click(40, 40)
  await page.waitForTimeout(350)
  check(WIDTHS[0].width, '点浮层外部会关闭浮层', (await popoverCount()) === 0)

  await page.evaluate(() => localStorage.removeItem('dsh-pet:settings:v1'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet]', { timeout: 30000 })
  await page.waitForTimeout(400)

  // ── 原生动作：透明 WebM 视频（12 个动作全部一动作一条视频）─────────────────
  // 位图形象原来靠 SVG 手臂/道具「拼」动作。现在优先铺一条带 alpha 的动作视频
  // （<video> 直接播，不受 8×11 图集协议的帧数限制），解码失败才退回横向胶片条。
  // 注意 petSpriteMarkup 一次返回三个兄弟节点（本体 + 胶片条 + 视频），渲染层曾经
  // 只挂第一个，导致动作层永远进不了 DOM —— 下面就是这条的回归护栏。
  const playNativeAction = async (id) => {
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(200)
    await page.locator(`[data-dsh-pet] [data-action-id="${id}"]`).first().click()
    await page.waitForTimeout(340)
    return page.evaluate(() => {
      const root = document.querySelector('[data-dsh-pet]')
      const clip = root.querySelector('.dsh-pet-clip')
      const video = root.querySelector('.dsh-pet-video')
      const sprite = root.querySelector('.dsh-pet-sprite')
      const style = clip ? getComputedStyle(clip) : null
      const videoStyle = video ? getComputedStyle(video) : null
      const layerDisplay = (selector) => {
        const node = root.querySelector(selector)
        return node ? getComputedStyle(node).display : null
      }
      const box = (node) => (node ? node.getBoundingClientRect() : null)
      const spriteBox = box(sprite)
      const videoBox = box(video)
      return {
        char: root.getAttribute('data-char'),
        act: root.getAttribute('data-act'),
        mode: root.getAttribute('data-clip-active'),
        active: root.hasAttribute('data-clip-active'),
        clipId: clip?.getAttribute('data-clip') ?? null,
        display: style?.display ?? null,
        name: style?.animationName ?? null,
        duration: style?.animationDuration ?? null,
        size: style?.backgroundSize ?? null,
        videoDisplay: videoStyle?.display ?? null,
        videoSrc: (video?.getAttribute('src') ?? '').slice(0, 160),
        idleActive: root.hasAttribute('data-idle-video'),
        idleDisplay: layerDisplay('.dsh-pet-idle'),
        videoPaused: video?.paused ?? null,
        videoTime: video?.currentTime ?? null,
        videoDuration: video?.duration ?? null,
        videoW: videoBox ? Math.round(videoBox.width) : null,
        videoH: videoBox ? Math.round(videoBox.height) : null,
        videoBottom: videoBox ? Math.round(videoBox.bottom) : null,
        spriteW: spriteBox ? Math.round(spriteBox.width) : null,
        spriteH: spriteBox ? Math.round(spriteBox.height) : null,
        spriteBottom: spriteBox ? Math.round(spriteBox.bottom) : null,
        spriteVisibility: sprite ? getComputedStyle(sprite).visibility : null,
        prop: layerDisplay('.dsh-pet-prop-layer'),
        outfit: layerDisplay('.dsh-pet-outfit-layer'),
      }
    })
  }

  const defaultRender = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    return {
      char: root.getAttribute('data-char'),
      clips: root.querySelectorAll('.dsh-pet-clip').length,
      videos: root.querySelectorAll('.dsh-pet-video').length,
      idles: root.querySelectorAll('.dsh-pet-idle').length,
      bodies: root.querySelectorAll('.dsh-pet-sprite').length,
    }
  })
  check(
    WIDTHS[0].width,
    '位图形象挂载了原生动作层（本体 + 胶片条 + 视频 + idle 视频各一层）',
    defaultRender.char === 'lulu' && defaultRender.clips === 1 && defaultRender.videos === 1 && defaultRender.idles === 1 && defaultRender.bodies === 1,
    JSON.stringify(defaultRender),
  )

  // 闲时：常驻 idle 视频接管（3.75s 循环），位图 idle 帧让位；顺手取得图集 URL
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 136, liveFeed: false }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-clip', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(500)
  const idleState = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const sprite = root.querySelector('.dsh-pet-sprite')
    const clip = root.querySelector('.dsh-pet-clip')
    const video = root.querySelector('.dsh-pet-video')
    return {
      char: root.getAttribute('data-char'),
      render: root.getAttribute('data-render'),
      action: sprite.getAttribute('data-action'),
      atlas: getComputedStyle(sprite).backgroundImage,
      clipDisplay: getComputedStyle(clip).display,
      videoDisplay: getComputedStyle(video).display,
      clips: root.querySelectorAll('.dsh-pet-clip').length,
      videos: root.querySelectorAll('.dsh-pet-video').length,
      idleLayers: root.querySelectorAll('.dsh-pet-idle').length,
      idleDisplay: getComputedStyle(root.querySelector('.dsh-pet-idle')).display,
      idleSrc: root.querySelector('.dsh-pet-idle')?.currentSrc ?? '',
      idlePaused: root.querySelector('.dsh-pet-idle')?.paused ?? null,
      idleDuration: root.querySelector('.dsh-pet-idle')?.duration ?? 0,
      spriteVisibility: getComputedStyle(sprite).visibility,
    }
  })
  check(
    WIDTHS[0].width,
    '闲时位图本体在跑 idle（胶片条与动作视频都收着）',
    idleState.char === 'lulu' && idleState.render === 'sprite' && idleState.action === 'idle' && idleState.clips === 1,
    JSON.stringify({ char: idleState.char, render: idleState.render, action: idleState.action, clips: idleState.clips }),
  )
  check(
    WIDTHS[0].width,
    '闲时原生动作层都隐藏（不挡住本体）',
    idleState.clipDisplay === 'none' && idleState.videoDisplay === 'none' && idleState.clips === 1 && idleState.videos === 1,
    JSON.stringify({ clip: idleState.clipDisplay, video: idleState.videoDisplay, clips: idleState.clips, videos: idleState.videos }),
  )
  check(
    WIDTHS[0].width,
    '闲时用常驻 idle 视频（3.75s 循环，顶掉图集 idle 帧）',
    idleState.idleLayers === 1
      && idleState.idleDisplay === 'block'
      && /\/pet\/assets\/idle-loop\.webm/.test(idleState.idleSrc)
      && idleState.idlePaused === false
      && Math.abs(idleState.idleDuration - 3.75) < 0.2
      && idleState.spriteVisibility === 'hidden',
    JSON.stringify({ layers: idleState.idleLayers, display: idleState.idleDisplay, src: idleState.idleSrc, paused: idleState.idlePaused, dur: idleState.idleDuration, sprite: idleState.spriteVisibility }),
  )

  // 回归：连续应用设置（大小/装扮来回改）不能叠出第二套本体层。
  // 旧实现换形象时按 class 名单删旧节点，每加一层新素材就漏删一次
  // （clip → video → idle 连漏三次），表现就是「后面还站着另一只噜噜」。
  const changeSettings = async (pick) => {
    await page.locator('[data-dsh-pet] .dsh-pet-figure').first().click({ button: 'right' })
    await page.waitForTimeout(200)
    await page.locator('[data-dsh-pet] .dsh-pet-menu-item', { hasText: /宠物设置|Pet settings/ }).first().click()
    await page.waitForSelector('.dsh-pet-popover .dsh-pet-settings', { timeout: 8000 })
    await pick()
    await page.waitForTimeout(250)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  const sizeSelect = () => page.locator('.dsh-pet-popover [data-testid="pet-size"]').first()
  const outfitSelect = () => page.locator('.dsh-pet-popover [data-testid="pet-outfit"]').first()
  await changeSettings(() => sizeSelect().selectOption('200'))
  await changeSettings(() => outfitSelect().selectOption('beret'))
  await changeSettings(() => sizeSelect().selectOption('136'))
  await changeSettings(() => outfitSelect().selectOption('scarf'))
  await page.waitForTimeout(1200)
  const afterReapply = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const bodies = [...root.querySelectorAll('.dsh-pet-sprite, .dsh-pet-idle, .dsh-pet-video, .dsh-pet-clip')].filter((node) => {
      const style = getComputedStyle(node)
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
    })
    return {
      char: root.getAttribute('data-char'),
      idleLayers: root.querySelectorAll('.dsh-pet-idle').length,
      sprites: root.querySelectorAll('.dsh-pet-sprite').length,
      visible: bodies.map((node) => node.className),
    }
  })
  check(
    WIDTHS[0].width,
    '连续应用设置不会叠出第二套本体层（不会出现「两只噜噜」）',
    afterReapply.char === 'lulu' && afterReapply.idleLayers === 1 && afterReapply.sprites === 1 && afterReapply.visible.length === 1,
    JSON.stringify(afterReapply),
  )

  const cheerState = await playNativeAction('cheer')
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：走原生动作视频（不是 SVG 组件）',
    cheerState.mode === 'video' && cheerState.videoDisplay === 'block' && cheerState.clipId === null,
    JSON.stringify({ mode: cheerState.mode, video: cheerState.videoDisplay, clipId: cheerState.clipId }),
  )
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：透明 WebM 已加载并在播',
    /\/pet\/assets\/anim-cheer\.webm/.test(cheerState.videoSrc) && cheerState.videoPaused === false && (cheerState.videoTime ?? 0) > 0.05,
    JSON.stringify({ src: cheerState.videoSrc, paused: cheerState.videoPaused, t: cheerState.videoTime, dur: cheerState.videoDuration }),
  )
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：视频时长贴合动作（1.8s 动作配 1.83s 片段）',
    Math.abs((cheerState.videoDuration ?? 0) - 1.83) < 0.15,
    `duration=${cheerState.videoDuration}`,
  )
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：视频层与位图本体同尺寸、同底边（换动作不跳位）',
    cheerState.videoW === cheerState.spriteW
      && cheerState.videoH === cheerState.spriteH
      && Math.abs((cheerState.videoBottom ?? 0) - (cheerState.spriteBottom ?? 0)) <= 1,
    JSON.stringify({ video: [cheerState.videoW, cheerState.videoH, cheerState.videoBottom], sprite: [cheerState.spriteW, cheerState.spriteH, cheerState.spriteBottom] }),
  )
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：常驻 idle 视频让位（不和动作视频叠着播）',
    cheerState.idleActive === false && cheerState.idleDisplay === 'none',
    JSON.stringify({ idleActive: cheerState.idleActive, idleDisplay: cheerState.idleDisplay }),
  )
  check(
    WIDTHS[0].width,
    '噜噜鼓掌：本体与 SVG 道具/装扮层一起让位',
    cheerState.spriteVisibility === 'hidden' && cheerState.prop === 'none' && cheerState.outfit === 'none',
    JSON.stringify({ sprite: cheerState.spriteVisibility, prop: cheerState.prop, outfit: cheerState.outfit }),
  )
  await page.screenshot({ path: join(OUT_DIR, 'pet-cheer.png'), clip: { x: 1150, y: Math.max(0, WIDTHS[0].height - 640), width: 290, height: 640 } })
  await page.waitForTimeout(1900)

  // 12 个动作现在都有专属视频：逐个触发，确认全部走视频层（不再靠 SVG 道具/手臂拼），
  // 而且 src 真的是内联的透明 WebM。
  const ALL_ACTIONS = ['newyear', 'lion', 'fireworks', 'redpacket', 'fu', 'dumpling', 'shy', 'cheer', 'dizzy', 'spin', 'roll', 'hop']
  const missing = []
  for (const id of ALL_ACTIONS) {
    const played = await playNativeAction(id)
    const ok = played.mode === 'video'
      && played.videoSrc.includes('/pet/assets/anim-')
      && played.videoDisplay === 'block'
    if (!ok) missing.push({ id, act: played.act, mode: played.mode, src: played.videoSrc, display: played.videoDisplay })
    await page.waitForTimeout(120)
  }
  check(
    WIDTHS[0].width,
    `12 个专属动作全部由透明 WebM 播放（检查 ${ALL_ACTIONS.length} 个）`,
    missing.length === 0,
    JSON.stringify({ missing }),
  )
  await page.waitForTimeout(1400)

  const afterClips = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-pet]')
    const sprite = root.querySelector('.dsh-pet-sprite')
    const video = root.querySelector('.dsh-pet-video')
    const idle = root.querySelector('.dsh-pet-idle')
    return {
      active: root.hasAttribute('data-clip-active'),
      act: root.getAttribute('data-act'),
      visibility: sprite ? getComputedStyle(sprite).visibility : null,
      videoDisplay: video ? getComputedStyle(video).display : null,
      videoPaused: video?.paused ?? null,
      idleActive: root.hasAttribute('data-idle-video'),
      idleDisplay: idle ? getComputedStyle(idle).display : null,
    }
  })
  check(
    WIDTHS[0].width,
    '动作演完：视频收起并暂停、本体/idle 视频恢复、没有残留 data-act',
    !afterClips.active
      && !afterClips.act
      && (afterClips.idleActive ? afterClips.idleDisplay === 'block' && afterClips.visibility === 'hidden' : afterClips.visibility === 'visible')
      && afterClips.videoDisplay === 'none'
      && afterClips.videoPaused === true,
    JSON.stringify(afterClips),
  )

  // 重新加载：动作层仍只有一份（不能被上一次演出的节点留在 DOM 里）
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, character: 'lulu', size: 104 }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-clip', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(500)
  const luluAfter = await page.evaluate(() => ({
    char: document.querySelector('[data-dsh-pet]').getAttribute('data-char'),
    clips: document.querySelectorAll('[data-dsh-pet] .dsh-pet-clip').length,
    videos: document.querySelectorAll('[data-dsh-pet] .dsh-pet-video').length,
  }))
  check(
    WIDTHS[0].width,
    '切回 lulu 后动作层只剩一份（旧节点被一起换掉）',
    luluAfter.char === 'lulu' && luluAfter.clips === 1 && luluAfter.videos === 1,
    JSON.stringify(luluAfter),
  )
  const luluCheer = await playNativeAction('cheer')
  check(
    WIDTHS[0].width,
    'lulu 默认形象也走原生鼓掌视频',
    luluCheer.mode === 'video' && luluCheer.videoPaused === false && luluCheer.spriteVisibility === 'hidden',
    JSON.stringify({ mode: luluCheer.mode, paused: luluCheer.videoPaused, sprite: luluCheer.spriteVisibility }),
  )
  await page.waitForTimeout(1900)

  // 关掉动效：视频不该再播（不然「减少动态效果」形同虚设），退回胶片条定格第一帧
  await page.evaluate(() => {
    const key = 'dsh-pet:settings:v1'
    const current = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, motion: 'off' }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-pet] .dsh-pet-clip', { state: 'attached', timeout: 30000 })
  await page.waitForTimeout(500)
  const quietCheer = await playNativeAction('cheer')
  check(
    WIDTHS[0].width,
    '关掉动效时不放视频，退回胶片条（定格第一帧）',
    quietCheer.mode === 'strip' && quietCheer.videoDisplay === 'none' && quietCheer.display === 'block',
    JSON.stringify({ mode: quietCheer.mode, video: quietCheer.videoDisplay, clip: quietCheer.display }),
  )
  await page.waitForTimeout(1900)

  check('common', '没有意外的控制台报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await browser.close()

  const failed = results.filter((entry) => !entry.ok)
  const report = {
    url: url.replace(/token=[A-Za-z0-9_-]+/, 'token=***'),
    at: new Date().toISOString(),
    viewports: WIDTHS,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  }
  writeFileSync(join(OUT_DIR, 'verify-ui.json'), `${JSON.stringify(report, null, 2)}\n`)

  console.log(`\n${failed.length === 0 ? '✓ 验收通过' : '✗ 验收失败'}：${report.passed}/${report.total} 项，报告 ${join(OUT_DIR, 'verify-ui.json')}`)
  if (failed.length) {
    for (const entry of failed) console.log(`  ✗ [${entry.viewport}] ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`✗ 验收脚本出错：${error.stack ?? error.message}`)
  process.exit(2)
})
