#!/usr/bin/env python3
"""
gen-scene.py —— 把已有的噜噜图抠出来，换到 AI 生成的场景背景上

管线：rembg(u2net) 抠图 → Pollinations(flux, nologo) 生成背景
      → 角色色温匹配 + 底部 AO + 接触阴影 + 边缘羽化 → 合成 1080×1920

为什么不是"直接文生图"：文生图每次都会漂移出不同的角色（耳朵、比例都变），
而这条管线里角色像素来自你自己的图，只有背景是 AI 生成的，所以角色 100% 一致。

依赖：
  ~/.venvs/rembg/bin/python（已装 rembg + onnxruntime，模型 u2net）
  Pillow
  联网（Pollinations 免费额度：约 1 张 / 45 秒 / IP）

用法：
  python3 scripts/gen-scene.py --cut images/lulu-anims/douyin-live-7703543793374999547/01.jpg --scene bedroom
  python3 scripts/gen-scene.py --cut images/lulu-anims/douyin-live-7703543793374999547/12.jpg \
      --prompt "cozy cafe interior, soft 3d render, pastel, no characters" --out images/lulu-generated/scenes/cafe.jpg

注意：脚本本体用系统 python3 跑不通 rembg，抠图那一步会自动调用
      ~/.venvs/rembg/bin/python；如果该 venv 不存在，会提示先安装。
"""
from __future__ import annotations

import argparse
import os
import pathlib
import subprocess
import sys
import urllib.parse

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageStat

# Pillow 10+ 把滤镜常量挪进 Image.Resampling，这里兼容新旧两版
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

# 本机路径一律运行时推导，可用 REMBG_PYTHON / HERMES_HOME 覆盖。
REMbg_PY = pathlib.Path(os.environ.get("REMBG_PYTHON") or pathlib.Path.home() / ".venvs/rembg/bin/python")
HERMES_HOME = pathlib.Path(os.environ.get("HERMES_HOME") or pathlib.Path.home() / ".hermes")
CACHE = HERMES_HOME / "cache/scratch/gen-scene-cache"

SCENES = {
    "bedroom": "cute cozy bedroom interior, soft 3d render style, blender, pastel colors, plush toys, warm lamp, empty room no characters, vertical",
    "cafe": "cute cozy cafe interior, soft 3d render style, blender, pastel colors, wooden table, plants, empty scene no characters, vertical",
    "street": "cute pastel street at dusk, soft 3d render style, blender, warm shop lights, wet pavement, empty scene no characters, vertical",
    "garden": "cute sunny garden, soft 3d render style, blender, pastel flowers, bench, empty scene no characters, vertical",
    "rain": "cute rainy window with raindrops, soft 3d render style, blender, pastel, warm interior light, empty scene no characters, vertical",
}


def cutout(src: pathlib.Path, dst: pathlib.Path) -> pathlib.Path:
    """用 rembg venv 抠图（缓存）。"""
    if dst.exists():
        return dst
    if not REMbg_PY.exists():
        sys.exit(f"缺少 rembg 环境：{REMbg_PY}（建法：python3 -m venv ~/.venvs/rembg && pip install rembg onnxruntime）")
    dst.parent.mkdir(parents=True, exist_ok=True)
    code = (
        "from rembg import remove, new_session\n"
        "from PIL import Image\n"
        "import sys\n"
        "s=new_session('u2net')\n"
        f"im=Image.open({str(src)!r}).convert('RGBA')\n"
        f"remove(im, session=s).save({str(dst)!r})\n"
    )
    subprocess.run([str(REMbg_PY), "-c", code], check=True)
    return dst


def gen_bg(prompt: str, dst: pathlib.Path, seed: int = 101) -> pathlib.Path:
    """Pollinations 生成背景（nologo，无水印）。免费额度约每 45 秒 1 张。"""
    if dst.exists():
        try:
            Image.open(dst)
            return dst
        except Exception:
            dst.unlink()
    dst.parent.mkdir(parents=True, exist_ok=True)
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width=768&height=1344&nologo=true&model=flux&seed={seed}"
    subprocess.run(["curl", "-sL", "--max-time", "170", "-o", str(dst), url], check=False)
    try:
        Image.open(dst)
    except Exception:
        sys.exit("背景生成失败（多半是 Pollinations 免费额度：等 45 秒再试）")
    return dst


def grade(ch: Image.Image, ref: Image.Image) -> Image.Image:
    """按背景局部色温/亮度轻微匹配角色（只做 35%，避免发灰）。"""
    bs, cs = ImageStat.Stat(ref.convert("RGB")), ImageStat.Stat(ch.convert("RGB"))
    fac = [((max(1, b) / max(1, c)) ** 0.35) for b, c in zip(bs.mean, cs.mean)]
    r, g, b, a = ch.split()
    r = r.point(lambda v, f=fac[0]: min(255, int(v * f)))
    g = g.point(lambda v, f=fac[1]: min(255, int(v * f)))
    b = b.point(lambda v, f=fac[2]: min(255, int(v * f)))
    ch = Image.merge("RGBA", (r, g, b, a))
    return ImageEnhance.Color(ch).enhance(0.92)


def compose(bg_path: pathlib.Path, cut_path: pathlib.Path, dst: pathlib.Path,
            ratio: float = 0.5, bottom: float = 0.86) -> pathlib.Path:
    W, H = 1080, 1920
    bg = Image.open(bg_path).convert("RGB").resize((W, H), LANCZOS)
    ch = Image.open(cut_path).convert("RGBA")
    scale = (H * ratio) / ch.height
    ch = ch.resize((int(ch.width * scale), int(ch.height * scale)), LANCZOS)

    x = (W - ch.width) // 2
    y = int(H * bottom - ch.height)

    ref = bg.crop((max(0, x), max(0, y), min(W, x + ch.width), min(H, y + ch.height)))
    ch = grade(ch, ref)

    # 底部假 AO
    ao = Image.new("L", ch.size, 0)
    ImageDraw.Draw(ao).rectangle((0, int(ch.height * 0.75), ch.width, ch.height), fill=70)
    ao = ao.filter(ImageFilter.GaussianBlur(ch.height * 0.06))
    dark = Image.new("RGBA", ch.size, (0, 0, 0, 0))
    dark.putalpha(ao)
    ch = Image.alpha_composite(ch, dark)

    # 边缘 1px 羽化，减轻贴纸感
    ch.putalpha(ch.getchannel("A").filter(ImageFilter.GaussianBlur(1)))

    canvas = bg.convert("RGBA")
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sw, shh = int(ch.width * 0.68), int(H * 0.018)
    cx = x + ch.width // 2
    ImageDraw.Draw(sh).ellipse((cx - sw // 2, y + ch.height - shh, cx + sw // 2, y + ch.height + shh),
                               fill=(0, 0, 0, 120))
    canvas = Image.alpha_composite(canvas, sh.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(ch, (x, y))

    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(dst, "JPEG", quality=92)
    return dst


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cut", required=True, help="角色原图（会先抠图）")
    ap.add_argument("--scene", choices=sorted(SCENES), help="预设场景")
    ap.add_argument("--prompt", help="自定义背景提示词（与 --scene 二选一）")
    ap.add_argument("--out", help="输出路径，默认 images/lulu-generated/scenes/<scene>-<cut>.jpg")
    ap.add_argument("--ratio", type=float, default=0.5, help="角色高度占画面比例（默认 0.5）")
    ap.add_argument("--seed", type=int, default=101)
    a = ap.parse_args()

    if not a.prompt and not a.scene:
        sys.exit("需要 --scene 或 --prompt")
    prompt = a.prompt or SCENES[a.scene]

    src = pathlib.Path(a.cut).resolve()
    tag = a.scene or "custom"
    cut_png = CACHE / f"{src.stem}_{a.seed}.png"
    bg_jpg = CACHE / f"bg_{tag}_{a.seed}.jpg"

    print("1/3 抠图 …")
    cutout(src, cut_png)
    print("2/3 生成背景 …")
    gen_bg(prompt, bg_jpg, seed=a.seed)
    print("3/3 合成 …")

    out = pathlib.Path(a.out) if a.out else pathlib.Path("images/lulu-generated/scenes") / f"{tag}-{src.stem}.jpg"
    compose(bg_jpg, cut_png, out, ratio=a.ratio)
    print("完成：", out)


if __name__ == "__main__":
    main()
