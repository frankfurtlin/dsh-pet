/**
 * dsh-pet 单元测试（node --test，无需浏览器）。
 *
 * 覆盖的是「改坏了能立刻发现」的那几类问题，而不是把实现抄一遍：
 *   · 包名/版本/补丁 id 三处必须一致（对不上会导致模块表找不到 bundle）；
 *   · 角色配色的 JS 事实来源与 CSS 必须一致（两边漂移就会出现"预览和实际不同色"）；
 *   · 中英字典键集合必须相同（漏键会直接显示 key 名）；
 *   · store 的等级数学、持久化、跨天连续天数；
 *   · 状态推导的优先级与事件检测；
 *   · 构建产物是最新的、形状是 ModuleLoader 认的那一种、导出名字对；
 *   · bundle 里没有会截断 script 的 `</script`。
 *
 * 浏览器里的真实表现由 scripts/verify-ui.mjs（Playwright）负责，两者不重叠。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')
const readJson = (path) => JSON.parse(read(path))

/**
 * 在隔离的 vm 上下文里加载若干源文件。
 *
 * 注意：源文件用 `const` / `function` 声明，而脚本级 `const` 不会变成 globalThis
 * 的属性，所以取值必须回到上下文里求值，不能读 `context.PET_X`。
 */
function loadSources(files, extras = {}) {
  const context = createContext({
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    ...extras,
  })
  for (const file of files) {
    runInContext(read(`client-src/${file}`), context, { filename: file })
  }
  const get = (name) => runInContext(`typeof ${name} === 'undefined' ? undefined : ${name}`, context)
  return { get, run: (code) => runInContext(code, context) }
}

/** 等 store 的 250ms 防抖写盘落地。 */
const settle = () => new Promise((done) => setTimeout(done, 320))

function fakeLocalStorage(store = new Map()) {
  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
}

function assertSameSet(actual, expected, label) {
  const missing = [...expected].filter((key) => !actual.has(key))
  const extra = [...actual].filter((key) => !expected.has(key))
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${label} 不一致`)
}

test('包名、版本、补丁 id 三处一致', () => {
  const pkg = readJson('package.json')
  assert.equal(pkg.name, 'dsh-pet')
  const patch = read('cordis.patch.yml')
  assert.match(patch, new RegExp(`id: ${pkg.name}\\b`), 'cordis.patch.yml 的 id 必须等于包名')
  assert.match(patch, new RegExp(`name: ${pkg.name}\\b`))
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.dsh.bundle.patch, '必须声明 dsh.bundle.patch')
  assert.equal(pkg.exports['./client'].default, './client.js')
  // 故意不写 engines.dsh：管太死会让每次 DSH 升级都变成"插件不兼容"
  assert.equal(pkg.engines, undefined, '不要声明 engines.dsh')
})

test('内置形象只剩一只位图噜噜', () => {
  const { get } = loadSources(['characters.js'])
  const characters = get('PET_CHARACTERS')
  assert.equal(characters.length, 1, '只保留噜噜一只形象')
  assert.equal(characters[0].id, 'lulu')
  assert.equal(characters[0].kind, 'sprite', '噜噜走位图，不再有矢量形象')
  // 位图角色的配色烘焙在素材里，不该再挂 palette
  assert.equal(characters[0].palette, undefined)
  // 未知 id 要回落到唯一形象，别让坏配置把宠物整只弄没
  assert.equal(get('petCharacter')('nope').id, 'lulu')
})

test('位图形象：图集协议、动作表与构建期素材内联', () => {
  const { get } = loadSources(['characters.js'])
  const characters = get('PET_CHARACTERS')
  assert.equal(characters.length, 1, '内置形象只剩一只位图噜噜')

  const lulu = characters.find((character) => character.id === 'lulu')
  assert.ok(lulu, '缺少噜噜')
  assert.equal(lulu.kind, 'sprite')
  assert.equal(lulu.sprite.frameW, 192)
  assert.equal(lulu.sprite.frameH, 208)
  assert.equal(lulu.sprite.cols, 8)
  assert.equal(lulu.sprite.rows, 11)

  // Codex pet 协议 v2：行 0–8 九个动作，有效帧数固定；校验它们没被改错位
  const expected = {
    idle: { row: 0, frames: 6 },
    runRight: { row: 1, frames: 8 },
    runLeft: { row: 2, frames: 8 },
    wave: { row: 3, frames: 4 },
    jump: { row: 4, frames: 5 },
    failed: { row: 5, frames: 8 },
    waiting: { row: 6, frames: 6 },
    working: { row: 7, frames: 6 },
    review: { row: 8, frames: 6 },
  }
  assertSameSet(new Set(Object.keys(lulu.sprite.actions)), new Set(Object.keys(expected)), '动作表')
  for (const [name, want] of Object.entries(expected)) {
    const action = lulu.sprite.actions[name]
    assert.equal(action.row, want.row, `${name} 的行号`)
    assert.equal(action.steps.length, want.frames, `${name} 的帧数`)
    assert.ok(action.steps.every((step) => Number.isInteger(step) && step > 0), `${name} 的每帧时长应为正整数毫秒`)
  }
  // 慢速 idle 复用第 0 行，但整轮时长约为正常 idle 的 1.8 倍（睡觉用）
  const idleMs = lulu.sprite.actions.idle.steps.reduce((sum, step) => sum + step, 0)
  const slowMs = lulu.sprite.idleSlow.steps.reduce((sum, step) => sum + step, 0)
  assert.equal(lulu.sprite.idleSlow.row, 0)
  assert.equal(lulu.sprite.idleSlow.steps.length, 6)
  assert.ok(Math.abs(slowMs / idleMs - 1.8) < 0.02, `慢速 idle 应为 1.8 倍（实际 ${(slowMs / idleMs).toFixed(2)}）`)

  // 状态 → 动作的投影，以及拖拽方向
  assert.equal(get('petSpriteAction')('lulu', 'idle', 'right'), 'idle')
  assert.equal(get('petSpriteAction')('lulu', 'thinking', 'right'), 'working')
  assert.equal(get('petSpriteAction')('lulu', 'alert', 'right'), 'waiting')
  assert.equal(get('petSpriteAction')('lulu', 'celebrate', 'right'), 'jump')
  assert.equal(get('petSpriteAction')('lulu', 'happy', 'right'), 'wave')
  assert.equal(get('petSpriteAction')('lulu', 'sleep', 'right'), 'idleSlow')
  assert.equal(get('petSpriteAction')('lulu', 'drag', 'left'), 'runLeft')
  assert.equal(get('petSpriteAction')('lulu', 'drag', 'right'), 'runRight')

  // 生成的 CSS：一个角色 10 组 keyframes + 背景图规则 + 换帧用 background-position
  const css = get('petSpriteCss')()
  assert.equal((css.match(/@keyframes dsh-pet-sprite-lulu-/g) ?? []).length, 10, '应有 9 动作 + 慢速 idle 共 10 组 keyframes')
  assert.match(css, /\[data-char='lulu'\] \.dsh-pet-sprite,[^{]*\{ background-image: url\("__DSH_PET_ASSET_LULU__"\)/)
  assert.match(css, /background-position: -192px -208px/, 'runRight 第 2 帧应平移到第 2 列第 2 行')
  assert.match(css, /background-position: -1344px -416px/, 'runLeft 最后一帧应在第 8 列第 3 行')
  assert.match(css, /\[data-action='idle'\] \{ animation-name: dsh-pet-sprite-lulu-idle; animation-duration: 1100ms; \}/)
  // 离散换帧（每帧停住，不做插值）由静态样式表统一给，不在生成 CSS 里
  assert.match(read('styles/pet.css'), /animation-timing-function: steps\(1, end\)/)
  assert.match(read('styles/pet.css'), /\.dsh-pet-sprite \{[^}]*background-size: 800% 1100%/)

  // 素材文件：存在、体积在预算内、构建期被内联
  const asset = join(ROOT, 'assets/lulu.webp')
  assert.ok(existsSync(asset), '缺少 assets/lulu.webp')
  const assetBytes = readFileSync(asset).byteLength
  assert.ok(assetBytes > 100_000, '图集太小，像是导错了文件')
  assert.ok(assetBytes < 512 * 1024, `图集 ${(assetBytes / 1024).toFixed(0)}KB 超出 512KB 预算`)
  const bundle = read('client.js')
  assert.ok(!bundle.includes('__DSH_PET_ASSET_'), '构建产物里不应残留素材占位符')
  assert.match(bundle, /data:image\/webp;base64,[A-Za-z0-9+/=]{1000}/, '图集应内联为 data URI')
})

test('16 向注视：角度→注视帧→图集格子', () => {
  const { get } = loadSources(['characters.js'])
  const gaze = get('petSpriteGaze')('lulu')
  assert.ok(gaze, '位图角色必须带注视帧表')
  assert.deepEqual([...gaze.rows], [9, 10], '注视帧在协议的行 9–10')
  assert.equal(gaze.count, 16)
  assert.equal(gaze.stepDeg, 22.5)

  const index = get('petSpriteGazeIndex')
  // 屏幕坐标：0°=右、90°=下（atan2(dy,dx)）；第 0 格朝正上，逐格顺时针 22.5°
  assert.equal(index('lulu', -90), 0, '正上')
  assert.equal(index('lulu', -67.5), 1)
  assert.equal(index('lulu', 0), 4, '正右')
  assert.equal(index('lulu', 90), 8, '正下')
  assert.equal(index('lulu', 180), 12, '正左')
  assert.equal(index('lulu', -270), 8, '跨 0° 环绕等价')

  const cell = get('petSpriteGazeCell')
  assert.deepEqual({ ...cell('lulu', 0) }, { index: 0, row: 9, col: 0, x: 0, y: -1872 })
  assert.deepEqual({ ...cell('lulu', 7) }, { index: 7, row: 9, col: 7, x: -1344, y: -1872 })
  assert.deepEqual({ ...cell('lulu', 8) }, { index: 8, row: 10, col: 0, x: 0, y: -2080 })
  assert.deepEqual({ ...cell('lulu', 12) }, { index: 12, row: 10, col: 4, x: -768, y: -2080 })
  assert.equal(cell('lulu', 16).index, 0, '越界索引应回绕')
  // 16 格必须全部落在 9–10 行内，不能读到图集外面
  for (let i = 0; i < 16; i += 1) {
    const current = cell('lulu', i)
    assert.ok(current.row === 9 || current.row === 10, `第 ${i} 格行号越界：${current.row}`)
    assert.ok(current.col >= 0 && current.col <= 7)
  }
})

test('中英字典键集合一致，占位符能正确替换', () => {
  const { get } = loadSources(['i18n.js'])
  const dict = get('PET_MESSAGES')
  assertSameSet(new Set(Object.keys(dict.zh)), new Set(Object.keys(dict.en)), '中英键集合')

  const zh = get('petTranslator')('zh')
  const en = get('petTranslator')('en')
  assert.equal(zh('levelUp', { level: 3 }), '升到 3 级啦！')
  assert.equal(en('levelUp', { level: 3 }), 'Level 3!')
  assert.equal(zh('thinking', { n: 2 }), '正在为你处理 2 个任务…')
  // 未注册语言回落英文；未知 key 原样返回，方便在页面上发现漏译
  assert.equal(get('petTranslator')('fr')('complete'), 'Task done!')
  assert.equal(zh('__missing__'), '__missing__')
  const locale = get('petLocaleLang')
  assert.equal(locale({ getSnapshot: () => ({ active: 'zh-CN' }) }), 'zh')
  assert.equal(locale({ getSnapshot: () => ({ active: 'en-US' }) }), 'en')
  assert.equal(locale(undefined), 'en')
})

test('store：默认值、持久化、等级数学、跨天连续天数', async () => {
  const localStorage = fakeLocalStorage()
  const { get } = loadSources(['store.js'], { localStorage })
  const instance = get('petCreateStore')()

  assert.equal(instance.getSettings().character, 'lulu', '默认形象是噜噜')
  assert.equal(instance.getSettings().enabled, true)
  assert.equal(instance.getSettings().volume, 0.45, '默认音量（旧版 0.3 被用户反馈"太小声"后调高）')

  instance.patchSettings({ size: 136 })
  assert.equal(instance.getSettings().size, 136)

  // 50 点一级
  assert.equal(instance.level().level, 1)
  assert.equal(instance.addAffinity(49), false)
  assert.equal(instance.level().level, 1)
  assert.equal(instance.addAffinity(1), true, '跨过 50 点应升级')
  assert.equal(instance.level().level, 2)
  assert.equal(instance.level().progress, 0)

  // 亲密度不会为负
  instance.addAffinity(-1000)
  assert.equal(instance.getGrowth().affinity, 0)

  await settle()
  const persisted = JSON.parse(localStorage.getItem('dsh-pet:growth:v1'))
  assert.equal(persisted.affinity, 0, '成长数据应已落盘')
  assert.equal(JSON.parse(localStorage.getItem('dsh-pet:settings:v1')).size, 136, '设置应已落盘')

  // 新实例从磁盘恢复
  const restored = get('petCreateStore')()
  assert.equal(restored.getSettings().size, 136)

  // 跨天：昨天有记录时今天累加，断天则重置为 1
  const pad = (n) => String(n).padStart(2, '0')
  const ymd = (offset) => {
    const day = new Date(Date.now() + offset * 86400000)
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
  }
  const write = (growth) => localStorage.setItem('dsh-pet:growth:v1', JSON.stringify(growth))
  write({ affinity: 0, streak: 3, lastDay: ymd(-1) })
  assert.equal(get('petCreateStore')().getGrowth().streak, 4, '昨天有记录时今天应累加')
  write({ affinity: 0, streak: 9, lastDay: ymd(-3) })
  assert.equal(get('petCreateStore')().getGrowth().streak, 1, '断天应重置')

  // 导入导出往返（换设备搬家）
  const exported = restored.exportData()
  assert.equal(restored.importData(exported).ok, true)
  assert.equal(restored.importData('not json').ok, false)
  assert.equal(restored.importData('{"settings":1}').ok, false, '结构不对必须整体拒绝')
})

test('音效音量曲线：下限不静音、满量程更大且单调', () => {
  const { get } = loadSources(['sound.js'])
  const peak = get('petSoundPeak')

  assert.equal(peak(0), 0, '音量 0 就是静音')
  assert.equal(peak(-1), 0, '负音量按静音处理')
  // 第一版是 volume*0.5（默认 0.3 → 0.15），用户先后两次反馈太小声，现在满量程 1.8
  assert.ok(peak(0.3) > 0.15 * 5, `默认音量要明显变响，实际 ${peak(0.3).toFixed(3)}`)
  assert.ok(Math.abs(peak(0.45) - 1.8 * (0.3 + 0.7 * 0.45)) < 1e-9, '默认 0.45 → 1.107（进压缩器前）')
  assert.ok(peak(0.1) >= 0.54, `滑块下限 10% 也要有声，实际 ${peak(0.1).toFixed(3)}`)
  assert.ok(Math.abs(peak(1) - 1.8) < 1e-9, '满量程峰值 = 1.8（靠压缩器兜住不削波）')
  assert.ok(peak(2) <= 1.8, '超过 1 的音量被夹住')
  for (let v = 0.05; v < 1; v += 0.05) assert.ok(peak(v + 0.05) > peak(v), '音量曲线单调递增')
})

test('状态推导：优先级与事件检测', () => {
  const { get } = loadSources(['state.js'])
  const petReadStatus = get('petReadStatus')
  const petDeriveState = get('petDeriveState')
  const petDetectEvent = get('petDetectEvent')

  const map = new Map([
    ['a', { sessionId: 'a', running: true, pendingInteraction: false, completionUnread: false }],
    ['b', { sessionId: 'b', running: false, pendingInteraction: true, completionUnread: false }],
    ['c', { sessionId: 'c', running: false, pendingInteraction: false, completionUnread: true }],
  ])
  const facts = petReadStatus({ getSnapshot: () => map })
  assert.deepEqual(
    { running: facts.running, pending: facts.pending, unread: facts.unread },
    { running: 1, pending: 1, unread: 1 },
  )
  assert.equal(facts.target, 'b', '有待审批时跳转目标应是待审批会话')
  assert.equal(facts.targetKind, 'pending')

  // 优先级：待审批 > 运行中 > 完成 > 专注 > 睡觉 > 空闲
  assert.equal(petDeriveState({ facts, sleeping: true, focus: true }), 'alert')
  const running = petReadStatus({ getSnapshot: () => new Map([['a', { running: true }]]) })
  assert.equal(petDeriveState({ facts: running, sleeping: true, focus: true }), 'thinking')
  const idle = petReadStatus({ getSnapshot: () => new Map() })
  assert.equal(petDeriveState({ facts: idle, sleeping: true, focus: false }), 'sleep')
  assert.equal(petDeriveState({ facts: idle, sleeping: false, focus: true }), 'focus')
  assert.equal(petDeriveState({ facts: idle, sleeping: false, focus: false }), 'idle')

  // 事件检测只报"新增的事"
  const before = { running: 0, pending: 0, unread: 0 }
  assert.equal(petDetectEvent(before, { running: 1, pending: 0, unread: 0 }), 'started')
  assert.equal(petDetectEvent(before, { running: 0, pending: 1, unread: 0 }), 'pending')
  assert.equal(petDetectEvent(before, { running: 0, pending: 0, unread: 1 }), 'completed')
  assert.equal(petDetectEvent({ running: 1, pending: 1, unread: 1 }, before), null, '数量减少不应打扰')
  assert.equal(petDetectEvent(null, before), null, '首次同步不提醒')

  // 不同 DSH 版本可能给普通对象而不是 Map
  const objectFacts = petReadStatus({ getSnapshot: () => ({ x: { sessionId: 'x', running: true } }) })
  assert.equal(objectFacts.running, 1)
  assert.equal(objectFacts.target, 'x')
})

test('位图噜噜：Codex 协议、独立素材、16 向注视', () => {
  const { get } = loadSources(['characters.js'])
  const characters = get('PET_CHARACTERS')
  const sprites = characters.filter((character) => character.kind === 'sprite')

  // 注意：vm 里造出来的数组是另一个 realm 的 Array，deepStrictEqual 会因原型不同而误判
  assert.equal(
    JSON.stringify(sprites.map((character) => character.id).sort()),
    JSON.stringify(['lulu']),
    '只保留噜噜一只位图形象',
  )
  assert.equal(new Set(sprites.map((character) => character.sprite.url)).size, sprites.length, '每只宠物必须有自己的素材占位符')

  for (const pet of sprites) {
    const sprite = pet.sprite
    assert.equal(sprite.frameW, 192, `${pet.id} 单格宽`)
    assert.equal(sprite.frameH, 208, `${pet.id} 单格高`)
    assert.equal(sprite.cols, 8, `${pet.id} 列数`)
    assert.equal(sprite.rows * sprite.frameH, sprite.rows * 208, `${pet.id} 行高`)
    // 协议动作表九项都在
    for (const key of ['idle', 'runRight', 'runLeft', 'wave', 'jump', 'failed', 'waiting', 'working', 'review']) {
      assert.ok(sprite.actions[key], `${pet.id} 缺动作 ${key}`)
      assert.ok(sprite.idleSlow, `${pet.id} 缺慢速 idle`)
    }
    // 素材文件必须存在且没超预算
    const name = sprite.url.replace(/^__DSH_PET_ASSET_|__$/g, '').toLowerCase().replace(/_/g, '-')
    const file = join(ROOT, 'assets', `${name}.webp`)
    assert.ok(existsSync(file), `${pet.id} 缺素材 assets/${name}.webp`)
    assert.ok(statSync(file).size <= 768 * 1024, `${pet.id} 素材超预算`)
  }

  // 11 行图集（噜噜）才有第 9–10 行注视帧
  const gazeIds = ['lulu']
  for (const id of gazeIds) assert.ok(sprites.find((pet) => pet.id === id).sprite.gaze, `${id} 应带 16 向注视`)
  for (const pet of sprites.filter((entry) => !gazeIds.includes(entry.id))) {
    assert.equal(pet.sprite.gaze, undefined, `${pet.id} 的图集只有 9 行，不该挂注视`)
  }
})

test('构建产物是最新的，且形状符合 ModuleLoader 契约', () => {
  const pkg = readJson('package.json')
  assert.ok(existsSync(join(ROOT, 'client.js')), 'client.js 不存在，请先 npm run build')
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' })

  const bundle = read('client.js')
  assert.ok(!bundle.includes('</script'), 'bundle 不能包含 </script')
  assert.ok(bundle.includes(`window.__ModuleLoader__.load({id:"${pkg.name}"`), 'bundle 必须用包名注册模块')
  assert.ok(!bundle.includes('__DSH_PET_CSS__'), 'CSS 占位符必须已被替换')

  // 在 vm 里执行 bundle，截获 ModuleLoader.load，再用桩 require 物化 factory
  let registered = null
  const context = createContext({
    window: {
      __ModuleLoader__: {
        load: (entry) => {
          registered = entry
        },
      },
      addEventListener() {},
      removeEventListener() {},
      innerWidth: 1280,
      innerHeight: 800,
      localStorage: fakeLocalStorage(),
    },
    document: undefined,
    console,
  })
  runInContext(bundle, context, { filename: 'client.js' })
  assert.ok(registered, 'bundle 应调用 __ModuleLoader__.load')
  assert.equal(registered.id, pkg.name)

  const stubs = {
    react: {
      createElement: (...args) => ({ args }),
      useEffect: () => {},
      useState: (value) => [value, () => {}],
    },
    'react-dom': { createRoot: () => ({ render() {}, unmount() {} }) },
    'react/jsx-runtime': {},
  }
  const moduleExports = registered.factory((name) => {
    if (!(name in stubs)) throw new Error(`未预料的 external: ${name}`)
    return stubs[name]
  })
  assert.equal(moduleExports.name, 'dsh-pet')
  assert.equal(typeof moduleExports.apply, 'function')
  assert.ok(Array.isArray(moduleExports.inject))
  for (const service of ['slots', 'sessions', 'locale']) {
    assert.ok(moduleExports.inject.includes(service), `inject 应包含 ${service}`)
  }
})

test('动作库：分类、动效、粒子与空闲自演池', () => {
  const { get } = loadSources(['actions.js'])
  const ACTIONS = get('PET_ACTIONS')
  const CATEGORIES = get('PET_ACTION_CATEGORIES')
  const byId = get('petActionById')
  const byCategory = get('petActionsByCategory')
  const randomIdle = get('petRandomIdleAction')
  const particles = get('petFxParticles')
  const label = get('petActionLabel')

  // id 唯一、必填字段齐全、时长合理（太短看不清，太长像卡住）
  const ids = ACTIONS.map((action) => action.id)
  assert.equal(new Set(ids).size, ids.length, '动作 id 不能重复')
  for (const action of ACTIONS) {
    assert.ok(action.id && action.effect && action.sound, `${action.id} 缺字段`)
    assert.ok(action.seconds >= 1 && action.seconds <= 3, `${action.id} 时长应在 1–3s`)
    assert.ok(action.label.zh && action.label.en, `${action.id} 需要中英名`)
    assert.ok(
      CATEGORIES.some((category) => category.id === action.category),
      `${action.id} 的分类 ${action.category} 必须存在`,
    )
  }

  // 面板 / 菜单按分类取，三类都不空
  for (const category of CATEGORIES) {
    assert.ok(byCategory(category.id).length > 0, `${category.id} 分类不能是空的`)
  }

  // 每个 effect 都必须在样式里有对应关键帧，否则点了不动
  const css = readFileSync(new URL('../styles/pet.css', import.meta.url), 'utf8')
  for (const action of ACTIONS) {
    assert.ok(css.includes(`@keyframes dsh-pet-act-${action.effect}`), `${action.effect} 缺关键帧`)
    assert.ok(css.includes(`[data-act='${action.effect}']`), `${action.effect} 缺 data-act 规则`)
  }

  // 粒子：类型决定数量，坐标是整数、颜色跟着类型走
  assert.equal(particles('firework', () => 0.5).length, 14)
  assert.equal(particles('envelope', () => 0.5).length, 6)
  assert.equal(particles('confetti', () => 0.5).length, 12)
  assert.equal(particles('sparkle', () => 0.5).length, 8)
  const fu = particles('fu', () => 0.5)
  assert.equal(fu.length, 1)
  assert.equal(fu[0].char, '福', '写福字要飘一个福字')
  for (const particle of particles('firework', () => 0.25)) {
    assert.ok(Number.isInteger(particle.dx) && Number.isInteger(particle.dy), '粒子坐标取整，避免亚像素抖动')
    assert.ok(particle.color.startsWith('#'), '粒子颜色要是具体色值')
  }
  assert.equal(particles(null).length, 0, '没有粒子类型就返回空数组')

  // 空闲自演只挑轻动作，而且永远在池子里
  const pool = ['hop', 'spin', 'shy', 'dizzy', 'cheer', 'roll']
  for (const value of [0, 0.2, 0.5, 0.99, 1]) {
    assert.ok(pool.includes(randomIdle(() => value)), `rand=${value} 应当返回池内动作`)
  }

  // 查询与标签
  assert.equal(byId('newyear').label.zh, '拜年')
  assert.equal(byId('nope'), null)
  assert.equal(label(byId('lion'), 'en'), 'Lion dance')
  assert.equal(label(byId('lion'), 'ja'), 'Lion dance', '未知语言回落英文')
})

test('道具与手臂：每个动作真的「手里有东西、手在动」', () => {
  const { get } = loadSources(['characters.js', 'props.js', 'actions.js'])
  const ACTIONS = get('PET_ACTIONS')
  const propMarkup = get('petPropMarkup')
  const propIds = get('petPropIds')
  const svg = get('petSvg')

  // 道具库：id 唯一、标记形状正确、未知 id 返回空
  const ids = propIds()
  assert.equal(new Set(ids).size, ids.length, '道具 id 不能重复')
  for (const id of ids) {
    const markup = propMarkup(id)
    assert.ok(markup.includes(`data-prop="${id}"`), `${id} 的标记要带 data-prop`)
    assert.ok(markup.length > 200, `${id} 的标记太短，估计是空壳`)
  }
  assert.equal(propMarkup(null), '', '没道具时返回空串')
  assert.equal(propMarkup('nope'), '', '未知道具返回空串')

  // 每个动作的 prop 必须是道具库里的 id；arms 必须是已知姿态
  const POSES = ['lift', 'clasp', 'hold', 'write', 'eat', 'shy', 'clap', 'balance', 'pump', 'raise']
  for (const action of ACTIONS) {
    if (action.prop !== null) assert.ok(ids.includes(action.prop), `${action.id} 的道具 ${action.prop} 不存在`)
    assert.ok(POSES.includes(action.arms), `${action.id} 的姿态 ${action.arms} 没在姿态表里`)
  }
  // 用户点名要更「具象」的六个动作，道具都得在
  const needProp = { lion: 'lion', newyear: 'clasp', redpacket: 'envelope', fu: 'brush', dumpling: 'bowl', fireworks: 'firework' }
  for (const [actionId, prop] of Object.entries(needProp)) {
    const action = ACTIONS.find((item) => item.id === actionId)
    assert.equal(action?.prop, prop, `${actionId} 应当拿 ${prop}`)
  }

  // 位图角色不画 SVG 骨架：只剩图集，没有胳膊（道具层仍然盖在位图上）
  assert.ok(!get('petSpriteMarkup')('lulu').includes('dsh-pet-arm'), '位图角色渲染不走 SVG 骨架')

  // 样式必须跟上：每个姿态有选择器 + keyframes，每个道具 class 有配色规则
  const css = readFileSync(new URL('../styles/pet.css', import.meta.url), 'utf8')
  for (const pose of POSES) {
    assert.ok(css.includes(`[data-pose='${pose}']`), `${pose} 姿态缺选择器`)
    for (const side of ['l', 'r']) {
      assert.ok(css.includes(`@keyframes dsh-pet-arm-${pose}-${side}`), `${pose} 缺 ${side} 手关键帧`)
    }
  }
  const classes = new Set()
  for (const id of ids) {
    for (const match of propMarkup(id).matchAll(/class="([^"]+)"/g)) {
      for (const token of match[1].split(/\s+/)) if (token) classes.add(token)
    }
  }
  // 纯结构分组（不承担配色）不要求有样式规则
  const structural = new Set(['dsh-pet-lion-mane', 'dsh-pet-writing'])
  const unstyled = [...classes].filter((token) => !structural.has(token) && !css.includes(`.${token}`))
  assert.deepEqual(unstyled, [], `这些道具 class 没有样式：${unstyled.join(', ')}`)
})

test('活动流：host 状态→宠物状态、工具相位、回合文案、轮询降级', async () => {
  const { get } = loadSources(['i18n.js', 'live.js', 'state.js'])

  const priority = get('PET_STATE_PRIORITY')
  const arbitrate = get('petArbitrate')
  const hostToPet = get('petHostStateToPet')
  const derive = get('petDeriveState')

  // 优先级：审批 > 出错/完成 > 在跑 > 专注 > 睡眠
  assert.ok(priority.alert > priority.celebrate)
  // 在跑 > 未读完成：未读徽标不该把正在跑的任务藏起来
  assert.ok(priority.thinking > priority.celebrate)
  assert.ok(priority.celebrate > priority.focus)
  assert.ok(priority.focus > priority.sleep)
  assert.equal(arbitrate(['sleep', 'focus']), 'focus')
  assert.equal(arbitrate(['thinking', 'alert', 'idle']), 'alert')
  assert.equal(arbitrate([]), 'idle')
  // 同优先级取先出现的
  assert.equal(arbitrate(['thinking', 'thinking']), 'thinking')

  // host 状态映射：审批与出错都该是最急的
  assert.equal(hostToPet({ state: 'approval' }), 'alert')
  assert.equal(hostToPet({ state: 'error' }), 'alert')
  assert.equal(hostToPet({ state: 'tool' }), 'thinking')
  assert.equal(hostToPet({ state: 'thinking' }), 'thinking')
  assert.equal(hostToPet({ state: 'done' }), 'celebrate')
  assert.equal(hostToPet({ state: 'idle' }), null)
  assert.equal(hostToPet(null), null)

  // 推导：host 说在等审批，就该盖住本地的 celebrate
  const facts = { running: 0, pending: 0, unread: 2, target: null, targetKind: null, sessions: [] }
  assert.equal(derive({ facts, sleeping: false, focus: false }), 'celebrate')
  assert.equal(derive({ facts, sleeping: false, focus: false, live: { active: { state: 'approval' } } }), 'alert')
  assert.equal(derive({ facts, sleeping: false, focus: false, live: { active: { state: 'tool' } } }), 'thinking')
  // host 缺失（插件 host 半没起来）时退回本地判断，不报错
  assert.equal(derive({ facts, sleeping: false, focus: false, live: null }), 'celebrate')

  // 工具名 → 相位（中英各一份文案）
  const phase = get('petToolPhase')
  assert.equal(phase('bash').zh, '跑命令')
  assert.equal(phase('edit_file').zh, '改代码')
  assert.equal(phase('grep').zh, '翻文件')
  assert.equal(phase('web_search').zh, '上网查')
  assert.equal(phase('task').zh, '派活')
  assert.equal(phase('todo_write').zh, '排计划')
  assert.equal(phase('mystery_tool').zh, '用工具')
  assert.equal(phase(undefined).zh, '用工具')
  assert.equal(phase('bash').en.length > 0, true)

  // 时长格式化
  const duration = get('petFormatDuration')
  assert.equal(duration(320), '320ms')
  assert.equal(duration(4200), '4.2s')
  assert.equal(duration(65_000), '1m5s')
  assert.equal(duration(Number.NaN), '')
  assert.equal(duration(-5), '')

  // 上下文等级
  const level = get('petUsageLevel')
  assert.equal(level(null), 'unknown')
  assert.equal(level({ percent: 12 }), 'ok')
  assert.equal(level({ percent: 71 }), 'warn')
  assert.equal(level({ percent: 90 }), 'high')
  assert.equal(level({ percent: 71 }, { warn: 80, high: 95 }), 'ok')

  // 回合汇报文案
  const turnText = get('petTurnText')
  assert.match(turnText({ durationMs: 4200, tools: 3, ok: true }, 'zh'), /4\.2s/)
  assert.match(turnText({ durationMs: 4200, tools: 3, ok: true }, 'zh'), /3/)
  assert.match(turnText({ durationMs: 1000, tools: 0, ok: true }, 'zh'), /1s/)
  assert.match(turnText({ durationMs: 900, tools: 2, ok: false }, 'zh'), /卡住/)
  assert.match(turnText({ durationMs: 2400, tools: 1, ok: true }, 'en'), /2\.4s/)

  // 轮询器：成功时 online、水位前移、notices 透传；连续失败降级为 offline
  const createLive = get('petCreateLive')
  const calls = []
  const responses = [
    { ok: true, json: async () => ({ active: { sessionId: 's1', state: 'tool' }, tool: { name: 'bash' }, usage: { percent: 40 }, lastTurn: null, notices: [{ id: 7, text: '来杯咖啡？' }] }) },
    { ok: true, json: async () => ({ active: { sessionId: 's1', state: 'tool' }, tool: { name: 'bash' }, usage: { percent: 41 }, lastTurn: null, notices: [] }) },
  ]
  let index = 0
  const fakeFetch = async (url) => {
    calls.push(url)
    const next = responses[index]
    index += 1
    if (!next) throw new Error('boom')
    return next
  }
  const live = createLive({ fetch: fakeFetch, intervalMs: 10 })
  const seen = []
  live.subscribe((snapshot) => seen.push(snapshot))
  live.start()
  await new Promise((done) => setTimeout(done, 30))
  live.stop()

  assert.ok(calls.length >= 1, '应该真的发起了轮询')
  assert.match(calls[0], /after=0/)
  const last = live.get()
  assert.equal(last.online, true)
  assert.equal(last.tool.name, 'bash')
  assert.equal(last.usage.percent, 41) // 第二次轮询的最新值
  // notices 只在当次快照里出现，第一次必须透传给订阅者
  assert.ok(seen.some((snapshot) => snapshot.notices.length === 1 && snapshot.notices[0].text === '来杯咖啡？'))
  assert.ok(seen.length >= 1)

  // 水位：第二次请求要带上已消费的 notice id
  const watermarked = calls.find((url) => url.includes('after=7'))
  assert.ok(watermarked !== undefined, `第二次请求应带 after=7，实际：${calls.join(',')}`)
})

test('标题闪烁：等审批时闪，stop 后原样恢复', () => {
  const fakeDocument = { title: 'DSH — 会话' }
  const { get } = loadSources(['i18n.js', 'live.js'], { document: fakeDocument, setInterval, clearInterval })
  const flash = get('petCreateTitleFlash')()
  assert.equal(flash.active(), false)
  flash.start('🔔 待审批')
  assert.equal(flash.active(), true)
  flash.stop()
  assert.equal(flash.active(), false)
  assert.equal(fakeDocument.title, 'DSH — 会话')
})

test('右键菜单落点：贴边也不许出视口（用户报的右上角被裁问题）', () => {
  // petMenuLayout 是纯函数：只吃矩形，所以可以直接喂边界数据
  const { get } = loadSources(['overlay.js'], { document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) }, window: { innerWidth: 1440, innerHeight: 900 } })
  const layout = get('petMenuLayout')
  assert.equal(typeof layout, 'function')
  const viewport = { width: 1440, height: 900 }
  const menu = { width: 200, height: 420 }

  // 右上角：上方放不下 → 翻到下方，且右边缘不出界
  const topRight = layout({ anchor: { left: 1310, top: 12, bottom: 116, width: 104, height: 104 }, size: menu, viewport })
  assert.equal(topRight.flipped, true, '上方放不下必须翻到下方')
  assert.ok(topRight.top >= 8, `top=${topRight.top} 不能小于 8`)
  assert.ok(topRight.top + topRight.height <= 892, `bottom=${topRight.top + topRight.height} 不能超过 892`)
  assert.ok(topRight.left >= 8 && topRight.left + topRight.width <= 1432, `left=${topRight.left} 出界`)

  // 左上角：右边要有空间，left 被夹到 8
  const topLeft = layout({ anchor: { left: 8, top: 10, bottom: 114, width: 104, height: 104 }, size: menu, viewport })
  assert.equal(topLeft.left, 8)

  // 右下角（默认位置）：优先放在上方，水平居中
  const bottomRight = layout({ anchor: { left: 1318, top: 700, bottom: 804, width: 104, height: 104 }, size: menu, viewport })
  assert.equal(bottomRight.flipped, false)
  assert.equal(bottomRight.top, 700 - 420 - 8)
  assert.ok(bottomRight.top >= 8)

  // 视口很小（手机横屏）：宽高都被夹进视口
  const tiny = layout({ anchor: { left: 300, top: 8, bottom: 60, width: 52, height: 52 }, size: menu, viewport: { width: 360, height: 200 } })
  assert.ok(tiny.width <= 360 - 16)
  assert.ok(tiny.height <= 200 - 16)
  assert.ok(tiny.left >= 8 && tiny.left + tiny.width <= 352)
  assert.ok(tiny.top >= 8 && tiny.top + tiny.height <= 192)
})

test('图集导入：host 返回的皮肤注册成 sprite 角色并能生成 CSS', () => {
  const { get } = loadSources(['characters.js', 'props.js'])
  const register = get('petRegisterSkins')
  const characters = get('PET_CHARACTERS')
  const css = get('petSpriteCss')
  const before = characters.length

  // 合法两条、非法四条（id 形状/行数/类型），只该加合法的两条
  const added = register([
    { id: 'skin-1a2b3c4d', label: '柴犬', rows: 11, mime: 'image/webp' },
    { id: 'skin-00112233', label: '', rows: 9, mime: 'image/png' },
    { id: 'skin-ZZZZ', rows: 11 },
    { id: 'lulu', rows: 11 },
    { id: 'skin-99999999', rows: 4 },
    { id: 'skin-88888888', rows: 11, mime: 'image/gif' },
  ])
  assert.deepEqual([...added], ['skin-1a2b3c4d', 'skin-00112233'])
  assert.equal(characters.length, before + 2)
  // 重复注册不该重复添加
  assert.deepEqual([...register([{ id: 'skin-1a2b3c4d', label: '柴犬', rows: 11 }])], [])

  const sheet = css()
  assert.match(sheet, /data-char='skin-1a2b3c4d'\] \.dsh-pet-sprite/)
  assert.match(sheet, /\/pet\/skins\/skin-1a2b3c4d\.webp/)
  assert.match(sheet, /\/pet\/skins\/skin-00112233\.png/)
  assert.match(sheet, /dsh-pet-sprite-skin-1a2b3c4d-idle/)
})

test('动图形象：注册校验、胶片条 keyframes 与帧时长', () => {
  const { get } = loadSources(['characters.js', 'props.js'])
  const register = get('petRegisterAnims')
  const characters = get('PET_CHARACTERS')
  const css = get('petAnimCss')
  const before = characters.length
  const url = 'data:image/webp;base64,AAAA'

  const added = register([
    { id: 'a-lulu-idle', label: '噜噜', url, frameW: 192, frameH: 208, frames: 3, durations: [280, 110, 320] },
    // 非法：id 不是 a- 前缀、不是 data URI、帧数越界、时长长度不匹配、尺寸非法
    { id: 'u-lulu', label: '错前缀', url, frameW: 192, frameH: 208, frames: 3, durations: [1, 1, 1] },
    { id: 'a-remote', label: '外链', url: 'https://example.com/a.webp', frameW: 192, frameH: 208, frames: 3, durations: [1, 1, 1] },
    { id: 'a-one', label: '单帧', url, frameW: 192, frameH: 208, frames: 1, durations: [100] },
    { id: 'a-no-durations', label: '缺时长', url, frameW: 192, frameH: 208, frames: 3, durations: [100] },
    { id: 'a-zero', label: '零高', url, frameW: 0, frameH: 208, frames: 3, durations: [100, 100, 100] },
  ])
  assert.deepEqual([...added], ['a-lulu-idle'])
  assert.equal(characters.length, before + 1)
  // 幂等：再注册一次不会重复
  assert.deepEqual([...register([{ id: 'a-lulu-idle', label: '噜噜', url, frameW: 192, frameH: 208, frames: 3, durations: [280, 110, 320] }])], [])

  assert.equal(get('petIsAnim')('a-lulu-idle'), true)
  assert.equal(get('petIsAnim')('lulu'), false)
  assert.match(get('petAnimMarkup')('a-lulu-idle'), /class="dsh-pet-anim" data-anim="a-lulu-idle"/)
  assert.equal(get('petAnimMarkup')('lulu'), '')
  assert.match(get('petPreviewMarkup')('a-lulu-idle'), /dsh-pet-anim-thumb/)
  // 缩放比：136 / 208，和位图同一套夹取
  assert.equal(get('petAnimScale')('a-lulu-idle', 136).toFixed(4), '0.6538')

  const sheet = css()
  // 3 帧 → 胶片条按 300% 宽度铺，元素盒等于单帧尺寸、水平居中
  assert.match(sheet, /data-char='a-lulu-idle'\] \.dsh-pet-anim[^{]*\{ background-image: url\("data:image\/webp;base64,AAAA"\); background-size: 300% 100%; \}/)
  assert.match(sheet, /data-char='a-lulu-idle'\] \.dsh-pet-anim \{ width: 192px; height: 208px; margin-left: -96px; \}/)
  // 总时长 = 280+110+320，帧起点按累计百分比离散推进
  assert.match(sheet, /@keyframes dsh-pet-anim-a-lulu-idle \{/)
  assert.match(sheet, /0\.000% \{ background-position: 0px 0; \}/)
  assert.match(sheet, /39\.437% \{ background-position: -192px 0; \}/)
  assert.match(sheet, /54\.930% \{ background-position: -384px 0; \}/)
  assert.match(sheet, /animation-duration: 710ms/)
})

test('装扮：id 唯一、标记有 class、切换闭环、默认戴围巾', () => {
  const { get } = loadSources(['outfits.js', 'store.js'])
  const ids = get('petOutfitIds')()
  assert.ok(ids.length >= 6, `装扮太少：${ids.length}`)
  assert.equal(new Set(ids).size, ids.length, '装扮 id 有重复')
  for (const id of ids) {
    const markup = get('petOutfitMarkup')(id)
    assert.ok(markup.includes('class="dsh-pet-'), `${id} 的标记里没有 class`)
    assert.ok(!/style=/.test(markup), `${id} 不该写内联样式（配色属于 CSS）`)
    assert.ok(!/#[0-9a-f]{3,6}/i.test(markup), `${id} 的标记里不该出现硬编码颜色`)
    assert.equal(typeof get('petOutfitLabel')(id, 'zh'), 'string')
    assert.equal(typeof get('petOutfitLabel')(id, 'en'), 'string')
  }
  assert.equal(get('petOutfitMarkup')('none'), '', 'none 必须返回空标记')
  assert.equal(get('petOutfitMarkup')('nope'), '', '未知 id 必须返回空标记')

  // 顺次切换要能回到原点（右键菜单「换装扮」靠它）
  const next = get('petOutfitNext')
  let current = 'none'
  const seen = new Set([current])
  for (let i = 0; i < ids.length; i += 1) {
    current = next(current, 1)
    seen.add(current)
  }
  assert.equal(current, ids[ids.length - 1], '正向切换应停在最后一个装扮')
  assert.equal(next(current, 1), 'none', '最后一个再切一次应回到不戴')
  assert.equal(next('none', -1), ids[ids.length - 1], '反向切换应绕到最后一个')

  // 默认装扮：用户嫌「太素」，新用户先戴围巾
  const store = get('petCreateStore')()
  assert.equal(store.getSettings().outfit, 'scarf', '默认装扮应为围巾')
})

/**
 * 自备形象流水线（scripts/import-lulu.py）：用户在 /root/workspace/lulu-images/
 * 放图之后，这一跑就该产出可用素材。这里用现成图集当输入，验证「能跑通 + 产物形状对」，
 * 不断言具体像素（那属于素材本身的事）。
 */
test('自备形象流水线：图片 → 抠底裁边缩放 → 内联数据模块', () => {
  const py = process.env.PET_PYTHON || 'python3'
  let hasPil = true
  try {
    execFileSync(py, ['-c', 'import PIL'], { stdio: 'ignore' })
  } catch {
    hasPil = false
  }
  if (!hasPil) {
    console.error('# 跳过：没有 python3 + Pillow')
    return
  }

  const tmp = mkdtempSync(join(tmpdir(), 'dsh-pet-import-'))
  try {
    mkdirSync(join(tmp, 'in'), { recursive: true })
    copyFileSync(join(ROOT, 'assets/lulu.webp'), join(tmp, 'in', '样例-噜噜.webp'))
    const emitted = join(tmp, 'generated-images.js')
    execFileSync(
      py,
      [join(ROOT, 'scripts/import-lulu.py'), '--in', join(tmp, 'in'), '--out', join(tmp, 'out'), '--emit', emitted, '--sheet', join(tmp, 'sheet.png')],
      { stdio: 'ignore' },
    )

    const code = readFileSync(emitted, 'utf8')
    assert.match(code, /const PET_USER_IMAGES = \[/, '必须导出 PET_USER_IMAGES 数组')
    assert.match(code, /data:image\/webp;base64,/, '图片必须内联成 data URI（插件单文件部署）')
    assert.match(code, /id: "u-/, 'id 必须以 u- 开头（客户端注册时校验）')

    const meta = JSON.parse(readFileSync(join(tmp, 'out', 'index.json'), 'utf8'))
    assert.equal(meta.images.length, 1, '应导入 1 张图')
    const [entry] = meta.images
    assert.ok(entry.width > 16 && entry.height > 16, '尺寸要合理')
    assert.ok(entry.bytes > 0 && entry.bytes < 3 * 1024 * 1024, '单图不能超过 3MB')
    assert.ok(existsSync(join(tmp, 'out', entry.file)), 'webp 必须落盘')
    assert.ok(existsSync(join(tmp, 'sheet.png')), '要生成拼图供肉眼检查')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
