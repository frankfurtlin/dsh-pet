// GENERATED for dsh-pet 0.1.0 by scripts/build.mjs — do not edit by hand.
// 源码：client-src/generated-images.js, client-src/generated-anims.js, client-src/characters.js, client-src/props.js, client-src/outfits.js, client-src/i18n.js, client-src/live.js, client-src/store.js, client-src/sound.js, client-src/actions.js, client-src/state.js, client-src/overlay.js, client-src/settings.js, client-src/main.js
// 样式：styles/pet.css（构建时内联；改样式请改源文件再 npm run build）
window.__ModuleLoader__.load({id:"dsh-pet",factory:function(require){var module={exports:{}};var exports=module.exports;
/* ── client-src/generated-images.js ── */
// 由 scripts/import-lulu.py 生成，不要手改。
// 初始为空：把图片放进 /root/workspace/plugins/dsh-pet/images/ 后运行
//   python3 scripts/import-lulu.py && node scripts/build.mjs
const PET_USER_IMAGES = []

/* ── client-src/generated-anims.js ── */
// 由 scripts/import-anim.py 生成：把动图/短视频转成循环动画形象。
// 手动改这个文件没有意义 —— 重新跑导入脚本会覆盖。空的数组 = 还没导入任何动图。
const PET_USER_ANIMS = []

/* ── client-src/characters.js ── */
/**
 * 内置形象：3 只纯矢量宠物。
 *
 * 为什么不用位图 / spritesheet：
 *   · 体积——一套 12 帧、每帧 256px 的 webp 精灵图至少 300KB 起步，而这里三只
 *     角色加起来不到 20KB 源码，构建后进 bundle 也几乎不涨；
 *   · 清晰度——矢量在 76px（手机）到 200px（超大）之间任意缩放都不糊；位图形象走原分辨率图集（单格 192×208，200px 档 ≈ 0.96 倍缩）；
 *   · 换色——角色配色是 CSS 变量，深色主题下换一组值即可，不用另出一套图；
 *   · 差异更新——改一根尾巴就是改一行 path，不需要重出素材。
 *
 * 每只角色返回**同一套 class 骨架**（.dsh-pet-body / -belly / -accent / -line /
 * -blink / -breathe / -think / -alert / -happy / -zzz），所以 state.js 里的状态
 * 只切 root 上的 data-state，形象层完全不用知道状态是怎么来的。
 *
 * 坐标系统一为 viewBox="0 0 100 100"，脚底贴 y=95，方便气泡/进度环对齐。
 */

/** 状态叠加件（思考点、感叹号、爱心、Zzz）——所有角色共用。 */
const PET_STATE_DECOR = `
  <g class="dsh-pet-think">
    <circle class="dsh-pet-think-dot" cx="78" cy="30" r="2.4"/>
    <circle class="dsh-pet-think-dot" cx="85" cy="23" r="3"/>
    <circle class="dsh-pet-think-dot" cx="92" cy="15" r="3.6"/>
  </g>
  <g class="dsh-pet-alert">
    <circle class="dsh-pet-alert-mark" cx="26" cy="30" r="7.5"/>
    <path class="dsh-pet-alert-glyph" d="M26 26.2v4.8"/>
    <circle class="dsh-pet-alert-glyph-dot" cx="26" cy="34.2" r="1"/>
  </g>
  <g class="dsh-pet-happy">
    <path class="dsh-pet-heart" d="M72 30c-2.6-3.4-8-1.4-6.8 2.6.8 2.6 4.4 4.8 6.8 7.4 2.4-2.6 6-4.8 6.8-7.4C80 28.6 74.6 26.6 72 30Z"/>
    <path class="dsh-pet-heart dsh-pet-heart-2" d="M84 20c-1.7-2.2-5.2-.9-4.4 1.7.5 1.7 2.9 3.1 4.4 4.8 1.5-1.7 3.9-3.1 4.4-4.8.8-2.6-2.7-3.9-4.4-1.7Z"/>
  </g>
  <g class="dsh-pet-zzz">
    <text class="dsh-pet-z" x="74" y="40" font-size="9">Z</text>
    <text class="dsh-pet-z" x="80" y="31" font-size="11">Z</text>
    <text class="dsh-pet-z" x="88" y="21" font-size="13">Z</text>
  </g>
`

/** 表情：眼睛（含高光）+ 嘴 + 腮红。三只角色共用，只是位置按脸型微调。 */
function petFace({ eyeY = 64, eyeGap = 9, mouthY = 73, cheekY = 71, cheekX = 32 } = {}) {
  const left = 50 - eyeGap
  const right = 50 + eyeGap
  return `
    <g class="dsh-pet-blink">
      <ellipse class="dsh-pet-eyewhite" cx="${left}" cy="${eyeY}" rx="6.1" ry="7.2"/>
      <ellipse class="dsh-pet-eyewhite" cx="${right}" cy="${eyeY}" rx="6.1" ry="7.2"/>
      <circle class="dsh-pet-line dsh-pet-pupil" cx="${left + 0.8}" cy="${eyeY + 0.6}" r="2.8"/>
      <circle class="dsh-pet-line dsh-pet-pupil" cx="${right - 0.8}" cy="${eyeY + 0.6}" r="2.8"/>
      <circle class="dsh-pet-glint" cx="${left + 2}" cy="${eyeY - 2}" r="0.95"/>
      <circle class="dsh-pet-glint" cx="${right}" cy="${eyeY - 2}" r="0.95"/>
    </g>
    <circle class="dsh-pet-accent dsh-pet-cheek" cx="${cheekX}" cy="${cheekY}" r="3.1"/>
    <circle class="dsh-pet-accent dsh-pet-cheek" cx="${100 - cheekX}" cy="${cheekY}" r="3.1"/>
    <path class="dsh-pet-mouth" d="M${50 - 4} ${mouthY} q4 4.2 8 0"/>
  `
}

/**
 * 位图形象（spritesheet）的动画表。
 *
 * 取自 Codex pet 协议 v2 的全局 `ANIMATIONS` 表：单帧时长(ms)按行列出，行内有效帧数
 * 与协议一致（idle 6 / run 8 / wave 4 / jump 5 / failed 8 / waiting 6 / working 6 /
 * review 6）。协议 v2 图集固定 8 列 × 11 行、单格 192×208，行 0–8 是动作，行 9–10
 * 是 16 向注视格——注视跟随这版没做（每帧都要重算指针角度，收益不抵抖动风险），
 * 图集里的注视行留作以后用。
 */
const PET_SPRITE_ACTIONS = {
  idle: { row: 0, steps: [280, 110, 110, 140, 140, 320] },
  runRight: { row: 1, steps: [120, 120, 120, 120, 120, 120, 120, 220] },
  runLeft: { row: 2, steps: [120, 120, 120, 120, 120, 120, 120, 220] },
  wave: { row: 3, steps: [140, 140, 140, 280] },
  jump: { row: 4, steps: [140, 140, 140, 140, 280] },
  failed: { row: 5, steps: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, steps: [150, 150, 150, 150, 150, 260] },
  working: { row: 7, steps: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, steps: [150, 150, 150, 150, 150, 280] },
}

/** 睡觉用 idle 的帧序放慢 1.8 倍，比另做一套睡眠图务实。 */
const PET_SPRITE_IDLE_SLOW = { row: 0, steps: [504, 198, 198, 252, 252, 576] }

/**
 * 16 向注视帧（Codex pet 协议 v2 的行 9–10）：8 列 × 2 行，第 i 格 → row `9+i//8`、col `i%8`。
 *
 * `originDeg` 是第 0 格朝向的屏幕角度（0°=右、90°=下，即 atan2(dy,dx) 的坐标系）。
 * 在源素材上实测瞳孔偏移：i=0 朝上（≈-84°）、i=8 朝下（≈+92°），也就是
 * 「从正上方开始、每格顺时针 22.5°」，和作者 README 的「16 个顺时针环视方向」一致。
 *
 * `deadZonePx`：指针进入宠物中心这个半径内就回到 idle 动画（原版插件也是 28px），
 * 否则一直盯着光标会显得呆。
 */
const PET_SPRITE_GAZE = {
  rows: [9, 10],
  count: 16,
  originDeg: -90,
  stepDeg: 22.5,
  deadZonePx: 28,
}

/**
 * 一套标准 Codex pet 图集 → 角色的 `sprite` 配置。
 *
 * 协议里行 0–8 的动作与帧数、每帧时长都是固定的，各家的图集只是画风不同，
 * 所以这里把「协议」和「素材」拆开：新加一只位图宠物只要 `petSpritePack(url, { rows })`。
 * 只有 11 行（多出第 9–10 行 16 向注视帧）的图集才挂 `gaze`。
 */
function petSpritePack(url, { rows = 9, gaze = false } = {}) {
  const sprite = {
    /**
     * 素材占位符：构建时由 scripts/build.mjs 换成 `/pet/assets/<名字>.webp`。
     *
     * 2026-11-05 之前是 base64 内联（单文件部署、刷新即生效），但 12 条动作视频被两只
     * 形象共用、同一份素材内联两遍，bundle 涨到 3.8MB；改成 host 半的 ASSETS_PATH
     * 白名单直供（带 ETag 回源校验）后 bundle 只剩代码。代价：补丁式插件加路由要重启
     * 一次 DSH 才生效（没有 HMR）。
     */
    url,
    frameW: 192,
    frameH: 208,
    cols: 8,
    rows,
    actions: PET_SPRITE_ACTIONS,
    idleSlow: PET_SPRITE_IDLE_SLOW,
    /** 宠物状态 → 图集动作。 */
    states: {
      idle: 'idle',
      thinking: 'working',
      alert: 'waiting',
      celebrate: 'jump',
      happy: 'wave',
      sleep: 'idleSlow',
      focus: 'working',
      drag: 'runRight',
    },
  }
  if (gaze) sprite.gaze = PET_SPRITE_GAZE
  return sprite
}

/**
 * 内置角色清单。`ears` / `tail` 决定骨架变体，`palette` 是浅色主题取值，
 * `paletteDark` 可选覆盖（深色下压暗身体、提亮肚皮，避免整只糊成一团）。
 *
 * `kind: 'sprite'` 的角色走位图分支（见下方 petSprite* 系列），`palette` 对它没用，
 * 配色已经烘焙在素材里。
 */
const PET_CHARACTERS = [
  {
    // 默认形象（2026-11-05 起）：idle 行是图生视频抽帧的原生呼吸，其余动作行沿用原图集；
    // 12 个专属动作全部走透明 WebM 视频（见 PET_ACTION_VIDEOS）。
    id: 'pilot',
    label: { zh: '噜噜', en: 'Lulu' },
    kind: 'sprite',
    sprite: petSpritePack('/pet/assets/lulu-idle-v2.webp', { rows: 11, gaze: true }),
  },
  {
    // 经典噜噜：上游原版图集（idle 是手绘 6 帧），保留给喜欢原版待机的人
    id: 'lulu',
    label: { zh: '噜噜（经典）', en: 'Lulu (classic)' },
    kind: 'sprite',
    // 11 行图集：第 0–8 行是 9 组动作，第 9–10 行是 16 向注视帧
    sprite: petSpritePack('/pet/assets/lulu.webp', { rows: 11, gaze: true }),
  },
]

/**
 * 用户自备形象（可选）：`generated-images.js` 里的 PET_USER_IMAGES。
 *
 * 素材来自 /root/workspace/plugins/dsh-pet/images/，经 scripts/import-lulu.py 抠底、裁边、
 * 缩到 320px 后以 data URI 内联（插件仍是单文件部署，不加 host 静态路由）。
 * 这类形象是**静态画**：不假装有 9 组动作，只做呼吸起伏 + 轻微视线跟随，
 * 所以单独走 `kind: 'image'` 分支，和矢量/位图并列。
 */
function petImagePack(image) {
  return {
    id: image.id,
    label: { zh: image.label, en: image.label },
    kind: 'image',
    image: { url: image.url, width: image.width, height: image.height },
  }
}

function petRegisterImages(images) {
  if (!Array.isArray(images)) return []
  const added = []
  for (const image of images) {
    if (!image || typeof image.id !== 'string' || typeof image.url !== 'string') continue
    // id 由 import 脚本生成（u- 前缀），挡住手写坏数据进渲染层
    if (!/^u-[a-z0-9-]{1,40}$/.test(image.id)) continue
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height)) continue
    if (image.width < 16 || image.height < 16) continue
    if (PET_CHARACTERS.some((character) => character.id === image.id)) continue
    PET_CHARACTERS.push(petImagePack(image))
    added.push(image.id)
  }
  return added
}

petRegisterImages(typeof PET_USER_IMAGES === 'undefined' ? [] : PET_USER_IMAGES)

/**
 * 用户自备**动图**形象（可选）：`generated-anims.js` 里的 `PET_USER_ANIMS`。
 *
 * 来源是小红书/表情包里的动图或短视频，经 scripts/import-anim.py 逐帧抠底、对齐基线、
 * 拼成横向胶片条再内联成 data URI。播放靠一张 keyframes 逐帧推 background-position，
 * 和位图噜噜同一套思路 —— 不用 GIF 解码器，也不会因为 GIF 调色板而发灰。
 */
function petAnimPack(anim) {
  return {
    id: anim.id,
    label: { zh: anim.label, en: anim.label },
    kind: 'anim',
    anim: {
      url: anim.url,
      frameW: anim.frameW,
      frameH: anim.frameH,
      frames: anim.frames,
      durations: anim.durations.slice(),
    },
  }
}

function petRegisterAnims(anims) {
  if (!Array.isArray(anims)) return []
  const added = []
  for (const anim of anims) {
    if (!anim || typeof anim.id !== 'string' || typeof anim.url !== 'string') continue
    // id 由 import 脚本生成（a- 前缀），挡住手写坏数据进渲染层
    if (!/^a-[a-z0-9-]{1,40}$/.test(anim.id)) continue
    if (!/^data:image\//.test(anim.url)) continue
    if (!Number.isFinite(anim.frameW) || !Number.isFinite(anim.frameH)) continue
    if (anim.frameW < 16 || anim.frameH < 16) continue
    if (!Number.isInteger(anim.frames) || anim.frames < 2 || anim.frames > 48) continue
    if (!Array.isArray(anim.durations) || anim.durations.length !== anim.frames) continue
    if (PET_CHARACTERS.some((character) => character.id === anim.id)) continue
    PET_CHARACTERS.push(petAnimPack(anim))
    added.push(anim.id)
  }
  return added
}

petRegisterAnims(typeof PET_USER_ANIMS === 'undefined' ? [] : PET_USER_ANIMS)

function petAnim(id) {
  const character = PET_CHARACTERS.find((c) => c.id === id && c.kind === 'anim')
  return character ? character.anim : null
}

function petIsAnim(id) {
  return Boolean(petAnim(id))
}

/** 动图形象的 DOM：一个空白 div，胶片条由 CSS 背景推着走。 */
function petAnimMarkup(id) {
  const anim = petAnim(id)
  if (!anim) return ''
  return `<div class="dsh-pet-anim" data-anim="${id}" aria-hidden="true"></div>`
}

/** 缩放比：element 原始像素高 → --pet-size。和位图同一套夹取区间。 */
function petAnimScale(id, size) {
  const anim = petAnim(id)
  if (!anim) return 1
  return Math.max(0.2, Math.min(2, size / anim.frameH))
}

/**
 * 动图角色需要的 CSS：一条 keyframes 逐帧推 background-position，帧时长来自素材本身。
 *
 * 为什么不用 GIF：GIF 只有 256 色、边缘发灰；也不便按角色切换速度。存成一张横向
 * webp 胶片条，浏览器解码一次，之后只是背景位移。
 */
function petAnimCss() {
  const blocks = []
  for (const character of PET_CHARACTERS) {
    const anim = character.anim
    if (!anim) continue
    const total = anim.durations.reduce((sum, ms) => sum + ms, 0)
    blocks.push(
      `[data-char='${character.id}'] .dsh-pet-anim, [data-char='${character.id}'] .dsh-pet-anim-thumb { background-image: url("${anim.url}"); background-size: ${anim.frames * 100}% 100%; }`,
    )
    blocks.push(
      `[data-char='${character.id}'] .dsh-pet-anim { width: ${anim.frameW}px; height: ${anim.frameH}px; margin-left: ${-anim.frameW / 2}px; }`,
    )
    blocks.push(`[data-char='${character.id}'] .dsh-pet-anim-thumb { aspect-ratio: ${anim.frameW} / ${anim.frameH}; }`)
    let elapsed = 0
    const steps = anim.durations.map((ms, index) => {
      const at = (elapsed / total) * 100
      elapsed += ms
      // 第一帧写 0 而不是 -0：CSS 里 -0px 合法但没必要，也避免测试里 deepStrictEqual 的坑
      return `  ${at.toFixed(3)}% { background-position: ${index === 0 ? 0 : -index * anim.frameW}px 0; }`
    })
    blocks.push(`@keyframes dsh-pet-anim-${character.id} {\n${steps.join('\n')}\n}`)
    blocks.push(
      `[data-char='${character.id}'] .dsh-pet-anim { animation-name: dsh-pet-anim-${character.id}; animation-duration: ${total}ms; }`,
    )
  }
  return blocks.join('\n')
}

function petImage(id) {
  const character = PET_CHARACTERS.find((c) => c.id === id && c.kind === 'image')
  return character ? character.image : null
}

function petIsImage(id) {
  return Boolean(petImage(id))
}

/** 静态形象的 DOM：一张 <img>，呼吸/跟随由 CSS 变量驱动。 */
function petImageMarkup(id) {
  const image = petImage(id)
  if (!image) return ''
  return `<img class="dsh-pet-image" data-image="${id}" src="${image.url}" alt="" draggable="false" aria-hidden="true">`
}

/** 按 id 取角色；未知 id 回落到第一只，避免坏掉的本地配置把宠物整只弄没。 */
function petCharacter(id) {
  return PET_CHARACTERS.find((c) => c.id === id) ?? PET_CHARACTERS[0]
}

/**
 * 手臂：两条能绕肩旋转的胳膊 + 圆手。
 *
 * 外层 `<g transform="translate(x y)">` 把局部原点搬到肩上，内层形状再按自己的
 * bbox 顶边旋转（CSS `transform-box: fill-box; transform-origin: 50% 0%`），
 * 所以动作只要改 `rotate` 就能让手抬起来 —— 这是「动作要能看出手在动」的骨架。
 */
function petArms(x, y) {
  const side = (name, shoulderX) => `
    <g class="dsh-pet-arm" data-arm="${name}" transform="translate(${shoulderX} ${y})">
      <g class="dsh-pet-arm-shape">
        <rect class="dsh-pet-limb" x="-3.8" y="-1.2" width="7.6" height="12.6" rx="3.8"/>
        <circle class="dsh-pet-hand" cx="0" cy="12.6" r="4.3"/>
      </g>
    </g>`
  return `${side('l', x)}${side('r', 100 - x)}`
}

/** 耳朵 / 尾巴等骨架差异。 */
function petBodyShape(kind) {
  if (kind === 'penguin') {
    return {
      ears: `
        <path class="dsh-pet-body" d="M42 44 q8 -7 16 0 q-8 3 -16 0Z"/>
      `,
      tail: '',
      armAnchor: [27.4, 68.4],
      face: petFace({ eyeGap: 8.6, cheekX: 33 }),
    }
  }
  if (kind === 'fox') {
    return {
      ears: `
        <path class="dsh-pet-body" d="M27 52 L25 24 L48 43 Z"/>
        <path class="dsh-pet-body" d="M73 52 L75 24 L52 43 Z"/>
        <path class="dsh-pet-accent" d="M30 47 L29.4 32 L43 44 Z"/>
        <path class="dsh-pet-accent" d="M70 47 L70.6 32 L57 44 Z"/>
      `,
      tail: `
        <g class="dsh-pet-tail">
          <path class="dsh-pet-body" d="M74 80 q17 -5 15 -23 q1 14 -13 17 z"/>
          <path class="dsh-pet-accent" d="M89 57 q3 9 -5 14 q5 -6 5 -14 z"/>
        </g>
      `,
      armAnchor: [27.4, 68.6],
      face: petFace({ eyeGap: 9.4, cheekX: 30.5 }),
    }
  }
  if (kind === 'capybara') {
    return {
      // 水豚没有明显的尾巴
      tail: '',
      // 耳朵小而圆，画在身体后面、只露出上半截（画在前面会变成两个球）
      back: `
        <ellipse class="dsh-pet-body" cx="24.6" cy="43.6" rx="7" ry="6.4"/>
        <ellipse class="dsh-pet-body" cx="75.4" cy="43.6" rx="7" ry="6.4"/>
        <ellipse class="dsh-pet-line" cx="25" cy="43.8" rx="3" ry="2.6" opacity=".16"/>
        <ellipse class="dsh-pet-line" cx="75" cy="43.8" rx="3" ry="2.6" opacity=".16"/>
      `,
      ears: '',
      // 水豚身体更宽更矮，肩点要往外放一点，不然手臂插在身体里
      armAnchor: [24.4, 69.2],
      // 水豚的头比猫宽，方一点才像水豚
      body: '<ellipse class="dsh-pet-body" cx="50" cy="66.4" rx="27.4" ry="24.6"/>',
      // 水豚的灵魂是大鼻子：一块比身体略深的吻部，压在肚皮上、脸下面，带两个鼻孔
      muzzle: `
        <ellipse class="dsh-pet-muzzle" cx="50" cy="70.6" rx="15.4" ry="10"/>
        <ellipse class="dsh-pet-nostril" cx="45.8" cy="66.8" rx="1.15" ry="0.85"/>
        <ellipse class="dsh-pet-nostril" cx="54.2" cy="66.8" rx="1.15" ry="0.85"/>
      `,
      face: petFace({ eyeY: 60.4, eyeGap: 10.6, mouthY: 74.4, cheekY: 67.4, cheekX: 30 }),
      // 头上一颗小橘子 + 橙色短裤（噜噜的招牌）
      details: `
        <g class="dsh-pet-hat">
          <circle class="dsh-pet-accent" cx="50" cy="21.4" r="7.6"/>
          <path class="dsh-pet-hat-stem" d="M50 14.2 q1 -4.2 4.2 -5.8"/>
          <path class="dsh-pet-leaf" d="M55.2 8.8 q5.4 -1.4 6.6 2.8 q-5.2 2 -6.6 -2.8Z"/>
          <ellipse class="dsh-pet-hat-shine" cx="47.4" cy="19" rx="2.2" ry="1.5"/>
        </g>
        <path class="dsh-pet-accent dsh-pet-shorts" d="M30 81 q20 5 40 0 q1.6 7.6 -1.2 13.6 q-18.8 4 -37.6 -0.2 q-2.8 -6 -1.2 -13.4Z"/>
        <path class="dsh-pet-shorts-line" d="M50 86 v9"/>
      `,
    }
  }
  // cat（默认）
  return {
    ears: `
      <path class="dsh-pet-body" d="M29 51 L31 28 L47 43 Z"/>
      <path class="dsh-pet-body" d="M71 51 L69 28 L53 43 Z"/>
      <path class="dsh-pet-accent" d="M32.6 47 L33.4 34 L43.6 43.4 Z"/>
      <path class="dsh-pet-accent" d="M67.4 47 L66.6 34 L56.4 43.4 Z"/>
    `,
    tail: `
      <g class="dsh-pet-tail">
        <path class="dsh-pet-body" d="M75 84 q12 -4 8 -18 q6 13 -6 16 z"/>
      </g>
    `,
    armAnchor: [26.8, 68.8],
    face: petFace(),
  }
}

/**
 * 渲染一只宠物的完整 SVG。
 *
 * **角色配色不写在这里**：颜色由 CSS 根据宿主元素的 `data-char` 属性注入
 * （见 styles/pet.css 的「角色配色」段），这样切深色主题时不用 JS 重绘 SVG，
 * 设置页的小预览也走同一套颜色规则，不会出现「预览和实际不一样」。
 *
 * @param {string} id 角色 id
 * @param {{decor?: boolean}} [options] decor=false 时不带状态叠加件（设置页预览用）
 * @returns {string} SVG 标记
 */
function petSvg(id, options = {}) {
  const character = petCharacter(id)
  const { decor = true } = options
  const shape = petBodyShape(character.kind)
  return `<svg class="dsh-pet-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <ellipse class="dsh-pet-shadow" cx="50" cy="95.5" rx="23" ry="3.4"/>
    <g class="dsh-pet-breathe">
      ${shape.tail}
      ${shape.back ?? ''}
      ${shape.body ?? '<ellipse class="dsh-pet-body" cx="50" cy="67" rx="26" ry="24"/>'}
      <ellipse class="dsh-pet-belly" cx="50" cy="75" rx="14.6" ry="13"/>
      ${shape.muzzle ?? ''}
      ${shape.ears}
      ${shape.face}
      ${shape.details ?? ''}
      ${shape.arms ?? petArms(shape.armAnchor[0], shape.armAnchor[1])}
    </g>
    ${decor ? PET_STATE_DECOR : ''}
  </svg>`
}

/* ── 位图形象分支 ─────────────────────────────────────────────────────── */

/** 取位图描述；矢量角色返回 null。 */
function petSprite(id) {
  return petCharacter(id).sprite ?? null
}

function petIsSprite(id) {
  return petSprite(id) !== null
}

/**
 * 状态 → 图集动作。`direction` 只在拖拽时有用（往左拖放 runLeft，往右 runRight）。
 * 未知状态回落到 idle，保证图集换了行数也不会「整只不动」。
 */
function petSpriteAction(id, state, direction) {
  const sprite = petSprite(id)
  if (!sprite) return null
  if (state === 'drag') return direction === 'left' ? 'runLeft' : 'runRight'
  return sprite.states[state] ?? 'idle'
}

/** 位图在页面上渲染出来的高度 = --pet-size，因此缩放比 = size / frameH。 */
function petSpriteScale(id, size) {
  const sprite = petSprite(id)
  if (!sprite) return 1
  return Math.max(0.2, Math.min(2, size / sprite.frameH))
}

/** 这个位图角色有没有注视帧（矢量角色没有）。 */
function petSpriteGaze(id) {
  const sprite = petSprite(id)
  return sprite?.gaze ?? null
}

/**
 * 屏幕角度 → 注视帧序号。
 *
 * @param {string} id 角色 id
 * @param {number} angleDeg atan2(dy, dx) 转成的角度：0° 朝右、90° 朝下
 * @returns {number|null} 0–15；非位图/无注视帧时 null
 */
function petSpriteGazeIndex(id, angleDeg) {
  const gaze = petSpriteGaze(id)
  if (!gaze) return null
  const step = gaze.stepDeg || 22.5
  const count = gaze.count || 16
  const relative = angleDeg - (gaze.originDeg ?? -90)
  const wrapped = ((relative % 360) + 360) % 360
  return Math.round(wrapped / step) % count
}

/** 注视帧序号 → 图集格子（row/col 与像素偏移）。 */
function petSpriteGazeCell(id, index) {
  const sprite = petSprite(id)
  const gaze = sprite?.gaze
  if (!sprite || !gaze || index === null || index === undefined) return null
  const count = gaze.count || 16
  const safe = ((index % count) + count) % count
  const row = (gaze.rows?.[0] ?? 9) + Math.floor(safe / (sprite.cols || 8))
  const col = safe % (sprite.cols || 8)
  // 用三元避免 -0（deepStrictEqual 里 -0 !== 0）
  return { index: safe, row, col, x: col === 0 ? 0 : -col * sprite.frameW, y: -row * sprite.frameH }
}

/**
 * 位图角色的 DOM。
 *
 * 外层 figure 仍是方形（气泡、进度环、徽标都按它定位），位图自己按 192×208 的原始
 * 尺寸排版、再用 transform: scale() 缩到 --pet-size 高——不用 background-size 做分数
 * 缩放，避免每换一档尺寸就重算一遍 background-position 的小数误差。
 */
function petSpriteMarkup(id) {
  const sprite = petSprite(id)
  if (!sprite) return ''
  // 后两层是「原生动作」：优先用一条透明视频（<video>），播不了再退回胶片条
  // （横向 WebP + 逐帧 background-position）。都是动作期间盖住位图本体。
  // 第三层是常驻 idle 视频：只给有 IDLE_VIDEO 的形象，闲时顶掉位图 idle 帧，动作/注视时让位
  const idle = petIdleVideo(id)
  const idleVideo = idle
    ? `<video class="dsh-pet-idle" data-sprite-idle="${id}" muted loop playsinline preload="none" aria-hidden="true"></video>`
    : ''
  return `<div class="dsh-pet-sprite" data-sprite="${id}" data-action="idle" aria-hidden="true"></div>`
    + `<div class="dsh-pet-clip" data-sprite-clip="${id}" aria-hidden="true"></div>`
    + `<video class="dsh-pet-video" data-sprite-video="${id}" muted playsinline preload="none" aria-hidden="true"></video>`
    + idleVideo
}

/** 设置页卡片里的小预览（矢量走 SVG，位图取图集第一格，自备图直接缩略）。 */
/**
 * 原生动作片段表：actionId → 横向胶片条。
 *
 * 渲染层在动作期间把它铺在角色位置上（隐藏位图本体和 SVG 道具），
 * 逐帧推 background-position —— 和位图动作同一套机制，不需要 GIF 解码。
 */
// 12 帧 × 150ms = 1800ms，正好等于「鼓掌」动作时长（actions.js 里 seconds: 1.8）
const CLIP_CHEER = { url: '/pet/assets/clip-cheer.webp', frameW: 192, frameH: 208, frames: 12, stepMs: 150 }

// 「蹦跶」的 i2v 片段（assets/clip-hop.webp）没接进来：模型没守住「大小不变」，
// 12 帧全是头肩大特写、帽子与脚出画，铺上去比 SVG 组件更像 bug。等重生成合格素材再接，
// 在那之前 hop 继续走程序化表演（actions.js 的 effect），不影响 data-act 与粒子效果。
const PET_ACTION_CLIPS = {
  lulu: { cheer: CLIP_CHEER },
  pilot: { cheer: CLIP_CHEER },
}

function petActionClip(characterId, actionId) {
  const clips = PET_ACTION_CLIPS[characterId]
  if (!clips) return null
  return clips[actionId] ?? null
}

function petHasClips(characterId) {
  return Boolean(PET_ACTION_CLIPS[characterId])
}

/**
 * 原生动作视频表：actionId → 一条带 alpha 的 VP9 WebM（由 scripts/video-to-webm.py 生成）。
 *
 * 这是「专属动作」的正确形态：帧率/时长不再受 8×11 图集协议约束，浏览器用 <video>
 * 直接播。画布按单元格 192×208 的 2 倍（384×416）输出，角色高 396、基线 406，所以
 * 渲染层只要把它铺成 192×208 的层，就和位图本体严丝合缝对齐。
 * 播不了（浏览器不支持 alpha WebM / 解码失败）时自动退回 PET_ACTION_CLIPS 的胶片条。
 */

// 原生动作视频：一动作一条透明 VP9 WebM（MiniMax-Video-H3-Max 480P/5s 绿幕 → video-to-webm.py）。
// 画布 384×416（= 单格 192×208 的 2 倍），角色高 396 / 脚底基线 406，与 .dsh-pet-sprite 同构；
// seconds 贴近 actions.js 里该动作时长（渲染层按动作时长收尾，超出部分会被截掉）。
const PET_ACTION_VIDEOS = {
  lulu: {
    newyear: { url: '/pet/assets/anim-newyear.webm', seconds: 2.21 },
    lion: { url: '/pet/assets/anim-lion.webm', seconds: 2.58 },
    fireworks: { url: '/pet/assets/anim-fireworks.webm', seconds: 2.42 },
    redpacket: { url: '/pet/assets/anim-redpacket.webm', seconds: 2.21 },
    fu: { url: '/pet/assets/anim-fu.webm', seconds: 2.42 },
    dumpling: { url: '/pet/assets/anim-dumpling.webm', seconds: 2.21 },
    shy: { url: '/pet/assets/anim-shy.webm', seconds: 1.79 },
    cheer: { url: '/pet/assets/anim-cheer.webm', seconds: 1.83 },
    dizzy: { url: '/pet/assets/anim-dizzy.webm', seconds: 2.0 },
    spin: { url: '/pet/assets/anim-spin.webm', seconds: 1.21 },
    roll: { url: '/pet/assets/anim-roll.webm', seconds: 1.58 },
    hop: { url: '/pet/assets/anim-hop.webm', seconds: 1.21 },
  },
  pilot: {
    newyear: { url: '/pet/assets/anim-newyear.webm', seconds: 2.21 },
    lion: { url: '/pet/assets/anim-lion.webm', seconds: 2.58 },
    fireworks: { url: '/pet/assets/anim-fireworks.webm', seconds: 2.42 },
    redpacket: { url: '/pet/assets/anim-redpacket.webm', seconds: 2.21 },
    fu: { url: '/pet/assets/anim-fu.webm', seconds: 2.42 },
    dumpling: { url: '/pet/assets/anim-dumpling.webm', seconds: 2.21 },
    shy: { url: '/pet/assets/anim-shy.webm', seconds: 1.79 },
    cheer: { url: '/pet/assets/anim-cheer.webm', seconds: 1.83 },
    dizzy: { url: '/pet/assets/anim-dizzy.webm', seconds: 2.0 },
    spin: { url: '/pet/assets/anim-spin.webm', seconds: 1.21 },
    roll: { url: '/pet/assets/anim-roll.webm', seconds: 1.58 },
    hop: { url: '/pet/assets/anim-hop.webm', seconds: 1.21 },
  },
}

function petActionVideo(characterId, actionId) {
  const videos = PET_ACTION_VIDEOS[characterId]
  if (!videos) return null
  return videos[actionId] ?? null
}

function petHasVideos(characterId) {
  return Boolean(PET_ACTION_VIDEOS[characterId])
}

/**
 * 常驻 idle 视频（只有默认 pilot 有）：3.75s 透明 WebM 循环。
 *
 * 位图 idle 只有 6 帧、靠 CSS steps 换帧，看久了像定格；这条是图生视频（Wan2.2-I2V）
 * 抽出的连续呼吸/眨眼。画布与动作视频同一套（384×416 / 角色高 396 / 脚底基线 406），
 * 所以渲染层直接当 192×208 的层摆，从 idle 切到动作不会跳位置。
 */
const IDLE_VIDEO = { url: '/pet/assets/idle-loop.webm', seconds: 3.75 }

const PET_IDLE_VIDEOS = { pilot: IDLE_VIDEO }

function petIdleVideo(characterId) {
  return PET_IDLE_VIDEOS[characterId] ?? null
}

/** 胶片条需要的 CSS：图片、background-size（N 格）与逐帧 keyframes。 */
function petClipCss() {
  const blocks = []
  for (const [characterId, clips] of Object.entries(PET_ACTION_CLIPS)) {
    for (const [actionId, clip] of Object.entries(clips)) {
      const total = clip.stepMs * clip.frames
      const name = `dsh-pet-clip-${characterId}-${actionId}`
      const frames = []
      for (let i = 0; i < clip.frames; i += 1) {
        const at = ((i * clip.stepMs) / total) * 100
        frames.push(`  ${at.toFixed(3)}% { background-position: ${-i * clip.frameW}px 0; }`)
      }
      blocks.push(`@keyframes ${name} {\n${frames.join('\n')}\n}`)
      blocks.push(
        `[data-char='${characterId}'] .dsh-pet-clip[data-clip='${actionId}'] { background-image: url("${clip.url}"); background-size: ${clip.frames * 100}% 100%; animation-name: ${name}; animation-duration: ${total}ms; }`,
      )
    }
  }
  return blocks.join('\n')
}

function petPreviewMarkup(id) {
  if (petIsSprite(id)) return '<span class="dsh-pet-sprite-thumb" aria-hidden="true"></span>'
  if (petIsAnim(id)) return '<span class="dsh-pet-anim-thumb" aria-hidden="true"></span>'
  const image = petImage(id)
  if (image) return `<img class="dsh-pet-image-thumb" src="${image.url}" alt="">`
  return petSvg(id, { decor: false })
}

/** 一个动作的 keyframes：每帧用 start% 定位，配合 steps(1, end) 得到离散换帧。 */
function petSpriteKeyframes(name, action, sprite) {
  const total = action.steps.reduce((sum, ms) => sum + ms, 0)
  let elapsed = 0
  const frames = action.steps.map((ms, col) => {
    const at = (elapsed / total) * 100
    elapsed += ms
    return `  ${at.toFixed(3)}% { background-position: ${-col * sprite.frameW}px ${-action.row * sprite.frameH}px; }`
  })
  return `@keyframes ${name} {\n${frames.join('\n')}\n}`
}

/**
 * 生成位图角色需要的全部 CSS（keyframes + 每个动作的 animation 绑定）。
 *
 * 为什么运行时生成而不是写死在 pet.css：动画表是「一份事实」，写两遍迟早对不上；
 * 这段 CSS 只有几 KB，注入一次留到页面生命周期结束。
 */
function petSpriteCss() {
  const blocks = []
  for (const character of PET_CHARACTERS) {
    const sprite = character.sprite
    if (!sprite) continue
    blocks.push(`[data-char='${character.id}'] .dsh-pet-sprite, [data-char='${character.id}'] .dsh-pet-sprite-thumb { background-image: url("${sprite.url}"); }`)
    // 缩略图按各自图集的列/行数缩放：写死 800%×1100% 只对 8×11 的图集成立
    blocks.push(
      `[data-char='${character.id}'] .dsh-pet-sprite-thumb { background-size: ${sprite.cols * 100}% ${sprite.rows * 100}%; }`,
    )
    const actions = { ...sprite.actions }
    if (sprite.idleSlow) actions.idleSlow = sprite.idleSlow
    for (const [key, action] of Object.entries(actions)) {
      const name = `dsh-pet-sprite-${character.id}-${key}`
      const total = action.steps.reduce((sum, ms) => sum + ms, 0)
      blocks.push(petSpriteKeyframes(name, action, sprite))
      blocks.push(
        `[data-char='${character.id}'] .dsh-pet-sprite[data-action='${key}'] { animation-name: ${name}; animation-duration: ${total}ms; }`,
      )
    }
  }
  return blocks.join('\n')
}

/**
 * 运行时注册自定义图集（图集导入用）。
 *
 * host 半把用户上传的图集存在 `~/.dsh/pet-skins/` 并通过 `/pet/skins` 列表返回；
 * 这里把它们当作 sprite 角色塞进 `PET_CHARACTERS`，之后 `petSpriteCss()` 会自然
 * 生成对应的 keyframes（overlay 里调一次 `petEnsureSpriteCss()` 即可生效）。
 *
 * 只接受 host 校验过的 id 形状（`skin-xxxxxxxx`），不认识的条目静默跳过 ——
 * 一条坏数据不该让整份皮肤列表失效。
 *
 * @param {Array<{id?: string, label?: string, rows?: number, mime?: string}>} skins
 * @returns {string[]} 实际新增的角色 id
 */
function petRegisterSkins(skins) {
  const added = []
  if (!Array.isArray(skins)) return added
  for (const skin of skins) {
    const id = String(skin?.id ?? '')
    if (!/^skin-[0-9a-f]{8}$/.test(id)) continue
    if (PET_CHARACTERS.some((character) => character.id === id)) continue
    const rows = Number(skin?.rows)
    if (!Number.isFinite(rows) || rows < 9 || rows > 11) continue
    // host 只保存 PNG / WebP；其它 mime 说明这条元数据已经坏了，注册出来只会是
    // 一只永远加载不出图的宠物，所以直接跳过。
    const mime = String(skin?.mime ?? 'image/webp')
    if (mime !== 'image/png' && mime !== 'image/webp') continue
    const ext = mime === 'image/png' ? 'png' : 'webp'
    const label = String(skin?.label ?? '').trim() || '自定义'
    PET_CHARACTERS.push({
      id,
      label: { zh: label, en: label },
      kind: 'sprite',
      custom: true,
      sprite: petSpritePack(`/pet/skins/${id}.${ext}`, { rows }),
    })
    added.push(id)
  }
  return added
}

/** 当前清单里所有位图角色（含运行时导入的），设置页用来区分「内置 / 自定义」。 */
function petSpriteIds() {
  return PET_CHARACTERS.filter((character) => character.sprite).map((character) => character.id)
}

/* ── client-src/props.js ── */
/**
 * 动作道具（全部手绘 SVG，无外部素材）。
 *
 * 为什么要道具：只让身体「转/跳/缩」看起来像抽象小人，用户的原话是
 * 「很多动作都不动手的，舞狮都没有狮子头套」。所以动作 = 身体动效 + 手臂姿态
 * + 手里真的拿着东西（狮头、红包、毛笔、碗筷、烟花棒）。
 *
 * 坐标系统一用 0–100（和角色 SVG 同一个 viewBox），道具画在「道具层」里、
 * 盖在角色之上，所以矢量和位图角色都能用。颜色一律由 CSS 类提供（不写内联
 * fill），深浅色主题各一套。
 */

/** 狮头鬃毛：一圈花瓣，用代码生成比手写 path 干净，也方便调数量。 */
function petLionMane(count = 13, cx = 50, cy = 56, radius = 22.6, petal = 7.7) {
  const shapes = []
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    const x = (cx + radius * Math.cos(angle)).toFixed(2)
    const y = (cy + radius * Math.sin(angle)).toFixed(2)
    shapes.push(`<circle class="dsh-pet-lion-petal" cx="${x}" cy="${y}" r="${petal}"/>`)
  }
  return `<g class="dsh-pet-lion-mane">${shapes.join('')}</g>`
}

/** 写福字的那张红纸上的笔画（按顺序淡入，模拟一笔一笔写上去）。 */
const PET_FU_STROKES = [
  // 点
  '<path class="dsh-pet-ink" d="M50 79.6 q0.6 1.6 0 3.2"/>',
  // 一
  '<path class="dsh-pet-ink" d="M44.4 83.6 h11.2"/>',
  // 一（第二横）
  '<path class="dsh-pet-ink" d="M43 86 q7 -1 14 0"/>',
  // 口（左竖 + 上横 + 右竖 + 下横）
  '<path class="dsh-pet-ink" d="M46.2 88.4 v6.2 q3.8 0.8 7.6 0 v-6.2 q-3.8 -0.8 -7.6 0Z"/>',
  // 口里的十字（田心）
  '<path class="dsh-pet-ink" d="M46.2 91.6 h7.6"/>',
  '<path class="dsh-pet-ink" d="M50 88.4 v6.2"/>',
  // 收笔一捺
  '<path class="dsh-pet-ink" d="M42.8 95 q7.2 2.4 14.4 0"/>',
]

/**
 * 道具定义。
 *
 * `id` 与 `actions.js` 里动作的 `prop` 字段对应；`markup` 是 SVG 片段，
 * 里面只用 class，不带内联样式，方便 CSS 分别给浅色/深色配色。
 */
const PET_PROPS = {
  /** 舞狮：狮头 + 披风 + 两只手举的杆 */
  lion: () => `
    <g class="dsh-pet-lion">
      <path class="dsh-pet-lion-cloth" d="M30 60 q20 -6 40 0 q7 15 4 27 q-24 7 -48 0 q-3 -12 4 -27Z"/>
      <path class="dsh-pet-lion-trim" d="M30 60 q20 -6 40 0"/>
      <path class="dsh-pet-lion-trim" d="M33.4 87 q16.6 5 33.2 0"/>
      ${petLionMane()}
      ${petLionMane(11, 50, 56, 17.4, 6.2).replace('dsh-pet-lion-petal', 'dsh-pet-lion-petal-inner')}
      <g class="dsh-pet-lion-head">
        <ellipse class="dsh-pet-lion-face" cx="50" cy="56" rx="17" ry="15"/>
        <path class="dsh-pet-lion-brow" d="M50 41.4 q-6.8 1.4 -8.8 6.2 q4.8 -2.6 8.8 -2.4 q4 0 8.8 2.4 q-2 -4.8 -8.8 -6.2Z"/>
        <circle class="dsh-pet-lion-eye" cx="42.6" cy="52.6" r="5.4"/>
        <circle class="dsh-pet-lion-eye" cx="57.4" cy="52.6" r="5.4"/>
        <circle class="dsh-pet-lion-pupil" cx="43" cy="53" r="2.6"/>
        <circle class="dsh-pet-lion-pupil" cx="57" cy="53" r="2.6"/>
        <circle class="dsh-pet-lion-glint" cx="44.4" cy="51.2" r="1.1"/>
        <circle class="dsh-pet-lion-glint" cx="56.6" cy="51.2" r="1.1"/>
        <g class="dsh-pet-lion-mouth">
          <path class="dsh-pet-lion-jaw" d="M41 62 q9 10.4 18 0 q-3.6 6.6 -9 6.8 q-5.4 -0.2 -9 -6.8Z"/>
          <path class="dsh-pet-lion-teeth" d="M43.6 63.4 L46 67 L48.4 63.6 L50.8 67 L53.2 63.6 L55.8 67 L58.4 63.2"/>
          <path class="dsh-pet-lion-tongue" d="M46.2 66.6 q3.8 2.8 7.6 0 q-1.6 3.6 -3.8 3.6 q-2.2 0 -3.8 -3.6Z"/>
        </g>
        <path class="dsh-pet-lion-horn" d="M50 41 q-2.2 -6.4 1.6 -9.6 q0.4 4.6 2.4 6.4 q-1.6 0.6 -1.6 3.2Z"/>
        <circle class="dsh-pet-lion-nose" cx="50" cy="59" r="2.8"/>
        <g class="dsh-pet-lion-tassel">
          <path class="dsh-pet-lion-tassel-line" d="M50 31.4 v-4.4"/>
          <circle class="dsh-pet-lion-tassel-ball" cx="50" cy="25.8" r="2.8"/>
        </g>
      </g>
    </g>`,

  /** 作揖：两只拳头在身前抱在一起 */
  clasp: () => `
    <g class="dsh-pet-clasp">
      <ellipse class="dsh-pet-sleeve" cx="50" cy="88.6" rx="17.4" ry="7.2"/>
      <path class="dsh-pet-sleeve-trim" d="M33.4 86.6 q16.6 6.6 33.2 0"/>
      <circle class="dsh-pet-fist" cx="43.2" cy="84.2" r="6.8"/>
      <circle class="dsh-pet-fist" cx="56.8" cy="84.2" r="6.8"/>
      <path class="dsh-pet-sleeve-line" d="M50 80.4 v8.6"/>
    </g>`,

  /** 红包：双手举着的红包，带金边和金印 */
  envelope: () => `
    <g class="dsh-pet-envelope">
      <rect class="dsh-pet-envelope-body" x="40.2" y="64" width="19.6" height="25.4" rx="2.6"/>
      <path class="dsh-pet-envelope-flap" d="M40.2 66.4 q9.8 7.2 19.6 0"/>
      <rect class="dsh-pet-envelope-band" x="40.2" y="73.6" width="19.6" height="4"/>
      <circle class="dsh-pet-envelope-seal" cx="50" cy="75.6" r="3.3"/>
      <ellipse class="dsh-pet-envelope-shine" cx="44.4" cy="68" rx="1.5" ry="2.4"/>
    </g>`,

  /** 写福字：红纸 + 毛笔 + 一笔笔写上去的黑墨 */
  brush: () => `
    <g class="dsh-pet-writing" transform="rotate(-2.6 50 86)">
      <rect class="dsh-pet-paper" x="35" y="75.6" width="30" height="20.4" rx="1.6"/>
      <rect class="dsh-pet-paper-edge" x="35" y="75.6" width="30" height="20.4" rx="1.6"/>
      ${PET_FU_STROKES.map((stroke, index) => stroke.replace('class="dsh-pet-ink"', `class="dsh-pet-ink" style="--pet-ink-delay:${(index * 0.34).toFixed(2)}s"`)).join('')}
      <g class="dsh-pet-brush">
        <path class="dsh-pet-brush-handle" d="M68.6 59.4 l-8.2 13.6"/>
        <path class="dsh-pet-brush-tip" d="M59.2 72 q2 2.6 0.6 5.2 q-2.6 -0.4 -3.2 -2.8Z"/>
      </g>
    </g>`,

  /** 吃饺子：碗 + 饺子 + 筷子 + 热气 */
  bowl: () => `
    <g class="dsh-pet-bowl">
      <g class="dsh-pet-steam">
        <path class="dsh-pet-steam-wisp" d="M45.4 74 q-2 -3.4 0.6 -6 q2.6 -2.6 0.4 -5.6"/>
        <path class="dsh-pet-steam-wisp" d="M54.6 74 q-2 -3.4 0.6 -6 q2.6 -2.6 0.4 -5.6"/>
      </g>
      <ellipse class="dsh-pet-dumpling" cx="45.4" cy="78.6" rx="5.4" ry="3.8"/>
      <ellipse class="dsh-pet-dumpling" cx="54.6" cy="78.2" rx="5" ry="3.6"/>
      <path class="dsh-pet-bowl-rim" d="M31 80.4 q19 6 38 0"/>
      <path class="dsh-pet-bowl-body" d="M31 80.4 q3 13.6 19 13.6 q16 0 19 -13.6 q-19 5 -38 0Z"/>
      <path class="dsh-pet-bowl-base" d="M42 94.4 q8 1.8 16 0"/>
      <g class="dsh-pet-chopsticks">
        <path class="dsh-pet-chopstick" d="M60.4 76.6 l7.4 -14.4"/>
        <path class="dsh-pet-chopstick" d="M62.8 77.4 l7 -14"/>
      </g>
    </g>`,

  /** 放烟花：手里一根仙女棒，顶端在炸火花 */
  firework: () => `
    <g class="dsh-pet-firework">
      <path class="dsh-pet-firework-stick" d="M62.4 78 l19.6 -11.8"/>
      <g class="dsh-pet-firework-spark">
        <circle class="dsh-pet-firework-core" cx="84" cy="64.6" r="3.4"/>
        <circle class="dsh-pet-firework-core-2" cx="84" cy="64.6" r="6.6"/>
        <path class="dsh-pet-firework-ray" d="M84 55.8 v-4.4"/>
        <path class="dsh-pet-firework-ray" d="M84 73.4 v4.4"/>
        <path class="dsh-pet-firework-ray" d="M75.2 64.6 h-4.4"/>
        <path class="dsh-pet-firework-ray" d="M92.8 64.6 h4.4"/>
        <path class="dsh-pet-firework-ray" d="M77.8 58.4 l-3.2 -3.2"/>
        <path class="dsh-pet-firework-ray" d="M90.2 70.8 l3.2 3.2"/>
        <path class="dsh-pet-firework-ray" d="M90.2 58.4 l3.2 -3.2"/>
        <path class="dsh-pet-firework-ray" d="M77.8 70.8 l-3.2 3.2"/>
      </g>
    </g>`,
}

/**
 * 取道具标记。
 * @param {string|null} id 道具 id
 * @returns {string} SVG 片段；未知 id 返回空串
 */
function petPropMarkup(id) {
  const build = id ? PET_PROPS[id] : null
  if (!build) return ''
  return `<g class="dsh-pet-prop" data-prop="${id}">${build()}</g>`
}

/** 道具 id 清单（测试和构建校验用）。 */
function petPropIds() {
  return Object.keys(PET_PROPS)
}

/* ── client-src/outfits.js ── */
/**
 * 装扮（outfits）：给位图噜噜加的可换配饰。
 *
 * 背景：用户反馈「噜噜太素了」。位图图集是别人画好的，改不了像素；但图画在
 * 同一个 100×100 的坐标层里（和动作道具层一样），所以**在原图上叠一层 SVG**
 * 就能换装：围巾、贝雷帽、眼镜、耳机、花环、圣诞帽、领结、披风、小书包。
 *
 * 坐标系（对着图集量的，别乱改）：
 *   橘子  x 42–60, y 3–13      头顶 y≈14
 *   耳朵  左 (22,22) 右 (78,22)
 *   眼睛  左 (34,25) 右 (66,25)
 *   口鼻  x 26–74, y 32–58    脖子 y≈58   肩 y≈62
 *   短裤  y 80–93             脚底 y=100
 *
 * 规则：markup 里只写 class、不写内联样式/颜色，配色全在 styles/pet.css，
 * 这样深色主题和「换配色」都只改 CSS。
 */

/** 装扮定义；`none` 由空字符串表示，不占条目。 */
const PET_OUTFITS = [
  {
    id: 'scarf',
    label: { zh: '红围巾', en: 'Red scarf' },
    markup: () => `
      <g class="dsh-pet-scarf">
        <path class="dsh-pet-scarf-band" d="M28 60.4 q22 -6.6 44 0 l-1.4 8.6 q-20.6 -6 -41.2 0 Z"/>
        <path class="dsh-pet-scarf-fold" d="M31 63.8 q19 -5 38 0"/>
        <path class="dsh-pet-scarf-tail" d="M27.6 67.8 l-4.4 15.8 q5.2 3 9.6 1.2 l2.4 -15.4 Z"/>
        <path class="dsh-pet-scarf-tail-inner" d="M25.8 71.2 l-1.2 11.2"/>
        <circle class="dsh-pet-scarf-knot" cx="28.6" cy="67.2" r="4.2"/>
      </g>`,
  },
  {
    id: 'beret',
    label: { zh: '贝雷帽', en: 'Beret' },
    markup: () => `
      <g class="dsh-pet-beret" transform="rotate(-10 46 16)">
        <ellipse class="dsh-pet-beret-main" cx="46" cy="15.6" rx="19.4" ry="8.6"/>
        <path class="dsh-pet-beret-band" d="M27 18.4 q19.2 6.4 38.4 0 l-0.6 2.6 q-18.6 6.4 -37.2 0 Z"/>
        <path class="dsh-pet-beret-shine" d="M35 11 q8 -4.4 17.4 -2.4"/>
        <circle class="dsh-pet-beret-stem" cx="57.6" cy="7.4" r="2.4"/>
      </g>`,
  },
  {
    id: 'glasses',
    label: { zh: '圆框眼镜', en: 'Round glasses' },
    markup: () => `
      <g class="dsh-pet-glasses">
        <circle class="dsh-pet-glasses-lens" cx="34" cy="25" r="7.4"/>
        <circle class="dsh-pet-glasses-lens" cx="66" cy="25" r="7.4"/>
        <path class="dsh-pet-glasses-frame" d="M41.4 24.4 q8.6 -4.4 17.2 0"/>
        <path class="dsh-pet-glasses-temple" d="M26.6 23.4 L19.6 21.4"/>
        <path class="dsh-pet-glasses-temple" d="M73.4 23.4 L80.4 21.4"/>
        <path class="dsh-pet-glasses-glint" d="M30.4 22.2 q2.4 -2.6 5.4 -2"/>
      </g>`,
  },
  {
    id: 'headphones',
    label: { zh: '耳机', en: 'Headphones' },
    markup: () => `
      <g class="dsh-pet-headphones">
        <path class="dsh-pet-headphones-band" d="M21.6 30.4 q0.6 -20.8 28.4 -22.6 q27.8 1.8 28.4 22.6"/>
        <rect class="dsh-pet-headphones-cup" x="14.4" y="22.4" width="12.4" height="17.8" rx="5.4"/>
        <rect class="dsh-pet-headphones-cup" x="73.2" y="22.4" width="12.4" height="17.8" rx="5.4"/>
        <rect class="dsh-pet-headphones-cushion" x="18.6" y="25" width="4.4" height="12.6" rx="2.2"/>
        <rect class="dsh-pet-headphones-cushion" x="77" y="25" width="4.4" height="12.6" rx="2.2"/>
      </g>`,
  },
  {
    id: 'flower',
    label: { zh: '花环', en: 'Flower crown' },
    markup: () => {
      const flowers = [
        [30, 19],
        [38.6, 13.6],
        [48, 11.4],
        [57.6, 13.4],
        [66.4, 18.4],
      ]
      return `
      <g class="dsh-pet-flower">
        <path class="dsh-pet-flower-vine" d="M26 22.4 q11 -9.6 22 -11.4 q11 1.8 22 11.4"/>
        ${flowers
          .map(
            ([cx, cy], index) => `
          <g transform="translate(${cx} ${cy})">
            ${[0, 72, 144, 216, 288]
              .map((deg) => `<circle class="dsh-pet-flower-petal" cx="0" cy="-3.1" r="2.5" transform="rotate(${deg})"/>`)
              .join('')}
            <circle class="dsh-pet-flower-core" cx="0" cy="0" r="1.9"/>
            ${index === 2 ? '<circle class="dsh-pet-flower-glint" cx="-0.7" cy="-0.7" r="0.7"/>' : ''}
          </g>`,
          )
          .join('')}
        <circle class="dsh-pet-flower-leaf" cx="24.4" cy="24.4" r="2.4"/>
        <circle class="dsh-pet-flower-leaf" cx="71.6" cy="23.6" r="2.2"/>
      </g>`
    },
  },
  {
    id: 'santa',
    label: { zh: '圣诞帽', en: 'Santa hat' },
    markup: () => `
      <g class="dsh-pet-santa">
        <path class="dsh-pet-santa-cone" d="M26.6 18.6 q2 -13.4 19.4 -17 q9.6 5.6 24.2 14.2 q-22.4 9.6 -43.6 2.8 Z"/>
        <path class="dsh-pet-santa-cone-shade" d="M33 18.8 q4.2 -9.2 12.6 -13 l-1.4 13.8 Z"/>
        <ellipse class="dsh-pet-santa-brim" cx="47.6" cy="19.8" rx="21.2" ry="6.2"/>
        <circle class="dsh-pet-santa-pompom" cx="67.4" cy="3.6" r="4.2"/>
      </g>`,
  },
  {
    id: 'bowtie',
    label: { zh: '领结', en: 'Bow tie' },
    markup: () => `
      <g class="dsh-pet-bowtie">
        <path class="dsh-pet-bowtie-wing" d="M50 62.6 L37.4 56.4 q-1.8 6.4 0 12.6 Z"/>
        <path class="dsh-pet-bowtie-wing" d="M50 62.6 L62.6 56.4 q1.8 6.4 0 12.6 Z"/>
        <circle class="dsh-pet-bowtie-knot" cx="50" cy="62.6" r="3.1"/>
      </g>`,
  },
  {
    id: 'cape',
    label: { zh: '小披风', en: 'Little cape' },
    markup: () => `
      <g class="dsh-pet-cape">
        <path class="dsh-pet-cape-panel" d="M27 57.6 q-9 9.6 -8.2 30.4 q6.6 2.6 12.4 0.6 q-2.2 -17 4 -30.4 Z"/>
        <path class="dsh-pet-cape-panel" d="M73 57.6 q9 9.6 8.2 30.4 q-6.6 2.6 -12.4 0.6 q2.2 -17 -4 -30.4 Z"/>
        <path class="dsh-pet-cape-lining" d="M22.4 78.6 q4.4 2 8.6 0.4"/>
        <path class="dsh-pet-cape-lining" d="M77.6 78.6 q-4.4 2 -8.6 0.4"/>
        <ellipse class="dsh-pet-cape-collar" cx="50" cy="57" rx="23.4" ry="5.4"/>
        <path class="dsh-pet-cape-collar-line" d="M31.8 55.4 q18.2 6 36.4 0"/>
      </g>`,
  },
  {
    id: 'backpack',
    label: { zh: '小书包', en: 'Backpack' },
    markup: () => `
      <g class="dsh-pet-backpack">
        <rect class="dsh-pet-backpack-body" x="18.8" y="64.6" width="13.2" height="17.4" rx="3.6"/>
        <rect class="dsh-pet-backpack-body" x="68" y="64.6" width="13.2" height="17.4" rx="3.6"/>
        <path class="dsh-pet-backpack-strap" d="M40.6 57.4 L43.4 76.6"/>
        <path class="dsh-pet-backpack-strap" d="M59.4 57.4 L56.6 76.6"/>
        <rect class="dsh-pet-backpack-pocket" x="20.6" y="70.4" width="9.6" height="5.6" rx="2.2"/>
        <rect class="dsh-pet-backpack-pocket" x="69.8" y="70.4" width="9.6" height="5.6" rx="2.2"/>
        <circle class="dsh-pet-backpack-clip" cx="43.4" cy="74.4" r="1.7"/>
        <circle class="dsh-pet-backpack-clip" cx="56.6" cy="74.4" r="1.7"/>
      </g>`,
  },
]

/** 全部装扮 id（不含「不戴」）。 */
function petOutfitIds() {
  return PET_OUTFITS.map((outfit) => outfit.id)
}

/** 按 id 取装扮定义；未知 id 返回 null。 */
function petOutfit(id) {
  return PET_OUTFITS.find((outfit) => outfit.id === id) ?? null
}

/** 装扮的 SVG 片段；`none` / 未知 id 返回空串。 */
function petOutfitMarkup(id) {
  const outfit = petOutfit(id)
  return outfit ? outfit.markup() : ''
}

/** 装扮名（按语言），未知 id 回落 id 本身。 */
function petOutfitLabel(id, lang) {
  const outfit = petOutfit(id)
  if (!outfit) return id
  return (lang === 'zh' ? outfit.label.zh : outfit.label.en) ?? outfit.label.en ?? id
}

/** 「不戴」+ 全部装扮，用于设置页下拉。 */
function petOutfitOptions() {
  return [{ id: 'none', label: { zh: '不戴', en: 'None' } }, ...PET_OUTFITS.map(({ id, label }) => ({ id, label }))]
}

/** 顺次切换装扮：none → 第一个 → … → 最后一个 → none。 */
function petOutfitNext(current, step = 1) {
  const ids = ['none', ...petOutfitIds()]
  const index = ids.indexOf(current)
  const next = (index + step + ids.length) % ids.length
  return ids[next]
}

/* ── client-src/i18n.js ── */
/**
 * 文案：中英双语。
 *
 * 这里**不**调用 `ctx.locale.register(ns, …)`：那个 API 的键集合由 DSH 自己的
 * 类型系统在编译期校验（`LocaleNamespaceMap` 的键联合），运行时注册一个外部
 * namespace 属于灰色地带，升级时容易因为校验变严而整块抛错。
 * 桌宠只需要知道「当前界面是中文还是英文」，读 `ctx.locale.getSnapshot().active`
 * 就够，剩下的字典自己管——耦合面更小，也不跟 DSH 的语言包抢命名空间。
 */

/** 字典。`{n}` / `{name}` 这类占位符由 petT 的格式化参数填充。 */
const PET_MESSAGES = {
  zh: {
    // 状态气泡
    thinking: '正在为你处理 {n} 个任务…',
    thinkingOne: '正在处理任务…',
    complete: '任务完成啦！',
    completeMany: '{n} 个任务完成了',
    alert: '有 {n} 个待审批/提问在等你',
    alertOne: '有 1 个待审批在等你',
    idle: '我在旁边待着～',
    idleLines: ['喵～', '要不要休息一下？', '今天也要顺利呀', '需要我陪你吗？', '摸我会变开心哦'],
    sleep: 'Zzz…（先眯一会儿）',
    feedDone: '好吃！亲密度 +{n}',
    levelUp: '升到 {level} 级啦！',
    focusStart: '专注 {n} 分钟，我陪着你',
    focusTick: '还剩 {n} 分钟',
    focusDone: '专注完成，起来动一下！',
    focusBreakDone: '休息结束，继续吧',
    // 菜单
    menuFeed: '喂食',
    menuPet: '摸摸',
    menuFocus: '开始专注',
    menuFocusStop: '结束专注',
    menuHide: '隐藏 5 分钟',
    menuSleep: '去睡觉',
    menuWake: '叫醒',
    menuSettings: '宠物设置',
    sectionActions: '动作',
    sectionOutfit: '装扮',
    outfitDesc: '给噜噜戴点东西：围巾、帽子、眼镜都行，随时可换。',
    outfitNone: '不戴',
    menuOutfit: '换装扮',
    actionsDesc: '点一下让宠物表演（右键菜单里也能点播）',
    actionPlay: '表演',
    menuResetPos: '回到角落',
    // 气泡里的按钮
    openSession: '去看看',
    dismiss: '知道啦',
    // 设置页
    settingsTitle: '宠物',
    // 活动流 / 上下文 / 日记 / 图集
    titlePending: '待审批',
    titlePendingMany: '{n} 个待审批',
    usageWarn: '上下文用了 {n}%，我有点跟不上了',
    usageHigh: '上下文快满了（{n}%），该开个新会话了',
    nudgeAsk: '陪我玩一会儿？',
    sectionLive: '活动与预警',
    liveDesc: '工具级状态、回合汇报、上下文占用（host 半需重启 DSH 后生效）',
    liveFeedLabel: '工具级状态',
    liveFeedDesc: '开着时宠物会显示正在跑哪个工具、这一轮用了多久；关掉只保留「在跑 / 等你审批」这类会话级状态。',
    usageWarnLabel: '上下文预警阈值',
    liveOnline: '活动流已连接',
    liveOffline: '活动流未连接（重启 DSH 后可用）',
    sectionDiary: '每日日记',
    diaryDesc: '今天跑了多少轮、用了哪些工具',
    diaryRefresh: '刷新',
    diaryEmpty: '今天还没有记录',
    sectionSkins: '自定义图集',
    skinsDesc: '导入 Codex 格式图集：8 列，单格 192×208，PNG 或 WebP',
    skinsImport: '选择图集文件',
    skinsRemove: '删除',
    skinsApplied: '已导入并切换',
    skinsFailed: '导入失败：{msg}',
    sectionAppearance: '外观',
    sectionBehaviour: '行为',
    sectionGrowth: '养成',
    enable: '显示宠物',
    enableDesc: '关掉后立即从页面移除，设置保留',
    character: '形象',
    size: '大小',
    sizeSmall: '小',
    sizeMedium: '中',
    sizeLarge: '大',
    sizeHuge: '超大',
    sound: '音效',
    soundDesc: '点击、完成、待审批时发出轻响（WebAudio 合成）',
    volume: '音量',
    motion: '动画',
    motionAuto: '跟随系统',
    motionOff: '关闭动画',
    motionDesc: '关闭后只剩淡入淡出，适合低性能设备或专注时使用',
    mobile: '手机端',
    mobileHide: '不显示',
    mobileShow: '显示',
    notify: '任务提醒',
    notifyDesc: '运行中/完成/待审批时弹气泡；点击可直接跳到会话',
    bubbleSeconds: '气泡停留',
    sleepAfter: '多久后打瞌睡',
    minutes: '{n} 分钟',
    focusWork: '专注时长',
    focusBreak: '休息时长',
    affinity: '亲密度',
    level: '等级',
    tasks: '完成任务',
    focusCount: '专注次数',
    streak: '连续天数',
    exportData: '导出数据',
    importData: '导入数据',
    resetGrowth: '清空养成',
    resetAll: '恢复默认设置',
    importPrompt: '把之前导出的 JSON 粘贴到这里',
    importOk: '导入成功',
    importFail: '导入失败：内容不是有效的宠物数据',
    resetDone: '已重置',
    copied: '已复制到剪贴板',
    disabledHint: '宠物当前被关闭，可在设置 → 宠物里重新打开',
  },
  en: {
    thinking: 'Working on {n} tasks…',
    thinkingOne: 'Working on a task…',
    complete: 'Task done!',
    completeMany: '{n} tasks done',
    alert: '{n} approvals waiting for you',
    alertOne: '1 approval waiting for you',
    idle: 'Just hanging out~',
    idleLines: ['Meow~', 'Take a break?', 'Have a good day!', 'Want some company?', 'Pet me and I cheer up'],
    sleep: 'Zzz… (napping)',
    feedDone: 'Yum! Bond +{n}',
    levelUp: 'Level {level}!',
    focusStart: 'Focusing {n} min, I will keep you company',
    focusTick: '{n} min left',
    focusDone: 'Focus done — stand up and stretch!',
    focusBreakDone: 'Break over, back to it',
    menuFeed: 'Feed',
    menuPet: 'Pet',
    menuFocus: 'Start focus',
    menuFocusStop: 'Stop focus',
    menuHide: 'Hide for 5 min',
    menuSleep: 'Go to sleep',
    menuWake: 'Wake up',
    menuSettings: 'Pet settings',
    sectionActions: 'Actions',
    sectionOutfit: 'Outfit',
    outfitDesc: 'Dress Lulu up: scarf, hat, glasses — switch any time.',
    outfitNone: 'None',
    menuOutfit: 'Change outfit',
    actionsDesc: 'Click to make the pet perform (also available in the right-click menu)',
    actionPlay: 'Play',
    menuResetPos: 'Back to corner',
    openSession: 'Take a look',
    dismiss: 'Got it',
    settingsTitle: 'Pet',
    titlePending: 'Approval needed',
    titlePendingMany: '{n} approvals needed',
    usageWarn: 'Context at {n}% — I am losing track',
    usageHigh: 'Context nearly full ({n}%) — start a new session',
    nudgeAsk: 'Play with me?',
    sectionLive: 'Activity & alerts',
    liveDesc: 'Tool-level status, turn reports, context pressure (host half needs a DSH restart)',
    liveFeedLabel: 'Tool-level state',
    liveFeedDesc: 'When on, the pet shows which tool is running and how long the turn took. Off keeps only session-level states (running / awaiting approval).',
    usageWarnLabel: 'Context warning threshold',
    liveOnline: 'Activity feed connected',
    liveOffline: 'Activity feed offline (restart DSH to enable)',
    sectionDiary: 'Daily diary',
    diaryDesc: 'Turns and tools from today',
    diaryRefresh: 'Refresh',
    diaryEmpty: 'Nothing recorded today',
    sectionSkins: 'Custom sprite sheets',
    skinsDesc: 'Codex format: 8 columns, 192x208 per frame, PNG or WebP',
    skinsImport: 'Choose sprite sheet',
    skinsRemove: 'Remove',
    skinsApplied: 'Imported and applied',
    skinsFailed: 'Import failed: {msg}',
    sectionAppearance: 'Appearance',
    sectionBehaviour: 'Behaviour',
    sectionGrowth: 'Growth',
    enable: 'Show pet',
    enableDesc: 'Removes the pet from the page immediately; settings are kept',
    character: 'Character',
    size: 'Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    sizeHuge: 'Huge',
    sound: 'Sound',
    soundDesc: 'Soft blips on click, completion and approvals (synthesised via WebAudio)',
    volume: 'Volume',
    motion: 'Animation',
    motionAuto: 'Follow system',
    motionOff: 'Off',
    motionDesc: 'Off keeps only fades — for low-end devices or deep focus',
    mobile: 'On phones',
    mobileHide: 'Hidden',
    mobileShow: 'Shown',
    notify: 'Task reminders',
    notifyDesc: 'Bubbles on running / done / approval; click to jump to the session',
    bubbleSeconds: 'Bubble linger',
    sleepAfter: 'Nap after',
    minutes: '{n} min',
    focusWork: 'Focus length',
    focusBreak: 'Break length',
    affinity: 'Bond',
    level: 'Level',
    tasks: 'Tasks done',
    focusCount: 'Focus sessions',
    streak: 'Streak days',
    exportData: 'Export data',
    importData: 'Import data',
    resetGrowth: 'Reset growth',
    resetAll: 'Restore defaults',
    importPrompt: 'Paste the JSON you exported earlier',
    importOk: 'Imported',
    importFail: 'Import failed: not valid pet data',
    resetDone: 'Reset',
    copied: 'Copied to clipboard',
    disabledHint: 'The pet is hidden — re-enable it in Settings → Pet',
  },
}

/**
 * 取翻译函数。
 *
 * @param {string} lang `zh` / `en`（其它语言回落英文，与 DSH 语言包策略一致）
 * @returns {(key: string, vars?: Record<string, string|number>) => string}
 */
function petTranslator(lang) {
  const dict = PET_MESSAGES[lang] ?? PET_MESSAGES.en
  const fallback = PET_MESSAGES.en
  return function t(key, vars) {
    const template = dict[key] ?? fallback[key] ?? key
    if (typeof template !== 'string') return key
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    )
  }
}

/** 从 DSH locale 快照里取当前语言；取不到就当英文。 */
function petLocaleLang(locale) {
  try {
    const active = locale?.getSnapshot?.()?.active
    if (typeof active === 'string' && active.startsWith('zh')) return 'zh'
    return 'en'
  } catch {
    return 'en'
  }
}

/* ── client-src/live.js ── */
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

/* ── client-src/store.js ── */
/**
 * 本地状态：设置 + 养成数据。
 *
 * 存 localStorage 而不是 host 文件，理由是这台机器 dsh.frankfurtlin.top 是多人共用：
 *   · 宠物是**个人化**的东西（形象、大小、音效、位置），按浏览器存才不会互相踩；
 *   · 不需要 host 半写文件，插件与 DSH 内核的耦合面保持在 webServer 一个 API；
 *   · 也不进 DSH 的设置（cordis.patch.yml），避免用户换设备时被别人的偏好覆盖。
 *
 * 代价是「换浏览器/清缓存就重来」——对桌宠这个代价可以接受，所以设置页写了导出/导入。
 *
 * 所有读写都经过 try/catch：localStorage 在隐私模式、磁盘满、被策略禁用时会抛异常，
 * 那时宠物照常跑（纯内存态），绝不因为存不了数据就让整个页面挂掉。
 */

/** 设置键（带版本号：结构变更时换 v2，老数据自然失效而不是崩在迁移里）。 */
const PET_SETTINGS_KEY = 'dsh-pet:settings:v1'

/** 养成数据键。 */
const PET_GROWTH_KEY = 'dsh-pet:growth:v1'

/** 每级需要的亲密度。 */
const PET_LEVEL_STEP = 50

/**
 * 设置默认值。
 *
 * `size` 是最常用的旋钮，所以给 3 档预设（小/中/大）而不是滑杆——桌宠挡视线时
 * 用户要的是「一眼点对」，不是精确到像素。
 */
const PET_DEFAULT_SETTINGS = {
  enabled: true,
  character: 'pilot',
  size: 104,
  dock: 'right',
  /** 自由拖拽落点（%），null 表示用 dock 的默认角 */
  pos: null,
  sound: true,
  volume: 0.45,
  motion: 'auto', // auto | off
  mobile: 'hide', // hide | show
  notifications: true,
  liveFeed: true,
  /** 上下文占用告警阈值（百分比）：跨过 warn 提醒一次，跨过 high 再提醒一次。 */
  usageWarn: 70,
  usageHigh: 88,
  bubbleSeconds: 8,
  sleepAfterMin: 5,
  /** 常驻装扮：none | scarf | beret | glasses | headphones | flower | santa | bowtie | cape | backpack */
  outfit: 'scarf',
  focusWorkMin: 25,
  focusBreakMin: 5,
}


/** 一次性迁移：2026-11-05 起默认形象从经典噜噜换成图生视频版 pilot。 */
const PET_DEFAULT_CHARACTER_MIGRATION_KEY = 'dsh-pet:migrate:v1-default-pilot'

function petMigrateDefaultCharacter(settings, stored) {
  try {
    if (!stored || localStorage.getItem(PET_DEFAULT_CHARACTER_MIGRATION_KEY)) return settings
    localStorage.setItem(PET_DEFAULT_CHARACTER_MIGRATION_KEY, '1')
    // 老默认就是 lulu；只有停在老默认上的用户跟随新默认，自己选过别的形象的不动
    return stored.character === 'lulu' ? { ...settings, character: 'pilot' } : settings
  } catch {
    return settings
  }
}

function petReadJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function petWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 今天（本地时区）的 `YYYY-MM-DD`，用于连续天数与每日统计。 */
function petToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 两个日期串相差几天（用于连续打卡判定）。 */
function petDayDiff(from, to) {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  return Math.round((b - a) / 86400000)
}

/**
 * 设置/养成的小型可订阅 store。
 *
 * 没有引入任何状态库：这里只有两个对象和一批监听器，几十行就够了；
 * 引入 react-redux 之类的依赖只会让这个"纯前端小宠物"升级时更难对齐 DSH 的基线模块表。
 */
function petCreateStore() {
  const listeners = new Set()
  const storedSettings = petReadJson(PET_SETTINGS_KEY)
  let settings = petMigrateDefaultCharacter({ ...PET_DEFAULT_SETTINGS, ...(storedSettings ?? {}) }, storedSettings)
  let growth = {
    affinity: 0,
    pets: 0,
    feeds: 0,
    tasks: 0,
    focus: 0,
    streak: 1,
    lastDay: petToday(),
    ...(petReadJson(PET_GROWTH_KEY) ?? {}),
  }

  let saveTimer = null
  const flush = () => {
    saveTimer = null
    petWriteJson(PET_SETTINGS_KEY, settings)
    petWriteJson(PET_GROWTH_KEY, growth)
  }
  const scheduleSave = () => {
    if (saveTimer !== null) return
    saveTimer = setTimeout(flush, 250)
  }
  const emit = () => {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        console.warn('[dsh-pet] listener failed', error)
      }
    }
  }

  /** 每次拿到成长数据前先滚一次"今天"：跨天时刷新连续天数。 */
  const rollDay = () => {
    const today = petToday()
    if (growth.lastDay === today) return
    const diff = petDayDiff(growth.lastDay, today)
    growth.streak = diff === 1 ? (growth.streak || 1) + 1 : 1
    growth.lastDay = today
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSettings() {
      return settings
    },
    getGrowth() {
      rollDay()
      return growth
    },
    patchSettings(patch) {
      settings = { ...settings, ...patch }
      scheduleSave()
      emit()
      return settings
    },
    resetSettings() {
      settings = { ...PET_DEFAULT_SETTINGS }
      scheduleSave()
      emit()
      return settings
    },
    /** 亲密度增减；返回本次是否升级。 */
    addAffinity(delta) {
      rollDay()
      const before = Math.floor(growth.affinity / PET_LEVEL_STEP)
      growth.affinity = Math.max(0, growth.affinity + delta)
      const after = Math.floor(growth.affinity / PET_LEVEL_STEP)
      scheduleSave()
      emit()
      return after > before
    },
    /** 计数类事件（摸头/喂食/完成任务/番茄）。 */
    bump(key, by = 1) {
      rollDay()
      growth[key] = (growth[key] ?? 0) + by
      scheduleSave()
      emit()
    },
    /** 当前等级与到下一级的进度（0..1）。 */
    level() {
      const affinity = growth.affinity
      return {
        level: 1 + Math.floor(affinity / PET_LEVEL_STEP),
        progress: (affinity % PET_LEVEL_STEP) / PET_LEVEL_STEP,
        current: affinity % PET_LEVEL_STEP,
        need: PET_LEVEL_STEP,
      }
    },
    /** 导出为可粘贴的 JSON（换设备搬家）。 */
    exportData() {
      return JSON.stringify({ version: 1, settings, growth }, null, 2)
    },
    /** 导入；结构不对就整体拒绝，不写半截数据。 */
    importData(text) {
      const parsed = petSafeParseObject(text)
      if (!parsed) return { ok: false, reason: 'invalid-json' }
      const nextSettings = parsed.settings
      const nextGrowth = parsed.growth
      if (!nextSettings || typeof nextSettings !== 'object' || !nextGrowth || typeof nextGrowth !== 'object') {
        return { ok: false, reason: 'invalid-shape' }
      }
      settings = { ...PET_DEFAULT_SETTINGS, ...nextSettings }
      growth = { ...growth, ...nextGrowth }
      scheduleSave()
      emit()
      return { ok: true }
    },
    /** 清空养成数据（设置保留）。 */
    resetGrowth() {
      growth = { affinity: 0, pets: 0, feeds: 0, tasks: 0, focus: 0, streak: 1, lastDay: petToday() }
      scheduleSave()
      emit()
    },
  }
}

function petSafeParseObject(text) {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/* ── client-src/sound.js ── */
/**
 * 音效：用 WebAudio 现场合成，不打包任何音频文件。
 *
 * 桌宠的音效必须"轻、短、不吓人"，而且不能因为多一个 200KB 的 sfx 包把插件变成
 * 需要审版权的东西。这里全部是振荡器 + 增益包络，五声音阶（宫商角徵羽）保证
 * 随便叠都不会刺耳。
 *
 * 浏览器的自动播放策略要求 AudioContext 在用户手势里创建/恢复，所以：
 *   · 首次 pointerdown 时 `prime()` 一次，之后所有事件音都能响；
 *   · 没有手势时 play() 直接静默返回，绝不抛错、绝不在控制台刷警告。
 */

/** 五声音阶（C 大调宫商角徵羽），跨八度取几个音，够用了。 */
const PET_SCALE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  E6: 1318.5,
}

/**
 * 音量曲线：把设置里的 0–1 旋钮映射成每个音符的峰值增益（进压缩器之前）。
 *
 * 演进：`volume * 0.5`（默认 0.3 → 0.15，用户报"没声音"）→ `0.8 × (0.2 + 0.8v)`
 * （默认 → 0.448）→ 用户仍觉得小，所以再抬一档：**满量程 1.8、下限 0.3**，
 * 默认 45% 得 1.107。>1 的增益靠主总线上的压缩器兜住，不会硬削波。
 *
 * 用「底 + 线性」而不是直接乘，是为了不让低段变成静音：滑块拉到 10% 也还有反馈。
 */
const PET_SOUND_FLOOR = 0.3
const PET_SOUND_MASTER = 1.8

/** 0 → 静音；>0 → 0.54..1.8 的峰值增益（单调递增，进压缩器前）。 */
function petSoundPeak(volume) {
  const level = Math.min(1, Math.max(0, Number(volume) || 0))
  if (level <= 0) return 0
  return PET_SOUND_MASTER * (PET_SOUND_FLOOR + (1 - PET_SOUND_FLOOR) * level)
}

function petCreateSound(store) {
  let context = null
  let bus = null

  /**
   * 主总线：所有音符先汇到一条增益，再过一个压缩器。
   *
   * 有了压缩器才敢把单音峰值推到 1.8：压缩器把峰值压平，响度上去但不会削波失真。
   * 没有 DynamicsCompressor（极老浏览器）就退回直接接输出，此时靠音量映射自身不越界。
   */
  const audioBus = (ctx) => {
    if (bus && bus.context === ctx) return bus
    const input = ctx.createGain()
    input.gain.setValueAtTime(1, ctx.currentTime)
    const compressor = typeof ctx.createDynamicsCompressor === 'function' ? ctx.createDynamicsCompressor() : null
    if (compressor) {
      compressor.threshold.setValueAtTime(-14, ctx.currentTime)
      compressor.knee.setValueAtTime(8, ctx.currentTime)
      compressor.ratio.setValueAtTime(8, ctx.currentTime)
      compressor.attack.setValueAtTime(0.003, ctx.currentTime)
      compressor.release.setValueAtTime(0.14, ctx.currentTime)
      input.connect(compressor)
      compressor.connect(ctx.destination)
    } else {
      input.connect(ctx.destination)
    }
    bus = { context: ctx, input, compressed: Boolean(compressor) }
    return bus
  }

  const audioContext = () => {
    if (context) return context
    const Ctor = window.AudioContext ?? window.webkitAudioContext
    if (!Ctor) return null
    try {
      context = new Ctor()
    } catch {
      return null
    }
    return context
  }

  /**
   * 一个音符：振荡器 + 指数衰减包络。
   *
   * @param {AudioContext} ctx
   * @param {{freq: number, start: number, dur: number, type?: OscillatorType, peak?: number}} note
   */
  const note = (ctx, { freq, start, dur, type = 'sine', peak = 0.22 }) => {
    // 时长放宽 1.5 倍：原来的 80–120ms 太"点"了，听起来像没响
    const length = Math.max(0.09, dur * 1.5)
    const bus = audioBus(ctx)
    const target = bus ? bus.input : ctx.destination

    const shape = (freqHz, wave, weight) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.frequency.setValueAtTime(freqHz, start)
      // 12ms 起音 → 60% 处仍保 45% 音量（延音）→ 指数收尾，比纯衰减"响"得多
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak * weight, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(peak * weight * 0.45, start + length * 0.6)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
      osc.connect(gain).connect(target)
      osc.start(start)
      osc.stop(start + length + 0.02)
    }

    shape(freq, type, 1)
    // 二次谐波：只加 18%，但明显提升"响度感"，不改变音色风格
    shape(freq * 2, 'triangle', 0.18)
  }

  /**
   * 低频冲击：60–120Hz 的短正弦。
   *
   * 用户连着两次说"声音太小"，而单纯抬音量已经到压缩器上限了。听觉响度很大一部分
   * 来自低频能量，所以给点击类音型垫一层 thump——同样的峰值，听起来"重"得多。
   */
  const thump = (ctx, { freq = 96, start, dur = 0.14, peak = 0.3 }) => {
    const bus = audioBus(ctx)
    const target = bus ? bus.input : ctx.destination
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), start + dur)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain).connect(target)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  /**
   * 噪声爆发（烟花 / 呼呼声 / 鼓面）。
   *
   * 用一次性噪声 buffer + 带通滤波：不放音频文件，也不会像正弦那样"电子味"。
   */
  let noiseBuffer = null
  const noiseBurst = (ctx, { start, dur = 0.3, peak = 0.3, freq = 1200, q = 0.9, sweep = null }) => {
    if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
      const length = Math.floor(ctx.sampleRate * 1.2)
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    }
    const bus = audioBus(ctx)
    const target = bus ? bus.input : ctx.destination
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq, start)
    filter.Q.setValueAtTime(q, start)
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, sweep), start + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    source.connect(filter).connect(gain).connect(target)
    source.start(start)
    source.stop(start + dur + 0.02)
  }

  /** 每种事件的音型；返回 0 表示无音。 */
  const patterns = {
    pet: [[PET_SCALE.E5, 0, 0.1], [PET_SCALE.G5, 0.05, 0.12]],
    gongxi: [[PET_SCALE.C5, 0, 0.16], [PET_SCALE.G5, 0.07, 0.18], [PET_SCALE.C6, 0.15, 0.26]],
    drum: [[196, 0, 0.1], [196, 0.18, 0.1], [196, 0.36, 0.1], [196, 0.54, 0.12]],
    coin: [[PET_SCALE.E6, 0, 0.1], [PET_SCALE.C6, 0.06, 0.14]],
    chime: [[PET_SCALE.C6, 0, 0.18], [PET_SCALE.E6, 0.09, 0.24]],
    chew: [[220, 0, 0.07], [200, 0.14, 0.07], [240, 0.28, 0.08]],
    // 纯噪声/低频音型：占位空数组，真正的发声在 play() 的特殊分支里
    firework: [],
    whoosh: [],
    feed: [[PET_SCALE.G5, 0, 0.09], [PET_SCALE.C6, 0.07, 0.14]],
    jump: [[PET_SCALE.C5, 0, 0.08], [PET_SCALE.G5, 0.04, 0.12]],
    complete: [[PET_SCALE.C6, 0, 0.12], [PET_SCALE.E6, 0.09, 0.16], [PET_SCALE.G5, 0.18, 0.22]],
    alert: [[PET_SCALE.A5, 0, 0.09], [PET_SCALE.A5, 0.14, 0.12]],
    focus: [[PET_SCALE.C5, 0, 0.1], [PET_SCALE.E5, 0.1, 0.1], [PET_SCALE.G5, 0.2, 0.2]],
    levelup: [[PET_SCALE.C5, 0, 0.1], [PET_SCALE.E5, 0.08, 0.1], [PET_SCALE.G5, 0.16, 0.1], [PET_SCALE.C6, 0.24, 0.26]],
  }

  return {
    /** 在用户手势里调用一次，解开自动播放限制。 */
    prime() {
      const ctx = audioContext()
      if (!ctx) return
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    play(kind) {
      const settings = store.getSettings()
      if (!settings.sound || settings.volume <= 0) return
      const pattern = patterns[kind]
      if (!pattern) return
      const ctx = audioContext()
      if (!ctx || ctx.state !== 'running') return
      const now = ctx.currentTime + 0.01
      // 没有压缩器时不把 >1 的增益直接送出去，否则会削波失真
      const bus = audioBus(ctx)
      const wanted = petSoundPeak(settings.volume)
      const peak = bus?.compressed === false ? Math.min(wanted, 0.85) : wanted
      if (peak <= 0) return
      for (const [freq, offset, dur] of pattern) {
        note(ctx, { freq, start: now + offset, dur, peak })
      }
      // 点击类：垫一层低频冲击 + 一点点噪声瞬态，同样的峰值听起来"重"
      if (kind === 'pet' || kind === 'feed') {
        thump(ctx, { freq: kind === 'pet' ? 104 : 88, start: now, dur: 0.16, peak: peak * 0.55 })
        noiseBurst(ctx, { start: now, dur: 0.05, peak: peak * 0.22, freq: 2600, q: 1.2 })
      }
      if (kind === 'drum') {
        thump(ctx, { freq: 72, start: now, dur: 0.3, peak: peak * 0.5 })
        noiseBurst(ctx, { start: now, dur: 0.12, peak: peak * 0.3, freq: 420, q: 0.8 })
      }
      if (kind === 'firework') {
        thump(ctx, { freq: 60, start: now, dur: 0.34, peak: peak * 0.5 })
        noiseBurst(ctx, { start: now, dur: 0.16, peak: peak * 0.28, freq: 2400, q: 0.6, sweep: 400 })
        noiseBurst(ctx, { start: now + 0.26, dur: 0.42, peak: peak * 0.34, freq: 900, q: 0.5, sweep: 1600 })
      }
      if (kind === 'whoosh') {
        noiseBurst(ctx, { start: now, dur: 0.28, peak: peak * 0.26, freq: 500, q: 0.7, sweep: 2200 })
      }
    },
  }
}

/* ── client-src/actions.js ── */
/**
 * 动作库：右键点播 + 自主表演。
 *
 * 参考对象是 `@luweiyabo/dsh-whale-pet`（MIT 代码，95 个动作 / 16 分类 / 右键点播 /
 * 意图仲裁 / 自主漫游）。它那 95 个动作是 webm 视频，而且动画媒体来自上游
 * `PC2005-cloud/dsh-pet`，授权是「允许开源使用、禁止商用」——不能搬进这里。
 *
 * 所以这里换一条路：**全部用 CSS 关键帧 + DOM 粒子在宠物本体上表演**。
 * 好处是没有素材体积（bundle 不涨）、没有授权问题、矢量/位图形象都能演；
 * 代价是动作种类比视频方案少，靠"效果名"复用（12 个动作 = 7 种动效编排）。
 *
 * 每个动作的字段：
 *   id       动作 id（也是 localStorage / 测试里的键）
 *   category festival | fun | move（右键菜单按此分组）
 *   effect   动效名，对应 pet.css 里 `@keyframes dsh-pet-act-<effect>`
 *   seconds  表演时长（同时决定 --pet-act-ms）
 *   sound    sound.play() 的音型名
 *   fx       粒子层类型（firework / envelope / confetti / sparkle / fu），null 表示无粒子
 *   label    中英名（菜单与设置页用）
 *   say      表演时气泡里的台词
 */

const PET_ACTION_CATEGORIES = [
  { id: 'festival', label: { zh: '节日', en: 'Festivals' } },
  { id: 'fun', label: { zh: '卖萌', en: 'Fun' } },
  { id: 'move', label: { zh: '动一动', en: 'Moves' } },
]

const PET_ACTIONS = [
  {
    id: 'newyear', prop: 'clasp', arms: 'clasp',
    category: 'festival',
    effect: 'bow',
    seconds: 2.2,
    sound: 'gongxi',
    fx: 'confetti',
    label: { zh: '拜年', en: 'New Year bow' },
    say: { zh: '新年好！恭喜发财～', en: 'Happy new year! Fortune to you~' },
  },
  {
    id: 'lion', prop: 'lion', arms: 'lift',
    category: 'festival',
    effect: 'lion',
    seconds: 2.6,
    sound: 'drum',
    fx: null,
    label: { zh: '舞狮', en: 'Lion dance' },
    say: { zh: '咚咚锵！咚咚锵！', en: 'Dong dong qiang!' },
  },
  {
    id: 'fireworks', prop: 'firework', arms: 'hold',
    category: 'festival',
    effect: 'hop',
    seconds: 2.4,
    sound: 'firework',
    fx: 'firework',
    label: { zh: '放烟花', en: 'Fireworks' },
    say: { zh: '咻——砰！', en: 'Whoosh — bang!' },
  },
  {
    id: 'redpacket', prop: 'envelope', arms: 'clasp',
    category: 'festival',
    effect: 'bounce',
    seconds: 2.2,
    sound: 'coin',
    fx: 'envelope',
    label: { zh: '收红包', en: 'Red envelope' },
    say: { zh: '谢谢老板，红包拿来！', en: 'Thank you for the red envelope!' },
  },
  {
    id: 'fu', prop: 'brush', arms: 'write',
    category: 'festival',
    effect: 'brush',
    seconds: 2.4,
    sound: 'chime',
    fx: 'fu',
    label: { zh: '写福字', en: 'Write 福' },
    say: { zh: '福到啦～', en: 'Fortune arrives!' },
  },
  {
    id: 'dumpling', prop: 'bowl', arms: 'eat',
    category: 'festival',
    effect: 'chew',
    seconds: 2.2,
    sound: 'chew',
    fx: null,
    label: { zh: '吃饺子', en: 'Eat dumplings' },
    say: { zh: '真香！', en: 'Yum!' },
  },
  {
    id: 'shy', prop: null, arms: 'shy',
    category: 'fun',
    effect: 'shy',
    seconds: 1.8,
    sound: 'pet',
    fx: null,
    label: { zh: '害羞', en: 'Shy' },
    say: { zh: '哎呀别看了…', en: 'Aw, stop looking…' },
  },
  {
    id: 'cheer', prop: null, arms: 'clap',
    category: 'fun',
    effect: 'cheer',
    seconds: 1.8,
    sound: 'complete',
    fx: 'sparkle',
    label: { zh: '鼓掌', en: 'Cheer' },
    say: { zh: '好耶！', en: 'Yay!' },
  },
  {
    id: 'dizzy', prop: null, arms: 'balance',
    category: 'fun',
    effect: 'dizzy',
    seconds: 2,
    sound: 'jump',
    fx: null,
    label: { zh: '转晕了', en: 'Dizzy' },
    say: { zh: '晕…晕了…', en: 'So… dizzy…' },
  },
  {
    id: 'spin', prop: null, arms: 'balance',
    category: 'move',
    effect: 'spin',
    seconds: 1.2,
    sound: 'whoosh',
    fx: null,
    label: { zh: '转圈', en: 'Spin' },
    say: { zh: '看我转圈！', en: 'Watch me spin!' },
  },
  {
    id: 'roll', prop: null, arms: 'balance',
    category: 'move',
    effect: 'roll',
    seconds: 1.6,
    sound: 'whoosh',
    fx: null,
    label: { zh: '打滚', en: 'Roll' },
    say: { zh: '滚来滚去～', en: 'Rolling around~' },
  },
  {
    id: 'hop', prop: null, arms: 'pump',
    category: 'move',
    effect: 'hop',
    seconds: 1.2,
    sound: 'jump',
    fx: null,
    label: { zh: '蹦跶', en: 'Hop' },
    say: { zh: '嘿！', en: 'Hey!' },
  },
]

/** 空闲时自己表演的池子（不带台词的轻动作，避免打扰）。 */
const PET_IDLE_ACTIONS = ['hop', 'spin', 'shy', 'dizzy', 'cheer', 'roll']

/** 动作标签。 */
function petActionLabel(action, lang) {
  if (!action) return ''
  return action.label?.[lang] ?? action.label?.en ?? action.id
}

/** 动作台词（可能没有）。 */
function petActionSay(action, lang) {
  if (!action) return ''
  return action.say?.[lang] ?? action.say?.en ?? ''
}

function petActionById(id) {
  return PET_ACTIONS.find((action) => action.id === id) ?? null
}

function petActionCategories() {
  return PET_ACTION_CATEGORIES
}

function petActionsByCategory(category) {
  return PET_ACTIONS.filter((action) => action.category === category)
}

/** 随机挑一个空闲表演（注入 rand 便于测试）。 */
function petRandomIdleAction(rand = Math.random) {
  const index = Math.min(PET_IDLE_ACTIONS.length - 1, Math.floor(rand() * PET_IDLE_ACTIONS.length))
  return PET_IDLE_ACTIONS[index]
}

/** 粒子配色：节日用红金，其余用主色系。 */
const PET_FX_COLORS = {
  confetti: ['#e5484d', '#f5a524', '#f6c65a', '#3b6fe0', '#7aa85a'],
  firework: ['#ffd166', '#ff8fab', '#8ecae6', '#c3f584', '#f4a261'],
  envelope: ['#e5484d', '#f6c65a'],
  sparkle: ['#f5a524', '#ffd166', '#fff4c2'],
}

/**
 * 生成粒子描述（纯数据，DOM 由 overlay 创建）。
 *
 * 每条粒子只带「从原点飞多远、转多少度、延迟多久」，轨迹交给 CSS 的
 * `@keyframes dsh-pet-fx-fly` 用 transform 完成（合成层，不触发布局）。
 *
 * @param {'firework'|'envelope'|'confetti'|'sparkle'|'fu'} kind
 * @param {() => number} rand 0..1 随机源（测试里可注入固定序列）
 */
function petFxParticles(kind, rand = Math.random) {
  if (!kind) return []
  if (kind === 'fu') {
    return [{ char: '福', color: '#e5484d', dx: 0, dy: -46, rot: 0, delay: 0, size: 22 }]
  }
  const palette = PET_FX_COLORS[kind] ?? PET_FX_COLORS.sparkle
  const count = kind === 'firework' ? 14 : kind === 'envelope' ? 6 : kind === 'confetti' ? 12 : 8
  const particles = []
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + rand() * 0.5
    const spread = kind === 'envelope' ? 34 : kind === 'confetti' ? 54 : 64
    const distance = spread * (0.55 + rand() * 0.65)
    particles.push({
      char: kind === 'envelope' ? '🧧' : kind === 'sparkle' ? '✦' : '',
      color: palette[index % palette.length],
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance * (kind === 'envelope' ? 0.6 : 1) - (kind === 'envelope' ? 26 : 8)),
      rot: Math.round((rand() * 2 - 1) * 220),
      delay: Math.round(rand() * (kind === 'firework' ? 180 : 90)),
      size: Math.round(6 + rand() * (kind === 'firework' ? 8 : 5)),
    })
  }
  return particles
}

/* ── client-src/state.js ── */
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

/* ── client-src/overlay.js ── */
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

  /** 常驻 idle 视频层（只有 IDLE_VIDEO 的形象才有这个元素）。 */
  const idleVideoLayer = () => figure.querySelector('.dsh-pet-idle')

  /** idle 视频解码失败过一次就别再试，退回位图 idle 帧。 */
  let idleVideoBroken = false

  /**
   * 常驻 idle 视频：闲着的时候用一条循环 WebM 顶掉位图 idle 帧（6 帧 steps 换帧
   * 看久了像定格），比图集连贯得多。
   *
   * 让位规则与注视一致：动作、拖拽、注视、关动效（或系统要求减少动态效果）时都不放，
   * 交给原有渲染 —— 否则注视帧、动作视频会和 idle 视频叠在一起。
   */
  const syncIdleVideo = () => {
    const layer = idleVideoLayer()
    if (!layer) return
    const video = petIdleVideo(root.getAttribute('data-char') ?? '')
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const stateName = effectiveState()
    const wanted = Boolean(video)
      && !idleVideoBroken
      && root.getAttribute('data-motion') !== 'off'
      && !reduced
      && !state.action
      && !state.drag
      && root.getAttribute('data-gaze') !== 'look'
      && (stateName === 'idle' || stateName === 'sleep')
    if (!wanted) {
      if (root.hasAttribute('data-idle-video')) {
        try {
          layer.pause()
        } catch {}
        root.removeAttribute('data-idle-video')
      }
      return
    }
    if (layer.getAttribute('src') !== video.url) {
      layer.setAttribute('src', video.url)
      layer.load()
      // onerror 是单值属性：只在挂新 src 时设一次，不会越挂越多
      layer.onerror = () => {
        idleVideoBroken = true
        root.removeAttribute('data-idle-video')
      }
    }
    // 睡觉时放慢，像呼吸变缓；清醒时按原速
    layer.playbackRate = stateName === 'sleep' ? 0.55 : 1
    root.setAttribute('data-idle-video', '')
    if (layer.paused) {
      const played = layer.play()
      if (played && typeof played.catch === 'function') {
        played.catch(() => {
          idleVideoBroken = true
          root.removeAttribute('data-idle-video')
        })
      }
    }
  }


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
    syncIdleVideo()
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
      syncIdleVideo()
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
    syncIdleVideo()
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
    syncIdleVideo()
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

/* ── client-src/settings.js ── */
/**
 * 设置面板（React）。
 *
 * 同一个组件挂两处：
 *   1. DSH 官方的 `settings.section` 槽位 —— 用户从设置里能找到；
 *   2. 宠物右键菜单里的「宠物设置」—— 就地弹出我们自己的浮层（main.js 负责）。
 *
 * 用官方控件语义（checkbox / select / range）而不是自绘开关：DSH 换主题、
 * 改字号、加键盘焦点样式时这些控件自动跟着走，我们少维护一套。
 */

const petReact = require('react')
const petH = petReact.createElement

/**
 * 建一个设置面板组件。
 *
 * @param {{
 *   store: ReturnType<typeof petCreateStore>,
 *   sound: ReturnType<typeof petCreateSound>,
 *   t: (key: string, vars?: Record<string, string | number>) => string,
 *   onTestPet?: () => void,
 * }} deps
 */
function petCreateSettingsPanel(deps) {
  const { store, sound, live, t, onTestPet, onPlayAction, onSkinsChanged } = deps

  /** 一行「标签 + 说明 + 控件」。 */
  function Row(props) {
    return petH(
      'div',
      { className: 'dsh-pet-settings-row' },
      petH(
        'div',
        { className: 'dsh-pet-settings-label' },
        petH('span', null, props.label),
        props.desc ? petH('span', { className: 'dsh-pet-settings-desc' }, props.desc) : null,
      ),
      props.children,
    )
  }

  function SectionTitle(props) {
    return petH('div', { className: 'dsh-pet-settings-desc', style: { fontWeight: 600, marginTop: 2 } }, props.children)
  }

  return function PetSettingsPanel() {
    const [, force] = petReact.useState(0)
    const [note, setNote] = petReact.useState('')
    const [importing, setImporting] = petReact.useState(false)
    const [importText, setImportText] = petReact.useState('')
    /** 每日日记（/pet/diary）：null = 还没拉到或 host 半未激活 */
    const [diary, setDiary] = petReact.useState(null)
    /** 已导入的自定义图集（/pet/skins） */
    const [skinList, setSkinList] = petReact.useState([])
    const [skinNote, setSkinNote] = petReact.useState('')
    /** host 活动流快照（online=false 时下面几段显示为"未连接"） */
    const [liveState, setLiveState] = petReact.useState(() => live?.get?.() ?? null)

    petReact.useEffect(() => {
      const off = store.subscribe(() => force((n) => n + 1))
      return () => off()
    }, [])

    petReact.useEffect(() => {
      loadDiary()
      loadSkins()
      if (typeof live?.subscribe === 'function') return live.subscribe(setLiveState)
      return undefined
    }, [])

    /**
     * 日记与图集都走 host 的 `/pet/*` 接口。
     *
     * 面板可能在 host 半还没重启起来时打开（路由 404），所以每个请求都只做
     * 「成功就用、失败就退化」，绝不弹错 —— 设置面板不该因为可选功能不可用而报红。
     */
    function loadDiary() {
      const lang = petLocaleLang(petProbe(deps.ctx, 'locale'))
      fetch(`/pet/diary?lang=${lang === 'en' ? 'en' : 'zh'}`, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setDiary(payload?.ok ? payload : null))
        .catch(() => setDiary(null))
    }

    function loadSkins() {
      fetch('/pet/skins', { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload?.ok) {
            setSkinList([])
            return
          }
          const skins = Array.isArray(payload.skins) ? payload.skins : []
          setSkinList(skins)
          // 把远端图集注册成角色（只加不改），再让 overlay 重算一次 keyframes
          if (petRegisterSkins(skins).length > 0) onSkinsChanged?.()
        })
        .catch(() => setSkinList([]))
    }

    function uploadSkin(file) {
      if (!file) return
      setSkinNote(t('skinsImport'))
      file
        .arrayBuffer()
        .then((buffer) =>
          fetch('/pet/skins', {
            method: 'POST',
            headers: {
              'content-type': file.type || 'application/octet-stream',
              'x-pet-label': file.name.replace(/\.[^.]+$/, '').slice(0, 40),
            },
            body: buffer,
          }),
        )
        .then(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok || !payload?.ok) {
            setSkinNote(t('skinsFailed', { msg: payload?.message ?? `HTTP ${response.status}` }))
            return
          }
          const skins = Array.isArray(payload.skins) ? payload.skins : []
          setSkinList(skins)
          petRegisterSkins(skins)
          onSkinsChanged?.()
          const id = payload.skin?.id
          if (typeof id === 'string' && id !== '') update({ character: id })
          setSkinNote(t('skinsApplied'))
        })
        .catch((error) => setSkinNote(t('skinsFailed', { msg: String(error?.message ?? error) })))
    }

    function removeSkinById(id) {
      fetch(`/pet/skins?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload?.ok) return
          setSkinList(Array.isArray(payload.skins) ? payload.skins : [])
          if (settings.character === id) update({ character: 'pilot' })
          onSkinsChanged?.()
        })
        .catch(() => {})
    }

    const lang = petLocaleLang(petProbe(deps.ctx, 'locale'))
    const settings = store.getSettings()
    const growth = store.getGrowth()
    const level = store.level()
    const update = (patch) => store.patchSettings(patch)

    const flash = (text) => {
      setNote(text)
      setTimeout(() => setNote(''), 2400)
    }

    const onExport = async () => {
      const text = store.exportData()
      try {
        await navigator.clipboard.writeText(text)
        flash(t('copied'))
      } catch {
        setImportText(text)
        setImporting(true)
        flash(t('exportData'))
      }
    }

    const onImport = () => {
      const result = store.importData(importText)
      if (result.ok) {
        setImporting(false)
        setImportText('')
        flash(t('importOk'))
      } else {
        flash(t('importFail'))
      }
    }

    const sizeOptions = [
      { value: 76, label: t('sizeSmall') },
      { value: 104, label: t('sizeMedium') },
      { value: 136, label: t('sizeLarge') },
      { value: 200, label: t('sizeHuge') },
    ]

    return petH(
      'div',
      { className: 'dsh-pet-settings' },
      petH(SectionTitle, null, t('sectionAppearance')),
      petH(
        Row,
        { label: t('enable'), desc: t('enableDesc') },
        petH('input', {
          type: 'checkbox',
          checked: settings.enabled,
          'data-testid': 'pet-enable',
          onChange: (event) => update({ enabled: event.target.checked }),
        }),
      ),
      petH(
        'div',
        { className: 'dsh-pet-settings-chars', 'data-testid': 'pet-characters' },
        ...PET_CHARACTERS.map((character) =>
          petH(
            'button',
            {
              key: character.id,
              type: 'button',
              className: 'dsh-pet-settings-char',
              'data-active': settings.character === character.id ? 'true' : 'false',
              'data-char': character.id,
              'aria-pressed': settings.character === character.id,
              onClick: () => update({ character: character.id }),
            },
            petH('span', { dangerouslySetInnerHTML: { __html: petPreviewMarkup(character.id) } }),
            petH('span', null, character.label[petLocaleLang(petProbe(deps.ctx, 'locale'))] ?? character.label.en),
          ),
        ),
      ),
      petH(
        Row,
        { label: t('size') },
        petH(
          'select',
          {
            value: String(settings.size),
            'data-testid': 'pet-size',
            onChange: (event) => update({ size: Number(event.target.value) }),
          },
          ...sizeOptions.map((option) => petH('option', { key: option.value, value: String(option.value) }, option.label)),
        ),
      ),
      petH(
        Row,
        { label: t('sectionOutfit'), desc: t('outfitDesc') },
        petH(
          'select',
          {
            value: settings.outfit ?? 'none',
            'data-testid': 'pet-outfit',
            onChange: (event) => update({ outfit: event.target.value }),
          },
          ...petOutfitOptions().map((option) =>
            petH(
              'option',
              { key: option.id, value: option.id },
              option.id === 'none' ? t('outfitNone') : option.label[lang] ?? option.label.en,
            ),
          ),
        ),
      ),
      petH(SectionTitle, null, t('sectionBehaviour')),
      petH(
        Row,
        { label: t('notify'), desc: t('notifyDesc') },
        petH('input', {
          type: 'checkbox',
          checked: settings.notifications,
          onChange: (event) => update({ notifications: event.target.checked }),
        }),
      ),
      petH(
        Row,
        { label: t('sound'), desc: t('soundDesc') },
        petH('input', {
          type: 'checkbox',
          checked: settings.sound,
          'data-testid': 'pet-sound',
          onChange: (event) => {
            update({ sound: event.target.checked })
            if (event.target.checked) sound.play('pet')
          },
        }),
      ),
      settings.sound
        ? petH(
            Row,
            { label: t('volume') },
            petH('input', {
              type: 'range',
              min: 10,
              max: 100,
              step: 5,
              value: Math.round(settings.volume * 100),
              style: { width: 140 },
              onChange: (event) => update({ volume: Number(event.target.value) / 100 }),
            }),
          )
        : null,
      petH(
        Row,
        { label: t('motion'), desc: t('motionDesc') },
        petH(
          'select',
          { value: settings.motion, onChange: (event) => update({ motion: event.target.value }) },
          petH('option', { value: 'auto' }, t('motionAuto')),
          petH('option', { value: 'off' }, t('motionOff')),
        ),
      ),
      petH(
        Row,
        { label: t('mobile') },
        petH(
          'select',
          { value: settings.mobile, onChange: (event) => update({ mobile: event.target.value }) },
          petH('option', { value: 'hide' }, t('mobileHide')),
          petH('option', { value: 'show' }, t('mobileShow')),
        ),
      ),
      petH(
        Row,
        { label: t('bubbleSeconds') },
        petH('input', {
          type: 'range',
          min: 3,
          max: 20,
          step: 1,
          value: settings.bubbleSeconds,
          style: { width: 140 },
          onChange: (event) => update({ bubbleSeconds: Number(event.target.value) }),
        }),
      ),
      petH(
        Row,
        { label: t('sleepAfter') },
        petH(
          'select',
          { value: String(settings.sleepAfterMin), onChange: (event) => update({ sleepAfterMin: Number(event.target.value) }) },
          ...[1, 3, 5, 10, 30].map((minute) => petH('option', { key: minute, value: String(minute) }, t('minutes', { n: minute }))),
        ),
      ),
      petH(
        Row,
        { label: t('focusWork') },
        petH(
          'select',
          { value: String(settings.focusWorkMin), onChange: (event) => update({ focusWorkMin: Number(event.target.value) }) },
          ...[15, 20, 25, 30, 45, 60].map((minute) => petH('option', { key: minute, value: String(minute) }, t('minutes', { n: minute }))),
        ),
      ),
      petH(SectionTitle, null, t('sectionLive')),
      petH(
        'div',
        { className: 'dsh-pet-settings-desc', 'data-testid': 'pet-live-status' },
        liveState?.online === true ? t('liveOnline') : t('liveOffline'),
      ),
      petH('div', { className: 'dsh-pet-settings-desc' }, t('liveDesc')),
      petH(
        Row,
        { label: t('liveFeedLabel') },
        petH('input', {
          type: 'checkbox',
          'data-testid': 'pet-live-feed',
          checked: settings.liveFeed !== false,
          onChange: (event) => update({ liveFeed: event.target.checked }),
        }),
      ),
      petH('div', { className: 'dsh-pet-settings-desc' }, t('liveFeedDesc')),
      petH(
        Row,
        { label: t('usageWarnLabel') },
        petH(
          'div',
          { className: 'dsh-pet-settings-inline' },
          petH(
            'select',
            {
              value: String(settings.usageWarn),
              'data-testid': 'pet-usage-warn',
              onChange: (event) => update({ usageWarn: Number(event.target.value) }),
            },
            ...[50, 60, 70, 80, 85].map((value) => petH('option', { key: value, value: String(value) }, `${value}%`)),
          ),
          petH(
            'select',
            {
              value: String(settings.usageHigh),
              'data-testid': 'pet-usage-high',
              onChange: (event) => update({ usageHigh: Number(event.target.value) }),
            },
            ...[80, 85, 88, 92, 95].map((value) => petH('option', { key: value, value: String(value) }, `${value}%`)),
          ),
        ),
      ),
      petH(SectionTitle, null, t('sectionDiary')),
      petH('div', { className: 'dsh-pet-settings-desc' }, t('diaryDesc')),
      petH(
        'div',
        { className: 'dsh-pet-settings-diary', 'data-testid': 'pet-diary' },
        ...(Array.isArray(diary?.lines) && diary.lines.length > 0
          ? diary.lines.map((line, index) => petH('div', { key: index, className: 'dsh-pet-settings-diary-line' }, String(line)))
          : [petH('div', { key: 'empty', className: 'dsh-pet-settings-diary-line' }, t('diaryEmpty'))]),
        petH('button', { type: 'button', className: 'dsh-pet-btn', onClick: loadDiary }, t('diaryRefresh')),
      ),
      petH(SectionTitle, null, t('sectionSkins')),
      petH('div', { className: 'dsh-pet-settings-desc' }, t('skinsDesc')),
      petH(
        'div',
        { className: 'dsh-pet-settings-skins' },
        petH('input', {
          type: 'file',
          accept: 'image/png,image/webp',
          'data-testid': 'pet-skins-input',
          onChange: (event) => {
            const file = event.target.files && event.target.files[0]
            uploadSkin(file)
            event.target.value = ''
          },
        }),
        ...skinList.map((skin) =>
          petH(
            'div',
            { key: skin.id, className: 'dsh-pet-settings-skin', 'data-skin-id': skin.id },
            petH(
              'span',
              { className: 'dsh-pet-settings-skin-thumb', 'data-char': skin.id, 'data-skin-thumb': skin.id },
              petH('span', { className: 'dsh-pet-sprite-thumb', 'aria-hidden': 'true' }),
            ),
            petH('span', { className: 'dsh-pet-settings-skin-label' }, `${skin.label} · ${skin.rows} 行`),
            petH(
              'button',
              { type: 'button', className: 'dsh-pet-btn', onClick: () => removeSkinById(skin.id) },
              t('skinsRemove'),
            ),
          ),
        ),
        skinNote ? petH('div', { className: 'dsh-pet-settings-desc' }, skinNote) : null,
      ),
      petH(SectionTitle, null, t('sectionActions')),
      petH('div', { className: 'dsh-pet-settings-desc' }, t('actionsDesc')),
      petH(
        'div',
        { className: 'dsh-pet-settings-actions', 'data-testid': 'pet-actions' },
        ...PET_ACTIONS.map((action) =>
          petH(
            'button',
            {
              key: action.id,
              type: 'button',
              className: 'dsh-pet-btn',
              'data-action-id': action.id,
              title: t('actionPlay'),
              onClick: () => onPlayAction?.(action.id),
            },
            petActionLabel(action, lang),
          ),
        ),
      ),
      petH(SectionTitle, null, t('sectionGrowth')),
      petH(
        'div',
        { className: 'dsh-pet-settings-stats' },
        petH(
          'div',
          { className: 'dsh-pet-settings-stat' },
          petH('b', null, String(level.level)),
          petH('span', null, t('level')),
        ),
        petH(
          'div',
          { className: 'dsh-pet-settings-stat' },
          petH('b', null, String(growth.affinity)),
          petH('span', null, t('affinity')),
        ),
        petH(
          'div',
          { className: 'dsh-pet-settings-stat' },
          petH('b', null, String(growth.tasks)),
          petH('span', null, t('tasks')),
        ),
        petH(
          'div',
          { className: 'dsh-pet-settings-stat' },
          petH('b', null, String(growth.focus)),
          petH('span', null, t('focusCount')),
        ),
        petH(
          'div',
          { className: 'dsh-pet-settings-stat' },
          petH('b', null, String(growth.streak)),
          petH('span', null, t('streak')),
        ),
      ),
      petH(
        'div',
        { className: 'dsh-pet-settings-actions' },
        onTestPet ? petH('button', { type: 'button', className: 'dsh-pet-btn', onClick: onTestPet }, '↺') : null,
        petH('button', { type: 'button', className: 'dsh-pet-btn', 'data-testid': 'pet-export', onClick: onExport }, t('exportData')),
        petH(
          'button',
          { type: 'button', className: 'dsh-pet-btn', onClick: () => setImporting((value) => !value) },
          t('importData'),
        ),
        petH(
          'button',
          {
            type: 'button',
            className: 'dsh-pet-btn',
            onClick: () => {
              store.resetGrowth()
              flash(t('resetDone'))
            },
          },
          t('resetGrowth'),
        ),
        petH(
          'button',
          {
            type: 'button',
            className: 'dsh-pet-btn',
            'data-tone': 'primary',
            onClick: () => {
              store.resetSettings()
              flash(t('resetDone'))
            },
          },
          t('resetAll'),
        ),
      ),
      importing
        ? petH(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            petH('textarea', {
              rows: 4,
              placeholder: t('importPrompt'),
              value: importText,
              onChange: (event) => setImportText(event.target.value),
              style: { width: '100%', fontFamily: 'monospace', fontSize: 11 },
            }),
            petH(
              'button',
              { type: 'button', className: 'dsh-pet-btn', 'data-tone': 'primary', style: { alignSelf: 'flex-start' }, onClick: onImport },
              t('importOk'),
            ),
          )
        : null,
      note ? petH('div', { className: 'dsh-pet-settings-desc', role: 'status' }, note) : null,
    )
  }
}

/* ── client-src/main.js ── */
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
const PET_CSS = '/* dsh-pet — 宠物样式\n *\n * 设计约束（每条都有理由，改之前先读一遍）：\n *\n * 1. **只用官方 --dsw-* token 做「界面件」**（气泡、菜单、按钮、阴影、圆角、文字色），\n *    这样换主题 / 切深色 / 用户自定字号时宠物不会变成一处突兀的异色块。\n *    宠物本体（角色颜色）用 --pet-c1..c4，由 JS 按角色注入，不进全局 token 命名空间。\n * 2. **不覆盖任何全局选择器**：所有规则都以 .dsh-pet-* / [data-dsh-pet] 开头，\n *    绝不写 `:root`、`body` 的裸选择器——否则升级后 DSH 换布局就会被我们压住。\n * 3. **动画只用 transform / opacity**：桌宠常驻页面，任何触发布局的动画都会让\n *    滚动和输入卡顿；所有 loop 动画都在合成层完成。\n * 4. **尊重 reduced motion**：系统偏好或设置里关掉动画时，只剩 0.2s 的淡入淡出。\n * 5. **移动端默认不显示**：小屏上桌宠是干扰，设置里可以显式打开。\n */\n\n[data-dsh-pet] {\n  /* 宠物尺寸（设置里可调），悬停/拖拽只改 --pet-scale，不改布局参数 */\n  --pet-size: 104px;\n  --pet-scale: 1;\n  /* 动作表演时长，由 JS 按动作写内联；这里给个默认值，构建期的 token 校验要看到定义 */\n  --pet-act-ms: 1600ms;\n  /* 上下文占用（0–1），由 JS 按 /pet/activity 的 usage.percent 写内联 */\n  --pet-usage: 0;\n\n  position: fixed;\n  z-index: 40; /* 低于菜单/对话框，高于正文 */\n  width: var(--pet-size);\n  height: var(--pet-size);\n  pointer-events: none; /* 容器不挡点击，只有本体/气泡/菜单接收事件 */\n  -webkit-user-select: none;\n  user-select: none;\n  touch-action: none;\n  contain: layout style;\n}\n\n/* 位置的两种落点：右下角（默认）与左下角（吸附后），由 JS 写 data-dock */\n[data-dsh-pet][data-dock=\'right\'] {\n  right: calc(18px + env(safe-area-inset-right, 0px));\n  bottom: calc(var(--pet-bottom, 92px) + env(safe-area-inset-bottom, 0px));\n}\n\n[data-dsh-pet][data-dock=\'left\'] {\n  left: calc(18px + env(safe-area-inset-left, 0px));\n  bottom: calc(var(--pet-bottom, 92px) + env(safe-area-inset-bottom, 0px));\n}\n\n/* 自由拖拽位置：JS 写 left/top，并清掉 data-dock 的锚点 */\n[data-dsh-pet][data-dock=\'free\'] {\n  right: auto;\n  bottom: auto;\n}\n\n/* ── 本体 ───────────────────────────────────────────────────────────── */\n\n.dsh-pet-figure {\n  position: absolute;\n  inset: 0;\n  display: block;\n  transform: scale(var(--pet-scale));\n  transform-origin: 50% 100%;\n  pointer-events: auto;\n  cursor: grab;\n  outline: none;\n  -webkit-tap-highlight-color: transparent;\n  transition: transform 160ms ease-out;\n}\n\n[data-dsh-pet][data-state=\'drag\'] .dsh-pet-figure {\n  cursor: grabbing;\n  transform: scale(calc(var(--pet-scale) * 1.06));\n}\n\n.dsh-pet-svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  filter: drop-shadow(0 2px 6px rgb(0 0 0 / 12%));\n}\n\n/* ── 位图形象（spritesheet）─────────────────────────────────────────────\n * 图集单格 192×208，8 列 × 11 行；每帧用 background-position 在未缩放的 192×208\n * 画布上取格，再由 transform 缩到 --pet-size 高。缩放走 transform 而不是\n * background-size，是为了避免每换一档尺寸都要重算 background-position 的小数。\n * keyframes 由 characters.js 的 petSpriteCss() 在运行时注入（动画表只有一份）。\n */\n[data-dsh-pet] {\n  --pet-sprite-scale: 0.5;\n  --pet-anim-scale: 0.5;\n}\n\n.dsh-pet-sprite {\n  position: absolute;\n  left: 50%;\n  bottom: 0;\n  width: 192px;\n  height: 208px;\n  margin-left: -96px;\n  background-repeat: no-repeat;\n  background-position: 0 0;\n  /* 8 列 × 11 行的图集：把整张图缩放到元素盒的 800%×1100%，一格正好等于一个元素盒，\n   * 换帧就是平移 background-position（见 characters.js 的 petSpriteCss）。 */\n  background-size: 800% 1100%;\n  transform: scale(var(--pet-sprite-scale));\n  transform-origin: 50% 100%;\n  pointer-events: none;\n  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 16%));\n  animation-timing-function: steps(1, end);\n  animation-iteration-count: infinite;\n  animation-fill-mode: both;\n}\n\n/**\n * 原生动作胶片条：动作期间盖在位图本体上，逐帧推 background-position。\n * 尺寸/缩放规则与 .dsh-pet-sprite 完全一致，切动作时角色不会跳大小。\n * 图片与 keyframes 由 characters.js 的 petClipCss() 运行时注入。\n */\n.dsh-pet-clip {\n  position: absolute;\n  left: 50%;\n  bottom: 0;\n  width: 192px;\n  height: 208px;\n  margin-left: -96px;\n  background-repeat: no-repeat;\n  background-position: 0 0;\n  transform: scale(var(--pet-sprite-scale));\n  transform-origin: 50% 100%;\n  pointer-events: none;\n  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 16%));\n  animation-timing-function: steps(1, end);\n  animation-iteration-count: infinite;\n  animation-fill-mode: both;\n  display: none;\n}\n\n/**\n * 原生动作视频：一段带 alpha 的透明 WebM，尺寸/缩放规则与 .dsh-pet-sprite 一致\n * （画布按 2 倍超采样输出，所以铺成 192×208 的层就对得齐）。解码失败时由脚本\n * 退回 .dsh-pet-clip 的胶片条。\n */\n.dsh-pet-video {\n  position: absolute;\n  left: 50%;\n  bottom: 0;\n  width: 192px;\n  height: 208px;\n  margin-left: -96px;\n  transform: scale(var(--pet-sprite-scale));\n  transform-origin: 50% 100%;\n  pointer-events: none;\n  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 16%));\n  display: none;\n}\n\n/* 有原生动作时：动作层顶掉本体和道具，避免「原生动作 + SVG 小组件」叠在一起 */\n[data-dsh-pet][data-clip-active=\'video\'] .dsh-pet-video {\n  display: block;\n}\n\n[data-dsh-pet][data-clip-active=\'strip\'] .dsh-pet-clip {\n  display: block;\n}\n\n/**\n * 常驻 idle 视频（只有默认 pilot 有）：闲时用一条 3.75s 透明 WebM 循环顶掉位图\n * idle 帧。与动作视频同一套 384×416 画布，摆成 192×208 的层就能和本体对齐；\n * 动作（data-clip-active）、注视、拖拽、关动效时都不显示，交给原渲染。\n */\n.dsh-pet-idle {\n  position: absolute;\n  left: 50%;\n  bottom: 0;\n  width: 192px;\n  height: 208px;\n  margin-left: -96px;\n  transform: scale(var(--pet-sprite-scale));\n  transform-origin: 50% 100%;\n  pointer-events: none;\n  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 16%));\n  display: none;\n}\n\n[data-dsh-pet][data-idle-video] .dsh-pet-idle {\n  display: block;\n}\n\n/* idle 视频接管时藏起位图本体；动作层接管时又把 idle 视频藏回去，避免两层叠着播 */\n[data-dsh-pet][data-idle-video]:not([data-clip-active]) .dsh-pet-sprite {\n  visibility: hidden;\n}\n\n[data-dsh-pet][data-clip-active] .dsh-pet-idle {\n  display: none;\n}\n\n[data-dsh-pet][data-clip-active] .dsh-pet-sprite {\n  visibility: hidden;\n}\n\n[data-dsh-pet][data-clip-active] .dsh-pet-prop-layer,\n[data-dsh-pet][data-clip-active] .dsh-pet-outfit-layer {\n  display: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .dsh-pet-clip {\n    animation-play-state: paused;\n  }\n}\n\n/* 位图角色本体：脚下留一点点空，气泡和进度环仍按方块定位 */\n[data-dsh-pet][data-char=\'lulu\'] .dsh-pet-figure {\n  cursor: grab;\n}\n\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-sprite {\n  animation-play-state: paused;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-pet] .dsh-pet-sprite {\n    animation-play-state: paused;\n  }\n}\n\n/* 设置页卡片里的位图缩略图：取图集第一格（background-size 用 800%×1100% 表示 8 列 × 11 行） */\n.dsh-pet-sprite-thumb {\n  display: block;\n  width: 40px;\n  aspect-ratio: 192 / 208;\n  background-repeat: no-repeat;\n  background-position: 0 0;\n  background-size: 800% 1100%;\n}\n\n/* 动图形象：一张横向胶片条，CSS 逐帧推 background-position（帧宽高由导入脚本写进内联规则） */\n.dsh-pet-anim {\n  position: absolute;\n  left: 50%;\n  bottom: 0;\n  background-repeat: no-repeat;\n  background-position: 0 0;\n  transform: scale(var(--pet-anim-scale));\n  transform-origin: 50% 100%;\n  pointer-events: none;\n  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 16%));\n  animation-timing-function: steps(1, end);\n  animation-iteration-count: infinite;\n  animation-fill-mode: both;\n}\n\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-anim {\n  animation-play-state: paused;\n}\n\n.dsh-pet-anim-thumb {\n  display: block;\n  width: 40px;\n  height: auto;\n  background-repeat: no-repeat;\n  background-position: 0 0;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-pet] .dsh-pet-anim {\n    animation-play-state: paused;\n  }\n}\n\n/* 角色配色：--pet-c1 身体 / --pet-c2 肚皮 / --pet-c3 点缀（脸颊、耳朵内侧） /\n * --pet-c4 五官线条。深浅色主题由角色自己对同一 token 组微调。 */\n.dsh-pet-body {\n  fill: var(--pet-c1);\n}\n\n.dsh-pet-belly {\n  fill: var(--pet-c2);\n}\n\n.dsh-pet-accent {\n  fill: var(--pet-c3);\n}\n\n.dsh-pet-line {\n  fill: var(--pet-c4);\n}\n\n.dsh-pet-eyewhite {\n  fill: var(--pet-eye-white, #fff);\n}\n\n.dsh-pet-glint {\n  fill: #fff;\n}\n\n.dsh-pet-cheek {\n  opacity: 0.55;\n}\n\n.dsh-pet-mouth {\n  fill: none;\n  stroke: var(--pet-c4);\n  stroke-width: 1.8;\n  stroke-linecap: round;\n}\n\n/* 水豚的大鼻子：点缀色和肚皮色对半调，太橙会像围兜 */\n.dsh-pet-muzzle {\n  fill: var(--pet-c2);\n  fill: color-mix(in srgb, var(--pet-c3) 42%, var(--pet-c2));\n  stroke: color-mix(in srgb, var(--pet-c3) 55%, var(--pet-c2));\n  stroke-width: 0.9;\n  stroke-opacity: 0.55;\n}\n\n.dsh-pet-nostril {\n  fill: var(--pet-c4);\n  opacity: 0.55;\n}\n\n/* 头上小橘子的梗和叶子（叶子固定绿，不随角色配色漂移） */\n.dsh-pet-hat-stem {\n  fill: none;\n  stroke: var(--pet-c4);\n  stroke-width: 1.6;\n  stroke-linecap: round;\n}\n\n.dsh-pet-leaf {\n  fill: #7aa85a;\n}\n\nbody[data-ds-dark-theme] .dsh-pet-leaf {\n  fill: #5f8a45;\n}\n\n.dsh-pet-hat-shine {\n  fill: #fff;\n  opacity: 0.35;\n}\n\n/* 短裤的中缝，避免整块橙色看不出腿 */\n.dsh-pet-shorts-line {\n  fill: none;\n  stroke: rgb(0 0 0 / 18%);\n  stroke-width: 1.4;\n  stroke-linecap: round;\n}\n\n/* 瞳孔跟随光标：偏移量由 overlay 写在宿主的 --pet-look-x/y 上（单位 = SVG 用户单位） */\n.dsh-pet-pupil {\n  transform: translate(var(--pet-look-x, 0px), var(--pet-look-y, 0px));\n  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);\n}\n\n.dsh-pet-glint {\n  transform: translate(calc(var(--pet-look-x, 0px) * 0.7), calc(var(--pet-look-y, 0px) * 0.7));\n  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);\n}\n\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-pupil,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-glint {\n  transition: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .dsh-pet-pupil,\n  .dsh-pet-glint {\n    transition: none;\n  }\n}\n\n/* 状态叠加件的描边/填充：感叹号三角、爱心、Zzz、思考点都跟着角色配色走 */\n.dsh-pet-alert-mark {\n  fill: var(--dsw-alias-state-warn-primary, #f59e0b);\n}\n\n.dsh-pet-alert-glyph,\n.dsh-pet-alert-glyph-dot {\n  fill: #fff;\n  stroke: #fff;\n  stroke-width: 1.8;\n  stroke-linecap: round;\n}\n\n.dsh-pet-heart {\n  fill: var(--dsw-alias-state-error-primary, #e5484d);\n  opacity: 0.9;\n}\n\n.dsh-pet-heart-2 {\n  opacity: 0.6;\n}\n\n.dsh-pet-z {\n  fill: var(--pet-c4);\n  font-weight: 700;\n  font-family: inherit;\n  opacity: 0.75;\n}\n\n.dsh-pet-think-dot {\n  fill: var(--pet-c3);\n}\n\n.dsh-pet-shadow {\n  fill: rgb(0 0 0 / 10%);\n}\n\n/* ── 角色配色 ────────────────────────────────────────────────────────\n * 颜色挂在宿主元素的 data-char 上而不是 SVG 内联：\n *   · 切深色主题时不用 JS 重绘 SVG；\n *   · 设置页的预览与页面上的宠物共用同一条规则，不会「预览和实际不一样」。\n * 取值见 client-src/characters.js 的 palette / paletteDark（那里是唯一事实来源，\n * test 会做一致性校验，避免两边漂移）。 */\n\n[data-char=\'mochi\'] {\n  --pet-c1: #f7dcae;\n  --pet-c2: #fff6e4;\n  --pet-c3: #f3b0a6;\n  --pet-c4: #4a3a2c;\n  --pet-eye-white: #fffdf8;\n}\n\n[data-char=\'pengu\'] {\n  --pet-c1: #5f6b7d;\n  --pet-c2: #f4f6f9;\n  --pet-c3: #f0b24b;\n  --pet-c4: #252c38;\n  --pet-eye-white: #ffffff;\n}\n\n[data-char=\'ember\'] {\n  --pet-c1: #f0a05a;\n  --pet-c2: #fde7cd;\n  --pet-c3: #e8755f;\n  --pet-c4: #4a2f22;\n  --pet-eye-white: #fffaf3;\n}\n\nbody[data-ds-dark-theme] [data-char=\'mochi\'] {\n  --pet-c1: #c9a978;\n  --pet-c2: #efe0c6;\n  --pet-c3: #d98d84;\n  --pet-c4: #2a2119;\n  --pet-eye-white: #fdf8ee;\n}\n\nbody[data-ds-dark-theme] [data-char=\'pengu\'] {\n  --pet-c1: #414a59;\n  --pet-c2: #dfe4ec;\n  --pet-c3: #e2a340;\n  --pet-c4: #171c24;\n  --pet-eye-white: #ffffff;\n}\n\nbody[data-ds-dark-theme] [data-char=\'ember\'] {\n  --pet-c1: #c47c3e;\n  --pet-c2: #f3d9bb;\n  --pet-c3: #cf5f4c;\n  --pet-c4: #2d1c14;\n  --pet-eye-white: #fff8ef;\n}\n\n/* ── 循环动画（全部合成层） ──────────────────────────────────────────── */\n\n.dsh-pet-breathe {\n  transform-origin: 50% 100%;\n  animation: dsh-pet-breathe 3.4s ease-in-out infinite;\n}\n\n.dsh-pet-blink {\n  transform-origin: 50% 50%;\n  animation: dsh-pet-blink 5.2s ease-in-out infinite;\n}\n\n.dsh-pet-tail {\n  transform-origin: 20% 80%;\n  animation: dsh-pet-tail 2.8s ease-in-out infinite;\n}\n\n@keyframes dsh-pet-breathe {\n  0%,\n  100% {\n    transform: scaleY(1) translateY(0);\n  }\n  50% {\n    transform: scaleY(0.965) translateY(1.5px);\n  }\n}\n\n@keyframes dsh-pet-blink {\n  0%,\n  92%,\n  100% {\n    transform: scaleY(1);\n  }\n  95%,\n  97% {\n    transform: scaleY(0.08);\n  }\n}\n\n@keyframes dsh-pet-tail {\n  0%,\n  100% {\n    transform: rotate(-6deg);\n  }\n  50% {\n    transform: rotate(8deg);\n  }\n}\n\n@keyframes dsh-pet-bob {\n  0%,\n  100% {\n    transform: translateY(0);\n  }\n  50% {\n    transform: translateY(-4px);\n  }\n}\n\n@keyframes dsh-pet-jump {\n  0%,\n  100% {\n    transform: translateY(0) scaleY(1);\n  }\n  12% {\n    transform: translateY(2px) scaleY(0.92);\n  }\n  45% {\n    transform: translateY(-16px) scaleY(1.04);\n  }\n  78% {\n    transform: translateY(0) scaleY(0.96);\n  }\n}\n\n@keyframes dsh-pet-shake {\n  0%,\n  100% {\n    transform: rotate(0deg);\n  }\n  20% {\n    transform: rotate(-4deg);\n  }\n  50% {\n    transform: rotate(4deg);\n  }\n  80% {\n    transform: rotate(-2deg);\n  }\n}\n\n/* ── 状态 ───────────────────────────────────────────────────────────── */\n\n/* thinking：运行中的任务，本体轻轻上下浮动，头顶三颗思考点 */\n[data-dsh-pet][data-state=\'thinking\'] .dsh-pet-breathe {\n  animation:\n    dsh-pet-breathe 1.6s ease-in-out infinite,\n    dsh-pet-bob 1.6s ease-in-out infinite;\n}\n\n.dsh-pet-think {\n  opacity: 0;\n  transition: opacity 200ms ease-out;\n}\n\n[data-dsh-pet][data-state=\'thinking\'] .dsh-pet-think,\n[data-dsh-pet][data-state=\'think-deep\'] .dsh-pet-think {\n  opacity: 1;\n}\n\n.dsh-pet-think-dot {\n  animation: dsh-pet-think-dot 1.2s ease-in-out infinite;\n}\n\n.dsh-pet-think-dot:nth-of-type(2) {\n  animation-delay: 0.18s;\n}\n\n.dsh-pet-think-dot:nth-of-type(3) {\n  animation-delay: 0.36s;\n}\n\n@keyframes dsh-pet-think-dot {\n  0%,\n  100% {\n    opacity: 0.25;\n    transform: translateY(0);\n  }\n  50% {\n    opacity: 1;\n    transform: translateY(-2.5px);\n  }\n}\n\n/* alert：有审批/提问等你处理，本体抖动并冒感叹号 */\n[data-dsh-pet][data-state=\'alert\'] .dsh-pet-breathe {\n  animation: dsh-pet-shake 0.9s ease-in-out infinite;\n}\n\n.dsh-pet-alert {\n  opacity: 0;\n  transition: opacity 160ms ease-out;\n}\n\n[data-dsh-pet][data-state=\'alert\'] .dsh-pet-alert {\n  opacity: 1;\n}\n\n/* celebrate：任务刚完成，跳一下冒爱心 */\n.dsh-pet-celebrate {\n  opacity: 0;\n  transform-origin: 50% 100%;\n}\n\n[data-dsh-pet][data-state=\'celebrate\'] .dsh-pet-celebrate {\n  opacity: 1;\n  animation: dsh-pet-jump 720ms cubic-bezier(0.3, 1.4, 0.4, 1) 2;\n}\n\n/* happy：被摸/被喂食，短暂冒爱心并下压 */\n[data-dsh-pet][data-state=\'happy\'] .dsh-pet-breathe {\n  animation: dsh-pet-bob 0.5s ease-in-out 2;\n}\n\n.dsh-pet-happy {\n  opacity: 0;\n}\n\n[data-dsh-pet][data-state=\'happy\'] .dsh-pet-happy,\n[data-dsh-pet][data-state=\'celebrate\'] .dsh-pet-happy {\n  opacity: 1;\n}\n\n/* sleeping：长时间没有任务，闭眼 + Zzz */\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-breathe {\n  animation-duration: 5.6s;\n}\n\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-blink {\n  animation: none;\n  transform: scaleY(0.08);\n}\n\n.dsh-pet-zzz {\n  opacity: 0;\n}\n\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-zzz {\n  opacity: 1;\n}\n\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-zzz > * {\n  animation: dsh-pet-zzz 2.6s ease-in-out infinite;\n}\n\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-zzz > :nth-child(2) {\n  animation-delay: 0.5s;\n}\n\n[data-dsh-pet][data-state=\'sleep\'] .dsh-pet-zzz > :nth-child(3) {\n  animation-delay: 1s;\n}\n\n@keyframes dsh-pet-zzz {\n  0% {\n    opacity: 0.2;\n    transform: translate(0, 2px);\n  }\n  45% {\n    opacity: 1;\n  }\n  100% {\n    opacity: 0.2;\n    transform: translate(3px, -5px);\n  }\n}\n\n/* focus：番茄钟进行中，本体底下一圈进度环 */\n.dsh-pet-ring {\n  position: absolute;\n  inset: -6px;\n  border-radius: 50%;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 200ms ease-out;\n  background: conic-gradient(\n    var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6) calc(var(--pet-progress, 0) * 360deg),\n    transparent 0\n  );\n  mask: radial-gradient(closest-side, transparent 86%, #000 88%);\n  -webkit-mask: radial-gradient(closest-side, transparent 86%, #000 88%);\n}\n\n[data-dsh-pet][data-state=\'focus\'] .dsh-pet-ring {\n  opacity: 0.7;\n}\n\n/* ── 气泡 ───────────────────────────────────────────────────────────── */\n\n.dsh-pet-bubble {\n  position: absolute;\n  bottom: calc(100% + 6px);\n  left: 50%;\n  min-width: 84px;\n  max-width: 236px;\n  padding: 7px 10px;\n  border-radius: var(--dsw-radius-md, 12px);\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  color: var(--dsw-alias-label-primary, #16181d);\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 8%));\n  box-shadow: var(--dsw-shadow-lv2, 0 4px 12px rgb(0 0 0 / 12%));\n  font-size: 12px;\n  line-height: 1.5;\n  text-align: left;\n  transform: translate(-50%, 4px);\n  opacity: 0;\n  pointer-events: none;\n  transition:\n    opacity 160ms ease-out,\n    transform 160ms ease-out;\n  word-break: break-word;\n  cursor: pointer;\n}\n\n[data-dsh-pet][data-bubble=\'show\'] .dsh-pet-bubble {\n  opacity: 1;\n  transform: translate(-50%, 0);\n  pointer-events: auto;\n}\n\n/* 气泡尾巴：用两个伪元素叠出边框色 + 背景色 */\n.dsh-pet-bubble::after,\n.dsh-pet-bubble::before {\n  content: \'\';\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  border: 6px solid transparent;\n  transform: translateX(-50%);\n}\n\n.dsh-pet-bubble::before {\n  border-top-color: var(--dsw-alias-border-l1, rgb(0 0 0 / 8%));\n  margin-top: 1px;\n}\n\n.dsh-pet-bubble::after {\n  border-top-color: var(--dsw-alias-bg-layer-2, #fff);\n}\n\n.dsh-pet-bubble-rec {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n  justify-content: space-between;\n  margin-top: 6px;\n}\n\n.dsh-pet-bubble-note {\n  color: var(--dsw-alias-label-secondary, #6b7280);\n  font-size: 11px;\n  margin-top: 3px;\n}\n\n/* 气泡里的小按钮，只在本 bubble 内生效 */\n.dsh-pet-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 10%));\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  color: var(--dsw-alias-label-primary, #16181d);\n  border-radius: var(--dsw-radius-sm, 8px);\n  padding: 2px 7px;\n  font-size: 11px;\n  line-height: 1.5;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.dsh-pet-btn:hover {\n  background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 4%));\n}\n\n.dsh-pet-btn[data-tone=\'primary\'] {\n  background: var(--dsw-alias-button-primary-fill, #4176e6);\n  border-color: transparent;\n  color: #fff;\n}\n\n.dsh-pet-btn[data-tone=\'primary\']:hover {\n  filter: brightness(1.06);\n}\n\n/* ── 未读徽标 ───────────────────────────────────────────────────────── */\n\n.dsh-pet-badge {\n  position: absolute;\n  top: 2px;\n  right: 2px;\n  min-width: 18px;\n  height: 18px;\n  padding: 0 5px;\n  border-radius: 999px;\n  background: var(--dsw-alias-state-warn-primary, #f59e0b);\n  color: #fff;\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 18px;\n  text-align: center;\n  box-shadow: 0 1px 3px rgb(0 0 0 / 20%);\n  display: none;\n}\n\n[data-dsh-pet][data-badge=\'show\'] .dsh-pet-badge {\n  display: block;\n}\n\n/* ── 上下文占用条 ───────────────────────────────────────────────────── */\n\n/*\n * 只在占用跨过预警阈值时出现：一条 3px 的细线贴着宠物底部。\n * 平时不显示 —— 桌宠是陪伴物，不是仪表盘。\n */\n.dsh-pet-usage {\n  position: absolute;\n  left: 22%;\n  bottom: 2px;\n  width: 56%;\n  height: 3px;\n  border-radius: 999px;\n  background: var(--dsw-alias-bg-layer-3, #e5e7eb);\n  opacity: 0;\n  transition: opacity 0.18s ease;\n  pointer-events: none;\n  overflow: hidden;\n}\n\n.dsh-pet-usage::after {\n  content: \'\';\n  display: block;\n  height: 100%;\n  width: calc(var(--pet-usage) * 100%);\n  border-radius: inherit;\n  background: var(--dsw-alias-state-warn-primary, #f59e0b);\n  transition: width 0.3s ease;\n}\n\n.dsh-pet-usage[data-visible=\'show\'] {\n  opacity: 0.9;\n}\n\n[data-dsh-pet][data-usage=\'high\'] .dsh-pet-usage::after {\n  background: var(--dsw-alias-state-error-primary, #ef4444);\n}\n\n[data-dsh-pet][data-live=\'off\'] .dsh-pet-usage {\n  opacity: 0;\n}\n\n/* ── 右键菜单 ───────────────────────────────────────────────────────── */\n\n.dsh-pet-menu {\n  /* 位置由 overlay.js 的 placeMenu() 按视口算（left/top/max-width 内联），\n   * 不能再用 bottom/right 贴边推 —— 宠物在右上角时会被屏幕顶边裁掉。 */\n  position: absolute;\n  left: 0;\n  top: 0;\n  /* max-height 得含 padding/border，否则菜单会比视口高出 10px（border-box） */\n  box-sizing: border-box;\n  min-width: 158px;\n  /* 动作点播加进来之后条目变多：限高 + 滚动，别把菜单顶到屏幕外 */\n  max-height: min(60vh, 420px);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding: 4px;\n  border-radius: var(--dsw-radius-md, 12px);\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 8%));\n  box-shadow: var(--dsw-shadow-lv3, 0 12px 32px rgb(0 0 0 / 14%));\n  display: none;\n  pointer-events: auto;\n}\n\n[data-dsh-pet][data-menu=\'open\'] .dsh-pet-menu {\n  display: block;\n}\n\n.dsh-pet-menu-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  width: 100%;\n  padding: 5px 8px;\n  border: 0;\n  border-radius: var(--dsw-radius-sm, 8px);\n  background: transparent;\n  color: var(--dsw-alias-label-primary, #16181d);\n  font-size: 12px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dsh-pet-menu-item:hover,\n.dsh-pet-menu-item:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 5%));\n  outline: none;\n}\n\n.dsh-pet-menu-item[data-danger=\'true\'] {\n  color: var(--dsw-alias-state-error-primary, #e5484d);\n}\n\n.dsh-pet-menu-head {\n  padding: 6px 8px 2px;\n  font-size: 10px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  color: var(--dsw-alias-label-secondary, rgb(0 0 0 / 45%));\n}\n\n.dsh-pet-menu-sep {\n  height: 1px;\n  margin: 4px 6px;\n  background: var(--dsw-alias-border-l1, rgb(0 0 0 / 8%));\n}\n\n/* ── 深色主题 ────────────────────────────────────────────────────────\n * 深色下官方 token 已自动跟随；这里只处理「我们自己画的东西」：\n * 落影更淡、光环更亮、徽标文字更实。选择器带上 body 前缀以匹配官方特异性。 */\n\nbody[data-ds-dark-theme] .dsh-pet-svg {\n  filter: drop-shadow(0 2px 8px rgb(0 0 0 / 42%));\n}\n\nbody[data-ds-dark-theme] .dsh-pet-shadow {\n  fill: rgb(0 0 0 / 34%);\n}\n\n/* ── 减少动效 ────────────────────────────────────────────────────────\n * 系统偏好与插件设置走同一个开关：JS 会给 root 写 data-motion="off"。 */\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-pet] .dsh-pet-figure,\n  [data-dsh-pet] .dsh-pet-bubble {\n    transition-duration: 0.01ms !important;\n  }\n}\n\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-breathe,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-blink,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-tail,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-celebrate,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-think-dot,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-zzz > * {\n  animation: none !important;\n}\n\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-figure,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-bubble,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-ring {\n  transition-duration: 0.01ms !important;\n}\n\n/* ── 移动端 ──────────────────────────────────────────────────────────\n * 默认不显示；设置里打开后缩小一号，并贴到安全区上方，避开输入框。 */\n\n@media (max-width: 1023px) {\n  [data-dsh-pet]:not([data-mobile=\'show\']) {\n    display: none;\n  }\n\n  [data-dsh-pet][data-mobile=\'show\'] {\n    --pet-size: 76px;\n    --pet-bottom: 76px;\n  }\n\n  [data-dsh-pet][data-mobile=\'show\'] .dsh-pet-bubble {\n    max-width: 180px;\n  }\n}\n\n/* ── 就地设置浮层 ────────────────────────────────────────────────────\n * 右键菜单 →「宠物设置」弹这个，不强迫用户进设置对话框；内容与\n * settings.section 是同一个 React 组件。 */\n\n.dsh-pet-popover {\n  position: fixed;\n  z-index: 70;\n  right: calc(18px + env(safe-area-inset-right, 0px));\n  bottom: calc(104px + env(safe-area-inset-bottom, 0px));\n  width: min(360px, calc(100vw - 24px));\n  max-height: min(72vh, 620px);\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 12px;\n  border-radius: var(--dsw-radius-lg, 16px);\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  color: var(--dsw-alias-label-primary, #16181d);\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 8%));\n  box-shadow: var(--dsw-shadow-lv3, 0 12px 32px rgb(0 0 0 / 14%));\n  pointer-events: auto;\n}\n\n.dsh-pet-popover-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.dsh-pet-popover-body {\n  overflow: auto;\n  overscroll-behavior: contain;\n  padding-right: 2px;\n}\n\n@media (max-width: 1023px) {\n  .dsh-pet-popover {\n    left: 12px;\n    right: 12px;\n    bottom: calc(88px + env(safe-area-inset-bottom, 0px));\n    width: auto;\n  }\n}\n\n/* ── 设置页 ──────────────────────────────────────────────────────────\n * 设置面板本身用原生控件，只借官方 token 上色，保证与 DSH 设置页一致。 */\n\n.dsh-pet-settings {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary, #16181d);\n}\n\n.dsh-pet-settings-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.dsh-pet-settings-label {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.dsh-pet-settings-desc {\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary, #6b7280);\n}\n\n.dsh-pet-settings select,\n.dsh-pet-settings input[type=\'range\'] {\n  accent-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);\n}\n\n.dsh-pet-settings select {\n  padding: 4px 8px;\n  border-radius: var(--dsw-radius-sm, 8px);\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 12%));\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  color: inherit;\n}\n\n.dsh-pet-settings input[type=\'checkbox\'] {\n  width: 16px;\n  height: 16px;\n  accent-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);\n}\n\n.dsh-pet-settings-chars {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.dsh-pet-settings-char {\n  position: relative;\n  width: 72px;\n  padding: 6px 4px 4px;\n  border-radius: var(--dsw-radius-md, 12px);\n  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / 10%));\n  background: var(--dsw-alias-bg-layer-2, #fff);\n  cursor: pointer;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 2px;\n  font-size: 11px;\n  color: inherit;\n}\n\n.dsh-pet-settings-char[data-active=\'true\'] {\n  border-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6) 22%, transparent);\n}\n\n.dsh-pet-settings-char svg {\n  width: 44px;\n  height: 44px;\n}\n\n.dsh-pet-settings-char .dsh-pet-sprite-thumb {\n  width: 44px;\n}\n\n.dsh-pet-settings-stats {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));\n  gap: 8px;\n}\n\n.dsh-pet-settings-stat {\n  padding: 8px 10px;\n  border-radius: var(--dsw-radius-md, 12px);\n  background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 4%));\n}\n\n.dsh-pet-settings-stat b {\n  display: block;\n  font-size: 16px;\n  line-height: 1.3;\n}\n\n.dsh-pet-settings-stat span {\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary, #6b7280);\n}\n\n.dsh-pet-settings-actions {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n/* ── 动作表演 ──────────────────────────────────────────────────────────\n * 根元素上挂 data-act=\'<effect>\'，用 rotate / translate / scale 三个独立属性做动画，\n * 不动 transform —— transform 已经被 --pet-scale（悬停、拖拽放大）占着，\n * 两者混用会互相覆盖。粒子层是 root 的子节点，跟着一起动，看起来像从宠物身上炸开。\n */\n\n.dsh-pet-fx {\n  position: absolute;\n  left: 50%;\n  bottom: 42%;\n  width: 0;\n  height: 0;\n  pointer-events: none;\n  z-index: 2;\n}\n\n.dsh-pet-fx-item {\n  --pet-fx-dx: 0px;\n  --pet-fx-dy: -40px;\n  --pet-fx-rot: 0deg;\n  --pet-fx-delay: 0ms;\n  --pet-fx-size: 8px;\n  --pet-fx-color: var(--dsw-alias-brand-primary, #3b6fe0);\n\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: var(--pet-fx-size);\n  height: var(--pet-fx-size);\n  border-radius: 999px;\n  background: var(--pet-fx-color);\n  color: var(--pet-fx-color);\n  font-size: var(--pet-fx-size);\n  line-height: 1;\n  opacity: 0;\n  animation: dsh-pet-fx-fly 900ms cubic-bezier(0.22, 0.68, 0.35, 1) var(--pet-fx-delay) both;\n}\n\n/* 带文字的粒子（🧧 / ✦ / 福）不画圆点，只显示字符 */\n.dsh-pet-fx-item:not(:empty) {\n  background: transparent;\n  border-radius: 0;\n}\n\n@keyframes dsh-pet-fx-fly {\n  0% {\n    opacity: 0;\n    translate: 0 0;\n    rotate: 0deg;\n    scale: 0.4;\n  }\n  18% {\n    opacity: 1;\n  }\n  70% {\n    opacity: 1;\n  }\n  100% {\n    opacity: 0;\n    translate: var(--pet-fx-dx) var(--pet-fx-dy);\n    rotate: var(--pet-fx-rot);\n    scale: 1;\n  }\n}\n\n/* 拜年：躬身两次 */\n[data-dsh-pet][data-act=\'bow\'] {\n  animation: dsh-pet-act-bow var(--pet-act-ms, 2200ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-bow {\n  0%, 100% { rotate: 0deg; translate: 0 0; }\n  18% { rotate: -12deg; translate: 0 3px; }\n  34% { rotate: 0deg; translate: 0 0; }\n  52% { rotate: -12deg; translate: 0 3px; }\n  70% { rotate: 0deg; translate: 0 0; }\n}\n\n/* 舞狮：上下弹跳 + 左右甩头 */\n[data-dsh-pet][data-act=\'lion\'] {\n  animation: dsh-pet-act-lion var(--pet-act-ms, 2600ms) ease-in-out;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-act-lion {\n  0%, 100% { translate: 0 0; rotate: 0deg; scale: 1 1; }\n  12% { translate: 0 -10px; rotate: -6deg; scale: 0.96 1.06; }\n  24% { translate: 0 0; rotate: 6deg; scale: 1.04 0.95; }\n  36% { translate: 0 -12px; rotate: 8deg; scale: 0.96 1.06; }\n  48% { translate: 0 0; rotate: -8deg; scale: 1.04 0.95; }\n  60% { translate: 0 -10px; rotate: -5deg; scale: 0.96 1.06; }\n  72% { translate: 0 0; rotate: 5deg; scale: 1.03 0.96; }\n}\n\n/* 收红包：开心往上弹两下 */\n[data-dsh-pet][data-act=\'bounce\'] {\n  animation: dsh-pet-act-bounce var(--pet-act-ms, 2200ms) ease-out;\n}\n\n@keyframes dsh-pet-act-bounce {\n  0%, 100% { translate: 0 0; scale: 1 1; }\n  14% { translate: 0 -16px; scale: 0.96 1.05; }\n  28% { translate: 0 0; scale: 1.04 0.94; }\n  44% { translate: 0 -20px; scale: 0.95 1.06; }\n  60% { translate: 0 0; scale: 1.05 0.94; }\n  76% { translate: 0 -8px; scale: 1 1; }\n}\n\n/* 蹦跶：一串小跳 */\n[data-dsh-pet][data-act=\'hop\'] {\n  animation: dsh-pet-act-hop var(--pet-act-ms, 1200ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-hop {\n  0%, 100% { translate: 0 0; scale: 1 1; }\n  16% { translate: 0 -18px; scale: 0.97 1.04; }\n  32% { translate: 0 0; scale: 1.05 0.93; }\n  50% { translate: 0 -14px; scale: 0.98 1.03; }\n  68% { translate: 0 0; scale: 1.04 0.94; }\n  84% { translate: 0 -8px; scale: 1 1; }\n}\n\n/* 写福字：小幅左右摆动，像在落笔 */\n[data-dsh-pet][data-act=\'brush\'] {\n  animation: dsh-pet-act-brush var(--pet-act-ms, 2400ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-brush {\n  0%, 100% { rotate: 0deg; translate: 0 0; }\n  12% { rotate: -5deg; translate: -2px 1px; }\n  24% { rotate: 5deg; translate: 2px 0; }\n  36% { rotate: -4deg; translate: -2px -1px; }\n  48% { rotate: 6deg; translate: 3px 1px; }\n  62% { rotate: -6deg; translate: -3px 0; }\n  76% { rotate: 3deg; translate: 1px 1px; }\n}\n\n/* 吃饺子：咀嚼式上下压缩 */\n[data-dsh-pet][data-act=\'chew\'] {\n  animation: dsh-pet-act-chew var(--pet-act-ms, 2200ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-chew {\n  0%, 100% { scale: 1 1; translate: 0 0; }\n  10% { scale: 1.03 0.96; translate: 0 1px; }\n  20% { scale: 0.98 1.02; translate: 0 -1px; }\n  30% { scale: 1.03 0.96; translate: 0 1px; }\n  40% { scale: 0.98 1.02; translate: 0 -1px; }\n  50% { scale: 1.03 0.96; translate: 0 1px; }\n  60% { scale: 0.99 1.01; translate: 0 0; }\n}\n\n/* 害羞：缩一下再左右扭 */\n[data-dsh-pet][data-act=\'shy\'] {\n  animation: dsh-pet-act-shy var(--pet-act-ms, 1800ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-shy {\n  0%, 100% { scale: 1 1; rotate: 0deg; }\n  20% { scale: 0.94 0.94; rotate: -4deg; }\n  40% { scale: 0.96 0.96; rotate: 4deg; }\n  60% { scale: 0.95 0.95; rotate: -3deg; }\n  80% { scale: 0.98 0.98; rotate: 2deg; }\n}\n\n/* 鼓掌：快速小幅左右晃 */\n[data-dsh-pet][data-act=\'cheer\'] {\n  animation: dsh-pet-act-cheer var(--pet-act-ms, 1800ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-cheer {\n  0%, 100% { rotate: 0deg; translate: 0 0; }\n  12% { rotate: 6deg; translate: 2px 0; }\n  24% { rotate: -6deg; translate: -2px 0; }\n  36% { rotate: 6deg; translate: 2px 0; }\n  48% { rotate: -6deg; translate: -2px 0; }\n  60% { rotate: 5deg; translate: 2px 0; }\n  72% { rotate: -5deg; translate: -2px 0; }\n}\n\n/* 转晕了：越转越歪，最后晃两下站定 */\n[data-dsh-pet][data-act=\'dizzy\'] {\n  animation: dsh-pet-act-dizzy var(--pet-act-ms, 2000ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-dizzy {\n  0% { rotate: 0deg; translate: 0 0; }\n  25% { rotate: -14deg; translate: -3px 0; }\n  50% { rotate: 14deg; translate: 3px 0; }\n  70% { rotate: -9deg; translate: -2px 0; }\n  85% { rotate: 5deg; translate: 1px 0; }\n  100% { rotate: 0deg; translate: 0 0; }\n}\n\n/* 转圈 */\n[data-dsh-pet][data-act=\'spin\'] {\n  animation: dsh-pet-act-spin var(--pet-act-ms, 1200ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-spin {\n  0% { rotate: 0deg; }\n  100% { rotate: 360deg; }\n}\n\n/* 打滚：横向滚一段再回位 */\n[data-dsh-pet][data-act=\'roll\'] {\n  animation: dsh-pet-act-roll var(--pet-act-ms, 1600ms) ease-in-out;\n}\n\n@keyframes dsh-pet-act-roll {\n  0% { rotate: 0deg; translate: 0 0; }\n  25% { rotate: -180deg; translate: -18px 0; }\n  50% { rotate: -360deg; translate: -30px 0; }\n  75% { rotate: -540deg; translate: -18px 0; }\n  100% { rotate: -720deg; translate: 0 0; }\n}\n\n/* 关动画 / reduced motion：动作只留一个轻微缩放，不做位移旋转 */\n[data-dsh-pet][data-motion=\'off\'][data-act] {\n  animation: dsh-pet-act-quiet var(--pet-act-ms, 1600ms) ease-in-out !important;\n}\n\n@keyframes dsh-pet-act-quiet {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.75; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-pet][data-act] {\n    animation: dsh-pet-act-quiet var(--pet-act-ms, 1600ms) ease-in-out;\n  }\n  [data-dsh-pet] .dsh-pet-fx-item {\n    animation: none;\n    opacity: 0;\n  }\n}\n\n/* ── 手臂：让动作「看得见手在动」 ─────────────────────────────────────\n *\n * 骨架见 client-src/characters.js 的 petArms()：外层 g 用 translate 把原点放到\n * 肩上，内层形状再以自己的 bbox 顶边为轴旋转。动作只改内层的 rotate，\n * 所以不会和根元素的 --pet-scale（transform 属性）打架。\n */\n.dsh-pet-arm-shape {\n  transform-box: fill-box;\n  transform-origin: 50% 0%;\n  rotate: 10deg;\n}\n\n.dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  rotate: -10deg;\n}\n\n/* 胳膊用身体色，手掌用肚皮色 + 一点描边 —— 不然手臂和头同色，抬起来就"消失"了 */\n.dsh-pet-limb {\n  fill: var(--pet-c1);\n  stroke: var(--pet-c4);\n  stroke-width: 0.9;\n  stroke-opacity: 0.34;\n}\n\n.dsh-pet-hand {\n  fill: var(--pet-c2);\n  stroke: var(--pet-c4);\n  stroke-width: 0.8;\n  stroke-opacity: 0.28;\n}\n\n/* 八个手臂姿态，每个动作挑一个。左右手分开写，因为镜像角度不同。 */\n[data-dsh-pet][data-pose=\'raise\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-raise-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'raise\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-raise-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'lift\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-lift-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'lift\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-lift-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'hold\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-hold-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'hold\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-hold-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'clasp\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-clasp-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'clasp\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-clasp-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'write\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-write-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'write\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-write-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'eat\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-eat-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'eat\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-eat-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'shy\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-shy-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'shy\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-shy-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'clap\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-clap-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'clap\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-clap-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'balance\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-balance-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'balance\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-balance-r var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'pump\'] .dsh-pet-arm[data-arm=\'l\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-pump-l var(--pet-act-ms) ease-in-out both;\n}\n\n[data-dsh-pet][data-pose=\'pump\'] .dsh-pet-arm[data-arm=\'r\'] .dsh-pet-arm-shape {\n  animation: dsh-pet-arm-pump-r var(--pet-act-ms) ease-in-out both;\n}\n\n@keyframes dsh-pet-arm-raise-l {\n  0% { rotate: 10deg; }\n  30% { rotate: 132deg; }\n  55% { rotate: 148deg; }\n  75% { rotate: 140deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-raise-r {\n  0% { rotate: -10deg; }\n  30% { rotate: -132deg; }\n  55% { rotate: -148deg; }\n  75% { rotate: -140deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-lift-l {\n  0% { rotate: 10deg; }\n  26% { rotate: -118deg; }\n  50% { rotate: -128deg; }\n  74% { rotate: -120deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-lift-r {\n  0% { rotate: -10deg; }\n  26% { rotate: 118deg; }\n  50% { rotate: 128deg; }\n  74% { rotate: 120deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-hold-l {\n  0% { rotate: 10deg; }\n  100% { rotate: 22deg; }\n}\n\n@keyframes dsh-pet-arm-hold-r {\n  0% { rotate: -10deg; }\n  18% { rotate: 58deg; }\n  44% { rotate: 62deg; }\n  70% { rotate: 56deg; }\n  100% { rotate: 58deg; }\n}\n\n@keyframes dsh-pet-arm-clasp-l {\n  0% { rotate: 10deg; }\n  28% { rotate: -58deg; }\n  52% { rotate: -68deg; }\n  78% { rotate: -50deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-clasp-r {\n  0% { rotate: -10deg; }\n  28% { rotate: 58deg; }\n  52% { rotate: 68deg; }\n  78% { rotate: 50deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-write-l {\n  0% { rotate: 10deg; }\n  22% { rotate: 38deg; }\n  72% { rotate: 34deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-write-r {\n  0% { rotate: -10deg; }\n  18% { rotate: 62deg; }\n  34% { rotate: 44deg; }\n  52% { rotate: 66deg; }\n  70% { rotate: 46deg; }\n  86% { rotate: 60deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-eat-l {\n  0% { rotate: 10deg; }\n  30% { rotate: 46deg; }\n  70% { rotate: 44deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-eat-r {\n  0% { rotate: -10deg; }\n  22% { rotate: 104deg; }\n  42% { rotate: 92deg; }\n  62% { rotate: 108deg; }\n  82% { rotate: 94deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-shy-l {\n  0% { rotate: 10deg; }\n  32% { rotate: -74deg; }\n  68% { rotate: -84deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-shy-r {\n  0% { rotate: -10deg; }\n  32% { rotate: 74deg; }\n  68% { rotate: 84deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-clap-l {\n  0% { rotate: 10deg; }\n  18% { rotate: -52deg; }\n  36% { rotate: -74deg; }\n  54% { rotate: -52deg; }\n  72% { rotate: -74deg; }\n  90% { rotate: -54deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-clap-r {\n  0% { rotate: -10deg; }\n  18% { rotate: 52deg; }\n  36% { rotate: 74deg; }\n  54% { rotate: 52deg; }\n  72% { rotate: 74deg; }\n  90% { rotate: 54deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-balance-l {\n  0% { rotate: 10deg; }\n  25% { rotate: 84deg; }\n  62% { rotate: 72deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-balance-r {\n  0% { rotate: -10deg; }\n  25% { rotate: -84deg; }\n  62% { rotate: -72deg; }\n  100% { rotate: -10deg; }\n}\n\n@keyframes dsh-pet-arm-pump-l {\n  0% { rotate: 10deg; }\n  25% { rotate: 48deg; }\n  50% { rotate: 20deg; }\n  75% { rotate: 46deg; }\n  100% { rotate: 10deg; }\n}\n\n@keyframes dsh-pet-arm-pump-r {\n  0% { rotate: -10deg; }\n  25% { rotate: -48deg; }\n  50% { rotate: -20deg; }\n  75% { rotate: -46deg; }\n  100% { rotate: -10deg; }\n}\n\n/* 关掉动画时手臂也保持一个自然的垂手姿态 */\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-arm-shape,\n[data-dsh-pet][data-motion=\'off\'][data-pose] .dsh-pet-arm-shape {\n  animation: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-pet][data-pose] .dsh-pet-arm-shape {\n    animation: none;\n  }\n}\n\n/* ── 动作道具层 ─────────────────────────────────────────────────────── */\n\n.dsh-pet-prop-layer {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  z-index: 2;\n}\n\n.dsh-pet-prop-svg {\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  display: block;\n}\n\n/* 舞狮：狮头在宠物头上，披风垂下来，两根杆子连到举起的手 */\n.dsh-pet-lion-petal {\n  fill: #d94f3d;\n}\n\n/* 内层鬃毛压深一档，狮头才有厚度 */\n.dsh-pet-lion-petal-inner {\n  fill: #b23a2c;\n}\n\n/* 戴着狮头的时候，脑袋上那颗小橘子会从狮头额头上钻出来，先藏起来 */\n[data-dsh-pet][data-prop=\'lion\'] .dsh-pet-hat {\n  display: none;\n}\n\n.dsh-pet-lion-cloth {\n  fill: #c0392b;\n}\n\n.dsh-pet-lion-trim {\n  fill: none;\n  stroke: #f3c04a;\n  stroke-width: 2.2;\n  stroke-linecap: round;\n}\n\n.dsh-pet-lion-pole {\n  fill: none;\n  stroke: #8b5a2b;\n  stroke-width: 2;\n  stroke-linecap: round;\n}\n\n.dsh-pet-lion-face {\n  fill: #f2b53c;\n  stroke: #c98b23;\n  stroke-width: 0.8;\n}\n\n.dsh-pet-lion-brow {\n  fill: #d94f3d;\n}\n\n.dsh-pet-lion-eye {\n  fill: #fffdf5;\n}\n\n.dsh-pet-lion-pupil {\n  fill: #2b1d13;\n}\n\n.dsh-pet-lion-glint {\n  fill: #fff;\n}\n\n.dsh-pet-lion-jaw {\n  fill: #a02b22;\n}\n\n.dsh-pet-lion-teeth {\n  fill: none;\n  stroke: #fffdf5;\n  stroke-width: 1.6;\n  stroke-linecap: round;\n}\n\n.dsh-pet-lion-tongue {\n  fill: #e2584a;\n}\n\n.dsh-pet-lion-horn {\n  fill: #f3c04a;\n  stroke: #c98b23;\n  stroke-width: 0.7;\n}\n\n.dsh-pet-lion-nose {\n  fill: #c0392b;\n}\n\n.dsh-pet-lion-tassel-line {\n  fill: none;\n  stroke: #f3c04a;\n  stroke-width: 1.4;\n}\n\n.dsh-pet-lion-tassel-ball {\n  fill: #d94f3d;\n}\n\n.dsh-pet-lion-head {\n  animation: dsh-pet-lion-bob var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n.dsh-pet-lion-mouth {\n  animation: dsh-pet-lion-chomp var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 0%;\n}\n\n.dsh-pet-lion-tassel {\n  animation: dsh-pet-lion-swing var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-lion-bob {\n  0% { rotate: -5deg; translate: 0 6px; }\n  28% { rotate: 4deg; translate: 0 -2px; }\n  52% { rotate: -3deg; translate: 0 -4px; }\n  76% { rotate: 5deg; translate: 0 -1px; }\n  100% { rotate: -5deg; translate: 0 6px; }\n}\n\n@keyframes dsh-pet-lion-chomp {\n  0% { scale: 1 0.7; }\n  22% { scale: 1 1.15; }\n  44% { scale: 1 0.75; }\n  66% { scale: 1 1.12; }\n  100% { scale: 1 0.7; }\n}\n\n@keyframes dsh-pet-lion-swing {\n  0% { rotate: -6deg; }\n  50% { rotate: 7deg; }\n  100% { rotate: -6deg; }\n}\n\n/* 作揖：两只拳头在身前抱在一起，袖子垫在下面 */\n.dsh-pet-sleeve {\n  fill: #c0392b;\n  stroke: #f3c04a;\n  stroke-width: 1.1;\n}\n\n.dsh-pet-sleeve-trim {\n  fill: none;\n  stroke: #f3c04a;\n  stroke-width: 1.6;\n  stroke-linecap: round;\n  opacity: 0.95;\n}\n\n.dsh-pet-sleeve-line {\n  fill: none;\n  stroke: #f3c04a;\n  stroke-width: 1.2;\n  stroke-linecap: round;\n}\n\n.dsh-pet-fist {\n  fill: var(--pet-c2);\n  stroke: var(--pet-c4);\n  stroke-width: 0.8;\n  stroke-opacity: 0.3;\n}\n\n.dsh-pet-clasp {\n  animation: dsh-pet-clasp-bow var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-clasp-bow {\n  0% { translate: 0 6px; }\n  28% { translate: 0 -1px; }\n  52% { translate: 0 -3px; }\n  78% { translate: 0 0; }\n  100% { translate: 0 6px; }\n}\n\n/* 红包：红底金边金印，被两只手举起来 */\n.dsh-pet-envelope-body {\n  fill: #d64545;\n  stroke: #b03a3a;\n  stroke-width: 0.7;\n}\n\n.dsh-pet-envelope-flap {\n  fill: none;\n  stroke: #b03a3a;\n  stroke-width: 0.9;\n}\n\n.dsh-pet-envelope-band {\n  fill: #f3c04a;\n}\n\n.dsh-pet-envelope-seal {\n  fill: #f3c04a;\n  stroke: #c99a2e;\n  stroke-width: 0.6;\n}\n\n.dsh-pet-envelope-shine {\n  fill: #fff;\n  opacity: 0.45;\n}\n\n.dsh-pet-envelope {\n  animation: dsh-pet-envelope-up var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-envelope-up {\n  0% { translate: 0 8px; rotate: -6deg; }\n  30% { translate: 0 -3px; rotate: 0deg; }\n  60% { translate: 0 -5px; rotate: 4deg; }\n  100% { translate: 0 -2px; rotate: 0deg; }\n}\n\n/* 写福字：红纸、毛笔、一笔笔写出来的墨 */\n.dsh-pet-paper {\n  fill: #d64545;\n}\n\n.dsh-pet-paper-edge {\n  fill: none;\n  stroke: #f3c04a;\n  stroke-width: 1.4;\n}\n\n.dsh-pet-ink {\n  fill: none;\n  stroke: #2b1d13;\n  stroke-width: 1.5;\n  stroke-linecap: round;\n  stroke-dasharray: 60;\n  stroke-dashoffset: 60;\n  animation: dsh-pet-ink-draw 0.42s linear both;\n  animation-delay: var(--pet-ink-delay, 0s);\n}\n\n@keyframes dsh-pet-ink-draw {\n  to { stroke-dashoffset: 0; }\n}\n\n.dsh-pet-brush-handle {\n  fill: none;\n  stroke: #8b5a2b;\n  stroke-width: 2.2;\n  stroke-linecap: round;\n}\n\n.dsh-pet-brush-tip {\n  fill: #2b1d13;\n}\n\n.dsh-pet-brush {\n  animation: dsh-pet-brush-write var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 100% 0%;\n}\n\n@keyframes dsh-pet-brush-write {\n  0% { translate: 0 0; rotate: 0deg; }\n  16% { translate: -6px 4px; rotate: -8deg; }\n  32% { translate: 2px 1px; rotate: 4deg; }\n  48% { translate: -6px 5px; rotate: -7deg; }\n  64% { translate: 1px 2px; rotate: 3deg; }\n  80% { translate: -5px 5px; rotate: -6deg; }\n  100% { translate: -4px 3px; rotate: -2deg; }\n}\n\n/* 吃饺子：青花碗 + 两只饺子 + 筷子 + 热气 */\n.dsh-pet-bowl-rim {\n  fill: none;\n  stroke: #cfd8e3;\n  stroke-width: 2.6;\n  stroke-linecap: round;\n}\n\n.dsh-pet-bowl-body {\n  fill: #f2f6fb;\n  stroke: #cfd8e3;\n  stroke-width: 1;\n}\n\n.dsh-pet-bowl-base {\n  fill: none;\n  stroke: #cfd8e3;\n  stroke-width: 1.6;\n  stroke-linecap: round;\n}\n\n.dsh-pet-dumpling {\n  fill: #fdf3dc;\n  stroke: #e4d3ac;\n  stroke-width: 0.7;\n}\n\n.dsh-pet-chopstick {\n  fill: none;\n  stroke: #8b5a2b;\n  stroke-width: 1.5;\n  stroke-linecap: round;\n}\n\n.dsh-pet-chopsticks {\n  animation: dsh-pet-chopsticks var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 100% 100%;\n}\n\n@keyframes dsh-pet-chopsticks {\n  0% { rotate: 0deg; }\n  25% { rotate: -12deg; }\n  50% { rotate: 4deg; }\n  75% { rotate: -10deg; }\n  100% { rotate: 0deg; }\n}\n\n.dsh-pet-steam-wisp {\n  fill: none;\n  stroke: #fff;\n  stroke-width: 1.6;\n  stroke-linecap: round;\n  opacity: 0.7;\n}\n\n.dsh-pet-steam {\n  animation: dsh-pet-steam var(--pet-act-ms) ease-in-out both;\n}\n\n@keyframes dsh-pet-steam {\n  0% { opacity: 0; translate: 0 3px; }\n  30% { opacity: 0.8; translate: 0 0; }\n  70% { opacity: 0.5; translate: 0 -4px; }\n  100% { opacity: 0; translate: 0 -7px; }\n}\n\n.dsh-pet-bowl {\n  animation: dsh-pet-bowl-in var(--pet-act-ms) ease-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-bowl-in {\n  0% { translate: 0 10px; opacity: 0; }\n  22% { translate: 0 0; opacity: 1; }\n  100% { translate: 0 0; opacity: 1; }\n}\n\n/* 放烟花：手里一根仙女棒，顶端在炸火花 */\n.dsh-pet-firework-stick {\n  fill: none;\n  stroke: #8b5a2b;\n  stroke-width: 1.8;\n  stroke-linecap: round;\n}\n\n.dsh-pet-firework-core {\n  fill: #ffd166;\n}\n\n.dsh-pet-firework-core-2 {\n  fill: #ffb347;\n  opacity: 0.35;\n}\n\n.dsh-pet-firework-ray {\n  fill: none;\n  stroke: #ff9f43;\n  stroke-width: 1.4;\n  stroke-linecap: round;\n}\n\n.dsh-pet-firework-spark {\n  animation: dsh-pet-spark-burst var(--pet-act-ms) ease-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 50%;\n}\n\n@keyframes dsh-pet-spark-burst {\n  0% { scale: 0.2; opacity: 0; }\n  18% { scale: 1; opacity: 1; }\n  45% { scale: 1.24; opacity: 0.85; }\n  72% { scale: 0.94; opacity: 1; }\n  100% { scale: 0.2; opacity: 0; }\n}\n\n.dsh-pet-firework {\n  animation: dsh-pet-firework-hold var(--pet-act-ms) ease-in-out both;\n  transform-box: fill-box;\n  transform-origin: 50% 100%;\n}\n\n@keyframes dsh-pet-firework-hold {\n  0% { translate: 0 6px; rotate: -4deg; }\n  40% { translate: 0 -2px; rotate: 3deg; }\n  100% { translate: 0 0; rotate: 0deg; }\n}\n\n/* ── 设置：活动流 / 日记 / 图集 ─────────────────────────────────────── */\n\n.dsh-pet-settings-inline {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n}\n\n.dsh-pet-settings-diary {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 8px 10px;\n  border-radius: var(--dsw-radius-md, 8px);\n  background: var(--dsw-alias-settings-card-fill, rgb(0 0 0 / 4%));\n  border: 1px solid var(--dsw-alias-settings-card-stroke, rgb(0 0 0 / 8%));\n}\n\n.dsh-pet-settings-diary-line {\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-secondary, #666);\n}\n\n.dsh-pet-settings-skins {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.dsh-pet-settings-skin {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dsh-pet-settings-skin-thumb {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px;\n  height: 34px;\n  border-radius: var(--dsw-radius-sm, 6px);\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-2, rgb(0 0 0 / 4%));\n}\n\n.dsh-pet-settings-skin-thumb .dsh-pet-sprite-thumb {\n  width: 30px;\n}\n\n.dsh-pet-settings-skin-label {\n  flex: 1;\n  font-size: 12px;\n  color: var(--dsw-alias-label-primary, #333);\n}\n\n/* ── 装扮层 ───────────────────────────────────────────────────────────\n * 常驻配饰画在角色之上、动作道具之下，坐标系与道具层一致（100×100，\n * 对着位图图集量的：橘子 y3–13、眼睛 y25、脖子 y58、短裤 y80–93）。 */\n\n.dsh-pet-outfit-layer {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  z-index: 1;\n}\n\n.dsh-pet-outfit-svg {\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  display: block;\n}\n\n/* 红围巾 */\n.dsh-pet-scarf-band { fill: #e05b4e; }\n.dsh-pet-scarf-fold { fill: none; stroke: #f28a7c; stroke-width: 1.4; stroke-linecap: round; }\n.dsh-pet-scarf-tail { fill: #d14b40; }\n.dsh-pet-scarf-tail-inner { fill: none; stroke: #f28a7c; stroke-width: 1.5; stroke-linecap: round; }\n.dsh-pet-scarf-knot { fill: #e8625a; stroke: #c33f36; stroke-width: 0.8; }\n\n/* 贝雷帽 */\n.dsh-pet-beret-main { fill: #5b79cf; }\n.dsh-pet-beret-band { fill: #463f8f; opacity: 0.55; }\n.dsh-pet-beret-shine { fill: none; stroke: rgb(255 255 255 / 55%); stroke-width: 2.2; stroke-linecap: round; }\n.dsh-pet-beret-stem { fill: #46609f; }\n\n/* 圆框眼镜 */\n.dsh-pet-glasses-lens { fill: rgb(150 200 255 / 22%); stroke: #3b3a44; stroke-width: 2; }\n.dsh-pet-glasses-frame { fill: none; stroke: #3b3a44; stroke-width: 2; stroke-linecap: round; }\n.dsh-pet-glasses-temple { fill: none; stroke: #3b3a44; stroke-width: 1.8; stroke-linecap: round; }\n.dsh-pet-glasses-glint { fill: none; stroke: rgb(255 255 255 / 80%); stroke-width: 1.2; stroke-linecap: round; }\n\n/* 耳机 */\n.dsh-pet-headphones-band { fill: none; stroke: #3a3f4b; stroke-width: 4.2; stroke-linecap: round; }\n.dsh-pet-headphones-cup { fill: #2f3440; }\n.dsh-pet-headphones-cushion { fill: #8ea1c4; }\n\n/* 花环 */\n.dsh-pet-flower-vine { fill: none; stroke: #7a5c3e; stroke-width: 1.6; stroke-linecap: round; }\n.dsh-pet-flower-petal { fill: #ff9ec2; }\n.dsh-pet-flower-core { fill: #ffd166; }\n.dsh-pet-flower-glint { fill: #fff; }\n.dsh-pet-flower-leaf { fill: #7fc08a; }\n\n/* 圣诞帽 */\n.dsh-pet-santa-cone { fill: #d93b34; }\n.dsh-pet-santa-cone-shade { fill: #b62e29; opacity: 0.7; }\n.dsh-pet-santa-brim { fill: #fff7f0; }\n.dsh-pet-santa-pompom { fill: #fff7f0; stroke: rgb(190 160 140 / 35%); stroke-width: 0.8; }\n\n/* 领结 */\n.dsh-pet-bowtie-wing { fill: #d94b45; }\n.dsh-pet-bowtie-knot { fill: #b93a36; }\n\n/* 小披风 */\n.dsh-pet-cape-panel { fill: #c8453f; }\n.dsh-pet-cape-lining { fill: none; stroke: #f0b03c; stroke-width: 1.6; stroke-linecap: round; }\n.dsh-pet-cape-collar { fill: #d94b45; }\n.dsh-pet-cape-collar-line { fill: none; stroke: #f0b03c; stroke-width: 1.2; stroke-linecap: round; }\n\n/* 小书包 */\n.dsh-pet-backpack-body { fill: #4f74c8; }\n.dsh-pet-backpack-strap { fill: none; stroke: #3c5aa0; stroke-width: 3.2; stroke-linecap: round; }\n.dsh-pet-backpack-pocket { fill: #6f8fd8; }\n.dsh-pet-backpack-clip { fill: #f0c24a; }\n\n/* ── 自备静态形象（用户自己的图） ─────────────────────────────────────\n * 这类图没有逐帧动作，靠三件小事显得"活"：\n *   1) 呼吸：极缓慢的纵向缩放（1 → 1.015），比位移更自然；\n *   2) 随光标倾斜：--pet-img-tilt / --pet-img-shift 由 overlay.js 写入；\n *   3) 柔和落地阴影：图是抠底的，没阴影会像贴纸浮着。\n * 不用 transform 而是独立属性（rotate/translate/scale），避免和 --pet-size 抢。\n */\n[data-dsh-pet] {\n  --pet-img-tilt: 0deg;\n  --pet-img-shift: 0px;\n}\n\n.dsh-pet-image {\n  display: block;\n  width: auto;\n  height: auto;\n  max-width: var(--pet-size, 104px);\n  max-height: var(--pet-size, 104px);\n  margin: 0 auto;\n  translate: var(--pet-img-shift) 0;\n  rotate: var(--pet-img-tilt);\n  transform-origin: 50% 100%;\n  filter: drop-shadow(0 6px 10px rgb(0 0 0 / 16%)) drop-shadow(0 1px 2px rgb(0 0 0 / 10%));\n  animation: dsh-pet-image-breathe 4.2s ease-in-out infinite;\n  transition: rotate 220ms ease-out, translate 220ms ease-out;\n  -webkit-user-drag: none;\n  user-select: none;\n}\n\n@keyframes dsh-pet-image-breathe {\n  0%, 100% { scale: 1; }\n  50% { scale: 1.015 1.008; }\n}\n\n[data-motion=\'off\'] .dsh-pet-image,\n[data-dsh-pet][data-motion=\'off\'] .dsh-pet-image {\n  animation: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .dsh-pet-image { animation: none; }\n}\n\n.dsh-pet-image-thumb {\n  display: block;\n  width: 44px;\n  height: 44px;\n  object-fit: contain;\n  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 12%));\n}\n\n'

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

return module.exports;}});
