# dsh-pet

DSH（DeepSeek Harness）Web 界面的桌宠插件：一只住在右下角、会跟着你的会话状态动的小宠物。内置两只位图形象——默认的**水豚噜噜**（idle 是 3.75s 循环透明视频，12 个专属动作全是透明 WebM）与 **噜噜（经典）**（上游原版图集，idle 用手绘帧）。`client.js` 只有 **213 KB**：图集、12 条动作视频、常驻 idle 视频和回退胶片条都改由 host 半的 `/pet/assets/` 白名单路由按需直供（带 ETag / 304）。支持把**你自己的图片**变成形象（见「自备形象」）。

它是自己写的一套，替代并卸载了 `@michengai/dsh-codex-pet` 与 `dsh-whale-widget`。

![噜噜在右下角](docs/verification/pet/pet-lulu-1440x900.png)

![右上角右键：菜单自动翻到下方，不会被屏幕边缘裁掉](docs/verification/pet/pet-menu-top-right-1440x900.png)

## 有什么

**形象**：两只位图噜噜。矢量版与其它社区形象都已按用户要求删除，`PET_CHARACTERS` 现在两条：

| id | 形象 | 类型 | 说明 |
| --- | --- | --- | --- |
| `pilot` | 噜噜（默认） | 位图 | 同一套 8×11 协议，第 0 行 idle 换成图生视频（Wan2.2-I2V）抽的 6 帧；12 个专属动作全部是 MiniMax 生成的透明 WebM 视频，见「原生动作」 |
| `lulu` | 噜噜（经典） | 位图 | 上游原版图集，9 组动作 + 慢速 idle + **16 向注视帧**；视频不可用/关动效时道具层（狮头 / 红包 / 毛笔 / 碗筷 / 烟花棒）照常盖在它身上 |

两只角色共用同一套动作与视频。**2026-11-05 起默认形象换成 `pilot`**：老用户 localStorage 里如果还停在原来的默认 `lulu`，首次加载会做一次性迁移到 `pilot`（迁移标记 `dsh-pet:migrate:v1-default-pilot`，只迁移一次，之后手动选回经典版不会被覆盖）。

其它形象（糯米猫 / 企鹅豆 / 小火狐 / 布布 / 团团 / 像素鸭 / 咕咚 / 薄荷）与矢量噜噜都已按用户要求移除：源码里的角色条目删掉，素材挪到 `/root/backups/dsh-pet-assets-removed-20261102/`。想再要回来，`assets/` 放回图集 + 在 `PET_CHARACTERS` 里加一条 `{ kind: 'sprite', sprite: petSpritePack(url, { rows: 9|11 }) }` 即可（`scripts/pack-sprite.mjs` 能直接生成条目）；设置页的「自定义图集」也能直接导入。

`size` 四档（小 76 / 中 104 / 大 136 / 超大 200）。

**跟着你看**：闲着的时候宠物会盯着鼠标 —— 切图集第 9–10 行的 16 张注视帧（每 22.5° 一张）。指针进宠物 28px 内或静止 2.2 秒就收回，免得一直瞪着。

位图角色「噜噜」的图集来自公开仓库 [czy666chen/lulu](https://github.com/czy666chen/lulu)（MIT）与 [srwang0506/HatchPet-CapybaraLulu](https://github.com/srwang0506/HatchPet-CapybaraLulu)（Apache-2.0，含全部源帧）：1536×2288、8 列 × 11 行、单格 **192×208**、RGBA。本地副本在 `/root/.dsh/codex-pet/pets/lulu-capybara-3/spritesheet.png`；现在**按原分辨率**压成 `assets/lulu.webp`（442 KB，WebP q82，alpha 保留），单格原生就是 192×208，200 px 档只需 0.96 倍缩，属于「原像素直出」，不再有降采样发虚。**2026-11-05 起素材走 host 直供**：`lib/assets.mjs` 只放行 `[a-z0-9][a-z0-9-]{0,63}.(webp|png|webm)` 白名单名、校验体积（≤768 KB）、回 `ETag` + `Cache-Control: no-cache`（`If-None-Match` 命中 304），路径穿越一律 400；构建只把 URL 拼进 `client.js`（213 KB），刷新页面就是最新素材。**代价是 host 半改动必须重启 DSH 才生效**（没有 HMR，插件也在 `apply()` 时才注册路由），加素材类型/换路由后记得重启。

**状态**（数据源：浏览器侧 `ctx.uiSession.sessionStatus` + host 侧 `/pet/activity` 活动流；仲裁规则见下）：

| 状态 | 触发 |
|---|---|
| `alert` 惊叹 | 有会话在等你审批/回答（最高优先级，卡住用户的事必须最显眼） |
| `thinking` 思考点 | 有任务在跑 |
| `celebrate` 爱心 | 有刚完成、你还没看的任务 |
| `focus` 番茄钟 | 手动开始专注，头顶进度环 |
| `sleep` Zzz | 闲置超过设定分钟数 |
| `idle` 呼吸+眨眼 | 其余时间 |

运行中不再叠加随机说话、也不切姿势（工作态闭嘴，是桌宠能长期留在屏幕上的分水岭）。

**状态仲裁表**（谁盖住谁写成一张表，加新状态只改表、不重推 if 顺序）：`alert 100 > thinking 60 > celebrate 55 > focus 45 > sleep 30 > idle 0`。同优先级取先出现，候选顺序是「本地待审批 → host 精确状态 → 会话事实 → 用户主动态」。「在跑」高于「有未读完成」是刻意的：一个未读徽标不该把正在跑的任务藏起来，完成的即时反馈由 1.1s 的 `react('celebrate')` 负责，不靠常驻状态。

开关：设置 → 活动与预警 → **工具级状态**（`data-feed=on|off`）。关掉后只保留会话级状态（在跑 / 等你审批 / 有未读完成），不再显示"正在跑哪个工具"、不弹回合汇报和占用预警。多人在同一台机器上用、或者嫌气泡太吵时可以关；验收脚本在基准段落里默认关掉它，否则验收自己那次 bash 调用会让宠物一直"思考"（`verify-ui.mjs` 里的 `dsh-pet:verify:live` 标记就是干这个的）。

**活动流（host 半）**：`lib/index.js` 订阅 `ctx.on('session/event')`，把事件折叠成「正在用哪个工具 / 是否在等审批 / 上下文占用 / 上一轮耗时成败 / 待说的话」，浏览器侧每 900ms 轮询 `/pet/activity?after=<seq>`（几百字节、同机回环）。host 半没重启起来时 `/pet/**` 全 404，宠物**静默降级**到只有 `sessionStatus` 的老能力（`data-live="off"`），不报错、不卡住、控制台不刷屏。

| 能力 | 表现 |
| --- | --- |
| 工具级状态 | 换工具时气泡报「🔧 改代码 / 跑命令 / 翻文件 / 上网查 / 派活 / 排计划」，3.5s 节流 |
| 审批标题闪烁 | 有待审批时 `document.title` 每 900ms 闪一次（`🔔 待审批`），处理完立刻恢复原文 —— 后台标签页也能看见 |
| 回合汇报 | 一轮结束报「搞定！这轮 12.4s、5 个工具。」，失败报「这轮卡住了（Xs），要我看看吗？」；成功 +1 任务、+2 亲密度 |
| 上下文预警 | 占用跨过 70% / 88%（设置里可调）弹一次提醒，宠物底部出现 3px 占用条，高档转红 |
| 反向通道 | host 注册 `pet_say` 工具：Agent 可以主动让宠物说一句话（可带动作），气泡最多 40 字 |
| 闲置讨活 | 3–7 分钟空闲时，50% 概率弹「陪我玩一会儿？」+「摸摸我」按钮，点一下走正常摸头逻辑 |

**每日日记**：host 用 `session/event` 记下当天的轮数、失败数、工具调用次数、活跃时长与会话数，落盘 `~/.dsh/pet-diary/<YYYY-MM-DD>.json`（3s 节流、原子写）。设置页「每日日记」显示两句人话：「今天陪跑了 N 轮对话」「我帮你调用了 M 次工具，最喜欢 bash（12 次）」。

**自定义图集**：设置页「自定义图集」可以导入 Codex 格式图集（PNG/WebP、8 列、单格 192×208、9–11 行，≤3MB）。host 端解析 PNG IHDR / WebP VP8|VP8L|VP8X 校验尺寸后存 `~/.dsh/pet-skins/`，浏览器侧把它注册成新的位图角色并即时生成 keyframes —— 导完直接切过去，刷新后仍在。

**提醒**：任务开始 / 完成 / 出现待审批时弹气泡 + 轻响（WebAudio 合成，无音频文件），气泡里带「去看看」按钮，点一下跳到对应会话（`uiWorkspace.openSession`）。数量减少（你自己处理完了）不提醒。

**音量曲线**：设置里的音量（10%–100%，默认 45%）先抬底再线性缩放：`peak = 1.8 × (0.3 + 0.7 × volume)`，音符先汇到主总线过一个压缩器（threshold -14dB、ratio 8:1）再进输出——所以单音峰值可以超过 1 而不会削波。默认 45% 时进压缩器前是 1.107，实测输出峰值 **0.852**（第一版 `volume × 0.5` 只有 0.15）。除了谐波和「延音段」，点击类音型还叠了**低频冲击**（96–110Hz 短正弦，freq 下滑）+ **2.6kHz 噪声瞬态**：同样峰值下低频能量让人耳觉得明显更「重」，这是调数字到 1.8 之后再往上抬的唯一办法（再抬就只剩削波了）。动作音里的鼓、烟花、呼呼声同样是"低频冲击 + 带通噪声"，没有任何音频文件。

**互动**：单击摸头（+1 亲密度，带 220ms 去抖）、双击跳一下、右键菜单（摸摸 / 喂食 / 专注 / **12 个动作点播** / 睡觉或叫醒 / 隐藏 5 分钟 / 回到角落 / 宠物设置）、拖拽落位（**松手在哪就停在哪**；只有真的拖到屏幕左/右边缘 56px 内才吸附贴边，吸附时纵向位置一并记住；落点写百分比，换分辨率/换设备不跑偏）。

**装扮**：用户说过「噜噜太素了」——图集是别人画好的像素，改不动，所以在角色之上叠一层 SVG 常驻配饰，共 9 件，随时可换：

| 装扮 | 位置 | 说明 |
|---|---|---|
| 红围巾 | 脖子 | **默认戴上**，新用户第一眼就不是光溜溜的 |
| 贝雷帽 | 头顶（左倾） | 留出头顶小橘子 |
| 圆框眼镜 | 眼睛 | 半透明镜片 + 反光 |
| 耳机 | 头顶 + 两耳 | 头梁 + 耳罩 + 耳垫 |
| 花环 | 头顶 | 5 朵花 + 藤蔓 + 叶子 |
| 圣诞帽 | 头顶 | 红锥 + 白绒边 + 绒球 |
| 领结 | 胸口 | 双翼 + 结 |
| 小披风 | 肩后 | 两侧披风片 + 金边 + 领圈 |
| 小书包 | 背后 | 双肩带 + 侧袋 + 金扣 |

换装三处入口：右键菜单「换装扮」（点一下顺次切下一件）、设置 → 展示 → 装扮下拉。装扮画在与动作道具同一个 100×100 坐标层里（坐标是对着图集量的：橘子 y3–13、眼睛 y25、脖子 y58、短裤 y80–93），所以位图角色也能精确戴到位；道具层在装扮之上，舞狮时狮头会盖住帽子。

**动作**：右键菜单里的「节日 / 卖萌 / 动一动」三组共 **12 个动作**，点一下宠物就演给你看（配套台词气泡 + 专属音效 + 粒子特效）：

| 分组 | 动作 |
| --- | --- |
| 节日 | 拜年（躬身两次 + 彩纸）、舞狮（弹跳甩头 + 鼓点）、放烟花（跳起 + 14 个火花）、收红包（上弹 + 🧧）、写福字（落笔摆动 + 飘「福」）、吃饺子（咀嚼压缩） |
| 卖萌 | 害羞（缩一下再扭）、鼓掌（快速左右晃 + 星光）、转晕了（越转越歪） |
| 动一动 | 转圈（360°）、打滚（横滚 720°）、蹦跶（连跳） |

**道具与手臂（第二轮：从「抽象」到「具象」）**：用户看完第一版说「很多动作都不动手的，还有什么舞狮，都没有狮子头套」，于是给动作加了两样东西——

| 动作 | 手里拿着什么 | 手怎么动 |
| --- | --- | --- |
| 舞狮 | 狮头（双圈鬃毛 13+11 瓣、金脸、大眼、獠牙、独角、红绒球）+ 红披风（上下金边） | 双手上举把狮头撑起来（`lift`），狮头左右摆、张嘴咬合、绒球甩动；演的时候把角色头上那颗小橘子藏起来，狮头才是完整的 |
| 拜年 | 红金袖口 + 两只抱在一起的拳头 | 双手收到胸前抱着（`clasp`），配合躬身 |
| 收红包 | 带金边、金印的红包 | 双手在胸前托着（`clasp`），红包上下轻轻颠 |
| 写福字 | 微斜的红纸 + 毛笔 | 左手按住纸（`write`），右手握笔一笔一笔写；纸上「福」的 7 笔按 `--pet-ink-delay` 依次用 `stroke-dashoffset` 画出来 |
| 吃饺子 | 青花碗 + 两只饺子 + 筷子 + 热气 | 左手扶碗（`eat`），右手拿筷子往嘴边送，筷子来回搅 |
| 放烟花 | 仙女棒 | 右手举着往右上方伸（`hold`），顶端 8 道火花 + 火芯脉动，配合 14 个粒子 |

实现要点：角色 SVG 里加了两组 `g.dsh-pet-arm`（`transform="translate(肩点)"` + 内层 `transform-box: fill-box; transform-origin: 50% 0%`），动作只改内层的 `rotate` 属性，所以不用碰根元素的 `transform`；道具画在角色之上、气泡之下的独立 SVG 层（`viewBox 0 0 100 100`，和角色同一套坐标），所以**位图形象也能拿道具**。胳膊/手掌用 `--pet-c1` + `--pet-c2` 并加了一点描边——同色的话抬起来会和头糊在一起，看着像「没有手」。道具全部用 class 上色、零内联样式，单测会检查「道具里出现的每个 class 都有 CSS 规则」，防止画了没颜色。

实现方式和动画视频方案不一样：**没有一帧外部素材**，全部是 `rotate / translate / scale` 三个独立 CSS 属性的关键帧（不碰 `transform`，那个已经被 `--pet-scale` 占着）+ 一层 DOM 粒子（`--pet-fx-dx/dy/rot` 驱动一段 `transform` 动画，全程合成层）。所以 12 个动作只让 bundle 涨了 ~22KB，矢量/位图形象都能演（位图的换帧动画走 `background-position`，和动作的 `rotate/translate` 互不干扰）。

粘贴一句参考说明：这套交互参考了 [`@luweiyabo/dsh-whale-pet`](https://github.com/luweiyabo/dsh-whale-pet)（MIT）的「右键点播动作 + 意图仲裁 + 自主表演」设计。它的 95 个动作是 webm 视频，且动画媒体来自上游 `PC2005-cloud/dsh-pet`、授权为「允许开源使用、禁止商用」，所以**一个素材都没搬**——只借了交互与动作分类的思路，动作本体全部自绘。

**自主表演**：完全空闲（没有运行中/待审批/未读、没在专注/睡觉/拖拽、宠物可见）时，每 1.5–4 分钟自己演一个轻动作（蹦跶/转圈/害羞/转晕/鼓掌/打滚），**静音**——用户没在看的时候不该突然出声。鼠标拖动或点菜单会立刻打断当前动作。

**养成**：亲密度每 50 点一级（头顶圆环显示进度）、完成任务计数、专注次数、连续天数（跨天自动滚动，断天重置）、摸头/喂食/任务完成各有加成；换设备可以用「导出/导入」搬家。

**设置**：两处入口 —— 官方的「设置 → 宠物」分区（`settings.section` 槽位），以及右键菜单里的就地浮层（不打断当前操作）。可调：显示开关、形象、大小（小 76 / 中 104 / 大 136 / 超大 200 px）、任务提醒、音效+音量、动画开关（跟随系统/关闭，另受 `prefers-reduced-motion` 约束）、手机端显示、气泡停留时长、打瞌睡阈值、专注/休息时长；统计与导出/导入；恢复默认。

**移动端**：宽度 < 1024px 默认隐藏（手机上宠物挡视线），设置里可以打开，打开后缩到 76px 并抬到底栏之上。

**中英双语**：自持字典，只读 `ctx.locale.getSnapshot().active` 决定用哪套，不注册 DSH 语言命名空间（那个键集合是编译期约束，运行时注册属于灰色地带）。

## 自备形象（用你自己的图）

内置形象只有一只官方素材的噜噜（位图）。如果你想用**别的噜噜图**（比如从小红书存的、朋友画的），这条流水线把它变成插件里的形象：

```bash
# 1. 把图片放进收件箱（png / jpg / webp 都行，中文文件名也行）
#    /root/workspace/plugins/dsh-pet/images/
# 2. 抠底 + 裁边 + 缩到 320px + 生成内联数据模块
python3 scripts/import-lulu.py
# 3. 重新打包
node scripts/build.mjs
# 4. 刷新页面 → 设置 → 形象，多出你的图
```

`import-lulu.py` 做的事：四角颜色接近且够亮时按「边缘连通」抠成透明（不会把角色身上的白色也抠掉）、按 alpha 自动裁掉多余留白、最长边缩到 320px、导出 WebP（alpha 保留）、生成 `assets/user/contact-sheet.png` 供肉眼检查；同时写出 `client-src/generated-images.js`（data URI 内联，插件仍是单文件部署）。

这类形象走 `kind: 'image'` 分支——**它们是静态画，所以不假装有 9 组动作**：只有呼吸起伏（4.2s 一个周期，缩放 1→1.015）、随光标轻微倾斜（±3°、±2px）、脚下柔和落地阴影（抠底图没有阴影会像贴纸浮着）。设置页里和内置形象并列可选。

预算：单图 ≤3MB（脚本会拦），全部内联总量 >900KB 时警告；`assets/user/index.json` 记录每张图的尺寸/体积/是否抠底成功。

**版权**：小红书等平台上的噜噜多为粉丝二创或转载，版权归属不明。这条流水线做出来的是**本机自用**形象，不随插件分发（这站是多人共用）。

### 动态形象（动图 / 短视频 → 循环动画）

静态图能用，但它只会呼吸——想要眨眼、摆尾、摇晃这种「活」的感觉，就给动图。支持 gif、动态 webp，以及 mp4 / mov / webm 短片：

```bash
python3 scripts/import-anim.py --in /root/workspace/plugins/dsh-pet/images/lulu-idle.gif --label 噜噜
# 或短视频：--fps 12 --max-frames 16
node scripts/build.mjs
```

`import-anim.py` 做的事（视频走 ffmpeg 解码，动图走 Pillow，共用 `import-lulu.py` 的抠底/裁边算法）：

1. 解码成帧，按 `--max-frames` 均匀抽帧（首尾帧必留，循环衔接最重要）；
2. 逐帧抠底：背景色取**第一帧四角**，四角颜色接近且够亮才抠，用容差 26 的阈值图 + 边缘连通填充（不会把角色身上的白吃掉），再羽化 0.8；
3. 对齐：统一缩放（单帧最长边 ≤320）、**脚底基线对齐 + 水平居中**——不校基线播放时会上下抖；
4. 拼成一张横向 webp 胶片条（q88，超 900KB 自动降质量），并把帧时长表一起内联进 `client-src/generated-anims.js`。

运行时这类形象走 `kind: 'anim'`：一张 vid 元素都没有，就是背景图按 `steps(1,end)` 逐帧平移（`background-size: N00% 100%`），帧时长来自素材本身（GIF 的 duration、视频按 fps 折算）。所以**GIF 的 256 色问题不存在**，也不会因为解码器差异发灰。

边界要说清楚：一条动图循环只能表达「一个状态」（通常是待机）。思考 / 审批 / 完成的提示仍旧靠头顶进度环、未读徽标和气泡文字，不会假装它在做 9 种动作。想要分状态动画，只有 Codex 协议图集（8 列 × 11 行）那条路，也就是内置噜噜走的路。

**素材要求**：2–4 秒、镜头别动、主体完整不裁剪、背景越干净越好（纯色/纯白最理想，抠底最稳）；短边 ≥400px。带水印的帧脚本不会自动去水印，尽量挑无水印的。

**已验证**：用内置图集 idle 的 6 帧做了个演示动图跑完整条链路，浏览器实测 `data-render=anim`、`background-size: 600% 100%`、动画名 `dsh-pet-anim-a-lulu-idle`、时长 1.1s、`steps(1)` 离散换帧、background-position 逐帧推进（0 → -960px）、136 档渲染 126×136px、无控制台报错；截图 `docs/verification/pet/pet-anim-demo.png`。演示素材验证完已清空（插件默认仍是内置噜噜）。

### 原生动作（生成视频 → 透明 WebM / 横向胶片条）

程序化动作是 SVG 手臂 + 道具「拼」出来的，能表达意思，但不是噜噜真在动。这一版试了另一条路：让视频模型生成整身动作，再交给浏览器按「整段视频」播。

**首选：透明 WebM（`<video>` 直接播）。** 帧率、时长都不受 8×11 图集协议约束，动作就是视频里那一段真实表演：

```bash
# 绿幕 mp4 → assets/anim-<action>.webm（VP9 + alpha，画布 384×416）
python3 scripts/video-to-webm.py --video /root/.hermes/cache/scratch/act/cheer.mp4 \
    --action cheer --start 49 --frames 30
node scripts/build.mjs
```

约定（脚本按这个约定输出，渲染层也按这个约定摆，所以不需要任何额外计算）：画布是单元格 192×208 的 **2 倍**（384×416），角色高 396、脚底基线 406 —— 与图集「角色高 198、基线 203」同构。渲染层把 `<video>` 铺成 192×208 的层（`transform: scale(var(--pet-sprite-scale))`，底边对齐），换动作时角色不会跳大小、不会挪位置。`--start/--frames` 用来掐一个首尾相似度最好的循环段（cheer 取第 43–86 帧 = 44 帧 @24fps / 1.83s，正好盖住 1.8s 的动作）。

链路：`video-to-webm.py` 抽帧 → 去绿/羽化（复用 `video-to-clip.py` 的抠像）→ 全片段统一并集 bbox + 中位高度缩放（保住跳起/下蹲的位移）→ raw RGBA 管道喂 `libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0` → 在 `client-src/characters.js` 的 `PET_ACTION_VIDEOS` 登记 `{ url, seconds }`。构建把 webm 换成 `/pet/assets/anim-<action>.webm` URL（`scripts/build.mjs` 的素材类型已支持 webm，预算 768KB，超了构建直接失败），运行时 `overlay.js` 的 `setVideoAction()` 给 `.dsh-pet-video` 挂 `src`、`currentTime = 0` 后 `play()`，同时隐藏 `.dsh-pet-sprite` 本体与 SVG 道具/装扮层。

**回退：横向胶片条。** 浏览器不支持 alpha WebM、或解码失败时（错误记进 `state.videoBroken`，同一动作不再重试），自动退回横向 WebP + 逐帧 `background-position`：

```bash
python3 scripts/video-to-clip.py --in /root/.hermes/cache/scratch/act/cheer.mp4 --action cheer --frames 12
```

胶片条在 `PET_ACTION_CLIPS` 登记 `{ url, frameW, frameH, frames, stepMs }`，`setClip()` 挂 `data-clip` 后由 `steps(1,end)` 离散换帧 —— 和位图动作同一套机制。两条路都是「整只换姿势」，不是「噜噜身上叠一个道具」。

现状：**12 个动作全部接了原生动作视频**，`lulu` 与 `pilot` 共用（`PET_ACTION_VIDEOS` 12 条）：newyear 2.21s / lion 2.58s / fireworks 2.42s / redpacket 2.21s / fu 2.42s / dumpling 2.21s / shy 1.79s / cheer 1.83s / dizzy 2.00s / spin 1.21s / roll 1.58s / hop 1.21s。素材全部来自腾讯云 TokenHub 的 `MiniMax-Video-H3-Max`（480P / 5s 图生视频 + 绿幕首帧，`prompt_expansion_mode=disabled`），13 条出片共 ¥21.45。

生成经验（写下来免得再踩）：

- **首帧参考图必须给足绿幕留白**：角色约占画面 62%、脚底上方留白，模型会忠实保留首帧构图。早期用贴边裁剪的 `ref_green.png` 当首帧，生成结果必然裁掉帽子/脚。现在的 `ref_green_v3.png` 是拿图集 idle 单格（192×208）放大到角色高 595px、居中贴在 960×960 纯绿幕上。
- 提示词要写「严格保持首帧外观/配色/大小/位置」「全身含脚在画面内」「镜头完全静止」「背景纯绿 #00FF00」，并且**别在提示词里另写服饰**（会覆盖参考图）。
- 一条 5s 源片按动作时长掐循环段：`prep_actions.py` 对每个动作取 `round(seconds*24)` 帧、滑动窗口找首尾差异最小的 start（hop/roll 这类位移大的会触发 `video-to-webm.py` 的并集高度收缩，避免顶破画布）。
- 品质欠佳的两条：`lion` 的狮头比身体还大，把角色遮住了；`fireworks` 只做出彩纸、没做出烟花棒。想重生成时 TokenHub 已返回 `402 / 401007`（免费体验额度用完、后付费未开），等额度恢复再补。
- `hop` 的旧胶片条素材（头肩大特写、帽子与脚出画）仍然不接；现在 hop 走视频，胶片条只留 cheer 当回退。

2026-11-05 已按这条路线迁完：`client.js` 从 3,662.9KB（内联）降到 **213 KB**（只留 URL，`<video preload="none">` 动作触发才拉），渲染层一行没动，只改了 `scripts/build.mjs` 与 host 半。

**常驻 idle 视频（默认 pilot）**：`images/pilot/idle3.mp4`（960×960 / 16fps / 81 帧）扫循环段取**第 5–64 帧 = 60 帧 @16fps = 3.75s（首尾差 1.31）**，经 `video-to-webm.py` 转成 `assets/idle-loop.webm`（116 KB，384×416，alpha 覆盖 0.545，角色高 396 / 基线 406，和动作视频同一套画布协议）。`characters.js` 的 `PET_IDLE_VIDEOS` 只给 pilot 登记，`overlay.js` 的 `syncIdleVideo()` 在闲时给 `.dsh-pet-idle` 挂 `data-idle-video`、按 state 设 `playbackRate`（睡觉 0.55 倍速），动作 / 注视 / 拖拽 / 关动效 / `prefers-reduced-motion` 时一律让位给原渲染（否则会和动作视频叠着播）。经典 lulu 不登记，仍走 6 帧手绘 idle。

## 素材来源与许可

位图素材都是社区公开的 **Codex pet 协议 v2** 图集（1536×2288 或 1536×1872，8 列 × 11/9 行、单格 192×208、RGBA），逐张重新压缩为 WebP 后放进 `assets/`、由 `/pet/assets/` 直供，未做任何缩放（原分辨率就是 200px 档要的清晰度）。

| 形象 | 上游 | 许可 |
| --- | --- | --- |
| 噜噜 | [czy666chen/lulu](https://github.com/czy666chen/lulu)（图集）、[srwang0506/HatchPet-CapybaraLulu](https://github.com/srwang0506/HatchPet-CapybaraLulu)（源帧/构建脚本） | MIT / Apache-2.0 |
| 噜噜（试验）`pilot` | 以噜噜图集第 0 行 idle 为参考图，用 `Wan-AI/Wan2.2-I2V-A14B`（硅基流动）图生视频，抽帧后按原协议回填 idle 行 | 同上游（派生自 MIT/Apache-2.0 素材），本机自用 |
| 12 条动作视频 `anim-*` | `MiniMax-Video-H3-Max`（腾讯云 TokenHub，480P/5s 图生视频，绿幕首帧）→ `scripts/video-to-webm.py` 转透明 WebM；每条按动作时长掐循环段（cheer 43–86 帧 / 44 帧 @24fps，其余见 `PET_ACTION_VIDEOS` 的 seconds） | 同上，本机自用 |
| 鼓掌胶片条 `clip-cheer` | 同一段视频，`scripts/video-to-clip.py` 切成胶片条（视频解码失败时的回退） | 同上，本机自用 |

（此前曾接入的布布 / 团团 / 像素鸭 / 咕咚 / 薄荷已移除，素材保留在 `/root/backups/dsh-pet-assets-removed-20261102/`，各自许可：MIT / MIT / MIT / CC BY 4.0 署名 `咕咚 by Rank` / MIT 署名 `Minty by Somnusochi`。）

选集时在 [legeling/awesome-codex-pet](https://github.com/legeling/awesome-codex-pet)（370+ 只社区宠物索引，代码 MIT、画廊素材标注 CC BY-NC 4.0）里筛，**每只宠物的实际许可以它自己 `submission.json` 的 `license` 字段和上游仓库的 LICENSE 为准**，本项目只收 MIT / Apache-2.0 / CC BY 4.0 这类可再分发的（CC BY 只要求署名，商用也行）；NC、GPL、无许可、以及带第三方 IP 的同人角色一律不收。要换成别的宠物，用 `scripts/pack-sprite.mjs`（见「开发」）。

## 同类插件借鉴（2026-11-02 调研）

从 dsh-market 目录（`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`，4282 个插件）里筛出 66 个桌宠插件，挑 13 个解包读了源码。结论：**它们强在事件粒度与反向通道，我们强在零素材的程序化表演**。只借鉴设计，没有搬任何素材（多数包的美术不在 MIT 内）。

| 值得抄的机制 | 出处 | 实现线索 |
| --- | --- | --- |
| 工具级状态（在跑哪个工具） | `@zyfgood/dsh-whale-girl` 0.3.0（MIT） | `lib/index.js:398` `ctx.on('session/event',(_s,e)=>pet.onSessionEvent(e))`；`turn/call` 记 `currentTool`，`turn/end` 按 `/(error|abort|cancel|interrupt|fail)/i` 判成败 |
| 工具名 → 中文标签 | 同上 + `dsh-task-mascot` 2.1.0 | 正则表：bash→敲命令、read→读文件、edit/write→改文件、glob/grep→搜索 |
| 审批时闪标签页标题 | `whale-on-desk` 3.0.0（MIT） | `lib/client.js:730` `document.title='🔔 审批… | '+baseTitle`，零成本强提醒 |
| 状态优先级仲裁表 | 同上 | `lib/pet-machine.mjs:9` `STATE_PRIORITY`（glass-tap=100 最高）+ `snapshot=forced??transient??durable` |
| Agent 主动让宠物说话 | `@hellosz/dsh-pets` 0.3.1（代码 MIT） | `ctx.get('tools')` 有才注册 `pet_say`，台词截 40 字、气泡 10s |
| 上下文用量三档预警 | `dsh-token-pet` 0.4.2（MIT） | `lib/usage.js` 从 `assistant/chunk` 的 `chunk.usage` 取 token，62/82/84% 三档换表情 |
| 图集导入 + v1/v2 自动识别 | `@signalight/dsh-codex-pet` 0.5.0 | `src/registry.js:109` 按像素宽高 1536×1872→v1、1536×2288→v2（与我们同规格） |
| 逐帧解会话日志 | `dsh-pet-cuteness-plugin` 0.2.8 | `~/.dsh/sessions/<ws>/<sid>/session.v4.jsonl.zstd` 必须**逐帧** `zstdDecompressSync`（append 写会追加帧） |
| per-record 存档 | `dsh-pomodoro-pet` 0.10.0 | `storageDomain.open({name,version,layout:'per-record'})`：每秒写 2ms vs 整文档 35ms |
| 局域网看同事的宠物 | `dsh-pet-lan` 0.5.2 | udp4 `reuseAddr` 0.0.0.0:41234，ANNOUNCE 1500ms / TTL 6500ms |

不抄的：上百个 webm 动作库（上游 assets 62MB / 109 段，我们 12 个动作只涨 22KB）、同人 IP 皮肤（侵权）、宠物代操作（安全边界）。

## 装 / 卸

```bash
# 装（link: 依赖，改 client-src 后重新 build 再刷新页面即可生效，不需要重启服务）
dsh plugin --profile web add /root/workspace/plugins/dsh-pet

# 卸载（同时清掉 profile 里的 bundle 条目）
dsh plugin --profile web remove dsh-pet
```

装完打一次浏览器验收：

```bash
cd /root/workspace/plugins/dsh-pet
node scripts/verify-ui.mjs            # 自动从 journal 取本次启动的 launch token
```

`/pet/status` 是 host 侧自检路由：`curl -s http://127.0.0.1:3080/pet/status` 返回插件名、版本、客户端 bundle 字节数、内置形象数量、`assets` 素材清单。`/pet/assets/<name>` 是素材直供路由：只允许 GET/HEAD、只认白名单文件名、带 `ETag`（体积+mtime）与 `Cache-Control: no-cache`、体积上限 768 KB；未知素材 404、路径穿越 400、其它方法 405。这两个路由只证明插件挂上了，浏览器里的实际表现以 `verify-ui.mjs` 为准。

## 加点别的宠物

`scripts/pack-sprite.mjs` 是从「一张 Codex pet 图集」到「插件里可选形象」的一步到位工具：

```bash
# 1) 校验图集尺寸/透明度、按体积预算压成 WebP（不缩放），并打印角色条目
node scripts/pack-sprite.mjs /path/to/spritesheet.webp tuantuan-like --name 新宠物 --budget 320

# 2) 把打印出来的那一项粘进 client-src/characters.js 的 PET_CHARACTERS，
#    位图形象统一用 petSpritePack(url, { rows: 9|11, gaze: 11 行才开 }) 写

# 3) 重新构建 + 跑门（构建会校验占位符有素材、素材没超预算）
node scripts/build.mjs && node --test test/pet.test.mjs
```

11 行的图集（多出第 9–10 行 16 向注视帧）把 `gaze` 打开，宠物就会盯着鼠标看；9 行的只有动作。图集如果不合规（宽度不是 1536、高度不是 208 的倍数、少于 9 行），工具会直接拒绝而不是塞进去一半。

## 开发

```bash
npm run build     # client-src/*.js + styles/pet.css → client.js
npm run check     # 校验 client.js 与源码一致（构建产物被手改过会失败）
npm test          # 单元测试（node --test，无需浏览器）
npm run verify    # 浏览器验收（Playwright + 真 Chromium）
```

目录：

```
package.json           dsh.bundle.patch + dsh.client（platform=web）
cordis.patch.yml       - insert: [{id: dsh-pet, name: dsh-pet}]
lib/index.js           host 半：注册 /pet/status 与 /pet/assets（只读，不写文件）
lib/assets.mjs         素材白名单解析 / ETag / 体积闸门（被 index.js 复用，也有独立单测）
client.js              构建产物（不要手改）
client-src/
  characters.js        角色定义（2 只位图）+ 图集/动作视频/胶片条登记 + 生成的 CSS
  actions.js           12 个动作（时长、道具、粒子、SVG 手臂关键帧）
  props.js             道具层绘制（狮头 / 红包 / 毛笔 / 碗筷 / 烟花棒）
  outfits.js           装扮层（红围巾 / 圣诞帽 / 眼镜）
  i18n.js              中英字典 + 占位符替换
  live.js              活动流 / 日记 / 预警轮询（host 侧 /pet/** 的客户端半个）
  store.js             设置与养成的 localStorage 存储（250ms 防抖、全部 try/catch）
  sound.js             WebAudio 合成音效（五声音阶，无素材）
  state.js             会话状态投影 → 宠物状态；事件检测
  overlay.js           宠物 DOM、动画、拖拽吸附、菜单、气泡、番茄钟
  settings.js          设置面板（React，官方槽位用）
  main.js              接线：样式注入、槽位注册、就地设置浮层
styles/pet.css         全部样式（只覆盖 --dsw-* token）
assets/                直供素材：lulu.webp / lulu-idle-v2.webp（图集）、anim-*.webm（12 条动作）、idle-loop.webm（116KB 常驻 idle）、clip-cheer.webp / clip-hop.webp（回退胶片条）
scripts/build.mjs      拼包 + 三重校验（语法 / token 名 / 占位符）+ 素材预算闸门
scripts/verify-ui.mjs  浏览器验收 147 项断言 + 截图 + JSON 报告
scripts/build.config.json  ui-theme bundle 候选路径（token 校验用）
scripts/import-lulu.py     静态图 → 抠底/裁边 → assets/user/（自备形象）
scripts/import-anim.py     gif/短视频 → 抠底/对齐 → 循环动图素材
scripts/pack-sprite.mjs    社区图集 → PET_CHARACTERS 条目
scripts/video-to-atlas.py  绿幕动作视频 → 图集某一行（8×11 协议）
scripts/video-to-webm.py   绿幕动作视频 → 透明 WebM assets/anim-*.webm（原生动作）
scripts/video-to-clip.py   绿幕动作视频 → 横向胶片条 assets/clip-*.webp（回退）
scripts/gen-scene.py       真实照片级场景合成（rembg + Pollinations + 影调匹配，实验）
scripts/gen-edit.py        图生图换场景（硅基流动 Qwen-Image-Edit，实验）
test/pet.test.mjs      单元测试（23 个用例：bundle 形状 / 图集协议 / 流水线 / 动作库 / 素材 URL）
test/assets.test.mjs   素材路由纯逻辑测试（5 个用例：白名单 / 穿越 / ETag / 体积闸门）
test/host.test.mjs     host 侧单元测试（16 个用例）
docs/verification/pet/ 验收报告与截图
images/                素材工作区（生成/收集的原始图片视频，不进 bundle，勿删）
```

## 几个设计取舍

**为什么手写拼包，不用 bundler。** 客户端 bundle 必须是 `window.__ModuleLoader__.load({id, factory})` 这一种同步 CJS 形状，用 vite/tsdown 反而要再维护一份「基线模块保持 external」的配置。14 个源文件按固定顺序拼进同一个 factory 作用域，构建成本接近零，`npm run check` 还能逐字节确认产物没走样。

**为什么构建期校验 CSS token 名。** 样式只覆盖 `--dsw-*` 官方 token，不硬编码颜色。构建脚本从当前安装的 ui-theme bundle 里取 token 名集合，自己定义的、`var()` 引用的都必须存在——官方哪天改名，构建立刻失败，而不是等用户发现"颜色不对"。同一个校验器抓出过 4 个我记错的 token 名（`--dsw-alias-state-warning-primary` 实际是 `--dsw-alias-state-warn-primary` 等）。

**为什么故意不写 `engines.dsh` / peerDependencies 里的 dsh 区间。** 那是 DSH 升级后"整行禁用插件"的头号原因（本地另两个插件就是因为区间不匹配在某次 rc 升级后整体消失）。这个插件只用 `slots` / `sessions` / `locale` / `uiSession` 四个公开服务，最坏情况是某个服务改名导致联动失效，宠物本身照常在。

**为什么设置存 localStorage 而不是 host 文件。** `dsh.frankfurtlin.top` 是多人共用的：宠物是个人偏好（形象、大小、位置、音效），按浏览器存才不会互相覆盖；也不用让 host 半碰任何文件系统，耦合面只有 `webServer` 一个 API。代价是换浏览器就重来，所以补了导出/导入。

**为什么样式表要反复挪到 `<head>` 末尾。** 其他客户端插件（主题、侧栏、移动端 UX）也会追加样式；`--pet-*` 变量挂在我们自己的根元素上，被整块覆盖就退回"没有宠物"的样子。`petStabilizeLater()` 在 DOMContentLoaded、挂载后 300ms / 1500ms 各复查一次，纯幂等——这一条是浏览器验收先失败、再修出来的。

**为什么菜单落点要用 JS 算。** 菜单挂在宠物容器里，早期用 `bottom: calc(100% + 8px); right: 0` 贴边推：宠物在**右上角**时，菜单直接顶出屏幕上沿，被裁掉一大半（用户报的 bug）。现在 `petMenuLayout()` 是个纯函数：优先放在宠物上方并水平居中 → 上方放不下就翻到下方 → 最后整体夹进视口（左右/上下各留 8px）。`placeMenu()` 取宠物与菜单的真实 rect 换算成视口坐标，再减去根容器坐标写内联 `left/top/max-width`；`max-height` 用 `box-sizing: border-box`，否则 padding + border 会让菜单比视口高 10px（小视口验收抓出来的）。窗口 resize 且菜单开着时会重算。

**为什么 figure 要显式给 100%×100%。** 位图角色本体（`.dsh-pet-sprite`）是绝对定位的，删掉矢量 SVG 之后 figure 里再没有撑高度的东西，高度会塌成 0：宠物看着还在（绝对定位元素照样画），但指针命中区是 0 高，点不到、拖不动、Playwright 也判 `not visible`。所以创建时直接写死 `width/height: 100%`。

**为什么单击要 220ms 去抖。** 双击要跳一下，单击要摸头；不去抖的话双击会先触发一次摸头。去抖窗口内不重复计数，拖拽（移动 > 4px）也不会被当成点击。

## 验收记录

2026-11-05 第四轮（素材改 host 直供 + 常驻 idle 视频）：`client.js` 从 3,662.9KB 降到 **213.2 KB** —— 新增 `lib/assets.mjs` + `/pet/assets/<name>` 路由（白名单名 / 体积闸门 / ETag / 304 / 穿越 400 / 非 GET 405），`scripts/build.mjs` 从「内联 base64」改成「替换成 URL」，12 条动作视频 + 两张图集 + 胶片条全部按需直供。新增 pilot 常驻 idle 视频 `assets/idle-loop.webm`（3.75s / 116KB / 60 帧 @16fps，扫描 41 个窗口选出首尾差 1.31 的循环段），渲染层 `syncIdleVideo()` 在闲时接管、动作/注视/拖拽/关动效时让位，经典 lulu 仍走手绘帧。单测 **44/44**（新增 `test/assets.test.mjs` 5 个 + 素材 URL 全量落盘校验 + idle 视频登记/体积/URL 用例）。**注意：这两个改动都落在 host 半和素材加载协议上，必须重启 DSH 才生效**；重启后 `npm run verify` 复验，结果写入 `docs/verification/pet/verify-ui.json`。

2026-11-05 第三轮（pilot 设为默认形象）：`npm run verify` 三视口 **148/148** 全绿（报告 `docs/verification/pet/verify-ui.json`）；单元测试 **21/21**（+ host 16/16）。默认形象 `pilot` 排在 `PET_CHARACTERS` 第一位、标签改为「噜噜 / Lulu」，原图集降级为「噜噜（经典） / Lulu (classic)」；`PET_DEFAULT_SETTINGS.character = 'pilot'`；新增一次性迁移 `petMigrateDefaultCharacter()`（老设置停在 `lulu` 的迁到 `pilot`，只做一次，用户之后再选经典版不受影响）；设置里删掉自备形象时的回落也改到 `pilot`。验收相应改动：新用户默认形象断言改成 `pilot`、新增「经典 lulu 能切过去且图集与 pilot 不同」、设置卡片文案改成「默认 pilot + 经典 lulu」。单测新增迁移用例（老 lulu 数据 → pilot、其它设置不被冲掉、迁一次后尊重用户选择）与两只形象的顺序/标签/回落断言。

2026-11-05 第二轮（12 个动作全部换成原生视频）：`npm run verify` 三视口全绿（**147/147**，报告 `docs/verification/pet/verify-ui.json`）；单元测试 **20/20**（+ host 16/16）。`PET_ACTION_VIDEOS` 扩到 12 条，`lulu`/`pilot` 共用；`client.js` 3,662.9KB（内联 12 条 webm + 图集 + 胶片条）。验收新增一条覆盖断言「12 个专属动作全部由透明 WebM 播放」（逐个触发，检查 `data-clip-active=video`、`src` 是 `data:video/webm`、`display:block`）；原来「手里有道具」的 18 条断言改为在**关掉动效**的回落路径上验（视频让位时 SVG 道具/姿态仍完整）。单测新增「两只角色的视频表必须覆盖 `PET_ACTIONS` 全部 12 个动作」。页面实拍 `docs/verification/pet/pet-actions-*.png`（lion/fireworks/newyear/dizzy/spin/hop/roll）。已知欠佳：lion 狮头过大遮住角色、fireworks 无烟花棒；TokenHub 现已 `402/401007`，重生成要等额度。

2026-11-05（cheer 换成 MiniMax 生成素材）：`npm run verify` 三视口全绿（**147/147**，报告 `docs/verification/pet/verify-ui.json`，截图 `pet-pilot-cheer.png`）；单测 **20/20**。
这一版把 `assets/anim-cheer.webm` 换成腾讯云 TokenHub `MiniMax-Video-H3-Max`（480P、5s）图生视频的产物：绿幕首帧用图集 idle 第 0 帧放大粘在 960×960 绿幕上（角色高 62%、脚底留白），提示词强调「镜头静止／角色大小位置不变／全身在画面内／不要改服饰」，抽 44 帧循环段（43–86，@24fps = 1.83s）经 `video-to-webm.py` 转透明 VP9（384×416，alpha 覆盖 0.438，64KB）。实测视频层与本体同尺寸同底边，帽子小柄与双脚都在画面内；旧素材（硅基流动 30 帧 @16fps / 1.88s）已废弃。
```
python3 /tmp/maxtube/gen.py cheer --ref-file /tmp/maxtube/ref_green_v3.png   # 提交 + 轮询 + 下载 mp4
python3 scripts/video-to-webm.py --video /tmp/maxtube/out/cheer.mp4 --action cheer --start 43 --frames 44 --fps 24
```

2026-11-04（位图形象 2 只 + 原生动作视频）：`npm run verify` 在 1440×900、390×844、420×420 三个视口全绿（**147/147**，报告 `docs/verification/pet/verify-ui.json`，截图新增 `pet-pilot-cheer.png`）；单元测试 **20/20**（`npm test`）。这一版把 `cheer` 从胶片条换成**透明 WebM 视频**（`<video>` 直接播，解码失败自动回退胶片条），验证了这条「专属动作」路线可行：视频层与位图本体同尺寸同底边（实测 128×138 / 底边 809 一致）、`currentTime` 在走、时长 1.876s、动作结束自动暂停收起。这一轮修掉一个真 bug：`applySettings()` 换形象时只取 `holder.firstElementChild`，而 `petSpriteMarkup()` 返回「本体 + 胶片条」两个兄弟节点，胶片条从来没进 DOM —— 所以原生动作在实际页面里一次都没播过（单测只查字符串，查不出来）。修法：换形象前先 `clearNative()`，再按 `.dsh-pet-svg, .dsh-pet-sprite, .dsh-pet-clip, .dsh-pet-video, .dsh-pet-image, .dsh-pet-anim` 收集旧节点，整体插入新节点后统一删旧（加视频层时又漏了一次 `.dsh-pet-video`，表现是切角色后视频层叠成两份 —— 已补进选择器并加了断言）。回归断言（13 条）覆盖：动作层三层各一份（本体 / 胶片条 / 视频）、设置里 lulu + pilot 两张卡、pilot 图集与 lulu 不同且闲时两层都隐藏、pilot 鼓掌走视频模式（`data-clip-active=video`、`src` 是 `data:video/webm`、未暂停且 `currentTime > 0`、时长 1.876s）、视频层与本体同尺寸同底边、道具层与装扮层一起让位、演完视频暂停收起、切回 lulu 不叠层、lulu 同样走原生鼓掌、hop 没有原生素材时退回 SVG 表演（不挂视频也不挂胶片条）、关掉动效时不放视频而是退回胶片条定格第一帧（`prefers-reduced-motion` 同理）。单测同名用例扩展成「胶片条与透明视频都只接合格素材」：视频源文件必须在 `assets/` 里、大小 > 1KB、时长与动作差不超过 0.3s、构建产物里必须有内联的 `data:video/webm;base64,`。注：验收脚本要反复 reload 页面，`[ui-cordis] reading the Cordis inventory failed … Failed to fetch` 会随机冒出来（DSH 自身插件拉插件清单的网关抖动，非本插件）；已在「无意外报错」断言里按精确文案放过，其余报错照旧严格。

2026-11-02（首轮）：`npm run verify` 在 1440×900、390×844 与一个 420×420 的小视口跑，**133/133** 全绿，报告与截图在 `docs/verification/pet/`（`pet-1440x900.png`、`pet-390x844.png`、`pet-lulu-1440x900.png`、`pet-huge-1440x900.png`、`pet-menu-top-right-1440x900.png`）。断言覆盖：**装扮**（默认红围巾、换圣诞帽是替换不是叠加、眼镜对得上眼睛、右键「换装扮」循环并显示当前装扮）、launch token 能进页面、样式在 head 末尾、默认形象（新用户 = 位图噜噜）/落点/尺寸、CSS token 生效、点击弹气泡且亲密度 +1、右键菜单三组动作与 12 个动作可点播（拜年 → `data-act=bow` + 2.2s、放烟花 → 14 个火花）、设置页 12 个动作试演按钮、点击音效真实输出峰值 0.837、**右键菜单落点回归**（把宠物摆到右上角/右下角/小视口 420×420，菜单四边都必须在视口内、条目仍可点、点「摸摸」真生效）、设置浮层回归（点内部不关闭、关掉再重开仍不关闭、点外部才关闭）、大小四档（含超大 200px 按 200/208 等比放大）、拖拽回归（横拖 180px / 竖直拖 220px 都不回弹、拖到左边缘才吸附且保住纵向位置、刷新后位置保持、可恢复右下角）、16 向注视（正左/正上各验一格、注视时停 keyframes、进 dead zone 与静止 2.2s 回 idle）、手机端默认隐藏与开关后出现、无意外控制台报错。

2026-11-02 第二轮（活动流 / 预警 / 日记 / 图集）：`npm run verify` 重启前 **128/128**（`/pet/**` 404 的降级路径通过）；删掉矢量形象、菜单改为视口内落点后为 **126/126**（部分矢量/形象断言合并）。单元测试 **16/16**，另有 host 侧 `test/host.test.mjs` **16/16**（`node --test test/host.test.mjs`）。新增断言：`data-live` 只在 on/off 之间、`data-usage` 取值合法、占用条元素存在、`/pet/activity` 离线时降级为 off 且不报错、设置里活动流状态行 / 每日日记块 / 图集导入入口 / 预警阈值默认 70-88；在线时额外验 `/pet/activity` 快照合法、`data-live=on`、`/pet/diary` 返回可读短句。新增单测：优先级表与仲裁、host 状态映射（approval/error→alert、tool→thinking、done→celebrate）、工具名→相位（todo_write 判"排计划"、web_search 判"上网查"）、时长格式化、上下文等级阈值、回合文案成败、轮询器（水位 after=7 前移、连续失败降级）、标题闪烁恢复原文、图集注册（非法 id/行数/mime 被拒、重复注册幂等、CSS 里出现 `/pet/skins/<id>.webp`）。

单元测试（`npm test`，23 个用例 + `test/assets.test.mjs` 5 个）覆盖：自备形象流水线（图片 → 抠底/裁边/缩放 → 内联数据模块）、包名/版本/补丁 id 一致、矢量角色配色 JS↔CSS 逐 token 对齐、位图协议（8 列×11 行、9 动作行号与帧数、慢速 idle = 1.8×、状态→动作投影、拖拽左右朝向、生成 10 组 keyframes、素材体积预算与 URL 直供）、中英键集合相同、store 等级数学与持久化与跨天连续、状态优先级与事件检测（Map/对象两种快照）、bundle 形状与导出名、动作库（id 唯一 / 每类非空 / 时长 1–3s / 每个 effect 都有对应关键帧与 `data-act` 规则 / 粒子数量与取整 / 空闲自演只在轻动作池里）。

## 已知边界

- 自备的静态图 / 动图都是**本机自用**素材：静态只有呼吸+倾斜+阴影，动图只有一条循环（无法分状态）。

- **用户自定义图片形象**：已支持（`scripts/import-lulu.py` + `kind: 'image'` 分支，见「自备形象」）；静态画只有呼吸/倾斜跟随，没有逐帧动作；内置位图形象已经有通用分支：在 `client-src/characters.js` 的 `PET_CHARACTERS` 里加一项 `{ kind: 'sprite', sprite: { url: '__DSH_PET_ASSET_<NAME>__', frameW, frameH, cols, rows, actions, states } }`，把图集放到 `assets/<name>.webp`，构建会替换成 `/pet/assets/<name>.webp` 并校验体积。位图噜噜已经接了第 9–10 行的 16 向注视帧；以后再收位图形象若要注视，加 `sprite.gaze = { rows: [9, 10], count: 16, originDeg: -90, stepDeg: 22.5, deadZonePx: 28 }` 即可。
- 动作主体仍是**程序化表演**（CSS 关键帧 + DOM 粒子），12 个动作另外接了一条原生透明 WebM（`assets/anim-*.webm`，宿主 `/pet/assets` 直供，bundle 里只留 URL）；播不了时按「视频 → 胶片条 → SVG 表演」三级回退。所以动作数比 `dsh-whale-pet` 的 95 个少，也因此没有素材体积和授权问题。加新动作视频：`scripts/video-to-webm.py` 转好放进 `assets/`，在 `client-src/characters.js` 的 `PET_ACTION_VIDEOS` 登记 `{ url, seconds }`，`npm run build` 会校验体积并替换成 URL（host 路由只认白名单名，改路由本身要重启 DSH）。想加动作：在 `client-src/actions.js` 的 `PET_ACTIONS` 里加一项 + 在 `styles/pet.css` 写对应 `@keyframes dsh-pet-act-<effect>` 与 `[data-act='<effect>']` 规则，单测会检查两者是否都写了。
- **生成素材的一致性还不够**：图生视频会轻微改比例（头偏大）、抹掉小细节（南瓜帽的柄变平顶），`hop` 的片段甚至整段出画，所以只接了鼓掌一个动作。要全面替换成「专属动作」，得先解决生成侧的镜头/比例锁定（或改用逐帧重绘、把动作重定向到原图集比例），并且需要重新拿到视频生成额度 —— 剩下 10 个动作提交时全部返回 `HTTP 402 Payment Required`。
- `assets/clip-hop.webp` 是**被拒的草稿**（head/脚出画、全程头肩特写），留在仓库里供以后对比，不参与构建（实际页面效果见 `docs/verification/pet/pet-hop-rejected-page.png`：只剩头肩，帽子与脚都在画外）；`images/generated/` 与 `images/generated-i2i/`（换背景/换场景实验）也没有接入任何代码路径。
- 宠物只有一套「行为人格」，没有多套语音/性格包。
- 没有余额/用量展示（按需求只要纯宠物功能，不做钱包）。
- 音效是合成音，不是打包的音频文件；想要更丰富需要引入素材与授权。
- 无头 Chromium 缺中文字体，截图里的中文会显示成方框（气泡文案本身是正确的中文，只是渲染字体缺失）。

## 提交约定

沿用 [Conventional Commits](https://www.conventionalcommits.org/)：`<type>(<scope>): <中文摘要>`。

- `type`：`feat`（新功能）/ `fix`（修 bug）/ `docs` / `test` / `build` / `chore` / `refactor`
- `scope`：受影响的部分，如 `host`、`client`、`panel`、`ai`、`layout`、`verify`
- 摘要用祈使句、不加句号，控制在 50 字内；正文说明「为什么」和影响面
- 一次提交只做一件事；改完必须跑过 `npm run check`（或等价）与对应的验收脚本
