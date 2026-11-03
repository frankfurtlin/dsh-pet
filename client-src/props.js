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
