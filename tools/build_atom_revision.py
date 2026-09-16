"""Publish decision prompts with explicit verification status. Never infer legal approval."""
from pathlib import Path
import sys,json,re,html,collections
SITE=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:raise SystemExit('Usage: build_atom_revision.py <merged_atoms.json>')
atoms=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')); by={a['id']:a for a in atoms}
assert set(by)=={f'A{i:04}'for i in range(1,1893)},'Incomplete revision'
esc=lambda s:html.escape(str(s or ''),quote=True)
label={'verified':'근거 확인','needs_source':'근거 검토 중','background':'배경·보조학습'}
stats=dict(collections.Counter(a['content_status']for a in atoms));eligible=sum(a['game_eligible']for a in atoms)
def answer_block(a):
 if not a['public_answer']:
  return '<p class="atom-pending">현재 근거를 대조하고 있습니다. 확인 전에는 정답 암기와 자동 출제에 사용하지 않습니다.</p>'
 drill=f' data-drill="{esc(a["rule"])}"' if a['game_eligible'] else ''
 url=a.get('source_url') or ''
 source=(f'<a href="{esc(url)}" rel="noopener" target="_blank">{esc(a["source_ref"])}</a>' if url.startswith('https://') else esc(a['source_ref']))
 return (f'<details class="atom-answer"><summary>판단과 답안 요소 보기</summary><p class="atom-body"{drill}>{esc(a["rule"])}</p>'
  +('<div class="atom-cond"><b>적용조건</b> '+esc(' / '.join(a['conditions']))+'</div>'if a['conditions']else '')
  +('<div class="atom-cond"><b>예외</b> '+esc(' / '.join(a['exceptions']))+'</div>'if a['exceptions']else '')
  +'<div class="atom-conf"><b>헷갈리는 지점</b> '+esc(a['confusion'])+'</div>'
  +'<div class="atom-rubric"><b>답에 들어갈 요소</b><ul>'+''.join('<li>'+esc(t)+'</li>'for t in a['required_elements'])+'</ul></div>'
  +f'<div class="atom-src">{source}'+(f' · 확인 {esc(a["source_checked"])}'if a.get('source_checked') else ' · 현행 정답 검수 대상 아님')+'</div></details>')
def article(a):
 title=a['title'] if a['content_status']!='needs_source' else '검토 질문'
 return (f'<article class="atom" id="{a["id"]}" data-atom="{a["id"]}" data-review="{a["content_status"]}" data-game="{str(a["game_eligible"]).lower()}">'
  +f'<div class="atom-meta"><span>{a["id"]}</span><span class="atom-status status-{a["content_status"]}">{label[a["content_status"]]}</span></div>'
  +f'<h4 class="atom-h">{esc(title)}</h4><p class="atom-question">{esc(a["decision_prompt"])}</p>'
  +answer_block(a)+'</article>')
published=set()
pattern=r'<article class="atom"[^>]*\bid="(A\d{4})"[^>]*>[\s\S]*?</article>'
for p in (SITE/'c').glob('*/index.html'):
 if p.parent.name=='etc':continue
 s=p.read_text(encoding='utf-8')
 def replacement(m):published.add(m[1]);return article(by[m[1]])
 s,n=re.subn(pattern,replacement,s)
 if not n:continue
 # Old chapter prose was not revised along with the atom, so it must not silently reintroduce old rules.
 s=re.sub(r'<details class="intro"[^>]*>[\s\S]*?</details>','<p class="atom-guide">질문에 먼저 답해 보세요. 근거 확인 항목은 답안 요소와 대조하고, 배경 설명과 검토 중 항목은 상태를 구분해 읽으세요.</p>',s)
 s=s.replace('>교재</a>','>판단 atom</a>')
 if 'assets/atoms.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="../../assets/atoms.css?v=20260916-v006">\n</head>')
 p.write_text(s,encoding='utf-8')
assert published=={f'A{i:04}'for i in range(1,1653)},f'Expected 1652 mapped pages, found {len(published)}'
# Preserve the original legacy IDs for progress and deep links while keeping pending answers out of public data.
for slug in ['law','plan','contract','practice','etc']:
 p=SITE/'data'/f'cards.{slug}.json';pack=json.loads(p.read_text(encoding='utf-8'))
 for c in pack['cards']:
  a=by[c['id']];public=a['public_answer']
  c.update(t=a['title'] if public else a['decision_prompt'],s=a['rule'] if public else '',c=' / '.join(a['conditions']+a['exceptions'])if public else '',x=a['confusion']if public else '',r=a['source_ref']if public else '현재 근거 검토 중',decision_prompt=a['decision_prompt'],recall_prompt=a['recall_prompt'],required_elements=a['required_elements']if public else [],source_url=a['source_url'],source_checked=a['source_checked'],content_status=a['content_status'],game_eligible=a['game_eligible'],revision='20260916-v006')
 pack.update(revision='20260916-v006',eligible_n=sum(x['game_eligible']for x in pack['cards']))
 p.write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf-8')
# A new master does not validate the legacy automatically generated MCQs. Replace the active pool with the independently checked package.
learning=json.loads((SITE/'data/learning-reviewed.json').read_text(encoding='utf-8'));la={a['id']:a for a in learning['atoms']};ls={s['id']:s for s in learning['sources']}
names={'law':'공공조달과 법제도 이해','plan':'공공조달계획 수립 및 분석','contract':'공공계약관리','practice':'공공조달 관리실무'}
for slug,subject in names.items():
 items=[]
 for q in learning['questions']:
  a=la[q['atom_id']]
  if a['subject']!=subject:continue
  source=ls[q['source_ids'][0]]
  items.append(dict(id=q['id'],atom=q['atom_id'],subject=subject,t=a['title'],major=q['criterion']['major'],minor=q['criterion']['minor'],imp='높음',src=' / '.join(ls[k]['title']for k in q['source_ids']),source_url=source['url'],source_checked=q['source_checked'],cond=' / '.join(a['conditions']),conf=a['confusion'],gid=q['criterion']['id'],kind='case',q=q['stem'],stem=q['context'],choices=q['options'],answer=q['answer_index'],full=q['explanation']+' '+' '.join(f'{i+1}번: {s}'for i,s in enumerate(q['option_explanations'])),content_status='verified'))
 (SITE/'data'/f'quiz.{slug}.json').write_text(json.dumps({'subject':subject,'slug':slug,'n':len(items),'revision':'20260916-v006','items':items},ensure_ascii=False,indent=2),encoding='utf-8')
policy=json.loads((SITE/'data/review-policy.json').read_text(encoding='utf-8'))
policy.update(revision='20260916-v006',approvedPracticeQuizIds=[q['id']for q in learning['questions']],approvedExamQuizIds=[],note='기존 자동생성 문항은 원장 개정에 따라 재검토 대기. 현재 객관식은 공식 근거와 선택지를 검토한 독립 작성 12문항만 제공한다.')
(SITE/'data/review-policy.json').write_text(json.dumps(policy,ensure_ascii=False,indent=2),encoding='utf-8')
summary={'revision':'20260916-v006','total':len(atoms),'mapped':1652,'unmapped':240,'status':stats,'eligible':eligible,'objective_questions':len(learning['questions']),'source_checked':'2026-09-16','scope':'개별 판단형 재작성 완료. 법령·문서 대조 여부는 각 atom 상태로 구분하며 전체 내용 검수 완료를 의미하지 않는다.'}
(SITE/'data/atom-review-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
p=SITE/'c/index.html';s=p.read_text(encoding='utf-8');s=s.replace('출제기준별 교재','판단 atom 찾기')
s=re.sub(r'(<h1>판단 atom 찾기</h1>)[\s\S]*?(?=<h2>)',r'\1'+f'<p class="lede">질문에 답하고, 판단의 조건과 근거를 확인하세요. 기존 <b>1,892개</b>를 판단형으로 고쳤습니다.</p><p class="note">근거 확인 {stats.get("verified",0)}개 · 검토 중 {stats.get("needs_source",0)}개 · 배경 {stats.get("background",0)}개. 아래 숫자는 보유 항목 수이며 검수 완료 수가 아닙니다.</p><p><a class="btn" href="../drill/?mode=recall">확인된 판단 {eligible}개 복습</a> <a class="btn ghost" href="etc/">출제기준 연결 검토 240개</a></p>',s)
p.write_text(s,encoding='utf-8')
template=(SITE/'c/W1.1.1/index.html').read_text(encoding='utf-8')
template=re.sub(r'<title>.*?</title>','<title>출제기준 연결 검토 — 조달프로</title>',template)
template=re.sub(r'<meta name="description"[^>]*>', '<meta name="description" content="기존 atom 240개의 공식 출제기준 연결을 검토합니다. 근거 확인과 보류 상태를 구분해 확인하세요.">',template)
template=re.sub(r'<div class="layout wrap">[\s\S]*?</main>', '<div class="layout wrap"><main id="main-content" class="body"><div class="crumb"><a href="../">판단 atom</a></div><h1>출제기준 연결 검토</h1><p class="lede">기존 원장의 240개 항목입니다. 시험 범위 밖으로 확정한 목록이 아니며, 공식 출제기준 연결을 검토하고 있습니다.</p>'+''.join(article(a)for a in atoms if not a['criterion']['id'])+'</main>',template,count=1)
(SITE/'c/etc').mkdir(exist_ok=True);(SITE/'c/etc/index.html').write_text(template,encoding='utf-8')
p=SITE/'library/index.html';s=p.read_text(encoding='utf-8').replace('과목별 개념 사전','판단 atom 찾기').replace('출제기준별 기존 개념 자료를 찾아봅니다. 전량 재검수는 진행 중입니다.','1,892개를 판단 질문으로 개정했습니다. 근거 확인·검토 중·배경 상태를 구분합니다.');p.write_text(s,encoding='utf-8')
p=SITE/'index.html';s=p.read_text(encoding='utf-8');s=s.replace('잊기 전에 한 번 더<small>개념 복습과 회상 연습</small>',f'판단 챌린지 {eligible}개<small>답을 쓰고 필수 요소와 대조하기</small>');p.write_text(s,encoding='utf-8')
p=SITE/'about/index.html';s=p.read_text(encoding='utf-8').replace('기존 개념 자료와 자동 생성 연습은 전량 재검수 완료 상태가 아니며,','1,892개 atom을 개별 판단 질문과 답안 요소로 개정했습니다. 공식 근거를 대조한 항목만 자동 복습에 사용하며, 기존 자동 생성 객관식은 재검토 중입니다.');p.write_text(s,encoding='utf-8')
for p in SITE.rglob('*.html'):
 if '.git'in p.parts:continue
 s=p.read_text(encoding='utf-8');s=re.sub(r'(assets/(?:quiz|study)\.js)(?:\?v=[^"\s>]+)?',r'\1?v=20260916-v006',s);p.write_text(s,encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
