#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사이트 페이지를 파일 하나로 합친다(CSS·JS·데이터 인라인).
채팅에서 내려받아 더블클릭으로 열어 보기 위한 것. 서버 없이 동작한다."""
# 구형 포장기는 원장 기반 카드·문항 전체를 HTML에 삽입하고 새 검수 정책은 누락한다.
raise SystemExit(
    "중단: pack_standalone.py는 미검수 데이터가 포함될 수 있는 구형 단일파일 포장기입니다. "
    "검수 정책을 반영한 내보내기가 마련되기 전까지 사용하지 않습니다. tools/README.md를 확인하세요."
)

import json, os, re

OUT = os.environ.get("PPM_OUT", "/home/claude/procurement")
DST = os.environ.get("PPM_PACK", "/mnt/user-data/outputs/미리보기")

NAME = {
    "index.html":        "학습방.html",
    "plan/index.html":   "학습계획.html",
    "c/index.html":      "익히기_목차.html",
    "c/W3.1.4/index.html": "익히기_계약종결.html",
    "c/W1.5.2/index.html": "익히기_공공계약법령.html",
    "c/P.4.1/index.html":  "익히기_실기_계약일반관리.html",
    "drill/index.html":  "외우기.html",
    "cbt/index.html":    "모의시험.html",
    "exam/index.html":   "시험정보.html",
    "news/index.html":   "소식자료.html",
    "about/index.html":  "소개.html",
    "privacy/index.html": "개인정보처리방침.html",
    "terms/index.html":   "이용약관.html",
    "future/index.html":  "자격의앞날.html",
    "links/index.html":   "바로가기.html",
    "errata/index.html":  "교재대조표.html",
}
EMBED_SUBJ = ["law", "plan", "contract"]     # 필기 3과목


def read(p):
    return open(os.path.join(OUT, p), encoding="utf-8").read()


def inline_assets(s, depth):
    up = "../" * depth
    for css in ("site.css", "study.css"):
        tag = '<link rel="stylesheet" href="%sassets/%s"/>' % (up, css)
        if tag in s:
            s = s.replace(tag, "<style>\n%s\n</style>" % read("assets/" + css))
    for js in ("site.js", "study.js", "quiz.js", "cards.js", "report.js"):
        tag = '<script src="%sassets/%s"></script>' % (up, js)
        if tag in s:
            s = s.replace(tag, "<script>\n%s\n</script>" % read("assets/" + js))
    return s


ROOTMAP = {
    "": "학습방.html", "index.html": "학습방.html",
    "plan": "학습계획.html", "drill": "외우기.html", "cbt": "모의시험.html",
    "exam": "시험정보.html", "news": "소식자료.html", "about": "소개.html",
    "privacy": "개인정보처리방침.html", "terms": "이용약관.html",
    "future": "자격의앞날.html", "links": "바로가기.html", "errata": "교재대조표.html", "card": "외우기.html",
}


def map_target(src, href):
    """src(사이트 기준 경로)에서 본 상대 href → 합친 파일 이름. 못 맞추면 None."""
    if href.startswith(("http", "mailto:", "javascript:", "#")):
        return None
    if "'" in href or "+" in href:        # 자바스크립트 문자열 조립
        return None
    cut = len(href)
    for ch in "#?":
        i = href.find(ch)
        if i >= 0:
            cut = min(cut, i)
    path, suffix = href[:cut], href[cut:]
    if not path:
        return None
    full = os.path.normpath(os.path.join(os.path.dirname(src), path))
    if full == ".":
        full = ""
    if full.startswith(("assets", "data")) or full.startswith(".."):
        return None
    if full.endswith("/index.html"):
        full = full[: -len("/index.html")]
    if full in ROOTMAP:
        return ROOTMAP[full] + suffix
    if full == "c" or full.startswith("c/"):
        return "익히기_목차.html" + suffix
    return None


def fix_links(s, src):
    def sub(m):
        t = map_target(src, m.group(1))
        return 'href="%s"' % t if t else m.group(0)
    return re.sub(r'href="([^"]*)"', sub, s)


def embed_data(s):
    """외우기·모의시험이 fetch 없이 돌게 데이터를 넣는다."""
    quiz = {k: json.load(open(os.path.join(OUT, "data", "quiz.%s.json" % k), encoding="utf-8"))
            for k in EMBED_SUBJ}
    cards = {k: json.load(open(os.path.join(OUT, "data", "cards.%s.json" % k), encoding="utf-8"))
             for k in EMBED_SUBJ}
    s = s.replace(
        'return fetch("../data/quiz." + slug + ".json").then(function (r) { return r.json(); })',
        'return Promise.resolve(window.__PPM_QUIZ__[slug] || {n:0,items:[]})')
    s = s.replace(
        'return fetch("../data/cards." + slug + ".json").then(function (r) { return r.json(); })',
        'return Promise.resolve(window.__PPM_CARDS__[slug] || {n:0,cards:[]})')
    s = s.replace('    { s: "공공조달 관리실무", slug: "practice", exam: "실기", n: 0 }\n', '')
    s = s.replace('{ s: "공공계약관리", slug: "contract", exam: "필기", n: 30 },\n', '{ s: "공공계약관리", slug: "contract", exam: "필기", n: 30 }\n')
    inject = """
<script>
/* 단독 파일용: 데이터를 내려받지 않고 파일 안에서 읽는다. 필기 3과목만 들어 있다. */
window.__PPM_QUIZ__ = %s;
window.__PPM_CARDS__ = %s;
</script>
""" % (json.dumps(quiz, ensure_ascii=False), json.dumps(cards, ensure_ascii=False))
    return s.replace("</head>", inject + "</head>", 1)


def main():
    os.makedirs(DST, exist_ok=True)
    made = []
    for src, name in NAME.items():
        if not os.path.exists(os.path.join(OUT, src)):
            print("  (없음) %s" % src)
            continue
        depth = src.count("/")
        s = read(src)
        s = inline_assets(s, depth)
        s = fix_links(s, src)
        if src in ("drill/index.html", "cbt/index.html"):
            s = embed_data(s)
            s = s.replace("</h1>", "</h1><p class=\"note\">이 파일은 미리보기용 단독 판입니다. 필기 3과목만 들어 있고, 실기 실무는 사이트에서 볼 수 있습니다.</p>", 1)
        p = os.path.join(DST, name)
        open(p, "w", encoding="utf-8").write(s)
        made.append((name, len(s.encode("utf-8"))))
        print("  %-34s %8.1f KB" % (name, len(s.encode("utf-8")) / 1024))
    return made


if __name__ == "__main__":
    main()
