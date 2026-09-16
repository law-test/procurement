(function () {
  'use strict';
  const host = document.getElementById('game-main');
  if (!host) return;
  const KEY = 'jodal.games.v1';
  let data, mode = 'combo', round, timer, selected = {}, matched = new Set(), attempts = 0, matchRound, loadVersion = 0, memoryOnly = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle = list => { const a = list.slice(); for (let i=a.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const today = () => new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const cleanRecord = raw => {
    const s = raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {}, best = {};
    ['combo','combo-free','mission','review','match'].forEach(key => {
      const score=s.best && !Array.isArray(s.best) && s.best[key];
      if(Number.isSafeInteger(score) && score>=0 && score<=(key==='match'?600:950)) best[key]=score;
    });
    const validDay = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
      Number.isFinite(Date.parse(x+'T00:00:00Z')) && new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x && x<=today();
    return {best, days:Array.isArray(s.days)?[...new Set(s.days.filter(validDay))].sort().slice(-365):[],
      wrong:Array.isArray(s.wrong)?[...new Set(s.wrong.filter(x=>typeof x==='string'&&x.length>0))]:[],
      rounds:Number.isSafeInteger(s.rounds)&&s.rounds>=0?s.rounds:0};
  };
  let record; try { record=cleanRecord(JSON.parse(localStorage.getItem(KEY))); } catch (_) { record=cleanRecord();memoryOnly=true; }
  function storageNote() {const el=document.getElementById('record-note');if(el&&memoryOnly)el.textContent='기록은 현재 페이지에서만 유지됩니다. 새로고침하거나 페이지를 떠나면 사라집니다.';}
  function persist() {try {localStorage.setItem(KEY,JSON.stringify(record));}catch(_){memoryOnly=true;}storageNote();updatePersonal();}
  function updatePersonal() {
    const count=document.getElementById('played-days'); if(count) count.textContent=record.days.length+'일';
    const best=document.getElementById('personal-best'); if(best) best.textContent='완료한 라운드 '+record.rounds+'회';
  }
  function clearTimer() { if(timer!=null) clearInterval(timer); timer=null; }
  function sources(ids) { return ids.map(id=>data.sources.find(s=>s.id===id)).filter(Boolean).map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a>').join(' · '); }
  function atomFor(q) { return data.atoms.find(a=>a.id===q.atom_id); }
  function stat(label,value,id) { return '<div class="game-stat"><small>'+label+'</small><strong'+(id?' id="'+id+'"':'')+'>'+value+'</strong></div>'; }
  function timeLeft() { if(!round||!round.limit)return null; return Math.max(0,round.remaining-(round.started!=null?Date.now()-round.started:0)); }
  function pauseTimer() { if(round&&round.started!=null) {round.remaining=timeLeft();round.started=null;} clearTimer(); }
  function pauseForBackground() {
    if(!round||!round.limit||round.answered||round.finished||!round.clockBegun)return;
    const active=round;
    pauseTimer();active.paused=true;
    host.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=true;});
    const info=host.querySelector('.game-help');
    if(info){info.innerHTML='잠시 멈췄어요. <button class="btn sm" id="resume-clock" type="button">이어서 도전</button>';
      document.getElementById('resume-clock').onclick=()=>{
        if(round!==active||!active.paused||active.answered||active.finished||document.hidden)return;
        active.paused=false;info.textContent='해설을 읽는 동안은 시간이 멈춥니다.';
        host.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=false;});startTimer();
      };}
  }
  function startTimer() {
    if(!round||!round.limit||round.answered||round.finished||round.paused||round.started!=null)return;
    if(document.hidden){pauseForBackground();return;}
    clearTimer();const active=round;active.started=Date.now();
    timer=setInterval(()=>{
      if(round!==active||active.finished||active.answered)return;
      const el=document.getElementById('time-left'),left=timeLeft();
      if(el)el.textContent=Math.ceil(left/1000)+'초';if(left<=0){pauseTimer();finish('time');}
    },200);
  }
  function startRound(nextMode, ids) {
    if(!data||!['combo','mission','match'].includes(nextMode))return;
    clearTimer();matchRound=null; mode=nextMode;
    document.querySelectorAll('.game-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===mode)));
    if(mode==='match') return startMatch();
    let pool=ids?[...new Set(ids)].map(id=>data.questions.find(q=>q.id===id)).filter(Boolean):shuffle(data.questions);
    if(mode==='mission'&&!ids) pool=data.atoms.map(a=>shuffle(data.questions.filter(q=>q.atom_id===a.id))[0]);
    if(!pool.length){round=null;host.innerHTML='<p>다시 풀 문항이 없습니다. 위에서 다른 게임을 골라 보세요.</p>';return;}
    const limit=mode==='combo'&&!ids;
    round={questions:pool.slice(0,6),index:0,score:0,combo:0,maxCombo:0,correct:0,answers:[],answered:false,finished:false,remaining:60000,started:null,limit:limit,clockBegun:false,review:Boolean(ids),bestKey:ids?'review':mode,paused:false};
    renderQuestion(false);
  }
  function missionMap() {
    return '<div class="mission-map" aria-label="미션 진행 상황">'+round.questions.map((q,i)=>{
      const answer=round.answers[i], cls=answer?(answer.ok?'done':'retry'):(i===round.index?'current':'');
      return '<div class="mission-building '+cls+'"><span class="building" aria-hidden="true"></span><span>'+(i+1)+'단계'+(answer?(answer.ok?' ✓':' 복습'):'')+'</span></div>';
    }).join('')+'</div>';
  }
  function renderQuestion(focus) {
    const q=round.questions[round.index]; if(!q)return finish('complete');
    round.answered=false;const active=round,index=round.index;
    host.innerHTML='<div class="game-stats">'+stat('점수',round.score)+stat(mode==='mission'?'완료한 미션':'연속 정답',mode==='mission'?round.answers.length+'/'+round.questions.length:round.combo+' 콤보')+stat('진행',(round.index+1)+' / '+round.questions.length)+stat(round.limit?'남은 판단 시간':'시간 제한',round.limit?Math.ceil(round.remaining/1000)+'초':'없음','time-left')+'</div>'+
      (mode==='mission'?missionMap():'')+'<div class="game-context"><span>'+(round.review?'틀린 문제 다시 도전':mode==='mission'?'조달 미션 · 조건을 읽고 결정하세요':'콤보 챌린지 · 맞힐수록 보너스')+'</span>'+
      (round.index===0&&!round.clockBegun&&mode==='combo'&&!round.review?'<div class="game-settings"><label for="game-time">시간</label><select id="game-time"><option value="60">60초</option><option value="0">시간 제한 없이</option></select></div>':'')+'</div>'+
      '<h2 class="game-question" id="game-question" tabindex="-1">'+esc(q.stem)+'</h2>'+(q.context?'<div class="game-question-context">'+esc(q.context)+'</div>':'')+
      '<div class="game-choices">'+q.options.map((o,i)=>'<button type="button" class="game-choice" data-answer="'+i+'"><span class="key" aria-hidden="true">'+(i+1)+'</span><span>'+esc(o)+'</span></button>').join('')+'</div>'+
      '<div id="game-feedback" aria-live="polite"></div><p class="game-help">'+(mode==='combo'&&round.limit&&!round.clockBegun?'첫 답을 고른 뒤 다음 문제부터 시간이 흐릅니다. 해설을 읽는 동안은 멈춰요.':mode==='mission'?'한 단계씩 해결하며 조달 지도를 완성해 보세요.':'숫자 1~4 키로도 답을 고를 수 있어요.')+'</p><div class="game-roundline" aria-label="'+round.answers.length+'문제 완료"><i style="width:'+round.answers.length/round.questions.length*100+'%"></i></div>';
    host.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{if(round===active&&round.index===index)answer(Number(b.dataset.answer));}));
    const setting=document.getElementById('game-time');if(setting) setting.addEventListener('change',()=>{if(round!==active||round.answered||round.finished||round.index!==index)return;round.limit=setting.value==='60';round.bestKey=round.limit?'combo':'combo-free';document.getElementById('time-left').textContent=round.limit?'60초':'없음';});
    if(focus)document.getElementById('game-question').focus({preventScroll:true});
    if(round.clockBegun)startTimer();
  }
  function answer(choice) {
    if(!round||round.answered||round.finished||round.paused||mode==='match'||document.hidden)return;
    if(!Number.isInteger(choice)||choice<0||choice>=round.questions[round.index].options.length)return;
    if(round.started&&timeLeft()<=0){pauseTimer();return finish('time');}
    const active=round,index=round.index;
    pauseTimer();round.answered=true;round.clockBegun=true;
    const q=round.questions[round.index], a=atomFor(q), ok=choice===q.answer_index;
    round.combo=ok?round.combo+1:0;round.maxCombo=Math.max(round.maxCombo,round.combo);
    const gain=ok?100+Math.min(round.combo-1,4)*25:0;round.score+=gain;if(ok)round.correct++;
    round.answers.push({id:q.id,ok,choice});
    if(ok)record.wrong=record.wrong.filter(id=>id!==q.id);else if(!record.wrong.includes(q.id))record.wrong.push(q.id);
    persist();
    host.querySelectorAll('[data-answer]').forEach(b=>{const i=Number(b.dataset.answer);b.disabled=true;if(i===q.answer_index)b.classList.add('is-right');else if(i===choice)b.classList.add('is-wrong');});
    host.querySelector('.game-stats').innerHTML=stat('점수',round.score)+stat(mode==='mission'?'완료한 미션':'연속 정답',mode==='mission'?round.answers.length+'/'+round.questions.length:round.combo+' 콤보')+stat('진행',(round.index+1)+' / '+round.questions.length)+stat(round.limit?'남은 판단 시간':'시간 제한',round.limit?Math.ceil(round.remaining/1000)+'초':'없음','time-left');
    if(mode==='mission')host.querySelector('.mission-map').outerHTML=missionMap();
    document.getElementById('game-feedback').innerHTML='<section class="game-feedback"><h3>'+(ok?'정답! <span class="gain">+'+gain+'점</span>':'다음에 잡을 포인트를 찾았어요')+'</h3><p>'+esc(q.explanation)+'</p><details><summary>보기별 이유 확인</summary><ol>'+q.option_explanations.map((t,i)=>'<li>'+(i===q.answer_index?'<b>정답 · </b>':'')+esc(t)+'</li>').join('')+'</ol></details><p class="source">근거: '+sources(q.source_ids)+'</p><div class="actions"><button class="btn" id="game-next" type="button">'+(round.index+1===round.questions.length?'라운드 결과 보기':'다음 문제 →')+'</button><a href="learn/#'+esc(a.id)+'">이 판단 복습하기</a></div></section>';
    document.getElementById('game-next').addEventListener('click',()=>{if(round!==active||round.finished||!round.answered||round.index!==index)return;round.answered=false;round.index++;if(round.index>=round.questions.length)finish('complete');else renderQuestion(true);});
    host.querySelector('.game-roundline i').style.width=round.answers.length/round.questions.length*100+'%';
    document.getElementById('game-next').focus({preventScroll:true});
  }
  function saveRound(score,key) {
    const old=Number.isFinite(record.best[key])&&record.best[key]>=0?record.best[key]:0;
    record.best[key]=Math.max(old,score);record.rounds++;
    if(!record.days.includes(today()))record.days.push(today());
    record.days=record.days.slice(-365);persist();return {best:record.best[key],isNew:score>old};
  }
  function finish(reason) {
    if(!round||round.finished)return;pauseTimer();round.finished=true;
    const active=round,saved=saveRound(round.score,round.bestKey), wrong=round.answers.filter(a=>!a.ok).map(a=>a.id);
    const unanswered=round.questions.filter(q=>!round.answers.some(a=>a.id===q.id)).map(q=>q.id),retryIds=[...new Set(wrong.concat(unanswered))];
    const attempted=round.answers.length, title=reason==='time'?'이번 도전은 여기까지!':mode==='mission'?round.questions.length+'개 판단을 마쳤어요':'라운드 완료!';
    const topics=[...new Set(wrong.map(id=>atomFor(data.questions.find(q=>q.id===id)).id))];
    host.innerHTML='<div class="game-results"><div class="result-emblem" aria-hidden="true">'+(saved.isNew&&!round.review?'★':'✓')+'</div><h2 tabindex="-1" id="result-title">'+title+'</h2><p class="score-big">'+round.score+'<small>점</small></p><p>'+attempted+'문제 도전 · '+round.correct+'문제 정답 · 최고 '+round.maxCombo+'콤보'+(unanswered.length?' · 미응답 '+unanswered.length+'문제':'')+'</p><p class="game-status">'+(round.review?'복습 결과를 기록했어요. 다시 이해한 이유도 확인해 보세요.':saved.isNew?'나의 최고 기록을 바꿨어요!':'이 모드의 내 최고 기록 '+saved.best+'점')+'</p><div class="result-actions"><button type="button" class="btn" id="game-again">다시 도전</button>'+(retryIds.length?'<button type="button" class="btn ghost" id="game-wrong">'+(unanswered.length?'오답·남은 ':'틀린 ')+retryIds.length+'문제 다시</button>':'<button type="button" class="btn ghost" id="game-other">'+(mode==='mission'?'짝맞추기 해보기':'조달 미션 해보기')+'</button>')+'</div>'+(topics.length?'<div class="result-review"><h3>이번에 기억할 판단</h3>'+topics.map(id=>{const a=data.atoms.find(x=>x.id===id);return '<a href="learn/#'+esc(id)+'">'+esc(a.title)+' →</a>';}).join('')+'</div>':'<p>이해한 이유까지 떠오르나요? 다른 방식으로 한 번 더 확인해 보세요.</p>')+'<p class="game-help">게임 점수는 학습 기록입니다. 실제 시험 성적과는 다릅니다.</p></div>';
    document.getElementById('game-again').onclick=()=>{if(round===active)startRound(mode);};
    const retry=document.getElementById('game-wrong');if(retry)retry.onclick=()=>{if(round===active)startRound(mode,retryIds);};
    const other=document.getElementById('game-other');if(other)other.onclick=()=>{if(round===active)startRound(mode==='mission'?'match':'mission');};
    document.getElementById('result-title').focus({preventScroll:true});
  }
  function startMatch() {
    round=null;selected={};matched=new Set();attempts=0;const active={finished:false};matchRound=active;
    const left=shuffle(data.atoms),right=shuffle(data.atoms);
    host.innerHTML='<div class="game-stats">'+stat('찾은 짝','0 / '+data.atoms.length,'match-count')+stat('시도','0','match-tries')+stat('시간 제한','없음')+stat('목표','6쌍')+'</div><h2 class="game-question" tabindex="-1" id="game-question">개념과 설명, 맞는 짝을 찾아보세요.</h2><p class="game-help">왼쪽 개념 하나, 오른쪽 설명 하나를 골라 연결하세요.</p><div class="match-grid">'+[left,right].map((items,col)=>'<div class="match-column" aria-label="'+(col?'설명':'개념')+'">'+items.map(a=>'<button type="button" class="match-tile" data-side="'+col+'" data-atom="'+esc(a.id)+'" aria-pressed="false">'+esc(col?a.match_prompt:a.match_answer)+'</button>').join('')+'</div>').join('')+'</div><div class="match-message" role="status" id="match-message">짝이 맞으면 초록색으로 바뀝니다.</div>';
    host.querySelectorAll('.match-tile').forEach(b=>b.addEventListener('click',()=>{
      if(mode!=='match'||matchRound!==active||active.finished||matched.has(b.dataset.atom))return;
      host.querySelectorAll('.missed').forEach(t=>t.classList.remove('missed'));
      const side=b.dataset.side;if(selected[side]===b){b.setAttribute('aria-pressed','false');delete selected[side];return;}
      if(selected[side])selected[side].setAttribute('aria-pressed','false');selected[side]=b;b.setAttribute('aria-pressed','true');
      if(!selected['0']||!selected['1'])return;
      attempts++;const ok=selected['0'].dataset.atom===selected['1'].dataset.atom;
      if(ok)matched.add(b.dataset.atom);
      Object.values(selected).forEach(t=>{t.setAttribute('aria-pressed','false');t.classList.add(ok?'matched':'missed');if(ok)t.disabled=true;});selected={};
      document.getElementById('match-count').textContent=matched.size+' / '+data.atoms.length;document.getElementById('match-tries').textContent=attempts;
      document.getElementById('match-message').textContent=ok?'맞는 짝이에요! '+matched.size+'쌍을 찾았어요.':'다른 짝이에요. 설명의 조건을 다시 읽어보세요.';
      if(matched.size===data.atoms.length)finishMatch();
    }));
  }
  function finishMatch() {
    if(mode!=='match'||!matchRound||matchRound.finished)return;
    const active=matchRound;active.finished=true;
    const score=Math.max(60,600-(attempts-6)*25),saved=saveRound(score,'match');
    document.getElementById('match-message').innerHTML='<b>6쌍 완성! '+attempts+'번 시도 · '+score+'점</b><p>'+ (saved.isNew?'새로운 내 최고 기록!':'내 최고 기록 '+saved.best+'점')+'</p><button type="button" class="btn" id="match-again">다시 섞어서 도전</button> <a href="learn/">판단과 근거 더 보기 →</a>';
    document.getElementById('match-again').onclick=()=>{if(matchRound===active)startRound('match');};
  }
  document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;if(mode!=='match'&&/^[1-4]$/.test(e.key)&&round&&!round.answered&&!round.finished){e.preventDefault();answer(Number(e.key)-1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForBackground();});
  document.querySelectorAll('.game-tab').forEach(b=>b.addEventListener('click',()=>{if(data)startRound(b.dataset.game);}));
  function valid(d) {
    const text=x=>typeof x==='string'&&x.trim().length>0;
    const ready=x=>x?.publication_review?.status==='ready' &&
      (!x.publication_review.pending_issues || (Array.isArray(x.publication_review.pending_issues)&&x.publication_review.pending_issues.length===0));
    if(!d||!ready(d)||d.official_questions_reproduced!==false||!Array.isArray(d.atoms)||d.atoms.length!==6||
      !Array.isArray(d.questions)||d.questions.length!==12||!Array.isArray(d.sources)||!d.sources.length)return false;
    if(!d.atoms.every(a=>a&&text(a.id)&&text(a.title)&&text(a.match_prompt)&&text(a.match_answer)&&ready(a))||
      !d.sources.every(s=>{if(!s||!text(s.id)||!text(s.title))return false;try{return new URL(s.url).protocol==='https:';}catch(_){return false;}}))return false;
    const atomIds=new Set(d.atoms.map(a=>a.id)),sourceIds=new Set(d.sources.map(s=>s.id));
    const refs=x=>Array.isArray(x.source_ids)&&x.source_ids.length>0&&x.source_ids.every(id=>sourceIds.has(id));
    return atomIds.size===6&&sourceIds.size===d.sources.length&&d.atoms.every(refs)&&
      d.questions.every(q=>q&&text(q.id)&&atomIds.has(q.atom_id)&&ready(q)&&text(q.stem)&&text(q.explanation)&&
        (q.context==null||typeof q.context==='string')&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(text)&&
        Number.isInteger(q.answer_index)&&q.answer_index>=0&&q.answer_index<4&&Array.isArray(q.option_explanations)&&q.option_explanations.length===4&&q.option_explanations.every(text)&&refs(q))&&
      new Set(d.questions.map(q=>q.id)).size===12&&d.atoms.every(a=>d.questions.filter(q=>q.atom_id===a.id).length===2);
  }
  async function load() {
    const version=++loadVersion,controller=typeof AbortController==='function'?new AbortController():null;
    let timeout;
    try {
      const request=fetch('data/learning-reviewed.json?v=20260916',controller?{signal:controller.signal}:{}).then(r=>{if(!r.ok)throw Error('HTTP');return r.json();});
      const d=await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>{if(controller)controller.abort();reject(Error('Timeout'));},15000);})]);
      if(version!==loadVersion)return;
      if(!valid(d))throw Error('Invalid');data=d;
      record.wrong=record.wrong.filter(id=>data.questions.some(q=>q.id===id));updatePersonal();storageNote();startRound('combo');
    } catch(_) {
      if(version!==loadVersion)return;clearTimer();round=null;matchRound=null;data=null;
      host.innerHTML='<h2>게임을 불러오지 못했어요.</h2><p>연결 또는 학습자료 상태를 확인한 뒤 다시 시작해 주세요.</p><button type="button" id="game-reload" class="btn">다시 불러오기</button> <a href="learn/">핵심 판단 읽기</a>';
      document.getElementById('game-reload').onclick=load;
    } finally {clearTimeout(timeout);}
  }
  load();
})();
