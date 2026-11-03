#!/usr/bin/env python3
"""把动图 / 短视频转成 dsh-pet 的「循环动画形象」。

用户从小红书、表情包拿到的动图（gif / 动态 webp）或几秒短视频（mp4/mov/webm），
在这里变成一张横向胶片条 + 一份播放时间表，内联进 client-src/generated-anims.js。

做四件事：
1. 解码成帧（视频走 ffmpeg，动图走 Pillow），按目标帧数均匀抽帧
2. 逐帧抠底（和 import-lulu.py 同一套边缘连通算法，背景色取第一帧四角）
3. 对齐：统一缩放，脚底基线对齐、水平居中 —— 否则播放时会上下抖
4. 拼成单行胶片条导出 webp，生成 generated-anims.js（data URI 内联）

用法：
  python3 scripts/import-anim.py --in /root/workspace/lulu-images/lulu-idle.gif --label 噜噜
  python3 scripts/import-anim.py --in clip.mp4 --fps 12 --max-frames 12
"""
from __future__ import annotations

import argparse
import base64
import importlib.util
import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageSequence
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：pip install pillow")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

VIDEO_SUFFIXES = {".mp4", ".mov", ".webm", ".m4v", ".mkv"}
ANIM_SUFFIXES = {".gif", ".webp", ".png", ".apng"}

PER_ANIM_BUDGET = 900 * 1024  # 单个动画胶片条的字节上限
CELL_EDGE = 320               # 单帧最长边
MIN_FRAMES, MAX_FRAMES = 2, 24


def load_import_lulu():
    """复用 import-lulu.py 的抠底/裁边/缩放，避免两份算法各自漂移。"""
    spec = importlib.util.spec_from_file_location("import_lulu", HERE / "import-lulu.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


LULU = load_import_lulu()


def decode_video(path: Path, fps: float) -> tuple[list[Image.Image], list[int]]:
    if not shutil.which("ffmpeg"):
        raise SystemExit("解视频需要 ffmpeg（apt install ffmpeg）")
    proc = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(path),
            # 上限 640 宽足够（输出单帧最长边 320），先缩再解码更快
            "-vf", f"fps={fps},scale='min(640,iw)':-2",
            "-f", "image2pipe", "-vcodec", "png", "-",
        ],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SystemExit(f"ffmpeg 解码失败：{proc.stderr.decode('utf-8', 'replace')[:300]}")
    frames: list[Image.Image] = []
    buffer = io.BytesIO(proc.stdout)
    while True:
        try:
            frame = Image.open(buffer)
            frame.load()
        except Exception:
            break
        frames.append(frame.convert("RGBA"))
    if not frames:
        raise SystemExit("这个视频没解出任何帧")
    step = max(1, round(1000 / fps))
    return frames, [step] * len(frames)


def decode_anim(path: Path) -> tuple[list[Image.Image], list[int]]:
    im = Image.open(path)
    frames: list[Image.Image] = []
    durations: list[int] = []
    for page in ImageSequence.Iterator(im):
        frames.append(page.convert("RGBA"))
        # GIF 的 duration 单位是毫秒；缺失时给 100ms（10fps），播放别太快也别卡死
        durations.append(int(page.info.get("duration") or 100))
    if not frames:
        raise SystemExit("这个文件没有可用的帧")
    return frames, durations


def pick_evenly(frames: list[Image.Image], durations: list[int], wanted: int):
    if len(frames) <= wanted:
        return frames, durations
    # 均匀抽帧，但保证第一帧和最后一帧都在（循环动画里首尾衔接最重要）
    indexes = [round(i * (len(frames) - 1) / (wanted - 1)) for i in range(wanted)]
    picked_frames = [frames[i] for i in indexes]
    picked_durations = [durations[i] for i in indexes]
    return picked_frames, picked_durations


def normalize_frames(frames: list[Image.Image]):
    """逐帧抠底 + 裁边；返回 (裁好的帧列表, 是否真的抠出了透明背景)。"""
    cutouts = []
    any_cut = False
    for frame in frames:
        cut, did = LULU.transparent_background(frame)
        any_cut = any_cut or did
        cutouts.append(LULU.trim(cut))
    return cutouts, any_cut


def compose_strip(cutouts: list[Image.Image], durations: list[int]):
    """统一缩放到同一画布：最长边 ≤ CELL_EDGE、脚底对齐、水平居中。"""
    heights = [max(1, im.height) for im in cutouts]
    widths = [max(1, im.width) for im in cutouts]
    scale = min(1.0, CELL_EDGE / max(max(heights), max(widths)))
    cell_h = max(1, round(max(heights) * scale))
    cell_w = max(1, round(max(widths) * scale))
    strip = Image.new("RGBA", (cell_w * len(cutouts), cell_h), (0, 0, 0, 0))
    for index, im in enumerate(cutouts):
        scaled = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        # 脚底对齐：每帧都贴到画布底部；水平居中
        x = index * cell_w + (cell_w - scaled.width) // 2
        y = cell_h - scaled.height
        strip.alpha_composite(scaled, (x, y))
    return strip, cell_w, cell_h


def encode_strip(strip: Image.Image, frames: int) -> tuple[bytes, int]:
    """优先高质量，超预算就降帧数再降质量 —— 单文件部署不能无限长。"""
    for quality in (88, 82, 76, 70):
        buffer = io.BytesIO()
        strip.save(buffer, "WEBP", quality=quality, method=6, alpha_quality=92)
        data = buffer.getvalue()
        if len(data) <= PER_ANIM_BUDGET:
            return data, quality
    raise SystemExit(
        f"这组帧太大（{frames} 帧、{strip.width}×{strip.height}），"
        f"试着少给几秒素材或用 --max-frames 8 重跑"
    )


def write_contact_sheet(frames: list[Image.Image], out: Path, cell_w: int, cell_h: int) -> None:
    sheet = Image.new("RGBA", (cell_w * len(frames), cell_h), (255, 255, 255, 0))
    for index, im in enumerate(frames):
        sheet.alpha_composite(im, (index * cell_w + (cell_w - im.width) // 2, cell_h - im.height))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def emit_module(entries: list[dict], out: Path) -> None:
    lines = [
        "// 由 scripts/import-anim.py 生成：把动图/短视频转成循环动画形象。",
        "// 手动改这个文件没有意义 —— 重新跑导入脚本会覆盖。",
        "const PET_USER_ANIMS = [",
    ]
    for entry in entries:
        lines.append("  {")
        lines.append(f'    id: {json.dumps(entry["id"])},')
        lines.append(f'    label: {json.dumps(entry["label"], ensure_ascii=False)},')
        lines.append(f'    frameW: {entry["frameW"]},')
        lines.append(f'    frameH: {entry["frameH"]},')
        lines.append(f'    frames: {entry["frames"]},')
        lines.append(f'    durations: [{", ".join(str(d) for d in entry["durations"])}],')
        lines.append(f'    url: {json.dumps(entry["url"])},')
        lines.append("  },")
    lines.append("]")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="动图/短视频 → dsh-pet 循环动画形象")
    parser.add_argument("--in", dest="source", required=True, help="gif / 动态 webp / mp4 / mov / webm")
    parser.add_argument("--out", default=str(ROOT / "assets" / "anim"), help="胶片条输出目录")
    parser.add_argument("--emit", default=str(ROOT / "client-src" / "generated-anims.js"))
    parser.add_argument("--label", default="", help="形象显示名（默认取文件名）")
    parser.add_argument("--fps", type=float, default=12.0, help="视频抽帧帧率（默认 12）")
    parser.add_argument("--max-frames", type=int, default=16, help=f"最多保留帧数（{MIN_FRAMES}–{MAX_FRAMES}）")
    args = parser.parse_args()

    source = Path(args.source).expanduser()
    if not source.exists():
        raise SystemExit(f"找不到文件：{source}")
    suffix = source.suffix.lower()
    wanted = max(MIN_FRAMES, min(MAX_FRAMES, args.max_frames))

    if suffix in VIDEO_SUFFIXES:
        frames, durations = decode_video(source, args.fps)
    elif suffix in ANIM_SUFFIXES:
        frames, durations = decode_anim(source)
    else:
        raise SystemExit(f"不支持的格式：{suffix}（支持 {', '.join(sorted(VIDEO_SUFFIXES | ANIM_SUFFIXES))}）")

    frames, durations = pick_evenly(frames, durations, wanted)
    cutouts, cutout_done = normalize_frames(frames)
    strip, cell_w, cell_h = compose_strip(cutouts, durations)
    data, quality = encode_strip(strip, len(cutouts))

    anim_id = "a-" + LULU.slugify(source.stem, "anim")
    label = args.label.strip() or source.stem
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    webp_path = out_dir / f"{anim_id}.webp"
    webp_path.write_bytes(data)
    write_contact_sheet(cutouts, out_dir / f"{anim_id}-sheet.png", cell_w, cell_h)

    index_path = out_dir / "index.json"
    entries = []
    if index_path.exists():
        try:
            entries = [e for e in json.loads(index_path.read_text()) if e.get("id") != anim_id]
        except json.JSONDecodeError:
            entries = []
    entry = {
        "id": anim_id,
        "label": label,
        "file": webp_path.name,
        "frameW": cell_w,
        "frameH": cell_h,
        "frames": len(cutouts),
        "durations": durations,
        "quality": quality,
        "cutout": cutout_done,
        "bytes": len(data),
        "url": "data:image/webp;base64," + base64.b64encode(data).decode("ascii"),
        "source": source.name,
    }
    entries.append(entry)
    emit_module(entries, Path(args.emit))
    index_path.write_text(json.dumps([{k: v for k, v in e.items() if k != "url"} for e in entries], indent=2, ensure_ascii=False))

    total = sum(e["bytes"] for e in entries)
    print(f"✓ {anim_id}：{len(cutouts)} 帧，单帧 {cell_w}×{cell_h}，webp {len(data) / 1024:.0f}KB（q{quality}）")
    print(f"  抠底：{'是' if cutout_done else '否（背景不是纯色，保留原背景）'}；帧时长 {durations[:6]}{'…' if len(durations) > 6 else ''}")
    print(f"  拼图检查：{out_dir / f'{anim_id}-sheet.png'}")
    print(f"  已写入：{args.emit}（累计 {len(entries)} 个动画，{total / 1024:.0f}KB）")
    if total > 2 * 1024 * 1024:
        print("  ⚠ 累计超过 2MB，client.js 会明显变大，考虑删掉不用的动画")
    return 0


if __name__ == "__main__":
    sys.exit(main())
