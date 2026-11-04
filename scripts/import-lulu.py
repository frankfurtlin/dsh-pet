#!/usr/bin/env python3
"""把 /root/workspace/plugins/dsh-pet/images/ 里的噜噜图片转成插件可用的形象素材。

做四件事：
1. 抠底（纯白/纯色背景变透明，复杂背景保留并标记 cutout=false）
2. 去掉多余留白（按 alpha 自动裁边）
3. 统一缩放到最长边 320px，导出 webp（alpha 保留）
4. 生成 client-src/generated-images.js（图片以 data URI 内联，插件保持单文件部署）
   另外生成一张 contact-sheet.png 供肉眼检查

用法：
  python3 scripts/import-lulu.py                 # 用默认目录
  python3 scripts/import-lulu.py --in DIR --out DIR --emit FILE --sheet FILE --label 前缀
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：pip install pillow")

SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
MAX_EDGE = 320
TOTAL_BUDGET = 900 * 1024  # 所有内联图片的原始字节上限（base64 后约 1.2MB）


def slugify(name: str, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not s:
        s = fallback
    return s[:24]


def transparent_background(im: Image.Image) -> tuple[Image.Image, bool]:
    """把纯色背景变透明。返回 (图片, 是否成功抠底)。"""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    # 四角颜色接近且足够亮/纯，才尝试抠底
    ref = corners[0]
    near = all(abs(c[0] - ref[0]) <= 12 and abs(c[1] - ref[1]) <= 12 and abs(c[2] - ref[2]) <= 12 for c in corners)
    bright = sum(ref[:3]) / 3 >= 205
    if not (near and bright):
        return rgba, False

    # 用“角落种子”的连通填充思路：PIL 没有 flood fill 到 alpha，改用容差阈值 + 边缘连通性
    tol = 26
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if _a == 0 or (
                abs(r - ref[0]) <= tol and abs(g - ref[1]) <= tol and abs(b - ref[2]) <= tol
            ):
                mpx[x, y] = 255
    # 只保留与边缘连通的那一片，避免把角色身上的白色也被抠掉
    keep = Image.new("L", (w, h), 0)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seen = bytearray(w * h)
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if mpx[x, y] == 0:
            continue
        keep.putpixel((x, y), 255)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # 边缘羽化，避免锯齿
    keep = keep.filter(ImageFilter.GaussianBlur(0.8))
    out = rgba.copy()
    pxo = out.load()
    kp = keep.load()
    for y in range(h):
        for x in range(w):
            _r, _g, _b, a = pxo[x, y]
            pxo[x, y] = (_r, _g, _b, int(a * (1 - kp[x, y] / 255)))
    return out, True


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def fit(im: Image.Image, max_edge: int = MAX_EDGE) -> Image.Image:
    w, h = im.size
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return im


def contact_sheet(entries: list[dict], out: Path) -> None:
    tile = 160
    cols = min(6, max(1, len(entries)))
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * tile, rows * (tile + 18)), (255, 255, 255, 255))
    for i, e in enumerate(entries):
        im = Image.open(out / e["file"]).convert("RGBA")
        im.thumbnail((tile - 12, tile - 12))
        x = (i % cols) * tile + (tile - im.width) // 2
        y = (i // cols) * (tile + 18) + (tile - im.height) // 2
        sheet.alpha_composite(im, (x, y))
    sheet.convert("RGB").save(out / "contact-sheet.png")


def main() -> int:
    targets = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="/root/workspace/plugins/dsh-pet/images")
    ap.add_argument("--out", dest="dst", default=str(targets / "assets/user"))
    ap.add_argument("--emit", default=str(targets / "client-src/generated-images.js"))
    ap.add_argument("--sheet", default="")
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    src = Path(args.src)
    dst = Path(args.dst)
    if not src.is_dir():
        sys.exit(f"找不到图片目录：{src}")

    files = sorted(p for p in src.iterdir() if p.suffix.lower() in SUFFIXES and not p.name.startswith("."))
    if not files:
        sys.exit(f"{src} 里没有图片（支持 {' '.join(sorted(SUFFIXES))}）")

    dst.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    total = 0
    used_ids: set[str] = set()

    for i, path in enumerate(files):
        stem = slugify(args.label + "-" + path.stem if args.label else path.stem, f"img{i + 1}")
        sid = f"u-{stem}"
        while sid in used_ids:
            sid += "x"
        used_ids.add(sid)
        try:
            im = Image.open(path)
        except Exception as exc:  # noqa: BLE001
            print(f"跳过 {path.name}：{exc}")
            continue
        # 大图先降到 900px 再做逐像素抠底，否则一张 4K 图要跑几十秒
        if max(im.size) > 900:
            im.thumbnail((900, 900), Image.LANCZOS)
        im, cutout = transparent_background(im)
        im = fit(trim(im))
        if im.width < 24 or im.height < 24:
            print(f"跳过 {path.name}：抠图后太小（{im.width}×{im.height}）")
            continue
        out_name = f"{sid}.webp"
        im.save(dst / out_name, "WEBP", quality=88, method=6, alpha_quality=92)
        size = (dst / out_name).stat().st_size
        total += size
        entries.append(
            {
                "id": sid,
                "label": path.stem[:20],
                "file": out_name,
                "width": im.width,
                "height": im.height,
                "cutout": cutout,
                "bytes": size,
            }
        )

    if not entries:
        sys.exit("没有可用的图片（全部被跳过）")

    if total > TOTAL_BUDGET:
        print(f"⚠ 图片总量 {total / 1024:.0f}KB 超过预算 {TOTAL_BUDGET / 1024:.0f}KB，建议减少数量或先压缩源图")

    # 生成客户端数据模块：data URI 内联，保持插件单文件部署
    lines = [
        "// 由 scripts/import-lulu.py 生成，不要手改。",
        "// 素材来源：你在 /root/workspace/plugins/dsh-pet/images/ 放进来的图片（仅本地个人使用）。",
        "const PET_USER_IMAGES = [",
    ]
    for e in entries:
        data = (dst / e["file"]).read_bytes()
        uri = "data:image/webp;base64," + base64.b64encode(data).decode("ascii")
        lines.append(
            "  {"
            f"id: {json.dumps(e['id'])}, label: {json.dumps(e['label'], ensure_ascii=False)}, "
            f"url: {json.dumps(uri)}, width: {e['width']}, height: {e['height']}"
            "},"
        )
    lines.append("];")
    Path(args.emit).write_text("\n".join(lines) + "\n", encoding="utf-8")

    meta = dst / "index.json"
    meta.write_text(json.dumps({"images": entries, "bytes": total}, ensure_ascii=False, indent=2), encoding="utf-8")
    sheet = Path(args.sheet) if args.sheet else dst / "contact-sheet.png"
    sheet.parent.mkdir(parents=True, exist_ok=True)
    contact_sheet(entries, dst)
    if (dst / "contact-sheet.png").resolve() != sheet.resolve():
        (dst / "contact-sheet.png").replace(sheet)

    print(f"✓ 导入 {len(entries)} 张图，共 {total / 1024:.0f}KB")
    for e in entries:
        print(f"  - {e['id']}  {e['width']}×{e['height']}  {e['bytes'] / 1024:.0f}KB  抠底={'是' if e['cutout'] else '否'}")
    print(f"✓ 已写 {args.emit}")
    print(f"✓ 拼图 {sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
