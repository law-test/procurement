#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""표준교재와 현행 법령이 다른 곳 — 대조표."""
import json, os, importlib.util

OUT = os.environ.get("PPM_OUT", "/home/claude/procurement")
spec = importlib.util.spec_from_file_location("bp", os.path.join(OUT, "tools", "build_pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
e = bp.e

KIND = {
    "law": ("현행 법령과 다름", "k-law"),
    "self": ("교재 안에서 갈림", "k-self"),
}


def item_html(it):
    label, cls = KIND[it["kind"]]
    o = ['<article class="er %s" id="%s">' % (cls, e(it["id"]))]
    o.append('<h3 class="er-h"><span class="er-id">%s</span>%s'
             '<span class="er-k">%s</span></h3>' % (e(it["id"]), e(it["topic"]), e(label)))
    o.append('<div class="er-w">%s</div>' % e(it["where"]))
    o.append('<div class="er-row"><span class="er-t er-t-b">교재</span>'
             '<span class="er-v">%s</span></div>' % e(it["book"]))
    o.append('<div class="er-row"><span class="er-t er-t-n">현행</span>'
             '<span class="er-v">%s</span></div>' % e(it["now"]))
    if it.get("law"):
        link = ('<a class="src-lk" href="%s" rel="noopener" target="_blank">%s</a>'
                % (e(it["url"]), e(it["law"]))) if it.get("url") else e(it["law"])
        o.append('<div class="er-row"><span class="er-t er-t-l">근거</span>'
                 '<span class="er-v">%s</span></div>' % link)
    o.append('<p class="er-why">%s</p>' % e(it["why"]))
    if it.get("risk"):
        o.append('<div class="er-risk">걸리는 자리 · %s</div>' % e(it["risk"]))
    o.append("</article>")
    return "".join(o)


def main():
    d = json.load(open(os.path.join(OUT, "tools", "errata.json"), encoding="utf-8"))
    items = d["items"]
    n_law = sum(1 for i in items if i["kind"] == "law")
    n_self = len(items) - n_law
    o = [bp.head("표준교재와 현행 법령이 다른 곳 — 조달프로",
                 "조달청 표준교재 4권을 현행 법령과 한 줄씩 대조했습니다. 법령과 다른 곳 %d군데, 교재 안에서 값이 갈리는 곳 %d군데."
                 % (n_law, n_self), 1)]
    o.append('<main class="wrap narrow">')
    o.append("<h1>표준교재와 현행 법령이 다른 곳</h1>")
    o.append('<p class="lede">첫 시행 시험이라 모두 같은 <b>조달청 표준교재 4권</b>으로 공부합니다. '
             '그 교재를 현행 법령과 대조했더니 어긋나는 자리가 있었습니다. '
             '<b>현행 법령과 다른 곳 %d군데</b>, <b>교재 안에서 값이 갈리는 곳 %d군데</b>입니다. '
             '교재 쪽수와 조문을 함께 적었으니 직접 확인하십시오.</p>' % (n_law, n_self))
    o.append('<p class="note">법령이 기준입니다. 교재가 법령과 다르면 법령대로 외우십시오. '
             '교재 안에서 값이 갈리는 곳은 어느 쪽도 근거로 쓸 수 없으니 조문을 보고 정하십시오.</p>')

    o.append('<div class="er-legend">')
    o.append('<span class="er-k k-law">현행 법령과 다름</span> 교재 표기와 현행 조문을 직접 대조해 확인한 것')
    o.append('<br/><span class="er-k k-self">교재 안에서 갈림</span> 같은 교재의 다른 쪽에서 값이 다른 것')
    o.append("</div>")

    o.append("<h2>계산이 어긋나는 다섯</h2>")
    o.append("<p>아래 다섯은 숫자 하나가 아니라 <b>계산 전체</b>를 틀어 놓습니다. 실기 계산 문항에 그대로 들어갑니다.</p>")
    o.append('<div class="tablewrap"><table><thead><tr><th>무엇</th><th>교재</th><th>현행</th></tr></thead><tbody>'
             '<tr><td><a href="#E01">공사 지체상금률</a></td><td>0.005</td><td><b>0.0005</b> (1천분의 0.5)</td></tr>'
             '<tr><td><a href="#E16">일반관리비 산식</a></td><td>(노무비+경비) × 율</td><td><b>(재료비+노무비+경비) × 율</b></td></tr>'
             '<tr><td><a href="#E15">용역 이윤율</a></td><td>14%</td><td><b>10%</b></td></tr>'
             '<tr><td><a href="#E17">선금 의무지급률(공사)</a></td><td>30% · 20%</td><td><b>40% · 30%</b></td></tr>'
             '<tr><td><a href="#E05">수의계약 공사 금액</a></td><td>종합 2억 · 전문 1억</td><td><b>4억 · 2억 · 1억6천만원</b></td></tr>'
             '</tbody></table></div>')
    o.append("<p>지체상금률은 계수가 열 배입니다. 일반관리비 산식은 재료비가 빠져 있어 물품 제조에서 특히 크게 어긋납니다. "
             "이 둘은 교재의 <b>표</b>에서만 틀렸고 같은 교재 본문은 옳게 쓰고 있습니다. 표를 보고 외우면 틀립니다.</p>")

    o.append("<h2>대조표</h2>")
    for it in items:
        o.append(item_html(it))

    o.append("<h2>어떻게 대조했는가</h2>")
    o.append("<p>표준교재 4권의 본문을 쪽 단위로 읽고, 숫자·요율·조문 번호가 나오는 자리를 "
             "국가법령정보센터의 현행 조문과 하나씩 맞췄습니다. "
             "교재 표기는 쪽수까지 적었고, 현행 규정은 조문 링크를 붙였으니 눌러서 원문을 보십시오. "
             "법령은 저작물이 아니어서 원문을 그대로 볼 수 있습니다.</p>")
    o.append("<p>대조에서 뺀 것도 있습니다. 낙찰하한율과 적격심사 통과점수는 조달청 지침과 "
             "행정안전부 예규에 있는 값인데 현행본 원문을 확인하지 못해 넣지 않았습니다. "
             "국제입찰 양허 기준금액은 2년마다 고시로 갱신되는 값이라 교재 숫자를 그대로 두었습니다. "
             "확인하지 못한 것을 확인한 것처럼 적지 않았습니다.</p>")
    o.append('<p class="note">대조 기준일 %s. 법령이 개정되면 이 표도 틀려집니다. '
             '조문 링크는 항상 현행을 가리키니 시험 직전에 다시 확인하십시오. '
             '빠진 곳이나 잘못 본 곳을 발견하면 아래 오류 신고로 알려 주세요.</p>' % e(d["rev"]))
    o.append("</main>")
    o.append(bp.foot(1))
    p = os.path.join(OUT, "errata", "index.html")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = "".join(o)
    open(p, "w", encoding="utf-8").write(s)
    print("  errata/index.html  %.1f KB · 항목 %d개(법령 %d · 교재내부 %d)"
          % (len(s.encode()) / 1024, len(items), n_law, n_self))


if __name__ == "__main__":
    main()
