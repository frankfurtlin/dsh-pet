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
