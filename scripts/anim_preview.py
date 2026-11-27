#!/usr/bin/env python3
"""动图组的 `preview.html` 生成器。

`fetch-douyin.py` 抓完一组会自动调用；历史组想补/重刷预览页也可以直接跑：

    python3 scripts/anim_preview.py images/lulu-anims/<组目录> [更多组目录…]

数据全部来自组目录里的 `manifest.json`（页码、时长、帧数），只读不写素材。
样式与 `fetch-douyin.py` 生成的一致——模板只此一份。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

TMPL = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>噜噜动图 · {item_id}</title>
<style>
  :root {{ color-scheme: dark }}
  body {{ margin:0; padding:32px; background:#111214; color:#e8e6e1;
         font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif }}
  h1 {{ font-size:20px; margin:0 0 4px }} p {{ color:#9a968e; margin:0 0 24px }}
  a {{ color:#7aa2f7 }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px }}
  figure {{ margin:0; background:#1a1c1f; border-radius:12px; overflow:hidden }}
  img {{ display:block; width:100%; aspect-ratio:1; object-fit:cover; background:#000 }}
  figcaption {{ padding:8px 10px; font-size:12px; color:#9a968e; display:flex; justify-content:space-between }}
  b {{ color:#e8e6e1; font-weight:600 }}
</style></head><body>
<h1>{title}</h1>
<p>{count} 个动图 · 来源 <a href="{page_url}">抖音 {item_id}</a>{author}</p>
<div class="grid">
{figures}
</div></body></html>
"""


def build_html(meta: dict, items: list[dict]) -> str:
    figures = []
    for it in items:
        index = it.get('index') or 0
        dur, frames = it.get('duration'), it.get('frames')
        caption = f'{dur:.2f}s · {frames}f' if dur and frames else (Path(it['file']).stem if it.get('file') else '')
        figures.append(
            f'<figure><img src="{it["file"]}" alt="{it["file"]}" loading="lazy">'
            f'<figcaption><b>{index:02d}</b><span>{caption}</span></figcaption></figure>'
        )
    author = f' · {meta["author"]}' if meta.get('author') else ''
    return TMPL.format(
        item_id=meta.get('item_id') or '?',
        title=meta.get('title') or '噜噜动图',
        count=len(items),
        page_url=meta.get('page_url') or '#',
        author=author,
        figures='\n'.join(figures),
    )


def write_preview(out: Path, meta: dict, items: list[dict]) -> Path:
    path = Path(out) / 'preview.html'
    path.write_text(build_html(meta, items), encoding='utf-8')
    return path


def items_from_manifest(set_dir: Path) -> tuple[dict, list[dict]]:
    """从 manifest.json 还原 (meta, items)，兼容早期 `probe: "w,h,dur,frames"` 写法。"""
    manifest = json.loads((Path(set_dir) / 'manifest.json').read_text(encoding='utf-8'))
    items = []
    for entry in manifest.get('items', []):
        if not entry.get('file'):
            continue
        dur, frames = entry.get('duration'), entry.get('frames')
        probe = entry.get('probe')
        if probe and (not dur or not frames):
            parts = str(probe).split(',')
            if len(parts) >= 4:
                dur = dur or float(parts[2])
                frames = frames or int(float(parts[3]))
        items.append({'index': entry.get('index') or len(items) + 1,
                      'file': entry['file'], 'duration': dur, 'frames': frames})
    meta = {
        'item_id': manifest.get('item_id'),
        'title': manifest.get('title'),
        'author': manifest.get('author'),
        'page_url': manifest.get('resolved')
                    or (f"https://www.douyin.com/note/{manifest['item_id']}" if manifest.get('item_id') else ''),
    }
    return meta, items


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1
    for arg in argv:
        set_dir = Path(arg).expanduser().resolve()
        if not (set_dir / 'manifest.json').exists():
            print(f'✗ {set_dir} 里没有 manifest.json')
            return 1
        meta, items = items_from_manifest(set_dir)
        path = write_preview(set_dir, meta, items)
        print(f'✓ {len(items)} 个动图 → {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
