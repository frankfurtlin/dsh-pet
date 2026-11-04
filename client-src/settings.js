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
