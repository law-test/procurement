(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.JodalRankCore=factory();}(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var MODES={supplier:'사장님 원정',manager:'관리사 원정',combo:'콤보 챌린지', 'combo-free':'콤보 · 시간 제한 없음',mission:'조달 미션',match:'개념 짝맞추기'};
  function requireThat(v){if(!v)throw Error('기록의 선택 내용을 확인하지 못했어요. 게임을 새로 완료해 주세요.');}
  function day(date){return new Date(new Date(date).getTime()+9*3600000).toISOString().slice(0,10);}
  function score(p,data,story){
    requireThat(p&&MODES[p.mode]&&typeof p.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id));
    var raw=0,max=950,endingId=null,endingTitle=null;
    if(p.mode==='supplier'||p.mode==='manager'){
      requireThat(p.revision===story.VERSION);
      var v=story.replay(data,{version:1,revision:p.revision,role:p.mode,history:p.history,pending:false});
      requireThat(v.node.ending);raw=story.STATS.reduce(function(sum,k){return sum+v.stats[k];},0);max=400;endingId=v.node.ending.id;endingTitle=v.node.ending.title;
    }else{
      requireThat(p.revision===data.package_id);
      if(p.mode==='match'){
        requireThat(Array.isArray(p.pool)&&p.pool.length===6&&new Set(p.pool).size===6&&p.pool.every(function(id){return data.atoms.some(function(a){return a.id===id;});})&&Array.isArray(p.matches)&&p.matches.length>=6&&p.matches.length<=60);
        var matched=new Set();p.matches.forEach(function(a){requireThat(a&&p.pool.indexOf(a.left)>=0&&p.pool.indexOf(a.right)>=0&&!matched.has(a.left)&&!matched.has(a.right)&&matched.size<6);if(a.left===a.right)matched.add(a.left);});requireThat(matched.size===6);raw=Math.max(60,600-(p.matches.length-6)*25);max=600;
      }else{
        requireThat(Array.isArray(p.answers)&&p.answers.length>=1&&p.answers.length<=6);
        requireThat(p.mode==='combo'||p.answers.length===6);
        var seen=new Set(),combo=0;p.answers.forEach(function(a){var q=data.questions.find(function(x){return x.id===a.id;});requireThat(q&&!seen.has(a.id)&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<q.options.length);seen.add(a.id);if(a.choice===q.answer_index){combo++;raw+=100+Math.min(combo-1,4)*25;}else combo=0;});
      }
    }
    return {id:p.id,mode:p.mode,score:raw,normalized:Math.round(raw*1000/max),endingId:endingId,endingTitle:endingTitle};
  }
  function totals(records){var buckets={},high=0;records.forEach(function(r){if(!r||!MODES[r.mode]||!Number.isInteger(r.normalized)||r.normalized<0||r.normalized>1000)return;var key=(r.endingId?'ending|'+r.mode+'|'+r.endingId:'day|'+r.mode+'|'+day(r.createdAt));buckets[key]=Math.max(buckets[key]||0,r.normalized);high=Math.max(high,r.normalized);});return {total:Object.values(buckets).reduce(function(a,b){return a+b;},0),high:high,plays:records.length};}
  return {MODES:MODES,score:score,totals:totals,day:day};
}));
