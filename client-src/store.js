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
