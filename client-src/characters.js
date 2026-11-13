/**
 * 形象注册表：内置 1 只位图噜噜（+ 可选用户自备图片/动图形象）。
 *
 * 「专属动作」不再用 SVG 零件拼：每个动作是一条带 alpha 的透明 VP9 WebM
 * （assets/anim-*.webm，由 scripts/video-to-webm.py 从绿幕视频逐帧抠像生成），
 * 闲时再叠一条 3.75s 的常驻 idle 视频循环（assets/idle-loop.webm）。视频统一按
 * 384×416 画布出（角色高 396、脚底基线 406），渲染层当作 192×208 的层铺在位图本体上，
 * 所以动作 ↔ 待机切换不跳位置；播不了时退回胶片条（clip-cheer.webp）或程序化演出。
 *
 * 位图图集（assets/lulu.webp）：8 列 × 11 行、单格 192×208、RGBA —— 行 0–8 是 9 组状态
 * 动作（idle / 跑 / 挥手 / 跳 / 失败 / 等待 / 工作中 / 审阅…），行 9–10 是 16 向注视帧。
 * 图集负责拖拽、注视、以及视频覆盖不到的赶状态切换；矢量形象（petSvg 兜底）与用户自备
 * 形象走同一套 class 骨架，状态差异只体现在 root 的 data-state 上。
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
    // 内置形象：位图图集 + 12 条透明 WebM 动作 + 常驻 idle 视频循环（见下方各表）
    id: 'lulu',
    label: { zh: '噜噜', en: 'Lulu' },
    kind: 'sprite',
    // 11 行图集：第 0–8 行是 9 组状态动作，第 9–10 行是 16 向注视帧
    sprite: petSpritePack('__DSH_PET_ASSET_LULU__', { rows: 11, gaze: true }),
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
  // 第三层是常驻 idle 视频：位图形象闲时用它顶掉图集 idle 帧，动作/注视/拖拽时让位
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
 * id 是否登记为位图形象。
 *
 * 和 petIsSprite 的区别：这里不跟随 petCharacter 的「未知 id 回落默认形象」，
 * 所以未知 id 不会凭空拿到动作视频/胶片条/idle 视频（兜底只负责渲染层的默认外观）。
 */
function petRegisteredSprite(characterId) {
  return PET_CHARACTERS.some((character) => character.id === characterId && character.kind === 'sprite')
}

/**
 * 胶片条回退表：actionId → 横向整条 WebP。
 *
 * 平时动作走透明 WebM；这里只在「关掉动效」或视频解码失败时顶上，渲染层逐帧推
 * background-position（不走 GIF 解码），帧数/时长与 actions.js 对齐，两条链路看不出跳变。
 */
// 12 帧 × 150ms = 1800ms，贴着「鼓掌」的 1.8s 动作
const CLIP_CHEER = { url: '__DSH_PET_ASSET_CLIP_CHEER__', frameW: 192, frameH: 208, frames: 12, stepMs: 150 }

// 「蹦跶」也做过一版 i2v 胶片条，但模型没守住「大小不变」：12 帧全是头肩大特写、帽子与脚
// 出画，铺上去比程序化演出更像 bug —— 素材已删，hop 继续走 actions.js 的 effect 表演。
const PET_ACTION_CLIPS = { cheer: CLIP_CHEER }

function petActionClip(characterId, actionId) {
  if (!petRegisteredSprite(characterId)) return null
  return PET_ACTION_CLIPS[actionId] ?? null
}

/**
 * 原生动作视频表：actionId → 一条带 alpha 的 VP9 WebM。
 *
 * 一动作一条（MiniMax-Video-H3-Max 480P/5s 绿幕 → scripts/video-to-webm.py 抠像压缩），
 * 画布 384×416（单格 192×208 的 2 倍）、角色高 396、脚底基线 406，和 .dsh-pet-sprite 同构；
 * seconds 贴近 actions.js 的动作时长（渲染层按动作时长收尾，多出来的帧会被截掉）。
 */
const PET_ACTION_VIDEOS = {
  newyear: { url: '__DSH_PET_ASSET_ANIM_NEWYEAR__', seconds: 2.21 },
  lion: { url: '__DSH_PET_ASSET_ANIM_LION__', seconds: 2.58 },
  fireworks: { url: '__DSH_PET_ASSET_ANIM_FIREWORKS__', seconds: 2.42 },
  redpacket: { url: '__DSH_PET_ASSET_ANIM_REDPACKET__', seconds: 2.21 },
  fu: { url: '__DSH_PET_ASSET_ANIM_FU__', seconds: 2.42 },
  dumpling: { url: '__DSH_PET_ASSET_ANIM_DUMPLING__', seconds: 2.21 },
  shy: { url: '__DSH_PET_ASSET_ANIM_SHY__', seconds: 1.79 },
  cheer: { url: '__DSH_PET_ASSET_ANIM_CHEER__', seconds: 1.83 },
  dizzy: { url: '__DSH_PET_ASSET_ANIM_DIZZY__', seconds: 2.0 },
  spin: { url: '__DSH_PET_ASSET_ANIM_SPIN__', seconds: 1.21 },
  roll: { url: '__DSH_PET_ASSET_ANIM_ROLL__', seconds: 1.58 },
  hop: { url: '__DSH_PET_ASSET_ANIM_HOP__', seconds: 1.21 },
}

function petActionVideo(characterId, actionId) {
  if (!petRegisteredSprite(characterId)) return null
  return PET_ACTION_VIDEOS[actionId] ?? null
}

/**
 * 常驻 idle 视频：3.75s 透明 WebM 循环（assets/idle-loop.webm）。
 *
 * 图集 idle 只有 6 帧、靠 CSS steps 换帧，看久了像定格；这条是真实建模噜噜的连续
 * 呼吸/眨眼（images/pilot/idle3.mp4 里 60 帧循环段，首尾差 1.31）。画布与动作视频同一套，
 * 闲时切到动作不跳位置；关动效 / 注视 / 拖拽时让位回图集帧。
 */
const IDLE_VIDEO = { url: '__DSH_PET_ASSET_IDLE_LOOP__', seconds: 3.75 }

function petIdleVideo(characterId) {
  return petRegisteredSprite(characterId) ? IDLE_VIDEO : null
}

/** 胶片条 CSS：每只位图形象 × 每个回退动作各生成一份逐帧关键帧。 */
function petClipCss() {
  const blocks = []
  const characters = PET_CHARACTERS.filter((character) => character.kind === 'sprite').map((character) => character.id)
  for (const characterId of characters) {
    for (const [actionId, clip] of Object.entries(PET_ACTION_CLIPS)) {
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
