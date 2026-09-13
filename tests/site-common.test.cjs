const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
test('D-day uses the Korean calendar around midnight, independent of host timezone',()=>{
  const context={window:{},document:{readyState:'loading',addEventListener(){}}};
  vm.runInNewContext(source,context);
  for(const timezone of ['Asia/Seoul','UTC','America/Los_Angeles','Pacific/Auckland']){
    process.env.TZ=timezone;
    assert.equal(context.ppmDaysUntil('2026-10-03',Date.parse('2026-10-02T14:59:59Z')),1);
    assert.equal(context.ppmDaysUntil('2026-10-03',Date.parse('2026-10-02T15:00:00Z')),0);
    assert.equal(context.ppmDaysUntil('2026-10-03',Date.parse('2026-10-03T15:00:00Z')),-1);
    assert.equal(context.ppmDaysUntil('2026-10-03',Date.parse('2026-09-13T15:00:00Z')),19);
  }
});
test('home progress ignores null, arrays and malformed saved records',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../assets/home.js'),'utf8');
  for(const saved of ['null','[]','{"bad":null,"bad2":{"due":1}}','{']){
    const elements=Object.fromEntries(['progressLearned','progressDue','progressPlan','homeProg'].map(k=>[k,{}]));
    vm.runInNewContext(source,{localStorage:{getItem:()=>saved},document:{getElementById:id=>elements[id]},window:{addEventListener(){}}});
    assert.equal(elements.progressLearned.textContent,'0');
    assert.equal(elements.progressPlan.textContent,'0 / 21');
  }
});
