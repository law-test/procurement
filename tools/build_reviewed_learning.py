"""검수된 독립 학습 데이터로 읽기 화면을 만든다. 문항 원문을 자동 변형하지 않는다."""
import json
from html import escape as e
from pathlib import Path
from refresh_experience import document
import re

ROOT=Path(__file__).resolve().parents[1]
def run():
    d=json.loads((ROOT/'data/learning-reviewed.json').read_text(encoding='utf-8'))
    assert len(d['atoms'])==6 and len(d['questions'])==12
    assert all(q['publication_review']['status']=='ready' for q in d['questions'])
    sources={s['id']:s for s in d['sources']}
    footer=re.search(r'<footer>[\s\S]*?</footer>',(ROOT/'index.html').read_text(encoding='utf-8')).group(0)
    footer=re.sub(r'href="(?!https?://|mailto:|#)([^"]+)"', lambda m:'href="../'+m.group(1).removeprefix('./')+'"',footer)
    content='<p class="eyebrow">게임에서 만난 판단, 이해하고 기억하기</p><h1>핵심 판단 노트</h1><p class="lede">조건을 읽고 답을 고르는 연습입니다. 어떤 규칙을 적용하는지, 비슷한 판단과 어디서 갈리는지 확인하세요.</p><p><a class="btn" href="../">게임으로 연습하기 →</a></p><nav class="compact-links" aria-label="핵심 판단 목록">'
    for a in d['atoms']:content+=f'<a href="#{a["id"]}">{e(a["match_answer"])}</a>'
    content+='</nav>'
    for a in d['atoms']:
        content+=f'<article class="section-box learning-atom" id="{a["id"]}"><p class="eyebrow">{e(a["subject"])}</p><h2>{e(a["title"])}</h2><p class="lede"><b>{e(a["decision"])}</b></p><p>{e(a["rule"])}</p><h3>이 조건을 확인하세요</h3><ul>'+''.join(f'<li>{e(x)}</li>' for x in a['conditions'])+'</ul><h3>헷갈리기 쉬운 부분</h3><p>'+e(a['confusion'])+'</p>'
        recall=a['recall']
        content+=f'<details class="learning-recall"><summary>{e(recall["prompt"])}</summary><p>{e(recall["answer"])}</p></details><p class="note">근거 확인: {e(a["source_checked"])} · '+ ' · '.join(f'<a href="{e(sources[s]["url"],quote=True)}" target="_blank" rel="noopener">{e(sources[s]["title"])}</a>' for s in a['source_ids'])+'</p></article>'
    content+='<p class="note">이 묶음은 6개 주제의 자체 작성 학습자료입니다. 공식 예시문항의 원문·답안이 아니며 시험 전체 범위를 다루지 않습니다. <a href="../about/#authoring">자료 작성 기준</a></p>'
    (ROOT/'learn').mkdir(exist_ok=True)
    (ROOT/'learn/index.html').write_text(document('핵심 판단 노트','게임에서 배운 6가지 공공조달 판단의 조건, 예외, 혼동 포인트와 공식 근거.',content,'../',footer),encoding='utf-8')
    body='''<p class="eyebrow">필요한 자료를 한곳에서</p><h1>자료 찾기</h1><p class="lede">지금 필요한 공부와 정보로 바로 이동하세요.</p><div class="path-grid"><a class="path-card" href="../learn/"><span class="card-number">이해하기</span><h2>게임 속 핵심 판단</h2><p>게임에서 만난 조건과 예외를 다시 읽고 기억합니다.</p></a><a class="path-card" href="../links/"><span class="card-number">고르기</span><h2>교재·강의·무료자료</h2><p>자료의 출처와 특징을 비교하고 원문으로 이동합니다.</p></a><a class="path-card" href="../plan/"><span class="card-number">이어가기</span><h2>하루 한 시간 학습계획</h2><p>3주 동안 개념을 고르고 오답을 반복하는 계획입니다.</p></a><a class="path-card" href="../c/"><span class="card-number">찾아보기</span><h2>과목별 개념 사전</h2><p>출제기준별 기존 개념 자료를 찾아봅니다. 전량 재검수는 진행 중입니다.</p></a><a class="path-card" href="../exam/"><span class="card-number">확인하기</span><h2>시험·접수 안내</h2><p>공식 일정과 시험 방식, 공고를 확인합니다.</p></a><a class="path-card" href="../errata/"><span class="card-number">대조하기</span><h2>교재·법령 대조</h2><p>교재와 적용 근거를 대조한 내용을 확인합니다.</p></a></div><div class="section-box"><h2>문제 연습과 소식</h2><div class="compact-links"><a href="../cbt/">과목별 개념 문제 연습</a><a href="../news/">소식·문의</a><a href="../about/">조달프로 소개·자료 작성 기준</a></div></div>'''
    (ROOT/'library').mkdir(exist_ok=True)
    (ROOT/'library/index.html').write_text(document('자료 찾기','공공조달관리사 교재·강의·무료자료, 학습계획과 과목별 개념.',body,'../',footer),encoding='utf-8')
if __name__=='__main__':run()
