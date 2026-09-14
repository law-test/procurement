#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
출제기준별 교재 생성기.

입력  : atoms_v005.json (atom 원장 추출본), criteria273.json (공식 출제기준 273항목)
출력  : c/index.html                 출제기준 트리
        c/<세부항목ID>/index.html    교재 본문(세세항목별 절 + atom)
        card/index.html              암기카드(빈칸·회상)
        data/cards.<과목슬러그>.json 카드 데이터

원칙 : 원장(xlsx)에서 단방향으로만 생성한다. 생성물을 직접 편집하지 않는다.
"""
import json, os, re, html, collections, sys

BUILD = os.environ.get("PPM_BUILD", "/home/claude/build")
OUT = os.environ.get("PPM_OUT", "/home/claude/procurement")

SUBJ_SLUG = {
    "공공조달과 법제도 이해": "law",
    "공공조달계획 수립 및 분석": "plan",
    "공공계약관리": "contract",
    "공공조달 관리실무": "practice",
}
SUBJ_ORDER = ["공공조달과 법제도 이해", "공공조달계획 수립 및 분석", "공공계약관리", "공공조달 관리실무"]
SUBJ_SHORT = {
    "공공조달과 법제도 이해": "법제도",
    "공공조달계획 수립 및 분석": "계획분석",
    "공공계약관리": "계약관리",
    "공공조달 관리실무": "실기 실무",
}
TYPE_ORDER = {"개념": 0, "구별": 1, "수치": 2, "절차": 3, "예외": 4, "계산": 5}


def e(s):
    return html.escape(s or "", quote=True)


def norm_label(s):
    """'2. 조달요구 응대 및제안' 처럼 띄어쓰기만 다른 항목명을 한 형태로 모은다."""
    return re.sub(r"\s+", "", s or "")


def group_id(cid):
    return ".".join(cid.split(".")[:-1])


def load():
    crit = json.load(open(os.path.join(BUILD, "criteria273.json"), encoding="utf-8"))
    atoms = json.load(open(os.path.join(BUILD, "atoms_v005.json"), encoding="utf-8"))
    link = collections.defaultdict(list)
    for a in atoms:
        for i in re.split(r"[,\s/;]+", a.get("연결 기준 ID", "")):
            i = i.strip()
            if i:
                link[i].append(a)
    for k in link:
        link[k].sort(key=lambda a: (TYPE_ORDER.get(a.get("유형", ""), 9), a.get("atom ID", "")))
    return crit, atoms, link


def build_tree(crit, link):
    """과목 → 주요항목 → 세부항목(페이지) → 세세항목(절)"""
    pages = collections.OrderedDict()
    for c in crit:
        g = group_id(c["id"])
        p = pages.setdefault(g, {
            "gid": g, "exam": c["exam"], "subject": c["subject"],
            "major": c["major"], "minor": c["minor"], "items": [],
        })
        # 같은 그룹 안에서 항목명 표기가 흔들리면 첫 표기를 쓴다
        p["items"].append(c)
    for p in pages.values():
        p["n_atom"] = sum(len(link[c["id"]]) for c in p["items"])
    subjects = collections.OrderedDict()
    for p in pages.values():
        s = subjects.setdefault(p["subject"], collections.OrderedDict())
        mk = norm_label(p["major"])
        m = s.setdefault(mk, {"label": p["major"], "pages": []})
        m["pages"].append(p)
    return pages, subjects


# ---------------------------------------------------------------- HTML 조각

def head(title, desc, depth, extra_css=""):
    up = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}"/>
<meta name="theme-color" content="#0f5f7a"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"/>
<link rel="stylesheet" href="{up}assets/site.css"/>
<link rel="stylesheet" href="{up}assets/study.css"/>
{extra_css}</head>
<body>
<header>
  <div class="wrap hrow">
    <a class="logo" href="{up}">조달프로<small>공공조달관리사 수험·실무</small></a>
    <nav class="menu">
      <a href="{up}">학습방</a>
      <a href="{up}plan/">학습계획</a>
      <a href="{up}c/">익히기</a>
      <a href="{up}drill/">외우기</a>
      <a href="{up}cbt/">모의시험</a>
      <a href="{up}exam/">시험정보</a>
      <a href="{up}future/">앞날</a>
      <a href="{up}errata/">교재대조</a>
      <a href="{up}links/">바로가기</a>
      <a href="{up}news/">소식·자료</a>
    </nav>
  </div>
</header>
"""


def foot(depth=0):
    u = "../" * depth
    return """<footer>
  <div class="wrap foot-grid">
    <div class="foot-col foot-brand">
      <div class="foot-logo">조달프로</div>
      <p>2026년 신설 국가자격 <b>공공조달관리사</b>를 준비하는 곳입니다.
         출제기준 273개 항목을 개념으로 정리하고, 문제로 묻고, 모의시험으로 점검합니다.</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">공부</div>
      <a href="{u}plan/">학습계획</a>
      <a href="{u}c/">익히기</a>
      <a href="{u}errata/">교재 대조표</a>
      <a href="{u}drill/">외우기</a>
      <a href="{u}cbt/">모의시험</a>
    </div>
    <div class="foot-col">
      <div class="foot-h">정보</div>
      <a href="{u}exam/">시험·접수</a>
      <a href="{u}future/">자격의 앞날</a>
      <a href="{u}links/">바로가기</a>
      <a href="{u}news/">소식·자료</a>
      <a href="{u}about/">소개</a>
    </div>
    <div class="foot-col">
      <div class="foot-h">운영</div>
      <a href="{u}news/#contact">문의·오류 신고</a>
      <a href="{u}privacy/">개인정보 처리방침</a>
      <a href="{u}terms/">이용약관</a>
    </div>
    <div class="foot-col">
      <div class="foot-h">공식 출처</div>
      <a href="https://www.q-net.or.kr" rel="noopener">Q-Net 시험정보</a>
      <a href="https://pps.go.kr" rel="noopener">조달청</a>
      <a href="https://www.law.go.kr" rel="noopener">국가법령정보센터</a>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <span>조달프로 · jodal.pro</span>
    <span>시험 일정과 출제기준은 시행기관 공고가 기준입니다.</span>
    <span><a class="foot-report" href="{u}news/#contact">이 페이지 오류 신고</a></span>
    <span>© 2026 조달프로</span>
  </div>
</footer>
<script src="{u}assets/report.js"></script>
</body>
</html>
""".replace("{u}", u)


FOOT = foot(0)


def sidebar(subjects, subject, cur_gid, depth):
    up = "../" * depth
    out = ['<aside class="side"><div class="side-in">']
    out.append(f'<div class="side-h">{e(SUBJ_SHORT.get(subject, subject))}</div>')
    for mk, m in subjects[subject].items():
        out.append(f'<div class="side-maj">{e(m["label"])}</div><ul class="side-list">')
        for p in m["pages"]:
            cls = ' class="on"' if p["gid"] == cur_gid else ""
            out.append(
                f'<li><a href="{up}c/{p["gid"]}/"{cls}>{e(p["minor"])}'
                f'<span class="side-n">{p["n_atom"]}</span></a></li>'
            )
        out.append("</ul>")
    out.append('<div class="side-h2">다른 과목</div><ul class="side-list">')
    for s in SUBJ_ORDER:
        if s == subject or s not in subjects:
            continue
        first = list(subjects[s].values())[0]["pages"][0]["gid"]
        out.append(f'<li><a href="{up}c/{first}/">{e(SUBJ_SHORT.get(s, s))}</a></li>')
    out.append("</ul></div></aside>")
    return "".join(out)


# ------------------------------------------------- 근거 조문을 법령 원문으로 연결

LAW_FULL = {
    "국가계약법": "국가를 당사자로 하는 계약에 관한 법률",
    "지방계약법": "지방자치단체를 당사자로 하는 계약에 관한 법률",
    "판로지원법": "중소기업제품 구매촉진 및 판로지원에 관한 법률",
    "중소기업제품 구매촉진 및 판로지원에 관한 법률": "중소기업제품 구매촉진 및 판로지원에 관한 법률",
    "전자조달법": "전자조달의 이용 및 촉진에 관한 법률",
    "전자조달의 이용 및 촉진에 관한 법률": "전자조달의 이용 및 촉진에 관한 법률",
    "조달사업법": "조달사업에 관한 법률",
    "조달사업에 관한 법률": "조달사업에 관한 법률",
    "국가를 당사자로 하는 계약에 관한 법률": "국가를 당사자로 하는 계약에 관한 법률",
    "지방자치단체를 당사자로 하는 계약에 관한 법률": "지방자치단체를 당사자로 하는 계약에 관한 법률",
    "클라우드컴퓨팅법": "클라우드컴퓨팅 발전 및 이용자 보호에 관한 법률",
    "클라우드컴퓨팅 발전 및 이용자 보호에 관한 법률": "클라우드컴퓨팅 발전 및 이용자 보호에 관한 법률",
    "건설산업기본법": "건설산업기본법",
    "건설기술 진흥법": "건설기술 진흥법",
    "행정기본법": "행정기본법",
    "국가재정법": "국가재정법",
    "형법": "형법",
    "소프트웨어진흥법": "소프트웨어 진흥법",
    "소프트웨어 진흥법": "소프트웨어 진흥법",
    "공공기관의 운영에 관한 법률": "공공기관의 운영에 관한 법률",
    "정부조직법": "정부조직법",
    "물품관리법": "물품관리법",
    "국가를 당사자로 하는 계약에 관한 법률 시행령": "국가를 당사자로 하는 계약에 관한 법률 시행령",
}
_LAWKEY = "|".join(sorted((re.escape(k) for k in LAW_FULL), key=len, reverse=True))
SRC_RE = re.compile(
    r"(?:「(?P<b>[^」]{2,40})」|(?P<p>" + _LAWKEY + r"))"
    r"\s*(?P<sub>시행령|시행규칙)?"
    r"\s*(?P<jo>제\s?\d+조(?:의\d+)?)"
)


def law_link(text):
    """'국가계약법 시행령 제26조' 같은 표기를 국가법령정보센터 조문으로 연결한다.
    법령은 저작물이 아니어서 원문을 그대로 보여줄 수 있고, 링크로 두면 개정돼도 최신이 나온다."""
    if not text:
        return ""
    out, last = [], 0
    for m in SRC_RE.finditer(text):
        short = m.group("b") or m.group("p") or ""
        full = LAW_FULL.get(short.strip())
        if not full:
            continue
        sub = m.group("sub") or ""
        jo = re.sub(r"\s+", "", m.group("jo"))
        name = (full + (" " + sub if sub else "")).replace(" ", "")
        url = "https://www.law.go.kr/법령/%s/%s" % (name, jo)
        out.append(e(text[last:m.start()]))
        out.append('<a class="src-lk" href="%s" rel="noopener" target="_blank" title="%s">%s</a>'
                   % (e(url), "국가법령정보센터에서 원문 보기", e(text[m.start():m.end()])))
        last = m.end()
    out.append(e(text[last:]))
    return "".join(out)


def atom_block(a, n):
    """atom 하나를 교재의 개념 블록으로."""
    aid = a.get("atom ID", "")
    idea = a.get("핵심 아이디어", "")
    body = a.get("핵심 원리", "")
    cond = a.get("적용조건·예외", "")
    conf = a.get("혼동하기 쉬운 점", "")
    src = a.get("근거", "")
    srck = a.get("근거구분", "")
    typ = a.get("유형", "")
    imp = a.get("중요도", "")
    o = [f'<article class="atom" id="{e(aid)}" data-atom="{e(aid)}">']
    o.append('<h4 class="atom-h"><span class="atom-n">%d</span>%s' % (n, e(idea)))
    o.append(f'<span class="b b-{TYPE_ORDER.get(typ, 9)}">{e(typ)}</span>')
    if imp == "높음":
        o.append('<span class="b b-imp">중요</span>')
    o.append("</h4>")
    o.append(f'<p class="atom-body" data-drill="{e(body)}">{e(body)}</p>')
    if cond and cond not in ("없음", "-"):
        o.append(f'<div class="atom-cond"><b>조건·예외</b> {e(cond)}</div>')
    if conf and conf not in ("없음", "-"):
        o.append(f'<div class="atom-conf"><b>혼동</b> {e(conf)}</div>')
    if src:
        o.append(f'<div class="atom-src">{law_link(src)}{" · " + e(srck) if srck else ""}</div>')
    o.append("</article>")
    return "".join(o)


# ------------------------------------------------- 주요항목 배경 설명

def load_intro():
    """주요항목별 배경 설명. 표기 흔들림을 무시하고 맞춘다."""
    fp = os.path.join(BUILD, "major_intro.json")
    if not os.path.exists(fp):
        return {}
    out = {}
    for x in json.load(open(fp, encoding="utf-8")):
        out[(norm_label(x["subject"]), norm_label(x["major"]))] = x
    return out


INTRO = load_intro()


def intro_block(subject, major):
    x = INTRO.get((norm_label(subject), norm_label(major)))
    if not x:
        return ""
    o = ['<details class="intro" open>']
    o.append('<summary><b>이 항목의 배경</b><span class="intro-m">%s</span></summary>' % e(major))
    o.append('<div class="intro-b">')
    o.append('<div class="intro-p"><span class="intro-h">무엇을 다루는가</span>%s</div>' % law_link(x["covers"]))
    o.append('<div class="intro-p"><span class="intro-h">왜 이렇게 되어 있는가</span>%s</div>' % law_link(x["why"]))
    o.append('<div class="intro-p"><span class="intro-h">시험에서 갈리는 자리</span>%s</div>' % law_link(x["split"]))
    if x.get("pages"):
        o.append('<div class="intro-s">%s 대조 · 조달프로가 직접 쓴 글입니다</div>' % e(x["pages"]))
    o.append("</div></details>")
    return "".join(o)


def page_html(p, subjects, link, prev_p, next_p):
    subject, major, minor = p["subject"], p["major"], p["minor"]
    title = f"{minor} — {major} | 조달프로"
    desc = f"{subject} {major} {minor}. 출제기준 세세항목 {len(p['items'])}개, 개념 {p['n_atom']}개를 근거와 함께 정리했습니다."
    o = [head(title, desc, 2)]
    o.append('<div class="layout wrap">')
    o.append(sidebar(subjects, subject, p["gid"], 2))
    o.append('<main class="body">')
    o.append(
        f'<div class="crumb"><a href="../">교재</a> · {e(SUBJ_SHORT.get(subject, subject))} · {e(major)}</div>'
    )
    o.append(f"<h1>{e(minor)}</h1>")
    o.append(
        f'<p class="pg-meta">출제기준 세세항목 {len(p["items"])}개 · 개념 {p["n_atom"]}개'
        f' <span class="gid">{e(p["gid"])}</span></p>'
    )
    o.append(
        intro_block(subject, major)
    )
    # 필기는 CBT 객관식이므로 문장을 가려 외우는 것이 시험 방식과 맞지 않는다.
    # 필답형인 실기 교재에만 둔다.
    if p["exam"] == "실기":
        o.append(
            '<div class="drill-bar">'
            '<button class="btn" onclick="ppmDrillStart()">이 절 빈칸 암기</button>'
            '<label class="gauge-wrap">가리기 <input id="ppmGauge" type="range" min="0" max="100" step="10" value="0" oninput="ppmGauge(this.value)"/> '
            '<span id="ppmGaugeV">0</span>%</label>'
            '<span class="drill-why">실기는 필답형이라 손으로 쓰는 연습이 필요합니다.</span>'
            "</div>"
        )
    n = 0
    for c in p["items"]:
        atoms = link[c["id"]]
        o.append(f'<section class="sect"><h3 class="sect-h">{e(c["detail"])}'
                 f'<span class="sect-id">{e(c["id"])}</span></h3>')
        if not atoms:
            o.append('<p class="sect-empty">이 항목은 아직 정리 중입니다.</p>')
        for a in atoms:
            n += 1
            o.append(atom_block(a, n))
        o.append("</section>")
    o.append('<nav class="pager">')
    if prev_p:
        o.append(f'<a class="pg-prev" href="../{prev_p["gid"]}/">← {e(prev_p["minor"])}</a>')
    if next_p:
        o.append(f'<a class="pg-next" href="../{next_p["gid"]}/">{e(next_p["minor"])} →</a>')
    o.append("</nav>")
    o.append("</main></div>")
    o.append('<div id="ppmModal" class="modal" hidden></div>')
    o.append('<script src="../../assets/study.js"></script>')
    o.append(foot(2))
    return "".join(o)


def index_html(subjects, pages, total_atoms):
    o = [head("출제기준별 교재 — 조달프로",
              "공공조달관리사 출제기준 273개 항목을 개념 %d개로 정리한 교재. 과목·주요항목·세부항목 트리에서 찾아 보세요." % total_atoms,
              1)]
    o.append('<main class="wrap">')
    o.append("<h1>출제기준별 교재</h1>")
    o.append(
        f'<p class="lede">시험 범위는 출제기준이 정합니다. 공식 출제기준 <b>273개 세세항목</b>을 하나도 빼지 않고 '
        f'개념 <b>{total_atoms}개</b>로 채웠습니다. 각 개념에는 근거(법령 조문·표준교재 쪽)가 붙어 있습니다.</p>'
    )
    o.append('<p class="lede">실기는 필답형이라 손으로 쓰는 연습이 필요합니다. 개념마다 <b>빈칸 가리기</b>를 걸어 두었습니다. '
             '<a href="../card/">암기카드</a>에서 과목을 골라 연속으로 풀 수도 있습니다.</p>')
    for s in SUBJ_ORDER:
        if s not in subjects:
            continue
        n_page = sum(len(m["pages"]) for m in subjects[s].values())
        n_atom = sum(p["n_atom"] for m in subjects[s].values() for p in m["pages"])
        exam = subjects[s][list(subjects[s])[0]]["pages"][0]["exam"]
        o.append(f'<h2>{e(s)} <span class="h2-sub">{e(exam)} · 세부항목 {n_page}개 · 개념 {n_atom}개</span></h2>')
        for mk, m in subjects[s].items():
            o.append(f'<div class="maj">{e(m["label"])}</div><ul class="tree">')
            for p in m["pages"]:
                o.append(
                    f'<li><a href="{p["gid"]}/">{e(p["minor"])}</a>'
                    f'<span class="tree-n">{p["n_atom"]}</span>'
                    f'<span class="tree-d">{len(p["items"])}항목</span></li>'
                )
            o.append("</ul>")
    o.append("</main>")
    o.append(foot(1))
    return "".join(o)


def card_html(subjects):
    return ("<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"utf-8\"/>"
            "<meta http-equiv=\"refresh\" content=\"0; url=../drill/\"/>"
            "<link rel=\"canonical\" href=\"https://jodal.pro/drill/\"/>"
            "<title>외우기로 이동합니다</title></head><body>"
            "<p><a href=\"../drill/\">외우기로 이동합니다</a></p></body></html>")


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    crit, atoms, link = load()
    pages, subjects = build_tree(crit, link)
    total = sum(p["n_atom"] for p in pages.values())

    order = [p for s in SUBJ_ORDER if s in subjects
             for m in subjects[s].values() for p in m["pages"]]
    for i, p in enumerate(order):
        prev_p = order[i - 1] if i else None
        next_p = order[i + 1] if i + 1 < len(order) else None
        write(os.path.join(OUT, "c", p["gid"], "index.html"),
              page_html(p, subjects, link, prev_p, next_p))

    write(os.path.join(OUT, "c", "index.html"), index_html(subjects, pages, total))
    write(os.path.join(OUT, "card", "index.html"), card_html(subjects))

    # 카드 데이터 — 과목별 청크
    for s in SUBJ_ORDER:
        if s not in subjects:
            continue
        rows = []
        for mk, m in subjects[s].items():
            for p in m["pages"]:
                for c in p["items"]:
                    for a in link[c["id"]]:
                        rows.append({
                            "id": a.get("atom ID", ""),
                            "t": a.get("핵심 아이디어", ""),
                            "s": a.get("핵심 원리", ""),
                            "c": a.get("적용조건·예외", ""),
                            "x": a.get("혼동하기 쉬운 점", ""),
                            "r": a.get("근거", ""),
                            "y": a.get("유형", ""),
                            "i": a.get("중요도", ""),
                            "g": p["gid"],
                            "m": m["label"],
                            "d": c["detail"],
                        })
        seen, uniq = set(), []
        for r in rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            uniq.append(r)
        write(os.path.join(OUT, "data", "cards.%s.json" % SUBJ_SLUG[s]),
              json.dumps({"subject": s, "slug": SUBJ_SLUG[s], "n": len(uniq), "cards": uniq},
                         ensure_ascii=False))
        print("  %-22s 카드 %4d" % (s, len(uniq)))

    print("교재 페이지 %d개, 개념 %d개" % (len(order), total))


if __name__ == "__main__":
    main()
