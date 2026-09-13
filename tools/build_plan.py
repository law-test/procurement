#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""1주일 완성 × 3회독 학습계획 화면 생성기."""
import json, os, importlib.util

BUILD = os.environ.get("PPM_BUILD", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "_private", "build"))
OUT = os.environ.get("PPM_OUT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("bp", os.path.join(OUT, "tools", "build_pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)

SLUG = {"공공조달과 법제도 이해": "law", "공공조달계획 수립 및 분석": "plan", "공공계약관리": "contract"}

ROUNDS = [
    ("1회독", "훑기", "중요 개념을 훑고 객관식으로 핵심을 확인합니다. 전체 지도를 머리에 넣는 것이 목적입니다.",
     "익히기 페이지를 중요 표시된 개념만 읽기", "외우기 · 4지선다 · 중요만"),
    ("2회독", "붙이기", "같은 범위를 다시 돌면서 조건·예외와 헷갈리는 짝을 붙입니다. 가리기를 60%로 올리고 객관식을 풉니다.",
     "익히기 페이지에서 가리기 60% · 이 절 빈칸 암기", "외우기 · 세 방식 섞기 · 중요·중간"),
    ("3회독", "굳히기", "전체를 덮고 틀린 것만 남깁니다. 과목이 끝나는 날 그 과목 모의시험을 칩니다.",
     "익히기 페이지 전체 · 틀린 개념 위주", "외우기 · 직접회상 전부 + 과목별 모의시험"),
]


def day_block(i, day):
    n = sum(p["n"] for p in day)
    hi = sum(p["hi"] for p in day)
    mid = sum(p["mid"] for p in day)
    subs = []
    for p in day:
        if p["subject"] not in subs:
            subs.append(p["subject"])
    o = ['<section class="dayb" id="day%d">' % (i + 1)]
    o.append('<h3 class="dayb-h"><span class="dayb-n">Day %d</span>%s'
             '<span class="dayb-c">개념 %d · 중요 %d</span></h3>'
             % (i + 1, " + ".join(bp.e(s) for s in subs), n, hi))
    o.append('<div class="dayb-links">')
    for p in day:
        o.append('<a class="dayb-l" href="../c/%s/">%s<span class="side-n">%d</span></a>'
                 % (p["gid"], bp.e(p["minor"]), p["n"]))
    o.append("</div>")
    o.append('<div class="dayb-act">')
    for r, (label, _t, _d, _a, _b) in enumerate(ROUNDS):
        imp = ["높음", "높음중간", "all"][r]
        mode = ["quiz", "mix", "recall"][r]
        cnt = [20, 30, 40][r]
        slug = SLUG.get(day[0]["subject"], "law")
        groups = ",".join(p["gid"] for p in day)
        o.append('<label class="chk"><input type="checkbox" data-day="%d" data-round="%d"/> %s</label>'
                 % (i + 1, r + 1, label))
        o.append('<a class="btn ghost sm" href="../drill/?subject=%s&amp;mode=%s&amp;imp=%s&amp;n=%d&amp;groups=%s&amp;day=%d">%s 외우기</a>'
                 % (slug, mode, imp, cnt, groups, i + 1, label))
    o.append("</div></section>")
    return "".join(o)


def main():
    days = json.load(open(os.path.join(BUILD, "plan7.json"), encoding="utf-8"))
    total = sum(p["n"] for d in days for p in d)
    o = [bp.head("3주 3회독 학습계획 — 조달프로",
                 "공공조달관리사 필기 개념 %d개를 7일에 한 바퀴 돌고, 그 7일을 세 번 반복합니다. 회독마다 읽는 깊이와 묻는 방식이 달라집니다." % total,
                 1)]
    o.append('<main class="wrap">')
    o.append("<h1>7일씩, 3주 3회독</h1>")
    o.append('<p class="lede">필기 범위를 <b>7일에 한 바퀴</b> 돌립니다. 그 7일을 <b>세 번</b> 반복합니다. '
             '같은 범위를 세 번 보지만 회독마다 읽는 깊이와 묻는 방식이 달라집니다. '
             '한 바퀴가 짧아서 앞을 잊기 전에 다시 만납니다.</p>')

    o.append("<h2>회독마다 무엇이 달라지는가</h2>")
    o.append('<div class="tablewrap"><table><thead><tr><th>회독</th><th>이름</th><th>익히기</th><th>외우기</th></tr></thead><tbody>')
    for label, t, d, a, b in ROUNDS:
        o.append("<tr><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td></tr>"
                 % (label, bp.e(t), bp.e(a), bp.e(b)))
    o.append("</tbody></table></div>")
    for label, t, d, a, b in ROUNDS:
        o.append("<p><b>%s · %s</b> %s</p>" % (label, bp.e(t), bp.e(d)))

    o.append("<h2>하루 한 시간 배분</h2>")
    o.append('<div class="tablewrap"><table><thead><tr><th>시간</th><th>하는 일</th></tr></thead><tbody>'
             "<tr><td>10분</td><td>어제 틀린 것 다시 — 외우기가 복습 차례인 카드를 먼저 냅니다</td></tr>"
             "<tr><td>25분</td><td>오늘 범위 익히기 — 회독에 맞는 깊이로</td></tr>"
             "<tr><td>20분</td><td>오늘 범위 외우기 — 회독에 맞는 방식으로</td></tr>"
             "<tr><td>5분</td><td>막힌 개념 표시 — 다음 회독에서 먼저 봅니다</td></tr>"
             "</tbody></table></div>")
    o.append("<p>1회독은 중요 개념만 보므로 하루 분량이 가장 적습니다. 3회독은 전체를 덮지만 이미 두 번 본 내용이라 속도가 붙습니다. "
             "복습이 밀리면 새 개념을 줄이고 밀린 것을 먼저 끝내세요.</p>")

    o.append("<h2>7일 범위</h2>")
    o.append('<p class="note">체크는 이 브라우저에 저장됩니다. 회독별로 따로 기록됩니다.</p>')
    for i, day in enumerate(days):
        o.append(day_block(i, day))

    o.append("<h2>실기는 필기 뒤에</h2>")
    o.append("<p>실기는 필답형이고 개념 1,005개가 따로 있습니다. 필기가 끝난 다음 같은 방식으로 7일 한 바퀴를 돌리되, "
             "계산과 서술이 섞이므로 하루에 <b>계산 1문항을 손으로 끝까지 푸는 시간</b>을 반드시 넣습니다. "
             '<a href="../c/">실기 실무 교재 →</a></p>')
    o.append("</main>")
    o.append('<script src="../assets/plan.js"></script>')
    o.append(bp.foot(1))
    p = os.path.join(OUT, "plan", "index.html")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write("".join(o))
    print("  plan/index.html  %d bytes · 필기 개념 %d개를 7일로" % (len("".join(o).encode()), total))


if __name__ == "__main__":
    main()

    from finalize_site import finalize
    finalize(OUT)
