# dsh-pet — desktop pet

**A capybara desktop pet for the DSH Web UI that reacts to what your sessions are doing.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/DSH-DeepSeek%20Harness-5b5ef7)](https://github.com/frankfurtlin/dsh-pocket)

[中文](README.md) · [English](README.en.md)

![Lulu in the bottom-right corner](docs/verification/pet/pet-1440x900.png)

## What it is

dsh-pet is a desktop-pet plugin for the DSH Web UI. The built-in character is a bitmap capybara, Lulu (`id: lulu`), that sits in the bottom-right corner: a 3.75 s transparent idle video when nothing is happening, 12 native WebM actions when you ask for one, and a sprite-sheet fallback for dragging, 16-direction gaze and state changes. The client bundle is only about 213 KB because the sprite sheet, the action videos, the idle loop and the fallback filmstrip are served on demand from the host half (`/pet/assets/`, ETag + 304) instead of being inlined.

It is a self-contained implementation that replaced and uninstalled `@michengai/dsh-codex-pet` and `dsh-whale-widget`.

## Features

- **Character**: one bitmap Lulu, four sizes (76 / 104 / 136 / 200 px). It watches the pointer when idle (16 gaze frames, one per 22.5°), withdraws when the pointer comes within 28 px or rests for 2.2 s.
- **Session states**: `alert` (a session waits for approval or an answer), `thinking` (a task is running), `celebrate` (a finished task you have not seen), `focus` (pomodoro), `sleep` (idle longer than the configured timeout), `idle`.
  Priority is a table, not an if-chain: `alert 100 > thinking 60 > celebrate 55 > focus 45 > sleep 30 > idle 0`. "Running" deliberately outranks "unread finished" — a badge should not hide work in progress; the 1.1 s `react('celebrate')` covers immediate feedback.
- **Activity feed (host half)**: `lib/index.js` subscribes to `ctx.on('session/event')` and folds events into "which tool is running / waiting for approval / context usage / last turn result / pending line". The client polls `/pet/activity?after=<seq>` every 900 ms (a few hundred bytes over loopback). If the host half is down, `/pet/**` returns 404 and the pet silently degrades to the old `sessionStatus`-only mode (`data-live="off"`); no errors, no console spam.
  - tool-level bubble ("改代码 / 跑命令 / 翻文件 / 上网查 / 派活 / 排计划"), throttled to 3.5 s;
  - `document.title` flashes `🔔 待审批` every 900 ms while an approval is pending, restored as soon as it is handled;
  - turn report ("搞定！这轮 12.4s、5 个工具。"), +1 task and +2 intimacy on success;
  - context warnings when usage crosses 70% / 88% (configurable), plus a 3 px usage bar at the pet's feet;
  - `pet_say` reverse channel: the agent can make the pet say a line (optionally with an action), max 40 characters;
  - idle prompt ("陪我玩一会儿？") after 3–7 minutes of inactivity, 50% chance.
  The whole tool-level feed can be switched off in Settings → 活动与预警 → 工具级状态 (`data-feed=on|off`).
- **Daily diary**: the host half records turns, failures, tool calls, active time and session count per day into `~/.dsh/pet-diary/<YYYY-MM-DD>.json` (3 s throttle, atomic writes). The settings page renders two plain sentences from it.
- **Outfits**: 9 SVG accessories drawn on top of the sprite (red scarf, beret, round glasses, headphones, flower crown, Santa hat, bow tie, cape, backpack). Red scarf is the default. Outfit, action props and arms share the same 100×100 coordinate layer, so a bitmap character can wear them precisely.
- **Actions**: 12 actions in three groups, each with a speech bubble, a synthesized sound and particles — 节日 (newyear, lion, fireworks, redpacket, fu, dumpling), 卖萌 (shy, cheer, dizzy), 动一动 (spin, roll, hop). Arms are two `g.dsh-pet-arm` groups whose inner `rotate` is animated; props sit in a separate SVG layer above the character, so bitmap characters can hold them too.
- **Native action videos**: each of the 12 actions also has a transparent WebM (`assets/anim-<action>.webm`, `PET_ACTION_VIDEOS`). The renderer puts a `<video>` at exactly the 192×208 cell size, scaled by `--pet-sprite-scale`, bottom-aligned, so the character never jumps in size or position. If alpha WebM fails to decode, it falls back to a horizontal WebP filmstrip, and then to the SVG performance.
- **Growth**: intimacy levels every 50 points (progress ring above the head), completed-task count, focus sessions, day streak; export/import to move between browsers.
- **Settings**: official Settings → 宠物 section plus an in-place overlay from the right-click menu. Display on/off, character, size, task reminders, sound + volume, animation switch, mobile display, bubble duration, doze threshold, focus/break lengths, stats, export/import, reset.
- **Mobile**: hidden below 1024 px by default; when enabled it shrinks to 76 px and lifts above the bottom bar.
- **Bilingual**: the plugin keeps its own zh/en dictionary, reads `ctx.locale.getSnapshot().active`, and does not register a DSH locale namespace.

## Install / uninstall

```bash
# install (link: dependency; after changing client-src just rebuild and refresh, no restart)
dsh plugin --profile web add /root/workspace/plugins/dsh-pet

# uninstall (also removes the bundle entry from the profile)
dsh plugin --profile web remove dsh-pet
```

Then run the browser acceptance once:

```bash
cd /root/workspace/plugins/dsh-pet
node scripts/verify-ui.mjs            # picks up the launch token of the current boot from the journal
```

Check the host half is mounted:

```sh
curl -s http://127.0.0.1:3080/pet/status
# → plugin name, version, client bundle bytes, built-in character count, asset list
```

Routes registered by the host half:

| Route | Purpose |
|---|---|
| `GET /pet/status` | Read-only self-check (name, version, bundle size, characters, assets) |
| `GET /pet/assets/<name>` | Direct asset serving: whitelist names only, `ETag` + `Cache-Control: no-cache`, `If-None-Match` → 304, 768 KB cap, 404 unknown, 400 path traversal, 405 other methods |
| `GET /pet/activity?after=<seq>` | Folded session-event stream polled by the client |
| `GET /pet/skins`, `POST /pet/skins`, `DELETE /pet/skins?id=` | Import / list / remove a Codex-format sprite sheet (PNG/WebP, 8 columns, 192×208 cells, 9–11 rows, ≤3 MB): dimensions are validated, files land under `~/.dsh/pet-skins/`, individual skins are served as `/pet/skins/<id>.(webp\|png)` |
| `GET /pet/diary?date=&lang=` | Daily diary entries; `lang=en` returns English lines |

Host-half changes require a DSH restart (there is no HMR, and routes are registered in `apply()`); client-side changes only need `npm run build` and a page refresh.

## Configuration

There is no `dsh` config block and no environment variable you must set. Everything the user tunes lives in the Settings pane (or the in-place overlay) and is stored per browser in `localStorage`:

| Key | Contents |
|---|---|
| `dsh-pet:settings:v1` | Display, character, size, reminders, sound/volume, animation, mobile, bubble duration, doze threshold, focus/break |
| `dsh-pet:growth:v1` | Intimacy, task count, focus count, streak |
| `dsh-pet:migrate:v2-single-lulu` | One-shot migration marker (old `pilot` id → `lulu`) |

Storage is per browser on purpose: `dsh.frankfurtlin.top` is shared by several people, so pet preferences must not overwrite each other. Export/import covers the "new browser" case.

Optional host environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `DSH_HOME` | `~/.dsh` | Base directory for skins and diary |
| `DSH_PET_SKINS_DIR` | `$DSH_HOME/pet-skins` | Where imported sprite sheets are stored |
| `DSH_PET_DIARY_DIR` | `$DSH_HOME/pet-diary` | Where the daily diary is written |

The bundle deliberately declares no `engines.dsh` range and no `dsh` peer range: a version range is the number-one reason a plugin disappears entirely after a DSH upgrade. The plugin only touches the public `slots` / `sessions` / `locale` / `uiSession` services.

## Usage

- Click to pet (+1 intimacy, 220 ms debounce), double-click to hop, right-click for the menu (摸摸 / 喂食 / 专注 / 12 actions / 睡觉或叫醒 / 隐藏 5 分钟 / 回到角落 / 宠物设置).
- Drag it anywhere; it stays where you drop it. Only a drop within 56 px of the left/right screen edge snaps to that edge, and the vertical position is remembered. Position is stored as percentages, so it survives resolution changes.
- Right-click → 换装扮 cycles outfits; Settings → 展示 → 装扮 picks one directly.
- The agent can call `pet_say` (`text`, optional `action`) to make the pet speak a short line.

## Custom characters

Static image pipeline:

```bash
# 1. drop png/jpg/webp into /root/workspace/plugins/dsh-pet/images/
python3 scripts/import-lulu.py     # edge-connected background removal, crop, 320 px, WebP + data module
node scripts/build.mjs
# 4. refresh → Settings → 形象: your image is listed
```

`import-lulu.py` keys the background out by edge-connected flood fill (it will not eat white parts inside the character), trims transparent margins, caps the long edge at 320 px, writes `assets/user/contact-sheet.png` for eyeballing, and emits `client-src/generated-images.js` as a data URI (single-file deployment). `kind: 'image'` characters only breathe (4.2 s scale 1 → 1.015), tilt slightly with the pointer (±3°, ±2 px), and get a soft ground shadow — they are static drawings and the plugin does not pretend they have nine action rows. Budget: ≤3 MB per image (the script rejects bigger ones), a warning when all inlined images exceed 900 KB.

Animated characters (GIF / animated WebP / mp4 / mov / webm):

```bash
python3 scripts/import-anim.py --in images/lulu-idle.gif --label 噜噜
# or a short video: --fps 12 --max-frames 16
node scripts/build.mjs
```

It decodes frames (ffmpeg for video, Pillow for GIF), samples `--max-frames` uniformly (first and last kept), removes the background per frame (background colour from the first frame's corners, tolerance 26, edge-connected fill, 0.8 px feather), aligns frames to the same foot baseline and horizontal centre, then packs a horizontal WebP filmstrip (q88, quality drops above 900 KB) with per-frame durations inlined into `client-src/generated-anims.js`. At runtime `kind: 'anim'` shifts one background image with `steps(1,end)` and `background-size: N00% 100%` — no `<video>`, no GIF 256-colour banding.

A single animation loop can express one state (usually idle). Thinking / approval / done feedback still comes from the progress ring, unread badge and bubble text. Per-state animation requires the Codex sprite-sheet protocol (8 columns × 11 rows), which is the built-in Lulu path.

Source-material requirements: 2–4 s, fixed camera, subject fully in frame, clean background (solid colour or white works best), short edge ≥ 400 px. The script does not remove watermarks.

**Copyright**: most Lulu images on Xiaohongshu and similar sites are fan art or reprints with unclear ownership. Characters built with these scripts are for local, personal use and are not distributed with the plugin.

## Asset credits and licenses

All bitmap assets are community sprite sheets in **Codex pet protocol v2** (1536×2288 or 1536×1872, 8 columns × 11/9 rows, 192×208 per cell, RGBA), recompressed to WebP at native resolution and served from `/pet/assets/`.

| Asset | Upstream | License |
|---|---|---|
| Lulu sprite sheet | [czy666chen/lulu](https://github.com/czy666chen/lulu) (sheet), [srwang0506/HatchPet-CapybaraLulu](https://github.com/srwang0506/HatchPet-CapybaraLulu) (source frames/build scripts) | MIT / Apache-2.0 |
| Lulu idle row + idle loop video | generated from the sprite sheet's row-0 idle reference with `Wan-AI/Wan2.2-I2V-A14B` (`images/lulu-idle-src/idle3.mp4`), 60-frame loop → `assets/idle-loop.webm` | same as upstream (derived from MIT/Apache-2.0 material), local use |
| 12 action videos `anim-*` | `MiniMax-Video-H3-Max` on Tencent Cloud TokenHub (480P / 5 s image-to-video, green-screen first frame) → `scripts/video-to-webm.py` | same, local use |
| `clip-cheer` filmstrip | the same cheer video, cut by `scripts/video-to-clip.py` as the decode fallback | same, local use |
| `images/lulu-anims` GIF library | Douyin photo-post loops (author 「碎个好觉」 and others) captured by `scripts/fetch-douyin.py` | fan re-creation, no permission; **local only, never bundled or distributed** |
| `images/lulu-stills` stills and wallpapers | Douyin originals (author ✨曜✨) and Xiaohongshu wallpaper notes | fan re-creation, no permission; **local only, not bundled** |

Earlier characters (布布 / 团团 / 像素鸭 / 咕咚 / 薄荷) were removed at the user's request; their assets are kept at `/root/backups/dsh-pet-assets-removed-20261102/` under MIT / MIT / MIT / CC BY 4.0 (`咕咚 by Rank`) / MIT (`Minty by Somnusochi`).

Characters were shortlisted from [legeling/awesome-codex-pet](https://github.com/legeling/awesome-codex-pet) (370+ community pets; code MIT, gallery art marked CC BY-NC 4.0). **The license that matters is each pet's own `submission.json` and its upstream repository LICENSE** — this project only takes redistributable material (MIT / Apache-2.0 / CC BY 4.0); NC, GPL, unlicensed and third-party-IP fan characters are refused.

The interaction design (right-click action playback, intent arbitration, self-performance) was inspired by [`@luweiyabo/dsh-whale-pet`](https://github.com/luweiyabo/dsh-whale-pet) (MIT). None of its assets were copied: its 95 actions are WebM videos with upstream media licensed "open-source use, no commercial use", so every action here is drawn or generated locally.

## Development

```bash
npm run build     # client-src/*.js + styles/pet.css → client.js
npm run check     # fail if client.js drifted from the sources
npm test          # unit tests (node --test, no browser)
npm run verify    # browser acceptance (Playwright + real Chromium)
```

Directory layout:

```
package.json               dsh.bundle.patch + dsh.client (platform=web)
cordis.patch.yml           insert: [{id: dsh-pet, name: dsh-pet}]
lib/index.js               host half: /pet/status, /pet/activity, /pet/skins, /pet/diary, /pet/assets
lib/assets.mjs             asset whitelist, ETag, size gate (unit-tested separately)
client.js                  build artifact, do not edit by hand
client-src/
  characters.js            character definitions, sprite/action video/filmstrip registry, generated CSS
  actions.js               the 12 actions (timing, props, particles, SVG arm keyframes)
  props.js                 prop layer (lion head, red packet, brush, bowl, sparkler)
  outfits.js               outfit layer (scarf, Santa hat, glasses, …)
  i18n.js                  zh/en dictionary + placeholder substitution
  live.js                  activity feed, diary, warning polling (client half of /pet/**)
  store.js                 settings and growth in localStorage (250 ms debounce, try/catch everywhere)
  sound.js                 WebAudio synthesis (pentatonic, no audio files)
  state.js                 session status projection → pet state; event detection
  overlay.js               pet DOM, animation, drag/snap, menu, bubbles, pomodoro
  settings.js              settings panel (React, official slot)
  main.js                  wiring: style injection, slot registration, in-place settings overlay
styles/pet.css             all styles; only overrides --dsw-* tokens
assets/                    lulu.webp, anim-*.webm (12), idle-loop.webm (116 KB), clip-cheer.webp
scripts/build.mjs          concat + three validations (syntax / token names / placeholders) + asset budget
scripts/verify-ui.mjs      browser assertions + screenshots + JSON report
scripts/import-lulu.py     static image → background removal → assets/user/
scripts/import-anim.py     gif/short video → loop animation asset
scripts/pack-sprite.mjs    community sprite sheet → PET_CHARACTERS entry
scripts/video-to-webm.py   green-screen video → transparent WebM action
scripts/video-to-clip.py   green-screen video → horizontal filmstrip fallback
scripts/video-to-atlas.py  green-screen video → one sprite-sheet row
test/*.test.mjs            unit tests: bundle shape, sprite protocol, pipelines, actions, asset routes, host
docs/verification/pet/     acceptance reports and screenshots
images/                    asset workspace (not in the bundle, do not delete)
```

Why a hand-written bundler instead of Vite: the client bundle has to be one synchronous CJS shape, `window.__ModuleLoader__.load({id, factory})`. The 14 source files are concatenated in a fixed order into that factory scope, the build is nearly free, and `npm run check` can confirm byte-for-byte that the artifact matches the sources. The build also validates every `--dsw-*` token name against the installed ui-theme bundle, so an official rename fails the build instead of showing a wrong colour.

## Adding another pet

`scripts/pack-sprite.mjs` takes a Codex pet sprite sheet and produces the character entry:

```bash
# 1) validate dimensions/alpha, compress to WebP within budget (no rescaling), print the entry
node scripts/pack-sprite.mjs /path/to/spritesheet.webp tuantuan-like --name 新宠物 --budget 320

# 2) paste the printed entry into PET_CHARACTERS in client-src/characters.js
#    use petSpritePack(url, { rows: 9|11, gaze: 11-row sheets only })

# 3) rebuild and run the gates
node scripts/build.mjs && node --test test/pet.test.mjs
```

11-row sheets add the 16-direction gaze rows (9–10); 9-row sheets have actions only. Non-conforming sheets (width not 1536, height not a multiple of 208, fewer than 9 rows) are rejected rather than half-imported.

## Known limitations

- Custom static images and animations are local-use material: static pictures only breathe/tilt/shadow, animations have a single loop and cannot express per-state motion.
- Actions are programmatic performances (CSS keyframes + DOM particles) with a native video path; playback falls back video → filmstrip → SVG. That is why there are 12 actions instead of `dsh-whale-pet`'s 95, and why there is no asset-size or licensing problem.
- Generated action videos are not perfectly consistent: image-to-video changes proportions slightly and erases small details, and the `hop` clip left the frame entirely; only the cheer clip was accepted at first. Replacing all actions would need camera/scale locking on the generation side and more video-generation quota.
- `assets/clip-hop.webp` was a rejected draft and was deleted on 2026-11-13; hop now plays a transparent video. `images/lulu-generated/scenes/` and `i2i/` are experiments not wired into any code path.
- One behaviour personality; no voice packs or character variants.
- No balance/usage display (pure pet, no wallet).
- Sound is synthesized, not packaged audio; richer sound needs licensed assets.
- Headless Chromium lacks Chinese fonts, so Chinese bubble text renders as boxes in screenshots (the text itself is correct).
- Host-half changes (routes, asset protocol) need a DSH restart; client changes do not.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <Chinese summary>`.

- `type`: `feat` / `fix` / `docs` / `test` / `build` / `chore` / `refactor`
- `scope`: affected part, e.g. `host`, `client`, `panel`, `ai`, `layout`, `verify`
- imperative summary, no trailing period, ≤50 characters; the body explains why and what it affects
- one change per commit; run `npm run check` (or the equivalent) and the matching acceptance script before committing
