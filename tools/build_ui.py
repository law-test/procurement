#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""학습방(홈)·외우기·모의시험·소식 화면 생성기."""
import json, os, importlib.util

OUT = os.environ.get("PPM_OUT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("bp", os.path.join(OUT, "tools", "build_pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)

QN = {}
for slug in ("law", "plan", "contract", "practice"):
    p = os.path.join(OUT, "data", "quiz.%s.json" % slug)
    QN[slug] = json.load(open(p, encoding="utf-8"))["n"] if os.path.exists(p) else 0
CN = {}
for slug in ("law", "plan", "contract", "practice", "etc"):
    p = os.path.join(OUT, "data", "cards.%s.json" % slug)
    CN[slug] = json.load(open(p, encoding="utf-8"))["n"] if os.path.exists(p) else 0

N_ATOM = sum(CN.values())
N_QUIZ = sum(QN.values())


def page_template(name, title, desc, depth):
    path = os.path.join(os.path.dirname(__file__), "templates", name)
    with open(path, encoding="utf-8") as handle:
        body = handle.read()
    values = {"LINKED": sum(n for slug, n in CN.items() if slug != "etc"), "ETC": CN.get("etc", 0), "QUIZ": N_QUIZ}
    values.update({"C_" + slug: n for slug, n in CN.items()})
    values.update({"Q_" + slug: n for slug, n in QN.items()})
    for key, value in values.items():
        body = body.replace("__" + key + "__", format(value, ",") if key in ("LINKED", "ETC", "QUIZ") else str(value))
    return bp.head(title, desc, depth) + body + bp.foot(depth)

# ------------------------------------------------------------------ 학습방(홈)

HOME = page_template('home.tpl', '조달프로 — 공공조달관리사 학습방', '공공조달관리사 무료 학습방. 3주 학습계획, 출제기준별 개념, 객관식·빈칸·회상, 모의시험으로 공부하세요.', 0)

# ------------------------------------------------------------------ 외우기

DRILL = page_template('drill.tpl', '외우기 — 조달프로', '공공조달관리사 개념을 4지선다·빈칸·직접회상 세 방식으로 묻습니다. 과목과 주요항목을 골라 연속으로 풀어 보세요.', 1)

# ------------------------------------------------------------------ 모의시험

CBT = page_template('cbt.tpl', '모의시험 CBT — 조달프로', '공공조달관리사 필기 구성 그대로 80문항 120분. 과목별 짧은 연습과 실기 실무 문항 연습도 있습니다. 제출하면 과목별 점수와 오답 해설이 나옵니다.', 1)

# ------------------------------------------------------------------ 소식·자료

NEWS = bp.head(
    "소식·자료 — 조달프로",
    "공공조달관리사 공지사항, 관련 기사와 글, 공식 자료 링크, 문의 창구.",
    1) + """
<main class="wrap">
  <h1>소식·자료</h1>

  <h2>공지</h2>
  <ul class="notice">
    <li><span class="nd">2026-09-13</span> <b>모의시험을 열었습니다.</b> 실전 80문항 120분과 과목별 연습, 실기 실무 문항 연습을 고를 수 있습니다.</li>
    <li><span class="nd">2026-09-13</span> <b>출제기준 273개 항목 전체를 공개했습니다.</b> 개념마다 근거 조문과 교재 쪽을 붙였습니다.</li>
    <li><span class="nd">2026-09-13</span> <b>사이트를 열었습니다.</b> 익히기·외우기·모의시험 세 갈래로 운영합니다.</li>
  </ul>

  <h2>관련 기사와 글</h2>
  <ul class="links">
    <li><a href="https://www.jodaleconomy.com/news/articleView.html?idxno=1891" rel="noopener">조달 자격증 시대 열린다… '공공조달관리사' 첫 시험 총정리</a> <span class="lsrc">조달경제신문</span></li>
    <li><a href="https://v.daum.net/v/4pxlgLg2Ei" rel="noopener">국가기술자격에 '공공조달관리사' 신설</a> <span class="lsrc">언론 보도</span></li>
    <li><a href="https://namu.wiki/w/%EA%B3%B5%EA%B3%B5%EC%A1%B0%EB%8B%AC%EA%B4%80%EB%A6%AC%EC%82%AC" rel="noopener">공공조달관리사 — 나무위키</a> <span class="lsrc">영문 명칭 Public Procurement Manager</span></li>
    <li><a href="https://www.q-net.or.kr/man004.do?id=man00402&amp;gSite=Q&amp;gId=&amp;ARTL_SEQ=5253729&amp;BOARD_ID=Q001&amp;notiType=40" rel="noopener">신설 종목 필기 예제문제 안내</a> <span class="lsrc">Q-Net 공고</span></li>
  </ul>

  <h2>공식 자료</h2>
  <ul class="links">
    <li><a href="https://www.q-net.or.kr/crf005.do?id=crf00503s02&amp;gSite=Q&amp;gId=&amp;jmCd=9777&amp;jmInfoDivCcd=B0&amp;seriesCd=03" rel="noopener">Q-Net 시험정보</a> <span class="lsrc">일정·구성·응시자격</span></li>
    <li><a href="https://www.q-net.or.kr/crf005.do?id=crf00503&amp;jmCd=9777" rel="noopener">출제기준</a> <span class="lsrc">적용 2026.03.01~2028.12.31 · 필기 182 · 실기 91</span></li>
    <li><a href="https://pps.go.kr/kor/bbs/view.do?bbsSn=2601150031&amp;key=00034&amp;orderBy=bbsOrdr+desc" rel="noopener">조달청 표준교재와 강좌 안내</a> <span class="lsrc">학습 참고자료</span></li>
    <li><a href="https://www.law.go.kr" rel="noopener">국가법령정보센터</a> <span class="lsrc">국가계약법·시행령·시행규칙, 판로지원법, 전자조달법, 조달사업법</span></li>
  </ul>

  <h2 id="contact">문의·오류 신고</h2>
  <p>내용이 틀렸거나 근거가 어긋난 곳을 찾으셨다면 알려 주세요. 어느 화면의 어느 문장인지, 맞는 내용은 무엇인지, 근거(법령 조문·공고 제목과 게시일·교재 판본과 쪽)를 함께 적어 주시면 확인해서 고치고 무엇이 바뀌었는지 남깁니다.</p>
  <p>개념과 문항에는 각각 <b>오류 신고</b> 버튼이 붙어 있습니다. 그 버튼을 쓰면 어느 항목인지가 자동으로 담겨
     확인이 빠릅니다. 교재에서는 개념 블록 오른쪽 아래, 외우기·모의시험에서는 정답이 공개된 뒤 버튼 줄에 있습니다.</p>
  <ul class="links">
    <li><a class="foot-report" href="https://github.com/law-test/procurement/issues/new" rel="noopener">지금 바로 신고하기</a> <span class="lsrc">항목을 지정하지 않는 일반 문의</span></li>
    <li><a href="https://github.com/law-test/procurement/issues" rel="noopener">접수된 신고와 처리 상태 보기</a> <span class="lsrc">GitHub</span></li>
  </ul>
  <p class="note">숫자와 요율, 조문 번호의 오류를 가장 먼저 고칩니다. 시중 교재에도 하자보수보증금 비율,
     계약보증금률, 지체상금률이 현행 법령과 어긋난 곳이 있습니다. 그런 지점을 발견하시면 알려 주세요.</p>
</main>
""" + bp.foot(1)


def write(path, text):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text)
    print("  %-24s %6d bytes" % (path, len(text.encode("utf-8"))))


if __name__ == "__main__":
    write("index.html", HOME)
    write("drill/index.html", DRILL)
    write("cbt/index.html", CBT)
    write("news/index.html", NEWS)

    from finalize_site import finalize
    finalize(OUT)
