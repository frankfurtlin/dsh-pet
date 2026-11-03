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
