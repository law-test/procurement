#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""바로가기 — 공식 사이트와 수험 자원을 한 화면에."""
import json, os, importlib.util, datetime

OUT = os.environ.get("PPM_OUT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("bp", os.path.join(OUT, "tools", "build_pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
e = bp.e

CHECK = {
    1: ("열어서 확인", "ok"),
    2: ("주소만 확인", "mid"),
    3: ("검색으로만 확인", "low"),
}
REV = "2026-09-13"

# 원서접수 마감 안내에 쓰는 날짜
APPLY_OPEN = datetime.date(2026, 9, 14)
APPLY_CLOSE = datetime.date(2026, 9, 17)
EXAM_DAY = datetime.date(2026, 10, 3)


def item_html(it):
    label, cls = CHECK[it.get("v", 2)]
    o = ['<li class="lk%s">' % (" lk-hot" if it.get("hot") else "")]
    o.append('<a class="lk-a" href="%s" rel="noopener" target="_blank">%s</a>' % (e(it["u"]), e(it["n"])))
    o.append('<span class="lk-meta"><span class="lk-fee">%s</span>'
             '<span class="lk-v lk-%s" title="%s">%s</span></span>'
             % (e(it.get("t", "")), cls, e(label), e(label)))
    o.append('<span class="lk-d">%s</span>' % e(it["d"]))
    o.append('<span class="lk-u">%s</span>' % e(it["u"].split("//")[-1].split("/")[0]))
    o.append("</li>")
    return "".join(o)


def group_html(g):
    o = ['<section class="lk-g" id="%s">' % e(g["id"])]
    o.append("<h2>%s <span class=\"lk-n\">%d</span></h2>" % (e(g["title"]), len(g["items"])))
    if g.get("lede"):
        o.append('<p class="lede">%s</p>' % e(g["lede"]))
    o.append('<ul class="lk-list">')
    o += [item_html(i) for i in g["items"]]
    o.append("</ul></section>")
    return "".join(o)


def main():
    d = json.load(open(os.path.join(OUT, "tools", "links.json"), encoding="utf-8"))
    total = sum(len(g["items"]) for g in d["groups"])
    o = [bp.head("바로가기 — 조달프로",
                 "공공조달관리사 시험·학습·법령·조달시스템 관련 사이트 %d곳. 모두 직접 확인하고 확인 방식을 함께 표시했습니다." % total,
                 1)]
    o.append('<main class="wrap">')
    o.append("<h1>바로가기</h1>")
    o.append('<p class="lede">공공조달관리사와 조달 실무에 쓰는 사이트 <b>%d곳</b>입니다. '
             '주소를 짐작해서 적지 않았습니다. 직접 열어 확인한 것, 주소만 확인한 것, 검색으로만 확인한 것을 '
             '링크마다 표시했습니다.</p>' % total)

    # 지금 해야 할 것
    o.append('<div class="lk-urgent">')
    o.append("<h2>지금 해야 할 것</h2>")
    o.append('<ol class="lk-do">')
    o.append('<li><b>필기 원서접수</b> — 2026년 9월 14일(월) 10:00 ~ 9월 17일(목) 18:00. '
             '큐넷 회원가입이 필요하니 접수 전에 먼저 만들어 두세요. '
             '<a href="https://www.q-net.or.kr" rel="noopener" target="_blank">Q-Net →</a></li>')
    o.append('<li><b>표준교재 4권 내려받기</b> — 무료입니다. 유료 교재를 사기 전에 이것부터 보세요. '
             '<a href="#free">아래 목록 →</a></li>')
    o.append('<li><b>공식 예제문제 6문항</b> — 시행기관이 낸 유일한 공식 문제입니다. '
             '<a href="#exam">아래 목록 →</a></li>')
    o.append('<li><b>정오표 확인</b> — 표준교재의 숫자가 고쳐진 곳이 있습니다. 고쳐지기 전 숫자를 외우면 그대로 틀립니다. '
             '<a href="#errata">아래 목록 →</a></li>')
    o.append("</ol></div>")

    # 일정
    o.append("<h2>제1회 일정</h2>")
    o.append('<div class="tablewrap"><table><thead><tr><th>구분</th><th>일정</th><th>비고</th></tr></thead><tbody>'
             "<tr><td>필기 원서접수</td><td><b>2026-09-14(월) 10:00 ~ 09-17(목) 18:00</b></td><td>큐넷 회원가입 필요</td></tr>"
             "<tr><td>필기시험</td><td><b>2026-10-03(토)</b></td><td>CBT 객관식 80문항 · 2시간</td></tr>"
             "<tr><td>필기 합격발표</td><td>2026-10-12(월) 09:00</td><td></td></tr>"
             "<tr><td>실기 원서접수</td><td>2026-10-12(월) 10:00 ~ 10-15(목) 18:00</td><td></td></tr>"
             "<tr><td>실기시험</td><td><b>2026-11-14(토)</b></td><td>필답형 · 2시간 30분</td></tr>"
             "<tr><td>최종 합격발표</td><td>2026-12-18(금) 09:00</td><td></td></tr>"
             "<tr><td>제2회 필기</td><td>2026년 11월 중 예정</td><td>확정 공고 확인 필요</td></tr>"
             "</tbody></table></div>")
    o.append('<p class="note">합격기준은 필기 과목당 40점 이상·평균 60점 이상, 실기 60점 이상입니다. '
             '응시자격에 나이·학력·경력 제한이 없습니다. '
             '일정은 큐넷 시행계획 공고가 기준이며, 바뀌면 공고를 따르십시오.</p>')

    o.append('<nav class="lk-jump">')
    for g in d["groups"]:
        o.append('<a href="#%s">%s</a>' % (e(g["id"]), e(g["title"].split(" —")[0])))
    o.append("</nav>")

    for g in d["groups"]:
        o.append(group_html(g))

    o.append('<section class="lk-warn"><h2>조심할 것</h2>')
    o.append("<p><b>지금 '기출문제'를 파는 곳은 기출이 없습니다.</b> "
             "제1회 필기시험이 2026년 10월 3일입니다. 그 전에 '최근 3개년 기출', '빈출문제 복원본'을 내세운 자료는 "
             "있을 수 없는 것을 파는 것입니다. 실제로 그런 제목을 붙인 페이지가 몇 군데 있습니다. "
             "지금 존재하는 모든 문제는 표준교재와 출제기준에서 만든 예상문제입니다. 이 사이트의 문제도 그렇습니다.</p>")
    o.append("<p><b>'공인'이나 '국가공인'을 앞세운 조달 자격은 다른 것입니다.</b> "
             "「자격기본법」에서 '공인'은 민간자격을 국가가 인정하는 행위를 뜻합니다. "
             "공공조달관리사는 국가기술자격이므로 이름에 '공인'이 붙지 않습니다. "
             '<a href="../future/#공인이라는-말에-대하여">자세히 →</a></p>')
    o.append("<p><b>표준교재는 조달청이 배포하는 것 하나뿐입니다.</b> "
             "조달청 공지에 \"조달청에서 배포하는 표준교재는 해당 교재가 유일하며, 타 교재는 조달청 및 "
             "공공조달역량개발원과 무관\"하다고 적혀 있습니다. 시판 교재는 그것을 다시 엮은 것입니다.</p>")
    o.append("</section>")

    o.append('<p class="note">확인 기준일 %s. 사이트가 주소를 바꾸거나 문을 닫으면 아래 오류 신고로 알려 주세요. '
             '빠진 곳을 알려 주셔도 넣겠습니다.</p>' % REV)
    o.append("</main>")
    o.append(bp.foot(1))
    p = os.path.join(OUT, "links", "index.html")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = "".join(o)
    open(p, "w", encoding="utf-8").write(s)
    print("  links/index.html  %.1f KB · 링크 %d개 · 묶음 %d개" % (len(s.encode()) / 1024, total, len(d["groups"])))


if __name__ == "__main__":
    main()

    from finalize_site import finalize
    finalize(OUT)
