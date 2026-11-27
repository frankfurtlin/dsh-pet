#!/usr/bin/env python3
"""抖音图文（slides / 幻灯片）作品 → 动图素材库。

用途：把「水豚噜噜」的抖音图文作品里每一页的循环短视频抓下来，统一转成
dsh-pet 素材库规格的动图（`NN.webp` + 原片 `src/NN.mp4` + `manifest.json`）。

为什么必须用真浏览器：分享页 SSR 没有作品数据，`aweme/iteminfo` 已废，
`slidesinfo` 返回空，PC 接口要签名。唯一稳定路线是 Chromium 打开作品页，
从播放器 DOM 里读每一页 `<video>` 的 `currentSrc`（见 Hermes skill
`social-post-to-html/references/douyin.md`）。

排序的关键：页面 DOM 里 11 个 `.dySwiperSlide` 始终按作品页顺序排列，只是
「当前页 + 前后预载」才有 `<video>`。所以记录的是 **DOM 里的 slide 序号**，
不是采样先后顺序——自动翻页、手动翻页、重试换签名都不影响最终顺序。
采样频率 200ms；播放器按每页时长自动翻页，卡住 7 秒才补一次 ArrowRight 兜底。
页数取自进度条分段数（`.xgplayer-progress-inner`），到数即停。

用法：
    python3 scripts/fetch-douyin.py --url https://v.douyin.com/XXXX/ \\
        --out images/lulu-anims/douyin-slides-7700022744537181178

    # 只留原片、不转 webp（例如想自己调参）
    python3 scripts/fetch-douyin.py --url ... --out ... --no-webp

产出（--out 目录）：
    01.webp … NN.webp    动图：480×480 居中裁方 / 15fps / 无限循环 / libwebp q75
    src/01.mp4 … NN.mp4  原片：抖音原始码流（保留最高可得分辨率）
    manifest.json        来源、作品 ID、标题、作者、每页时长/尺寸/帧数/体积
    preview.html         本地预览页（把 NN.webp 并排铺开，肉眼过一遍）

退出码：0 成功；1 参数/抓取/下载/转码失败；2 抓到的页数与进度条不符（产物保留）。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from anim_preview import write_preview  # noqa: E402  预览页模板只此一份

DESKTOP_UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
)
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)
REFERER = 'https://www.douyin.com/'
CST = timezone(timedelta(hours=8))

# 采样：每页的 slide 元素常驻 DOM，只有「当前页 + 预载邻居」才挂了 <video>。
# 记录 slide 序号而不是采样顺序，才能保证与作品页一致。
JS_ACTIVE = """() => {
  const slides = Array.from(document.querySelectorAll('[class*=dySwiperSlide]'));
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    const v = slides[i].querySelector('video');
    if (!v) continue;
    const src = v.currentSrc || v.src || '';
    if (!src || !/^https?:/.test(src)) continue;
    if (!v.videoWidth) continue;                       // 元数据没到的占位，跳过
    out.push({
      index: i,
      src,
      duration: Number.isFinite(v.duration) ? v.duration : null,
      width: v.videoWidth || null,
      height: v.videoHeight || null,
      t: v.currentTime || 0,
      paused: !!v.paused,
      playing: !v.paused && v.currentTime > 0.05,
    });
  }
  return out;
}"""

JS_META = """() => {
  const prog = document.querySelectorAll('.xgplayer-progress-inner').length;
  const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(s => s.textContent).join('\\n');
  let author = null;
  try {
    const data = JSON.parse(ld);
    const flat = [].concat(...(data['@graph'] || [data]));
    for (const node of flat) {
      for (const it of (node.itemListElement || [])) {
        if (it.position === 2 && it.name) author = it.name;
      }
    }
  } catch (e) {}
  const captcha = document.querySelectorAll(
    '[id*=captcha], [class*=captcha], iframe[src*=captcha], [class*=verify-bar], [class*=verify_center]').length;
  return {progress: prog, author, captcha,
          videos: document.querySelectorAll('video').length,
          ready: document.readyState,
          title: document.title};
}"""


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str, code: int = 1) -> 'NoReturn':  # type: ignore[name-defined]
    log(f'✗ {msg}')
    sys.exit(code)


# ---------------------------------------------------------------- 解析作品 ID

def resolve_item(url: str) -> tuple[str, str, str]:
    """短链 → (item_id, kind, 落地 URL)。kind ∈ slides / note / video。"""
    if re.search(r'/note/(\d{6,})', url):
        item_id = re.search(r'/note/(\d{6,})', url).group(1)
        return item_id, 'note', url
    if re.search(r'/video/(\d{6,})', url):
        item_id = re.search(r'/video/(\d{6,})', url).group(1)
        return item_id, 'video', url
    m = re.search(r'/share/(slides|note|video)/(\d{6,})', url)
    if m:
        return m.group(2), m.group(1), url

    req = urllib.request.Request(url, headers={'User-Agent': IPHONE_UA, 'Accept': 'text/html'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            final = resp.geturl()
    except urllib.error.HTTPError as exc:          # 3xx 也可能走到这里
        final = exc.geturl() or url
    except Exception as exc:                        # noqa: BLE001
        die(f'短链解析失败：{exc}')
    m = re.search(r'/(slides|note|video)/(\d{6,})', final)
    if not m:
        die(f'落地页里找不到作品 ID：{final[:200]}')
    return m.group(2), m.group(1), final


# ---------------------------------------------------------------- 浏览器抓取

def collect_pages(item_id: str, kind: str, max_pages: int, stall_nudge: float,
                  timeout: float, profile: Path) -> dict:
    """打开作品页，按 slide 序号收集每一页的视频流地址。"""
    from playwright.sync_api import sync_playwright

    page_url = f'https://www.douyin.com/{"note" if kind != "video" else "video"}/{item_id}'
    log(f'→ 打开 {page_url}')
    profile.mkdir(parents=True, exist_ok=True)
    by_index: dict[int, dict] = {}
    order: list[str] = []          # 采样顺序（仅用于日志与单视频作品兜底）

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(profile), headless=True, user_agent=DESKTOP_UA,
            viewport={'width': 1280, 'height': 860}, locale='zh-CN',
            args=['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(page_url, wait_until='domcontentloaded', timeout=90_000)
            # 等播放器把第一页的 <video> 挂出来（首屏脚本 + 首帧大概 3–8s）
            deadline = time.time() + 40
            while time.time() < deadline:
                meta = page.evaluate(JS_META)
                if meta.get('captcha'):
                    die('页面出现人机验证，抓不到播放器地址。换 IP / 稍后重试，或人工过一次验证。')
                if meta.get('videos'):
                    break
                page.wait_for_timeout(500)
            meta = page.evaluate(JS_META)
            expected = int(meta.get('progress') or 0)
            title = (meta.get('title') or '').removesuffix(' - 抖音')
            author = meta.get('author')
            log(f'  title  : {title}')
            log(f'  author : {author}')
            log(f'  进度条 : {expected or "?"} 段')
            if not meta.get('videos'):
                die('播放器里一个 <video> 都没出现（页面没渲染完或被降级）。重跑一次通常就好。')

            target = min(expected, max_pages) if (expected and max_pages) else (max_pages or expected)
            head = time.time() + timeout
            last_seen = time.time()
            last_nudge = 0.0
            while time.time() < head:
                states = page.evaluate(JS_ACTIVE)
                now = time.time()
                fresh = False
                for st in states:
                    idx = st['index']
                    prev = by_index.get(idx)
                    if prev is None or prev['src'] != st['src']:
                        by_index[idx] = st
                        fresh = True
                        if st['src'] not in order:
                            order.append(st['src'])
                        log(f"  page {idx + 1:>2}{'/' + str(expected) if expected else ''}"
                            f"  {st['width']}x{st['height']} {st['duration']:.2f}s")
                if fresh:
                    last_seen = now
                if target and len(by_index) >= target:
                    break
                if not expected:
                    # 普通视频作品：没有进度条，一个流就够
                    if len(order) >= 1 and now - last_seen > 8:
                        break
                elif now - last_seen > stall_nudge and now - last_nudge > stall_nudge:
                    # 自动翻页没动（被暂停/后台节流）：补一次方向键
                    page.keyboard.press('ArrowRight')
                    last_nudge = now
                if now - last_seen > 40:
                    log('  ! 40s 没有新页，停止收集')
                    break
                page.wait_for_timeout(200)

            pages = [by_index[i] for i in sorted(by_index)]
        finally:
            ctx.close()

    return {'pages': pages, 'expected': expected, 'title': title, 'author': author,
            'page_url': page_url}


# ---------------------------------------------------------------- 下载 / 转码

def http_download(url: str, dest: Path, retries: int = 3) -> int:
    headers = {
        'User-Agent': DESKTOP_UA,
        'Referer': REFERER,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    }
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if len(data) < 20_000:
                raise RuntimeError(f'响应只有 {len(data)} 字节')
            if data[4:8] != b'ftyp':
                raise RuntimeError('不是 mp4（前 8 字节不匹配）')
            dest.write_bytes(data)
            return len(data)
        except Exception as exc:                     # noqa: BLE001
            last = exc
            time.sleep(1.5 * attempt)
    raise RuntimeError(f'下载失败（{retries} 次）：{last}')


def ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
         '-show_entries', 'format=duration,size', '-of', 'json', str(path)],
        capture_output=True, text=True, check=False,
    )
    if out.returncode != 0:
        raise RuntimeError(f'ffprobe 失败：{out.stderr.strip()[:200]}')
    data = json.loads(out.stdout or '{}')
    stream = (data.get('streams') or [{}])[0]
    fmt = data.get('format') or {}
    num, _, den = (stream.get('r_frame_rate') or '0/1').partition('/')
    fps = float(num) / float(den) if float(den or 1) else 0.0
    duration = float(fmt.get('duration') or 0)
    return {
        'width': int(stream.get('width') or 0),
        'height': int(stream.get('height') or 0),
        'duration': round(duration, 3),
        'fps': round(fps, 2),
        'size': int(fmt.get('size') or path.stat().st_size),
    }


def to_webp(src: Path, dest: Path, long_edge: int, fps: int, quality: int,
            max_bytes: int = 0) -> dict:
    """视频 → 方形动图（居中裁方），无限循环。给了体积预算就先降质量、再降帧率。"""
    probe = ffprobe(src)
    ladder = [(fps, quality)]
    if max_bytes:
        ladder += [(fps, 65), (fps, 58), (max(10, fps - 3), 58), (max(8, fps - 5), 50)]
    last_err = ''
    for use_fps, use_q in ladder:
        vf = (
            f'fps={use_fps},'
            f'scale={long_edge}:{long_edge}:force_original_aspect_ratio=increase:flags=lanczos,'
            f'crop={long_edge}:{long_edge}'
        )
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src),
               '-vf', vf, '-c:v', 'libwebp', '-lossless', '0', '-q:v', str(use_q),
               '-compression_level', '4', '-loop', '0', '-an', str(dest)]
        out = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if out.returncode != 0 or not dest.exists() or dest.stat().st_size < 1024:
            last_err = out.stderr.strip()[:300]
            continue
        if not max_bytes or dest.stat().st_size <= max_bytes:
            return {**probe, 'webp_bytes': dest.stat().st_size,
                    'encode_fps': use_fps, 'encode_quality': use_q}
    if last_err:
        raise RuntimeError(f'ffmpeg 转 webp 失败：{last_err}')
    raise RuntimeError(f'{src.name} 压到 {max_bytes // 1024}KB 以下失败')


def verify_webp(path: Path) -> dict:
    """用 Pillow 复核动图（ffprobe 的 webp 解复用不可靠）。"""
    from PIL import Image
    im = Image.open(path)
    frames = getattr(im, 'n_frames', 1)
    if frames < 2:
        raise RuntimeError(f'{path.name} 只有 {frames} 帧，不是动图')
    return {'frames': frames, 'width': im.size[0], 'height': im.size[1],
            'loop': im.info.get('loop', 0)}


# ---------------------------------------------------------------- 索引

def upsert_index(out: Path, entry: dict) -> Path | None:
    """把本组写进同级 index.json（素材库总索引）。没有索引就跳过。"""
    index_path = out.parent / 'index.json'
    if not index_path.exists():
        return None
    try:
        data = json.loads(index_path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        log(f'! {index_path} 读不动，跳过索引更新：{exc}')
        return None
    sets = [s for s in data.get('sets', []) if s.get('path') != entry['path']]
    sets.append(entry)
    sets.sort(key=lambda s: (s.get('captured_at') or '', s.get('path') or ''))
    data['sets'] = sets
    data['updated'] = datetime.now(CST).strftime('%Y-%m-%d')
    index_path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n',
                          encoding='utf-8')
    return index_path


# ---------------------------------------------------------------- 主流程

def main() -> int:
    ap = argparse.ArgumentParser(description='抖音图文（slides）动图抓取 → dsh-pet 素材库')
    ap.add_argument('--url', help='分享短链或作品页 URL（--reuse-src 时可省）')
    ap.add_argument('--out', required=True, help='输出目录（不存在会创建）')
    ap.add_argument('--long-edge', type=int, default=480, help='动图长边像素，默认 480')
    ap.add_argument('--fps', type=int, default=15, help='动图帧率，默认 15')
    ap.add_argument('--quality', type=int, default=75, help='libwebp 质量，默认 75')
    ap.add_argument('--max-kb', type=int, default=0,
                    help='单个动图体积上限 KB（0=不限制，只按质量转；超预算会降质量/帧率）')
    ap.add_argument('--max-pages', type=int, default=0, help='最多抓多少页（0=按进度条）')
    ap.add_argument('--timeout', type=float, default=180.0, help='浏览器采集超时秒数')
    ap.add_argument('--profile', default=str(Path.home() / '.cache/dsh-pet/douyin-profile'),
                    help='Chromium 持久化 profile（存 ttwid cookie，默认 ~/.cache/dsh-pet/douyin-profile）')
    ap.add_argument('--no-webp', action='store_true', help='只下原片，不转动图')
    ap.add_argument('--reuse-src', action='store_true',
                    help='跳过浏览器与下载，用已有 src/*.mp4 重新转码（调参时用）')
    ap.add_argument('--overwrite', action='store_true', help='覆盖已存在的产物')
    args = ap.parse_args()
    if not args.url and not args.reuse_src:
        ap.error('--url 与 --reuse-src 至少给一个')

    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            die(f'缺少 {tool}')

    out = Path(args.out).expanduser().resolve()
    src_dir = out / 'src'
    if out.exists() and not args.overwrite and any(out.glob('*.webp')):
        die(f'{out} 里已有产物；确认要重抓请加 --overwrite')
    src_dir.mkdir(parents=True, exist_ok=True)

    expected = 0
    captured_at = datetime.now(CST).isoformat(timespec='seconds')
    source_url = args.url
    if args.reuse_src:
        # 只重转码：作品信息沿用已有 manifest，页码按 src/*.mp4 排序
        old_manifest = {}
        if (out / 'manifest.json').exists():
            old_manifest = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
        source_mp4 = sorted(src_dir.glob('*.mp4'))
        if not source_mp4:
            die(f'{src_dir} 里没有 mp4，没法 --reuse-src')
        source_url = old_manifest.get('source') or args.url
        item_id = old_manifest.get('item_id') or 'unknown'
        kind = 'slides'
        resolved = old_manifest.get('resolved') or ''
        collected = {'title': old_manifest.get('title'), 'author': old_manifest.get('author')}
        expected = int(old_manifest.get('expected_pages') or len(source_mp4))
        captured_at = old_manifest.get('captured_at')
        log(f'→ 复用 {len(source_mp4)} 个已有原片，只重转码')
    else:
        item_id, kind, resolved = resolve_item(args.url or '')
        log(f'作品 ID {item_id}（{kind}）')
        collected = collect_pages(item_id, kind, args.max_pages, stall_nudge=7.0,
                                  timeout=args.timeout, profile=Path(args.profile))
        pages = collected['pages']
        if not pages:
            die('没抓到任何视频流：可能不是 slides 作品、页面没渲染，或播放器还没起。'
                '重跑一次通常就好；仍为空就退化成「实况图」路线或人工下载。')

        expected = collected['expected']
        if expected and not args.max_pages and len(pages) < expected:
            log(f'! 进度条显示 {expected} 页，只抓到 {len(pages)} 页（产物保留，退出码 2）')

        log(f'→ 下载 {len(pages)} 个原片到 {src_dir}')
        source_mp4 = []
        for idx, page in enumerate(pages, 1):
            dest = src_dir / f'{idx:02d}.mp4'
            size = http_download(page['src'], dest)
            probe = ffprobe(dest)
            log(f'  src/{dest.name:<7} {size/1024:7.1f} KB  {probe["width"]}x{probe["height"]}'
                f'  {probe["duration"]:.2f}s  {probe["fps"]:.0f}fps')
            source_mp4.append(dest)

    max_bytes = max(64, args.max_kb) * 1024 if args.max_kb else 0
    # 2) 转动图（并发的只是 ffmpeg 子进程）
    items: list[dict] = []
    if args.no_webp:
        for idx, mp4 in enumerate(source_mp4, 1):
            probe = ffprobe(mp4)
            items.append({
                'index': idx, 'file': None, 'source_mp4': f'src/{mp4.name}',
                'width': probe['width'], 'height': probe['height'],
                'duration': probe['duration'], 'fps': probe['fps'],
                'src_bytes': mp4.stat().st_size,
            })
    else:
        budget = f'（≤{args.max_kb}KB）' if args.max_kb else ''
        log(f'→ 转 {args.long_edge}×{args.long_edge} @{args.fps}fps 动图{budget}')
        def job(pair):
            idx, mp4 = pair
            webp = out / f'{idx:02d}.webp'
            meta = to_webp(mp4, webp, args.long_edge, args.fps, args.quality, max_bytes)
            info = verify_webp(webp)
            return idx, mp4, webp, meta, info

        with ThreadPoolExecutor(max_workers=min(4, len(source_mp4))) as pool:
            results = sorted(pool.map(job, enumerate(source_mp4, 1)), key=lambda r: r[0])
        for idx, mp4, webp, meta, info in results:
            tuned = '' if meta['encode_quality'] == args.quality else \
                f"  (q{meta['encode_quality']}@{meta['encode_fps']}fps)"
            log(f'  {webp.name:<7} {webp.stat().st_size/1024:7.1f} KB  {info["frames"]:>3} 帧'
                f'  loop={info["loop"]}{tuned}')
            items.append({
                'index': idx, 'file': webp.name, 'source_mp4': f'src/{mp4.name}',
                'width': meta['width'], 'height': meta['height'],
                'duration': meta['duration'], 'fps': meta['fps'],
                'src_bytes': mp4.stat().st_size,
                'webp_bytes': meta['webp_bytes'], 'frames': info['frames'],
                'encode': f"q{meta['encode_quality']}@{meta['encode_fps']}fps",
                'sha256': hashlib.sha256(webp.read_bytes()).hexdigest()[:12],
            })

    # 3) manifest + 预览页
    page_url = collected.get('page_url') or (
        f'https://www.douyin.com/{"video" if kind == "video" else "note"}/{item_id}')
    manifest = {
        'source': source_url,
        'resolved': page_url,
        'item_id': item_id,
        'kind': 'slides（抖音图文/幻灯片，每页为循环短视频）' if kind != 'video' else 'video',
        'title': collected.get('title'),
        'author': collected.get('author'),
        'captured_at': captured_at,
        'count': len(items),
        'spec': {
            'display': f'NN.webp {args.long_edge}×{args.long_edge} @{args.fps}fps '
                       f'libwebp q{args.quality} 居中裁方 无限循环'
                       + (f' ≤{args.max_kb}KB' if args.max_kb else ''),
            'original': 'src/NN.mp4 抖音原始码流（未转码，分辨率随码流）',
        },
        'expected_pages': expected or None,
        'items': items,
    }
    (out / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    write_preview(out, manifest, [i for i in items if i.get('file')])

    entry = {
        'id': f'douyin-{"video" if kind == "video" else "slides"}-{item_id}',
        'kind': 'video' if kind == 'video' else 'slides',
        'path': out.name,
        'count': len(items),
        'webp_bytes': sum(i.get('webp_bytes') or 0 for i in items),
        'gif_bytes': 0,
        'src_bytes': sum(i.get('src_bytes') or 0 for i in items),
        'source': source_url,
        'resolved': page_url,
        'title': collected.get('title'),
        'author': collected.get('author'),
        'captured_at': captured_at,
        'preview': 'preview.html',
        'spec': (manifest.get('spec') or {}).get('display'),
    }
    index_path = upsert_index(out, entry)
    if index_path:
        log(f'→ 索引已更新：{index_path}')

    log(f'✓ {len(items)} 个动图 → {out}')
    if expected and len(items) < expected and not args.max_pages:
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
