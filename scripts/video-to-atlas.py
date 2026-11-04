#!/usr/bin/env python3
"""
video-to-atlas.py —— 把一段绿幕动作视频转成 Codex 宠物图集的一行（或整张图集）

背景：dsh-pet 的宠物是一个 8 列 × 11 行的 spritesheet，格子 192×208 RGBA。
      每个动作行帧数和每帧停留时间由渲染器写死（见下 ANIMATIONS）。
      本脚本负责：抽帧 → 绿幕抠像 → 归一化位置/尺寸 → 按协议帧数重采样 → 拼图集。

用法：
  # 只替换 idle 行（用现有图集其余内容垫底）
  /usr/bin/python3 scripts/video-to-atlas.py --video /tmp/idle.mp4 --row 0 \
      --base assets/lulu.webp --out assets/lulu-v2.webp

  # 指定取哪几帧（秒）
  /usr/bin/python3 scripts/video-to-atlas.py --video /tmp/run.mp4 --row 1 --times 0.2,0.6,1.0

  # 只导出一行预览 GIF，不碰图集
  /usr/bin/python3 scripts/video-to-atlas.py --video /tmp/idle.mp4 --row 0 --preview /tmp/idle.gif
"""
from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 11

# 与 pack-sprite.mjs / client 渲染器一致的帧数与每帧毫秒
ANIMATIONS = [
    ("idle", 6, [280, 110, 110, 140, 140, 320]),
    ("runRight", 8, [120] * 7 + [220]),
    ("runLeft", 8, [120] * 7 + [220]),
    ("wave", 4, [140, 140, 140, 280]),
    ("jump", 5, [140, 140, 140, 140, 280]),
    ("failed", 8, [140] * 7 + [240]),
    ("waiting", 6, [150] * 5 + [260]),
    ("working", 6, [120] * 5 + [220]),
    ("review", 6, [150] * 5 + [280]),
]


def extract_frames(video: pathlib.Path, tmp: pathlib.Path) -> list[pathlib.Path]:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), str(tmp / "f%04d.png")],
                   check=True)
    return sorted(tmp.glob("f*.png"))


def key_green(bgr: np.ndarray) -> np.ndarray:
    """绿幕抠像：HSV 阈值 → 只保留与边界连通的背景（避免误伤角色内部）→ 边缘去溢色。"""
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hh, ss, vv = cv2.split(hsv)
    bg = ((hh >= 35) & (hh <= 95) & (ss > 90) & (vv > 60)).astype(np.uint8)

    ff = bg.copy()
    m = np.zeros((h + 2, w + 2), np.uint8)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                 (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if ff[seed[1], seed[0]] == 1:
            cv2.floodFill(ff, m, seed, 2)
    bg = (ff == 2).astype(np.uint8)

    fg = 1 - bg
    band = (cv2.dilate(bg, np.ones((5, 5), np.uint8)) & fg).astype(bool)
    out = bgr.astype(np.float32).copy()
    rb = np.maximum(out[..., 2], out[..., 0])          # BGR: max(B, R)
    out[..., 1] = np.where(band, np.minimum(out[..., 1], rb * 1.01), out[..., 1])

    alpha = cv2.GaussianBlur(fg.astype(np.float32) * 255, (3, 3), 0)
    return np.dstack([out[..., 2], out[..., 1], out[..., 0], alpha]).astype(np.uint8)


def bbox(rgba: np.ndarray):
    ys, xs = np.where(rgba[..., 3] > 20)
    if len(xs) == 0:
        return None
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def normalize(rgba: np.ndarray, scale: float | None = None,
              target_h: int = 198, baseline: int = 203) -> Image.Image:
    """缩放到统一尺度、脚底落在 baseline、水平居中，输出 CELL_W×CELL_H RGBA。

    scale 由整段视频统一给定（不是逐帧算），否则呼吸起伏会被归一化抹平。
    """
    box = bbox(rgba)
    if box is None:
        return Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))

    x0, x1, y0, y1 = box
    crop = rgba[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    if scale is None:
        scale = target_h / ch

    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LANCZOS4
    resized = cv2.resize(crop, (nw, nh), interpolation=interp)

    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    px = (CELL_W - nw) // 2
    py = baseline - nh
    cell.paste(Image.fromarray(resized, "RGBA"), (px, py), Image.fromarray(resized, "RGBA"))
    return cell


def polish(cells: list[Image.Image], ref: Image.Image, taper: float) -> list[Image.Image]:
    """统一尺度到参考帧宽度，并按 taper 削弱帧间尺寸变化；顺带补回头部细节。

    I2V 会把角色画得比原图集略宽，直接替换动作行会在切换动作时跳尺寸。
    """
    rb = bbox(np.array(ref))
    if not rb:
        return cells
    ref_w = rb[1] - rb[0]

    boxes = [bbox(np.array(c)) for c in cells]
    widths = [(b[1] - b[0]) for b in boxes if b]
    if not widths:
        return cells
    w_min = min(widths)

    out = []
    top_h = max(0, min(40, int(ref.height * 0.17)))
    for cell, b in zip(cells, boxes):
        if not b:
            out.append(cell)
            continue
        w = b[1] - b[0]
        scale = (ref_w / w_min) * (1 + (w / w_min - 1) * taper)
        im = cell.resize((max(1, round(CELL_W * scale)), max(1, round(CELL_H * scale))),
                         Image.LANCZOS)
        # 上限保护：任何一帧都不超过参考宽度的 6%
        arr = np.array(im)
        b2 = bbox(arr)
        if b2:
            w2 = b2[1] - b2[0]
            cap = ref_w * 1.06
            if w2 > cap:
                k2 = cap / w2
                im = im.resize((max(1, round(im.width * k2)), max(1, round(im.height * k2))),
                               Image.LANCZOS)
        fitted = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        fitted.paste(im, ((CELL_W - im.width) // 2, CELL_H - im.height), im)
        if top_h:
            fitted.alpha_composite(ref.crop((0, 0, CELL_W, top_h)), (0, 0))
        out.append(fitted)
    return out


def signature(img: Image.Image) -> np.ndarray:
    a = np.array(img)[..., 3].astype(np.float32) / 255.0
    return cv2.resize(a, (24, 26), interpolation=cv2.INTER_AREA).ravel()


def pick_frames(cells: list[Image.Image], k: int) -> list[int]:
    """最远点采样：从动作循环里挑出 k 个差异最大的帧，避免全挑到几乎相同的帧。"""
    if len(cells) <= k:
        return list(range(len(cells)))
    sigs = np.stack([signature(c) for c in cells])
    idx = [0]
    d = np.linalg.norm(sigs - sigs[0], axis=1)
    while len(idx) < k:
        nxt = int(np.argmax(d))
        idx.append(nxt)
        d = np.minimum(d, np.linalg.norm(sigs - sigs[nxt], axis=1))
    return sorted(idx)


def build_row(video: pathlib.Path, row: int, times: list[float] | None) -> list[Image.Image]:
    n_frames = ANIMATIONS[row][1]
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        frames = extract_frames(video, tmp)
        if not frames:
            sys.exit("视频抽帧失败")
        keyed = [key_green(cv2.imread(str(f))) for f in frames]
        # 统一尺度：用全段中位数高度算一次 scale，保留呼吸带来的尺寸变化
        heights = [b[3] - b[2] for b in (bbox(k) for k in keyed) if b]
        scale = 198.0 / float(np.median(heights)) if heights else None
        cells = [normalize(k, scale) for k in keyed]

    if times:
        fps = 16.0
        pick = [min(len(cells) - 1, round(t * fps)) for t in times][:n_frames]
    else:
        # 默认：把第一个「循环长度」均匀切成 n 帧（循环长度 = 协议总时长）
        loop_s = sum(ANIMATIONS[row][2]) / 1000.0
        dur = len(cells) / 16.0
        span = min(loop_s, dur)
        pick = [min(len(cells) - 1, round(i * span / n_frames * 16)) for i in range(n_frames)]

    while len(pick) < n_frames:            # 帧不够就重复最后一帧
        pick.append(pick[-1])
    return [cells[i] for i in pick]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--row", type=int, required=True, help="0-8，见 ANIMATIONS")
    ap.add_argument("--base", help="底图图集（其余行沿用），不给就整张透明")
    ap.add_argument("--out", help="输出图集 webp")
    ap.add_argument("--preview", help="只导出一行循环 GIF")
    ap.add_argument("--times", help="指定取帧时间（秒，逗号分隔）")
    ap.add_argument("--taper", type=float, default=0.5,
                    help="帧间尺寸变化削减比例（0=抹平，1=原样），默认 0.5")
    a = ap.parse_args()

    if not 0 <= a.row < len(ANIMATIONS):
        sys.exit(f"--row 只能是 0-{len(ANIMATIONS)-1}")

    times = [float(x) for x in a.times.split(",")] if a.times else None
    name, n_frames, ms = ANIMATIONS[a.row]
    print(f"动作 {name}：需要 {n_frames} 帧，时长 {sum(ms)}ms")
    cells = build_row(pathlib.Path(a.video), a.row, times)
    print(f"取样 {len(cells)} 帧")

    if a.preview:
        out = pathlib.Path(a.preview)
        out.parent.mkdir(parents=True, exist_ok=True)
        frames = cells + [cells[0]]
        durations = (ms[:len(cells)] + [ms[0]])[:len(frames)]
        cells[0].save(out, save_all=True, append_images=frames[1:],
                      duration=durations, loop=0, disposal=2)
        print("预览 →", out)
        return

    if not a.out:
        sys.exit("需要 --out 或 --preview")

    if a.base:
        atlas = Image.open(a.base).convert("RGBA")
        if atlas.size != (CELL_W * COLS, CELL_H * ROWS):
            sys.exit(f"底图尺寸不对：{atlas.size}，应为 {(CELL_W*COLS, CELL_H*ROWS)}")
    else:
        atlas = Image.new("RGBA", (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))

    ref_cell = atlas.crop((0, 0, CELL_W, CELL_H)) if a.base else None
    if ref_cell is not None:
        cells = polish(cells, ref_cell, a.taper)

    for i, cell in enumerate(cells[:n_frames]):
        atlas.paste(cell, (i * CELL_W, a.row * CELL_H), cell)

    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out, "WEBP", quality=82, method=6)
    print(f"图集 → {out}  {out.stat().st_size/1024:.0f}KB")
    if out.stat().st_size > 512 * 1024:
        print("⚠️ 超过 512KB，pack-sprite 会自动降采样，建议先降 quality")


if __name__ == "__main__":
    main()
