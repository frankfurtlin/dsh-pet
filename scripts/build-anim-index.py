#!/usr/bin/env python3
"""重建 `images/lulu-anims/index.json` 与 README 的库存表。

素材组会越收越多，手改索引和表格必然漂移，所以扫描每组的 `manifest.json` 重算：

    python3 scripts/build-anim-index.py [--dir images/lulu-anims]

做两件事：
1. 重写 `index.json`（组数、条数、体积、来源、抓取时间都从 manifest 和磁盘现算）；
2. 重写 README 里 `<!-- inventory:start -->` 与 `<!-- inventory:end -->` 之间的
   合计行 + 库存表（其余正文不动）。

只读素材、只写这两个文件，不动图片/视频。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
START = '<!-- inventory:start -->'
END = '<!-- inventory:end -->'


def norm_time(value: str | None) -> str | None:
    if not value:
        return None
    if re.match(r'^\d{4}-\d{2}-\d{2}T', value) and ('+' in value or value.endswith('Z')):
        return value
    m = re.match(r'^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})', value)
    return f'{m.group(1)}T{m.group(2)}+08:00' if m else value


def collect(lib: Path) -> list[dict]:
    sets = []
    for set_dir in sorted(p for p in lib.iterdir() if p.is_dir()):
        manifest_path = set_dir / 'manifest.json'
        if not manifest_path.exists():
            continue
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        kind = 'live' if str(manifest.get('kind', '')).startswith('live') else 'slides'
        items = manifest.get('items') or []
        sets.append({
            'id': f'douyin-{kind}-{manifest["item_id"]}',
            'kind': kind,
            'path': set_dir.name,
            'count': len(list(set_dir.glob('*.webp'))) or len(items),
            'webp_bytes': sum(f.stat().st_size for f in set_dir.glob('*.webp')),
            'gif_bytes': sum(f.stat().st_size for f in set_dir.glob('*.gif')),
            'still_bytes': sum(f.stat().st_size for f in set_dir.glob('*.jpg')),
            'src_bytes': sum(f.stat().st_size for f in (set_dir / 'src').glob('*.mp4')),
            'source': manifest.get('source'),
            'resolved': manifest.get('resolved')
                        or f'https://www.douyin.com/note/{manifest["item_id"]}',
            'title': manifest.get('title'),
            'author': manifest.get('author'),
            'captured_at': norm_time(manifest.get('captured_at')),
            'preview': 'preview.html' if (set_dir / 'preview.html').exists() else None,
            'spec': (manifest.get('spec') or {}).get('display'),
        })
    return sorted(sets, key=lambda s: s['captured_at'] or '')


def render_inventory(sets: list[dict]) -> str:
    total_webp = sum(s['webp_bytes'] for s in sets)
    total_gif = sum(s['gif_bytes'] for s in sets)
    total_src = sum(s['src_bytes'] for s in sets)
    total_n = sum(s['count'] for s in sets)
    lines = [
        f'**{total_n} 个动图 / {total_webp / 1048576:.1f} MB**（另有 '
        f'{total_gif / 1048576:.1f} MB GIF、{total_src / 1048576:.1f} MB 原片）',
        '',
        '| 目录 | 类型 | 条数 | 动图体积 | 标题 | 抓取 |',
        '| --- | --- | --- | --- | --- | --- |',
    ]
    for s in sets:
        title = (s.get('title') or '—').replace('|', '｜')
        if len(title) > 28:
            title = title[:28] + '…'
        extra = ' + GIF' if s['gif_bytes'] else ''
        when = (s['captured_at'] or '')[:10]
        lines.append(f"| `{s['path']}` | {s['kind']} | {s['count']} | "
                     f"{s['webp_bytes'] / 1048576:.1f} MB{extra} | {title} | {when} |")
    return '\n'.join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description='重建动图库索引与 README 库存表')
    ap.add_argument('--dir', default=str(ROOT / 'images/lulu-anims'), help='动图库目录')
    args = ap.parse_args()

    lib = Path(args.dir).expanduser().resolve()
    if not lib.is_dir():
        print(f'✗ 没有这个目录：{lib}')
        return 1

    sets = collect(lib)
    if not sets:
        print(f'✗ {lib} 里没有找到任何 manifest.json')
        return 1

    index_path = lib / 'index.json'
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding='utf-8'))
    else:
        index = {'schema': 2, 'about': 'dsh-pet 的噜噜动图库：一组一目录。'}
    index['sets'] = sets
    from datetime import datetime
    index['updated'] = datetime.now().astimezone().strftime('%Y-%m-%d')
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    readme_path = lib / 'README.md'
    if readme_path.exists():
        readme = readme_path.read_text(encoding='utf-8')
        if START in readme and END in readme:
            head, _, rest = readme.partition(START)
            _, _, tail = rest.partition(END)
            block = f'{START}\n{render_inventory(sets)}\n{END}'
            readme = head + block + tail
            readme_path.write_text(readme, encoding='utf-8')
        else:
            print(f'! README 里没有 {START}/{END} 标记，表格未更新')

    total_n = sum(s['count'] for s in sets)
    print(f'✓ {len(sets)} 组 / {total_n} 个动图 → {index_path.relative_to(ROOT)}')
    for s in sets:
        print(f"  {s['path']:44s} {s['kind']:6s} {s['count']:>2}  {s['webp_bytes'] / 1048576:5.1f} MB")
    return 0


if __name__ == '__main__':
    sys.exit(main())
