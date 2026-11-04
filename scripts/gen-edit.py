#!/usr/bin/env python3
"""
gen-edit.py —— 用图生图（Qwen-Image-Edit-2509 @ 硅基流动）给噜噜换场景/换姿势

为什么用这个而不是文生图：文生图每次角色都会漂移；图生图把原图当参考，
外形/配色/比例能保住，只改背景和动作。实测单张 ~25-30 秒。

依赖：
  SiliconFlow key：默认从 /root/.dsh/.credentials.yaml 的 SILICONFLOW_API_KEY 读，
                 也可以用环境变量 SF_API_KEY 覆盖
  Pillow + opencv（去水印用 cv2.inpaint）

用法（必须用系统 python3，里面有 cv2）：
  /usr/bin/python3 scripts/gen-edit.py --ref images/lulu-2/01.jpg --preset cafe
  /usr/bin/python3 scripts/gen-edit.py --ref images/lulu-2/12.jpg \
      --prompt "背景换成海边落日，角色保持不变，手里多一个冰淇淋" --out images/generated-i2i/beach.png
  /usr/bin/python3 scripts/gen-edit.py --ref images/lulu-2/01.jpg --preset snow --keep-watermark

预设：cafe / snow / sakura / party / garden / night
说明：
  - 本地图片会先上传到 COS（static.frankfurtlin.top）拿公网 URL，模型需要 URL 或 base64
  - Qwen-Image 会在右下角打「AI生成」水印，脚本默认用 inpaint 抹掉（抹掉区域是纯背景时几乎无痕）
  - 一次一张；批量就循环调用（每次约 30 秒）
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

import cv2
import numpy as np

ENDPOINT = "https://api.siliconflow.cn/v1/images/generations"
MODEL = "Qwen/Qwen-Image-Edit-2509"
CRED = pathlib.Path("/root/.dsh/.credentials.yaml")
COS_SCRIPT = "/root/.hermes/skills/devops/tencent-cos-ops/scripts/cos_res.py"

BASE_RULE = "保持这只卡通水豚的外形、配色、比例和质感完全不变，只改动场景与动作"

PRESETS = {
    "cafe": "把背景换成温馨的咖啡馆室内，角色坐在木桌前，桌上放着咖啡杯",
    "snow": "把背景换成下雪的森林小屋前，地上有积雪，冷色调",
    "sakura": "把背景换成樱花树下，花瓣飘落，阳光柔和，角色站起来抬起一只手打招呼",
    "party": "把背景换成生日派对房间，有气球和蛋糕，暖色灯光",
    "garden": "把背景换成阳光花园，草地与小雏菊，角色坐着",
    "night": "把背景换成夜晚的窗边，窗外星星和月亮，室内暖灯",
}


def api_key() -> str:
    key = ""
    try:
        txt = CRED.read_text("utf8")
        m = re.search(r"SILICONFLOW_API_KEY:\s*(\S+)", txt)
        key = m.group(1) if m else ""
    except FileNotFoundError:
        pass
    import os
    return os.environ.get("SF_API_KEY") or key


def public_url(ref: pathlib.Path) -> str:
    """本地图片上传 COS，返回公网 URL；已经是 http(s) 则原样返回。"""
    if str(ref).startswith("http"):
        return str(ref)
    if not pathlib.Path(COS_SCRIPT).exists():
        sys.exit(f"找不到 COS 上传脚本：{COS_SCRIPT}")
    out = subprocess.run(["/usr/bin/python3", COS_SCRIPT, "upload", str(ref)],
                         capture_output=True, text=True)
    url = next((ln.strip() for ln in out.stdout.splitlines() if ln.strip().startswith("https://")), "")
    if not url:
        sys.exit("上传 COS 失败：" + (out.stderr or out.stdout)[:200])
    return url


def dewatermark(src: pathlib.Path, dst: pathlib.Path) -> None:
    """抹掉右下角「AI生成」水印（固定区域 inpaint）。"""
    img = cv2.imread(str(src), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    mask[int(h * 0.885):, int(w * 0.72):] = 255
    cv2.imwrite(str(dst), cv2.inpaint(img, mask, 25, cv2.INPAINT_NS))


def generate(prompt: str, image_url: str, key: str, timeout: int = 300) -> str:
    body = {"model": MODEL, "prompt": prompt, "image": image_url, "batch_size": 1}
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key,
                                          "Content-Type": "application/json"})
    data = json.loads(urllib.request.urlopen(req, timeout=timeout).read())
    imgs = data.get("images") or []
    if not imgs:
        raise RuntimeError("上游没返回图片：" + json.dumps(data)[:200])
    return imgs[0]["url"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="角色参考图（本地路径或 http URL）")
    ap.add_argument("--prompt", help="自定义指令")
    ap.add_argument("--preset", choices=sorted(PRESETS), help="预设场景")
    ap.add_argument("--out", help="输出 PNG 路径")
    ap.add_argument("--keep-watermark", action="store_true", help="不去水印")
    ap.add_argument("--no-rule", action="store_true", help="不要自动追加「保持角色不变」规则")
    a = ap.parse_args()

    if not a.prompt and not a.preset:
        sys.exit("需要 --prompt 或 --preset")

    prompt = a.prompt or PRESETS[a.preset]
    if not a.no_rule:
        prompt = prompt + "；" + BASE_RULE

    key = api_key()
    if not key:
        sys.exit("没找到 SILICONFLOW_API_KEY（/root/.dsh/.credentials.yaml 或 SF_API_KEY）")

    ref = pathlib.Path(a.ref)
    print("1/3 准备参考图 …")
    url = public_url(ref)

    print("2/3 调用图生图（约 30 秒）…")
    t0 = time.time()
    raw_url = generate(prompt, url, key)

    stamp = time.strftime("%Y%m%d-%H%M%S")
    tag = a.preset or "custom"
    raw = pathlib.Path("/root/.hermes/cache/scratch") / f"i2i_{tag}_{stamp}_raw.png"
    raw.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(raw_url, raw)

    out = pathlib.Path(a.out) if a.out else pathlib.Path("images/generated-i2i") / f"{tag}-{ref.stem}.png"
    out.parent.mkdir(parents=True, exist_ok=True)

    print("3/3 后处理 …")
    if a.keep_watermark:
        raw.replace(out)
    else:
        dewatermark(raw, out)
        raw.unlink(missing_ok=True)

    print(f"完成（{round(time.time()-t0,1)}s）：{out}")


if __name__ == "__main__":
    main()
