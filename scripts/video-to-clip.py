#!/usr/bin/env python3
"""
video-to-clip.py —— 把一段绿幕动作视频转成「动作胶片条」（原生动作动画）

背景：dsh-pet 原来用 SVG 小组件（舞狮头、红包、碗、烟花）配合 CSS 变换演动作，
      观感是「一张静态图被摆来摆去」。这个脚本把图生视频的结果做成横向胶片条，
      渲染层用 background-position 逐帧推进——和位图噜噜同一套机制，不需要 GIF 解码。

用法：
  /usr/bin/python3 scripts/video-to-clip.py --video /tmp/clap.mp4 --action clap
  /usr/bin/python3 scripts/video-to-clip.py --video /tmp/clap.mp4 --action clap \
      --frames 20 --seconds 2.4 --out assets/clip-clap.webp
  # 只导预览 GIF
  /usr/bin/python3 scripts/video-to-clip.py --video /tmp/clap.mp4 --action clap --preview /tmp/clap.gif

约定：
  - 单帧 192×208（和位图角色一致，渲染层共用同一套尺寸/缩放）
  - 尺度由整段视频统一算一次，动作过程中角色该变大变小（跳跃）就让它变
  - 抠像同 video-to-atlas.py：只去掉与边界连通的绿底，避免误抠角色内部
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
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS


def bbox(rgba: np.ndarray):
    ys, xs = np.where(rgba[..., 3] > 20)
    if len(xs) == 0:
        return None
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def key_green(bgr: np.ndarray) -> np.ndarray:
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
    rb = np.maximum(out[..., 2], out[..., 0])
    out[..., 1] = np.where(band, np.minimum(out[..., 1], rb * 1.01), out[..., 1])

    alpha = cv2.GaussianBlur(fg.astype(np.float32) * 255, (3, 3), 0)
    return np.dstack([out[..., 2], out[..., 1], out[..., 0], alpha]).astype(np.uint8)


def normalize(rgba: np.ndarray, scale: float, baseline: int = 203) -> Image.Image:
    box = bbox(rgba)
    if box is None:
        return Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    x0, x1, y0, y1 = box
    crop = rgba[y0:y1, x0:x1]
    nw, nh = max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LANCZOS4
    resized = cv2.resize(crop, (nw, nh), interpolation=interp)
    # 超宽时按宽度收一下，避免手臂出框
    if nw > CELL_W:
        k = CELL_W / nw
        nw, nh = CELL_W, max(1, round(nh * k))
        resized = cv2.resize(resized, (nw, nh), interpolation=cv2.INTER_AREA)
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    px = (CELL_W - nw) // 2
    py = baseline - nh
    cell.paste(Image.fromarray(resized, "RGBA"), (px, py), Image.fromarray(resized, "RGBA"))
    return cell


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--action", required=True, help="动作 id，如 clap / hop / redpacket")
    ap.add_argument("--frames", type=int, default=16)
    ap.add_argument("--seconds", type=float, default=2.4, help="取多少秒做循环（跟动作时长对齐）")
    ap.add_argument("--fps", type=float, default=16.0, help="源视频帧率")
    ap.add_argument("--out")
    ap.add_argument("--preview")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.video, str(tmp / "f%04d.png")],
                       check=True)
        files = sorted(tmp.glob("f*.png"))
        if not files:
            sys.exit("抽帧失败")
        keyed = [key_green(cv2.imread(str(f))) for f in files]

    heights = [b[3] - b[2] for b in (bbox(k) for k in keyed) if b]
    scale = 198.0 / float(np.median(heights)) if heights else 1.0

    span = min(len(keyed), int(a.seconds * a.fps))
    idx = [round(i * (span - 1) / max(1, a.frames - 1)) for i in range(a.frames)]
    cells = [normalize(keyed[i], scale) for i in idx]
    step_ms = round(a.seconds * 1000 / a.frames)
    print(f"{a.action}: 取 {len(cells)} 帧，{step_ms}ms/帧，共 {step_ms * len(cells)}ms")

    if a.preview:
        ms = [step_ms] * len(cells)
        frames = [c.convert("RGB") for c in cells]
        frames[0].save(a.preview, save_all=True, append_images=frames[1:], duration=ms, loop=0)
        print("预览 →", a.preview)
        return

    out = pathlib.Path(a.out or f"assets/clip-{a.action}.webp")
    out.parent.mkdir(parents=True, exist_ok=True)
    strip = Image.new("RGBA", (CELL_W * len(cells), CELL_H), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        strip.paste(cell, (i * CELL_W, 0), cell)
    strip.save(out, "WEBP", quality=78, method=6)
    print(f"胶片条 → {out}  {out.stat().st_size/1024:.0f}KB  ({len(cells)} 帧)")
    print(f"渲染条目：frameW {CELL_W}, frameH {CELL_H}, frames {len(cells)}, step {step_ms}ms")


if __name__ == "__main__":
    main()
