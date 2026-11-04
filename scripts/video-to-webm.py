#!/usr/bin/env python3
"""
video-to-webm.py —— 把一段绿幕动作视频转成「原生动作视频」（透明 VP9 WebM）

背景：胶片条（video-to-clip.py）受 192×208 单格和固定帧数限制，动作看起来像
      「几张关键帧在跳」。这个脚本走另一条路：输出一条带 alpha 的 VP9 WebM，
      浏览器用 <video> 直接播，帧率、时长都不受图集协议约束。

用法：
  /usr/bin/python3 scripts/video-to-webm.py --video /tmp/cheer.mp4 --action cheer
  /usr/bin/python3 scripts/video-to-webm.py --video /tmp/cheer.mp4 --action cheer \
      --start 49 --frames 30

约定（关键）：
  - 画布固定 384×416（= 位图单格 192×208 的 2 倍），角色高度 396px、脚底基线 406px
    —— 与图集「角色高 198 / 基线 203」完全同构，渲染层只要把 <video> 当 192×208
    的层摆（width:192px;height:208px），就会和 .dsh-pet-sprite 严丝合缝对齐。
  - 尺度全片段只算一次（取角色高度中位数），动作里的变大变小（跳起/下蹲）保留。
  - 抠像同 video-to-clip.py：只去掉与边界连通的绿底，避免误抠角色内部。
  - 产物默认 `assets/anim-<action>.webm`（扁平目录，build.mjs 的占位符只认这一层）。
"""
from __future__ import annotations

import argparse
import glob
import importlib.util
import pathlib
import subprocess
import sys
import tempfile

import cv2
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("video_to_clip", HERE / "video-to-clip.py")
v2c = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v2c)

CELL_W, CELL_H = 192, 208          # 与图集单格一致
CHAR_H, BASELINE = 198, 203        # 与图集里角色高度/脚底基线一致
SS = 2                             # 超采样倍率
CANVAS_W, CANVAS_H = CELL_W * SS, CELL_H * SS
CANVAS_CHAR_H, CANVAS_BASELINE = CHAR_H * SS, BASELINE * SS


def load_frames(video: pathlib.Path, tmp: pathlib.Path) -> list[np.ndarray]:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), str(tmp / "f%04d.png")],
                   check=True)
    files = sorted(tmp.glob("f*.png"))
    if not files:
        sys.exit("抽帧失败")
    return [v2c.key_green(cv2.imread(str(f))) for f in files]


def compose(keyed: list[np.ndarray]) -> tuple[list[np.ndarray], float]:
    boxes = [v2c.bbox(rgba) for rgba in keyed]
    valid = [b for b in boxes if b]
    if not valid:
        sys.exit("整段都没抠出角色（alpha 全空）")
    heights = [b[3] - b[2] for b in valid]
    scale = CANVAS_CHAR_H / float(np.median(heights))

    # 全片段统一裁切区：并集 bbox，保住跳起/下蹲的位移
    x0 = min(b[0] for b in valid)
    x1 = max(b[1] for b in valid)
    y0 = min(b[2] for b in valid)
    y1 = max(b[3] for b in valid)

    nw = max(1, round((x1 - x0) * scale))
    if nw > CANVAS_W:  # 手臂张太开时按宽度收一下，免得侧向出画
        scale *= CANVAS_W / nw
        nw = CANVAS_W

    # 跳起/滚动这类位移大的动作，并集高度会超过画布：再按高度收一次，
    # 保证任何一帧都完整落在画布内（双脚贴基线，头顶留 4px 余量）。
    nh_union = max(1, round((y1 - y0) * scale))
    if nh_union > CANVAS_H - 8:
        scale *= (CANVAS_H - 8) / nh_union

    out = []
    for rgba in keyed:
        crop = rgba[y0:y1, x0:x1]
        nh = max(1, round(crop.shape[0] * scale))
        nw_i = max(1, round(crop.shape[1] * scale))
        interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LANCZOS4
        resized = cv2.resize(crop, (nw_i, nh), interpolation=interp)
        canvas = np.zeros((CANVAS_H, CANVAS_W, 4), np.uint8)
        px = (CANVAS_W - nw_i) // 2
        py = max(0, CANVAS_BASELINE - nh)
        canvas[py:py + nh, px:px + nw_i] = resized
        out.append(canvas)
    return out, scale


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--action", required=True, help="动作 id，如 cheer / hop / redpacket")
    ap.add_argument("--start", type=int, default=0, help="起始帧（0 起）")
    ap.add_argument("--frames", type=int, default=0, help="取多少帧，0 = 到结尾")
    ap.add_argument("--fps", type=float, default=16.0, help="源视频帧率（也写进 webm）")
    ap.add_argument("--crf", type=int, default=34, help="VP9 质量，越小越清晰越大")
    ap.add_argument("--out")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as td:
        keyed = load_frames(pathlib.Path(a.video), pathlib.Path(td))

    span = keyed[a.start:]
    if a.frames > 0:
        span = span[:a.frames]
    if not span:
        sys.exit("取帧范围为空")
    frames, scale = compose(span)

    cover = float(np.mean([(f[..., 3] > 20).mean() for f in frames]))
    print(f"{a.action}: {len(frames)} 帧 @ {a.fps:g}fps = {len(frames) / a.fps:.2f}s，"
          f"缩放 {scale:.3f}，画布 {CANVAS_W}×{CANVAS_H}，alpha 覆盖 {cover:.3f}")

    out = pathlib.Path(a.out or f"assets/anim-{a.action}.webm")
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = b"".join(np.ascontiguousarray(f[..., [0, 1, 2, 3]]).tobytes() for f in frames)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", f"{CANVAS_W}x{CANVAS_H}", "-r", f"{a.fps:g}", "-i", "-",
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
        "-b:v", "0", "-crf", str(a.crf), "-row-mt", "1", "-an",
        str(out),
    ]
    subprocess.run(cmd, input=raw, check=True)
    print(f"视频 → {out}  {out.stat().st_size / 1024:.0f}KB")
    print(f"渲染条目：{{ url: 'assets/anim-{a.action}.webm', width: {CELL_W}, height: {CELL_H}, "
          f"seconds: {len(frames) / a.fps:.2f} }}")


if __name__ == "__main__":
    main()
