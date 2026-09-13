#!/usr/bin/env python3
"""Apply the common accessible shell and search metadata to generated pages."""
from pathlib import Path
from html import escape, unescape
import re

ROOT = Path(__file__).resolve().parents[1]

def finalize(root=ROOT):
    root = Path(root)
    urls = []
    for path in sorted(root.rglob('*.html'), key=lambda p: p.relative_to(root).as_posix()):
        if any(part.startswith('.') or part in ('node_modules', 'tests', 'tools') for part in path.relative_to(root).parts):
            continue
        text = path.read_text(encoding='utf-8')
        if 'http-equiv="refresh"' in text:
            continue
        rel = path.relative_to(root)
        route = rel.as_posix().removesuffix('index.html')
        up = '../' * (len(rel.parts) - 1)
        canonical = 'https://jodal.pro/' + route
        text = re.sub(r'<link rel="canonical"[^>]*>\s*', '', text)
        text = re.sub(r'<meta property="og:[^"]*"[^>]*>\s*', '', text)
        title = re.search(r'<title>(.*?)</title>', text, re.S)
        desc = re.search(r'<meta name="description" content="([^"]*)"', text)
        meta = '<link rel="canonical" href="' + canonical + '"/>\n'
        for key, value in [('type', 'website'), ('locale', 'ko_KR'), ('site_name', '조달프로'), ('url', canonical), ('title', unescape(title[1]) if title else '조달프로'), ('description', unescape(desc[1]) if desc else '')]:
            meta += '<meta property="og:' + key + '" content="' + escape(value, quote=True) + '"/>\n'
        text = text.replace('</head>', meta + '</head>')
        text = re.sub(r'<script src="(?:\.\./)*assets/site\.js"></script>\s*', '', text)
        text = text.replace('</body>', '<script src="' + up + 'assets/site.js"></script>\n</body>')
        if 'class="skip-link"' not in text:
            text = text.replace('<body>', '<body>\n<a class="skip-link" href="#main-content">본문 바로가기</a>')
        text = re.sub(r'<main(?![^>]*\bid=)', '<main id="main-content" tabindex="-1"', text, count=1)
        text = text.replace('class="logo" href=""', 'class="logo" href="./"').replace('<a href="">학습방', '<a href="./">학습방')
        if text != path.read_text(encoding='utf-8'):
            path.write_text(text, encoding='utf-8')
        if path.name == 'index.html':
            urls.append(canonical)
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += ''.join('  <url><loc>' + escape(url) + '</loc></url>\n' for url in urls)
    (root / 'sitemap.xml').write_text(sitemap + '</urlset>\n', encoding='utf-8')
    (root / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://jodal.pro/sitemap.xml\n', encoding='utf-8')
    print(f'Common shell and sitemap: {len(urls)} pages')

if __name__ == '__main__':
    finalize()
