# -*- coding: utf-8 -*-
"""data/theory.<gid>.json → c/<gid>/index.html 의 <main> 만 교체한다.
기존 머리말·메뉴·푸터·스크립트는 그대로 두므로 구형 생성기를 돌릴 필요가 없다."""
import io, json, re, html, sys

E = lambda s: html.escape(str(s or ''), quote=True)

def rich(t, ids):
    """*강조* 와 [[A0001]] 링크를 풀어 준다."""
    t = E(t)
    t = re.sub(r'\[\[(A\d{4})\]\]',
               lambda m: ('<a class="th-ref" href="#%s">%s</a>' % (m.group(1), m.group(1)))
               if m.group(1) in ids else m.group(1), t)
    t = re.sub(r'\*([^*\n]{1,60})\*', r'<em>\1</em>', t)
    return t

def build(gid):
    d = json.load(io.open('data/theory.%s.json' % gid, encoding='utf-8'))
    ids = {i['id'] for i in d['items']}
    o = []
    o.append('<main id="main-content" class="body theory">')
    o.append('<div class="crumb"><a href="../">이론</a> · %s · %s</div>'
             % (E(d['subject']), E(d['major'])))
    o.append('<h1>%s</h1>' % E(d['minor']))
    o.append('<p class="pg-meta">개념 %d개 <span class="gid">%s</span></p>'
             % (len(d['items']), E(gid)))

    ov = d['overview']
    o.append('<section class="th-ov">')
    o.append('<div class="th-ov-head"><span class="th-ov-tag">개관</span>'
             '<p class="th-lede">%s</p></div>' % rich(ov['lede'], ids))
    o.append('<p class="th-hint">본문의 <b>A0000</b> 표시를 누르면 그 항목으로 바로 이동합니다.</p>')
    for s in ov['sections']:
        o.append('<h2 class="th-h">%s</h2>' % E(s['h']))
        for para in [p for p in s['body'].split('\n\n') if p.strip()]:
            o.append('<p class="th-p">%s</p>' % rich(para.strip(), ids))
    o.append('</section>')

    cur = None
    for it in d['items']:
        if it.get('sub') != cur:
            cur = it.get('sub')
            o.append('<h3 class="sect-h">%s</h3>' % E(cur))
        st = 'verified' if it.get('basis_kind') == 'statute' else 'background'
        lab = '근거 확인' if st == 'verified' else '배경·보조학습'
        o.append('<article class="atom th-item" id="%s" data-atom="%s" data-review="%s">'
                 % (it['id'], it['id'], st))
        o.append('<div class="atom-meta"><span>%s</span>'
                 '<span class="atom-status status-%s">%s</span></div>' % (it['id'], st, lab))
        o.append('<h4 class="atom-h">%s</h4>' % E(it['t']))
        o.append('<p class="atom-question">%s</p>' % E(it['q']))
        o.append('<details class="atom-answer"><summary>배경·해설 보기</summary>')
        o.append('<div class="th-blk th-bg"><b>배경·이해</b><p>%s</p></div>'
                 % rich(it['background'], ids))
        if it.get('breakdown'):
            o.append('<div class="th-blk th-bd"><b>낱말분해</b><dl>%s</dl></div>'
                     % ''.join('<dt>%s</dt><dd>%s</dd>' % (E(b['k']), E(b['v']))
                               for b in it['breakdown']))
        if it.get('mnemonic'):
            o.append('<div class="th-blk th-mn"><b>외우기 고리</b><p>%s</p></div>'
                     % E(it['mnemonic']))
        if it.get('keywords'):
            o.append('<div class="th-blk th-kw"><b>핵심어</b><p>%s</p></div>'
                     % ''.join('<span class="th-tag">%s</span>' % E(k) for k in it['keywords']))
        if it.get('exam'):
            o.append('<div class="th-blk th-ex"><b>시험에 나오는 형태</b><ul>%s</ul></div>'
                     % ''.join('<li>%s</li>' % E(x) for x in it['exam']))
        if it.get('quote'):
            o.append('<div class="th-blk th-q"><b>조문</b><p>%s</p></div>' % E(it['quote']))
        src = E(it.get('r', ''))
        mst = (it.get('mst') or '').strip()
        if mst.isdigit():
            src = ('<a href="https://www.law.go.kr/lsInfoP.do?lsiSeq=%s" rel="noopener" '
                   'target="_blank">%s</a>' % (mst, src))
        eff = it.get('law_effective') or ''
        o.append('<div class="atom-src">%s%s</div>'
                 % (src, (' · 시행 %s' % E(eff)) if eff else ''))
        o.append('</details>')
        o.append('<button class="rep-btn" type="button" data-report="%s">오류 신고</button>' % it['id'])
        o.append('</article>')
    o.append('</main>')
    new = ''.join(o)

    p = 'c/%s/index.html' % gid
    s = io.open(p, encoding='utf-8').read()
    a = s.find('<main'); b = s.find('</main>')
    if a < 0 or b < 0:
        raise SystemExit('main 태그를 찾지 못했습니다: ' + p)
    s = s[:a] + new + s[b + 7:]
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('생성:', p, len(s), 'bytes ·', len(d['items']), '항목')

if __name__ == '__main__':
    for g in (sys.argv[1:] or ['W1.1.1']):
        build(g)
