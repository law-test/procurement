"""현재 정적 페이지의 공통 화면을 갱신한다. 원장·문항 생성기는 실행하지 않는다."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
VERSION='20260916'
def header(rel):
    items=[('', '게임'),('rank/','순위'),('drill/','복습'),('review/','별점·후기'),('board/','커뮤니티'),('library/','자료')]
    nav=''.join(f'<a href="{rel}{href}">{title}</a>' for href,title in items)
    return f'''<a class="skip-link" href="#main-content">본문으로 바로가기</a>
<header><div class="wrap hrow"><a class="logo" href="{rel}">조달프로<small>공공조달관리사 학습·실무</small></a><button class="menu-toggle" aria-expanded="false" aria-controls="site-menu" type="button">메뉴</button><nav id="site-menu" class="menu" aria-label="주 메뉴">{nav}</nav></div></header>'''

def document(title,description,body,rel,footer):
    return f'''<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} — 조달프로</title><meta name="description" content="{description}"><meta name="theme-color" content="#152b3b"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"><link rel="stylesheet" href="{rel}assets/site.css"><link rel="stylesheet" href="{rel}assets/study.css"></head><body>{header(rel)}<main class="wrap" id="main-content">{body}</main>{footer}<script src="{rel}assets/site.js"></script><script src="{rel}assets/report.js"></script></body></html>'''

def run():
    original=(ROOT/'index.html').read_text(encoding='utf-8')
    footer=re.search(r'<footer>[\s\S]*?</footer>',original).group(0)
    # Keep the current hand-maintained story, ranking and community homepage.
    planpath=ROOT/'plan/index.html'
    plan=planpath.read_text(encoding='utf-8')
    if 'id="plan-revised"' not in plan:
        sections=re.findall(r'<section class="dayb"[\s\S]*?</section>',plan)
        assert len(sections)==7
        selected=[]
        for i,section in enumerate(sections,1):
            section=section.replace(f'Day {i}',f'범위 {i}')
            section=section.replace('1회독 외우기','과목 객관식 연습').replace('2회독 외우기','과목 혼합 복습').replace('3회독 외우기','과목 회상 연습')
            section=section.replace('n=40','n=10').replace('n=30','n=10').replace('n=20','n=10')
            section=re.sub(r'(<div class="dayb-links">[\s\S]*?</div>)',r'<details><summary>선택할 개념 목록 펼치기</summary>\1</details>',section,count=1)
            selected.append(section)
        newbody='''<section id="plan-revised"><p class="eyebrow">하루 60분 · 선택하고 반복하기</p><h1>3주 반복 학습계획</h1><p class="lede">오늘 이해할 개념을 조금씩 고르고, 다음 주에 다시 확인합니다. 아래의 넓은 범위를 하루에 모두 끝내는 계획은 아닙니다.</p><div class="learning-note">처음이라면 <a href="../learn/">핵심 판단 연습</a>에서 한 주제를 시작하세요. 읽고 설명할 수 있는 분량에 맞춰 하루 3~5개 개념부터 선택하고, 복습이 밀리면 새 범위를 줄입니다.</div><div class="section-box"><h2>내 시작일과 시험일까지의 시간</h2><label for="planStart">학습 시작일</label> <input id="planStart" type="date"><p id="planDates" aria-live="polite"></p><p class="note">21일은 반복 습관을 위한 기간입니다. 전 범위 숙달·합격을 뜻하지 않습니다. 필기시험 뒤까지 이어지면 남은 날은 회고와 실기 준비에 활용하세요.</p></div><h2>하루 한 시간 배분</h2><div class="tablewrap"><table><thead><tr><th>시간</th><th>할 일</th><th>끝냈는지 확인하는 방법</th></tr></thead><tbody><tr><td>10분</td><td>지난 오답 복습</td><td>해설을 가리고 이유를 말하기</td></tr><tr><td>20분</td><td>오늘 고른 개념·조건 읽기</td><td>비슷한 개념과의 차이 한 줄</td></tr><tr><td>20분</td><td>관련 문제와 해설</td><td>내 답과 오답의 이유 대조</td></tr><tr><td>10분</td><td>기록·다음 복습 정하기</td><td>잊은 조건 하나를 남기기</td></tr></tbody></table></div><h2>같은 범위를 세 번 보는 방법</h2><p><b>1주차:</b> 내가 선택한 개념의 뜻과 기본 조건. <b>2주차:</b> 예외와 헷갈리는 개념 비교. <b>3주차:</b> 틀린 문제의 이유 설명과 회상.</p><p>아래 목록은 찾아볼 범위입니다. 목록 전체를 한 시간에 읽으라는 의미가 아닙니다. 과목 연습 버튼은 해당 과목 전체에서 문제를 고르므로 오늘 읽은 절과 일치하지 않을 수 있습니다.</p><p class="note">기존 회독 체크는 유지됩니다. 체크는 스스로 선택한 분량의 완료 기록이며 전체 출제기준 이수 인증이 아닙니다.</p></section>'''+''.join(selected)+'''<h2>실기 준비</h2><p>실기는 직접 답안을 쓰는 연습이 필요합니다. 계산은 산식·단위·적용조건을 적고, 서술은 필수 요소를 써 본 뒤 근거와 대조하세요. <a href="../c/">실기 개념 찾기</a></p>'''
        plan=re.sub(r'<main[^>]*>[\s\S]*?</main>',lambda _: '<main class="wrap">'+newbody+'</main>',plan,count=1)
        plan=re.sub(r'<title>.*?</title>','<title>3주 반복 학습계획 — 조달프로</title>',plan,count=1)
        plan=re.sub(r'<meta name="description"[^>]*>','<meta name="description" content="하루 60분, 이해할 개념을 고르고 오답을 반복하는 공공조달관리사 학습계획">',plan,count=1)
        plan=plan.replace('</body>','<script src="../assets/plan-dates.js"></script>\n</body>')
        planpath.write_text(plan,encoding='utf-8')
    aboutpath=ROOT/'about/index.html'
    about=aboutpath.read_text(encoding='utf-8')
    about=about.replace('신설 자격이라 믿을 자료가 없습니다. 출제기준을 기준선으로 잡고, 개념마다 근거 조문을 붙여 하나씩 쌓아 올리는 곳입니다.','공식 출제기준과 원문을 기준으로 공부할 내용을 정리하고, 조건과 예외를 문제에 적용하는 연습을 돕습니다.')
    about=about.replace('실제 배점(30·20·30문항)과 120분 제한으로 칩니다. 과목별 40점 과락까지 그대로 계산합니다.','기존 개념 연습과 검수한 문항을 구분합니다. 80문항 실전 구성은 과목별 검수 문항이 갖춰졌을 때 제공합니다.')
    about=about.replace('필기 범위를 7일에 한 바퀴 돌리고, 그 7일을 세 번 반복합니다. 회독마다 읽는 깊이와 묻는 방식이 달라집니다.','하루 한 시간에 맞춰 이해할 분량을 선택하고, 3주 동안 조건·예외·오답을 반복합니다.')
    if 'id="authoring"' not in about:
        about=about.replace('<h2>쓰는 방식</h2>','''<h2 id="authoring">학습자료 작성 기준</h2><p>상업 교재의 문제·보기·해설을 숫자나 단어만 바꾸어 옮기지 않습니다. 학습목표와 일반적인 출제 아이디어를 참고하고, 공식 근거에서 사례·질문·보기·해설을 독립적으로 작성합니다.</p><p>법령이 정한 금액·기간·비율은 근거대로 유지합니다. 새로 정하는 것은 가상 사례의 조건과 수치이며, 별도로 계산을 확인합니다. 공개 예시문항은 판단 유형을 참고하는 자료이고, 공식 원문·정답을 재배포하는 방식으로 사용하지 않습니다.</p><p>‘핵심 판단’은 조건·혼동 포인트·근거·문항별 해설을 함께 확인한 새 학습 묶음입니다. 기존 개념 자료와 자동 생성 연습은 전량 재검수 완료 상태가 아니며, 일부 주제의 연습 성적을 실제 시험의 합격 가능성으로 표시하지 않습니다.</p><h2>쓰는 방식</h2>''')
    aboutpath.write_text(about,encoding='utf-8')
    for page in ROOT.rglob('*.html'):
        if any(x in page.parts for x in ('.git','tools','_private','_reference')):continue
        depth=len(page.relative_to(ROOT).parts)-1
        rel='../'*depth if depth else './'
        text=page.read_text(encoding='utf-8')
        text=text.replace('공공조달관리사의 앞날','공공조달관리사 취업·활용').replace('>앞날<','>취업·활용<').replace('자격의 앞날','취업·활용').replace('공공조달관리사의 앞날','공공조달관리사 취업·활용')
        text=re.sub(r'<a class="skip-link"[^>]*>.*?</a>\s*','',text)
        text=re.sub(r'<header>[\s\S]*?</header>',lambda _:header(rel),text,count=1)
        text=re.sub(r'<main\b(?![^>]*\bid=)([^>]*)>',r'<main id="main-content"\1>',text,count=1)
        text=re.sub(r'<link[^>]*href="[^"<>]*assets/experience\.css[^"<>]*"[^>]*>\s*','',text)
        text=re.sub(r'<script[^>]*src="[^"<>]*assets/experience\.js[^"<>]*"[^>]*></script>\s*','',text)
        text=re.sub(r'(src="[^"]*assets/(?:site|study|quiz|cards)\.js)(?:\?[^"]*)?(")', r'\1?v=20260916\2', text)
        text=text.replace('</head>',f'<link rel="stylesheet" href="{rel}assets/experience.css?v={VERSION}">\n</head>')
        text=text.replace('</body>',f'<script src="{rel}assets/experience.js?v={VERSION}"></script>\n</body>')
        text=text.replace('출제기준 273개 항목을 개념으로 정리하고, 문제로 묻고, 모의시험으로 점검합니다.', '게임으로 판단을 연습하고, 개념과 근거를 확인하며 복습합니다.')
        text=text.replace('>모의시험</a>', '>개념 문제 연습</a>').replace('>외우기</a>', '>복습</a>')
        # Page templates may omit the closing body. Do not silently omit the enhancement.
        if 'assets/experience.js' not in text:text+=f'\n<script src="{rel}assets/experience.js?v={VERSION}"></script>\n'
        page.write_text(text,encoding='utf-8')
if __name__=='__main__':run()
