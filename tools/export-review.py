#!/usr/bin/env python3
"""Copy the current design review bundle; repository sources remain authoritative."""
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
import xml.etree.ElementTree as ET

import markdown

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'https://github.com/gitvssh/fest-compass'
MARKER = '<!-- fest-compass-review-index -->'
DOCS = {
    'docs/ops/repository-consolidation.md': '저장소 통합·구현 결과',
    'docs/sdlc/2-design/functional-spec.md': '기능 상세·디자인 작업 입력',
    'docs/product/planning-principles.md': '기획 기준',
    'docs/review/2026-09-planning-review.md': '검토 안내',
    'docs/sdlc/2-design/screens.md': '화면설계',
    'docs/sdlc/2-design/flows.md': '사용자 흐름',
    'docs/sdlc/2-design/ia.md': '정보구조',
    'docs/sdlc/2-design/data-visualization.md': '데이터와 시각화',
    'docs/sdlc/2-design/design-system.md': '문구·레이아웃·검수',
    'docs/sdlc/1-analysis/srs.md': '기능 요구사항',
    'docs/sdlc/1-analysis/usecases/UC-FC-009.md': '기존 축제 이용 흐름',
    'docs/sdlc/1-analysis/usecases/UC-FC-010.md': '새 축제 이용 흐름',
    'docs/review/2026-09-current-state.md': '현재 사용 가능한 기능',
    'docs/research/2026-09-data-inventory.md': '데이터 확보 현황',
    'docs/research/festival-officer-interview.md': '담당자 업무 확인 질문',
}
SCREENS = [
    ('011', 'v5', '기존 축제 시작', 'existing'),
    ('008', 'v5', '과거 방문 흐름', 'existing'),
    ('009', 'v5', '주변 관광자원', 'existing'),
    ('010', 'v5', '개최 시기 비교', 'existing'),
    ('011', 'v6', '새 축제 시작', 'new'),
    ('012', 'v6', '지역 관광자원', 'new'),
    ('013', 'v6', '지역 방문 흐름', 'new'),
    ('014', 'v6', '개최 시기', 'new'),
    ('008', 'v7', '지난 개최 기록이 없을 때', 'states'),
    ('012', 'v7', '지도 실패·목록 유지', 'states'),
    ('014', 'v7', '후보 하나·일정 확인 불가', 'states'),
]
CSS = '''
*{box-sizing:border-box}body{margin:0;background:#f6f7f4;color:#10233d;font:16px/1.65 system-ui,"Malgun Gothic",sans-serif}
main{max-width:1120px;margin:auto;padding:36px 24px 80px;overflow-wrap:anywhere}a{color:#174caa;text-underline-offset:3px}
h1{font-size:30px;line-height:1.35}h2{font-size:24px;margin-top:36px}h3{font-size:19px}p{max-width:80ch}
nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}nav a,.button{display:inline-block;padding:10px 16px;background:white;border:1px solid #c5ced7;border-radius:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.card{padding:20px;background:white;border:1px solid #c5ced7;border-radius:8px}
.muted{color:#526174}.preview{position:relative;overflow:hidden;background:white;border:1px solid #c5ced7;margin:16px 0}
.preview img{position:absolute;max-width:none}figure{margin:24px 0}figcaption{font-weight:650}details{margin:18px 0}summary{cursor:pointer;padding:12px 0}
img{max-width:100%}table{display:block;overflow:auto;border-collapse:collapse;background:white}td,th{border:1px solid #c5ced7;padding:9px 12px;min-width:120px;text-align:left}
pre{overflow:auto;background:#fff;padding:16px;border:1px solid #d8dfe6}code{font-size:.9em}blockquote{margin:16px 0;padding-left:16px;border-left:3px solid #9eacbd}
:focus-visible{outline:3px solid #2667e8;outline-offset:3px}.meta{font-size:14px;color:#526174}.source-path{overflow-wrap:anywhere}
@media(max-width:600px){main{padding:24px 16px}h1{font-size:25px}.card{padding:16px}}
'''


def page(title, body, mermaid=False):
    script = '<script src="mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,securityLevel:"strict"});</script>' if mermaid else ''
    return f'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · FEST Compass</title><style>{CSS}</style><body><main>{body}</main>{script}</body></html>'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=Path('/mnt/d/download/project'))
    parser.add_argument('--label', default=datetime.now().strftime('%Y-%m-%d-%H%M%S') + '-design')
    parser.add_argument('--traceboard', type=Path, default=Path('/home/lsh/dev/devkit/traceboard'))
    args = parser.parse_args()
    if not re.fullmatch(r'[\w-]+', args.label):
        parser.error('label must be one directory name using letters, digits, _ or -')
    if Path(git('rev-parse', '--show-toplevel')).resolve() != ROOT:
        parser.error('run from a standalone fest-compass checkout or worktree')
    destination = args.destination.resolve()
    if destination.is_relative_to(ROOT):
        parser.error('review copies must be outside the project source tree')
    if not destination.is_dir():
        parser.error('destination must already be mounted and accessible')
    if destination == Path('/mnt/d/download/project'):
        mount = json.loads(subprocess.check_output(['findmnt', '--json', '--output', 'SOURCE,FSTYPE,TARGET', '--target', str(destination)], text=True))['filesystems'][0]
        if not mount['source'].upper().startswith('D:') or mount['target'] != '/mnt/d':
            parser.error('default destination is not connected to the Windows D drive')
    stamp = datetime.now().astimezone().isoformat(timespec='seconds')
    revision = git('rev-parse', 'HEAD')
    common = Path(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
    canonical = common.parent if common.name == '.git' else common
    remote = f'{REPOSITORY}/blob/{revision}/'
    project = destination / 'fest-compass'
    bundle = project / args.label
    paths = list(DOCS)
    for sid, version, _, _ in SCREENS:
        paths.extend(f'docs/assets/SCR-FC-{sid}/wireframe-{version}.{ext}' for ext in ('svg', 'excalidraw'))
    for path in DOCS:
        for image_ref in re.findall(r'!\[[^\]]*\]\(([^)]+)\)', (ROOT / path).read_text()):
            image_path = (ROOT / path).parent.joinpath(unquote(image_ref.split('#')[0])).resolve()
            if image_path.is_relative_to(ROOT) and image_path.suffix.lower() in ('.svg', '.png', '.jpg', '.jpeg', '.webp'):
                paths.append(image_path.relative_to(ROOT).as_posix())
    paths = list(dict.fromkeys(paths))
    for path in paths:
        if not (ROOT / path).is_file():
            raise FileNotFoundError(ROOT / path)
    source_dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--', *paths], cwd=ROOT, text=True).strip())
    vendor = args.traceboard / 'tools/trace_lib/vendor/mermaid.min.js'
    if not vendor.is_file():
        raise FileNotFoundError(vendor)
    bundle.mkdir(parents=True, exist_ok=False)
    hashes = {}
    for path in paths:
        target = bundle / 'sources' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / path, target)
        digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        assert digest == hashlib.sha256(target.read_bytes()).hexdigest()
        hashes[path] = digest
    shutil.copy2(vendor, bundle / 'mermaid.min.js')
    doc_pages = {path: f'doc-{i:02}.html' for i, path in enumerate(DOCS, 1)}
    outside = []
    for path, title in DOCS.items():
        raw = (ROOT / path).read_text()
        body = re.sub(r'\A---\n.*?\n---\n', '', raw, count=1, flags=re.S)
        body = markdown.markdown(body, extensions=['tables', 'fenced_code', 'toc', 'sane_lists'])
        body = re.sub(r'<pre><code class="language-mermaid">(.*?)</code></pre>', r'<pre class="mermaid">\1</pre>', body, flags=re.S)
        def link(match):
            attr, value = match.group(1), html.unescape(match.group(2))
            parsed = urlsplit(value)
            if parsed.scheme or value.startswith('#'):
                return match.group(0)
            resolved = (ROOT / path).parent.joinpath(unquote(parsed.path)).resolve()
            if not resolved.is_relative_to(ROOT):
                outside.append({'document': path, 'link': value})
                return 'title="저장소 밖 자료라 이 사본에서 열 수 없습니다"' if attr == 'href' else match.group(0)
            relative = resolved.relative_to(ROOT).as_posix()
            target = doc_pages.get(relative)
            if not target:
                target = 'sources/' + quote(relative) if relative in paths else remote + quote(relative)
            if parsed.fragment:
                target += '#' + quote(parsed.fragment)
            return f'{attr}="{html.escape(target, quote=True)}"'
        body = re.sub(r'(href|src)="([^"]+)"', link, body)
        prefix = '<nav><a href="index.html">검토 시작</a><a href="sources/' + quote(path) + '">Markdown 사본</a></nav>'
        (bundle / doc_pages[path]).write_text(page(title, prefix + body, 'class="mermaid"' in body))
    cards = {'existing': [], 'new': [], 'states': []}
    for sid, version, title, group in SCREENS:
        source = f'docs/assets/SCR-FC-{sid}/wireframe-{version}.svg'
        svg = ET.fromstring((ROOT / source).read_text())
        sw, sh = map(float, (svg.attrib['width'], svg.attrib['height']))
        scene = json.loads((ROOT / source.replace('.svg', '.excalidraw')).read_text())
        frames = {e['id']: e for e in scene['elements'] if e['type'] == 'frame'}
        figures = []
        for clip in svg.findall('.//{http://www.w3.org/2000/svg}clipPath'):
            if clip.attrib['id'] not in frames:
                continue
            frame = frames[clip.attrib['id']]
            rect = clip.find('{http://www.w3.org/2000/svg}rect')
            x, y = map(float, re.search(r'translate\(([-\d.]+) ([-\d.]+)\)', rect.attrib['transform']).groups())
            w, h = float(rect.attrib['width']), float(rect.attrib['height'])
            style = f'width:{sw/w*100}%;height:{sh/h*100}%;left:{-x/w*100}%;top:{-y/h*100}%'
            name = html.escape(frame['name'])
            preview = f'<figure><figcaption>{name}</figcaption><div class="preview" style="aspect-ratio:{w}/{h};max-width:{w}px"><img src="sources/{source}" style="{style}" alt="{name}"></div></figure>'
            if w < 500:
                preview = '<details><summary>모바일 화면 펼치기</summary>' + preview + '</details>'
            figures.append(preview)
        filename = f'screen-{sid}-{version}.html'
        body = f'<nav><a href="index.html#{group}">검토 시작</a><a href="sources/{source}">전체 시안 열기</a></nav><h1>{title}</h1><p class="meta">SCR-FC-{sid} · {version} · 개발 전 설계</p>' + ''.join(figures)
        (bundle / filename).write_text(page(title, body))
        cards[group].append(f'<a class="card" href="{filename}"><strong>{title}</strong><br><span class="meta">SCR-FC-{sid} · {version}</span></a>')
    first_doc = doc_pages['docs/ops/repository-consolidation.md']
    body = f'<p class="meta">FEST Compass · {stamp[:10]}</p><h1>축제 기획 기능·화면 검토</h1><p>통합 결과에서 현재 구현과 검증 상태를 먼저 확인하세요. 기능 상세에는 두 목적의 화면 목표·행동·데이터 연결을 정리했습니다.</p><p>아래 와이어프레임은 개발 전 기본 배치입니다. 정상 상태 v5·v6와 부족한 자료·오류 상태 v7을 함께 읽을 수 있습니다. 최종 시각 디자인은 별도 작업이며 각 화면에서 모바일 구성을 펼쳐 볼 수 있습니다.</p><nav><a href="{first_doc}">통합·구현 결과부터 읽기</a><a href="#existing">기존 축제</a><a href="#new">새 축제</a><a href="#states">부족한 자료·복구</a><a href="#documents">설계 문서</a></nav>'
    for group, title in [('existing', '기존 축제 개선 · 정상 상태 참고'), ('new', '새 축제 기획 · 정상 상태 참고'), ('states', '부족한 자료와 조회 실패 · 기본 배치')]:
        body += f'<section id="{group}"><h2>{title}</h2><div class="grid">' + ''.join(cards[group]) + '</div></section>'
    body += '<section id="documents"><h2>설계 문서</h2><div class="grid">' + ''.join(f'<a class="card" href="{doc_pages[p]}">{html.escape(title)}</a>' for p, title in DOCS.items()) + '</div></section>'
    checkout = f'<br>내보낸 작업 위치: {html.escape(str(ROOT))}' if ROOT != canonical else ''
    body += f'<details><summary>원본과 확인용 사본</summary><p>프로젝트 원본은 저장소에 유지됩니다. 이 폴더는 확인용 사본이며, 문서의 추가 근거 링크는 해당 시점의 저장소 원본으로 열립니다.</p><p class="source-path">원본: {html.escape(str(canonical))}{checkout}<br>저장소: {REPOSITORY}<br>기준 커밋: {revision}<br>선택 자료의 미커밋 변경: {"있음" if source_dirty else "없음"}<br>복사 시각: {stamp}</p><a href="manifest.json">복사 파일 목록·원본 해시</a></details>'
    (bundle / 'index.html').write_text(page('화면 검토', body))
    manifest = {'project': 'fest-compass', 'copied_at': stamp, 'source_repository': REPOSITORY, 'source_root': str(canonical), 'source_checkout': str(ROOT), 'source_revision': revision, 'source_dirty': source_dirty, 'source_files_sha256': hashes, 'links_outside_project': outside, 'mermaid_sha256': hashlib.sha256(vendor.read_bytes()).hexdigest(), 'source_of_truth': 'project repository; review copies are not edited sources'}
    (bundle / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    landing = project / 'index.html'
    landing_hash = project / '.review-index.sha256'
    content = MARKER + page('최신 검토 자료', f'<h1>FEST Compass 검토 자료</h1><p>{stamp[:10]} · 두 목적의 기능 상세·화면 목표·기본 배치</p><a class="button" href="{quote(args.label)}/index.html">최신 기능·설계 문서 열기</a>')
    if landing.exists() and (not landing_hash.exists() or hashlib.sha256(landing.read_bytes()).hexdigest() != landing_hash.read_text().strip()):
        print('Existing user index preserved:', landing)
        suffix = ''
        number = 1
        while True:
            landing = project / f'index-{args.label}{suffix}.html'
            try:
                with landing.open('x') as output:
                    output.write(content)
                break
            except FileExistsError:
                number += 1
                suffix = f'-{number}'
    else:
        landing.write_text(content)
    if landing.name == 'index.html':
        landing_hash.write_text(hashlib.sha256(landing.read_bytes()).hexdigest() + '\n')
    print(json.dumps({'bundle': str(bundle), 'start': str(landing), 'source_files': len(hashes), 'screen_pages': len(SCREENS), 'document_pages': len(DOCS)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
