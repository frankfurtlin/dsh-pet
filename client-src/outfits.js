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
