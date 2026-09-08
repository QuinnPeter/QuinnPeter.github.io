const APP='miaomiao-feeding-2026-09', KEY=APP+':github-cache:QuinnPeter/miaomiao-data', $=id=>document.getElementById(id);
let state={app:APP,version:4,month:'2026-09',entries:{},meals:[],weights:{},revision:0};
let queue={}, loaded=false, busy=false, cacheOK=true, retryTimer, toastTimer, backup, selectedDay=2;
function cache(){try{localStorage.setItem(KEY,JSON.stringify({state,queue}));}catch{cacheOK=false;}}
function readCache(){try{
  const c=JSON.parse(localStorage.getItem(KEY)||'null');
  if(c?.state?.app===APP && c.state.entries){state=c.state;queue=c.queue||{};
    // Upgrade the first version's unsent checkbox edits, without losing them.
    for(const p of Object.values(c.pending||{}))if(typeof p?.done==='boolean')queue[p.id]={...p,kind:'entry'};
  }
}catch{cacheOK=false;}}
function status(text,warn=false){$('save-status').textContent=text;$('save-status').classList.toggle('pending',warn);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function today(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return {active:p.year==='2026'&&p.month==='09'&&Number(p.day)>=2,day:Number(p.day)};}
const target=FeedingPlan.target;
const amount=n=>(n/10).toFixed(1).replace(/\.0$/,'');
function isDone(day){let done=state.entries[day]?.done||false;for(const op of Object.values(queue))if(op.kind==='entry'&&op.day===day)done=op.done;return done;}
function meals(){
  const map=new Map((state.meals||[]).map(m=>[m.id,{...m}]));
  for(const op of Object.values(queue)){
    if(op.kind==='meal'&&!map.has(op.id))map.set(op.id,{id:op.id,day:op.day,tenths:Math.round(op.grams*10),...(op.weighing?{weighing:op.weighing}:{}),recordedAt:op.recordedAt,deletedAt:null,pending:true});
    if(op.kind==='meal-status'&&map.has(op.mealId))map.set(op.mealId,{...map.get(op.mealId),deletedAt:op.deleted?op.recordedAt:null,pending:true});
  }
  return [...map.values()].sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));
}
function total(day){return meals().filter(m=>m.day===day&&!m.deletedAt).reduce((sum,m)=>sum+m.tenths,0);}
function remaining(day){const diff=target(day)*10-total(day);return diff>0?`还差 ${amount(diff)} g`:diff===0?'已达标':`已达标，超出 ${amount(-diff)} g`;}
function accept(data){if((data.revision||0)>=(state.revision||0))state=data;}
const mealInput=window.MealInput.create(document);
const rewards=window.CatRewards?.create();
let cloud=null;
async function api(path,body){
  if(!cloud)throw new Error('请先连接私有仓库');
  if(path==='state'||path==='export')return (await cloud.read()).state;
  if(path==='import')return cloud.write({kind:'import',id:backupOpId,payload:body});
  return cloud.write(body);
}

function enqueue(op){if(!loaded)return;op.id=op.id||crypto.randomUUID();rewards?.capture(op,{done:isDone(op.day),total:total(op.day)});queue[op.id]=op;cache();render();status('正在保存…',true);flush();}
async function flush(){
  if(busy)return;busy=true;clearTimeout(retryTimer);
  try{
    while(Object.keys(queue).length){
      const op=Object.values(queue)[0];
      let saved;
      try{saved=await api(op.kind,op);accept(saved);delete queue[op.id];}
      catch(e){if(e.validation){delete queue[op.id];rewards?.discard(op.id);toast('这条记录未保存：'+e.message);}else throw e;}
      cache();render();if(saved)rewards?.committed(op,saved,Object.values(queue));
    }
    status(cacheOK?'已同步至私有仓库':'已同步至私有仓库 · 浏览器缓存不可用');
  }catch{status('尚未同步 · 操作已保留，请检查网络或重新授权',true);retryTimer=setTimeout(flush,15000);}
  finally{busy=false;}
}
async function refresh(){if(busy||Object.keys(queue).length)return;try{accept(await api('state'));loaded=true;cache();render();status('已同步至私有仓库');}catch{status('连接已断开，请检查网络或重新授权',true);}}
function render(){
  const t=today();let count=0;
  for(let day=2;day<=30;day++){
    const done=isDone(day), input=$('day-'+day);input.checked=done;input.disabled=!loaded;
    input.parentElement.classList.toggle('done',done);input.parentElement.classList.toggle('today',t.active&&t.day===day);
    input.setAttribute('aria-label',`9月${day}日，目标${target(day)}克，已记录${amount(total(day))}克，${done?'已打勾，点击取消':'未打勾，喂完后点击打勾'}`);
    input.parentElement.title=`9月${day}日 · 已喂 ${amount(total(day))} g · ${remaining(day)}`;
    if(done)count++;
  }
  $('completed').textContent=count;$('progress').value=count;
  $('encouragement').textContent=count===29?'九月的每一天，都记下来了。':count===0?'第一顿，就从一条记录开始。':`已经认真照顾妙妙 ${count} 天啦。`;
  $('open-today-record').disabled=!loaded;$('open-records').disabled=!loaded;
  if(t.active){
    $('today-label').textContent='今天 · 上海时间';$('today-date').textContent=`9 月 ${t.day} 日`;
    $('today-portion').textContent=`目标 ${target(t.day)} g\n累计已喂 ${amount(total(t.day))} g\n${remaining(t.day)}`;
    $('open-today-record-label').textContent='记一顿饭';$('today-action-label').textContent=isDone(t.day)?'✓ 已打勾':'完成打勾';
    $('today-action').classList.toggle('is-done',isDone(t.day));$('today-action').disabled=!loaded;
  }else{
    $('today-label').textContent='九月记录';$('today-date').textContent='妙妙的 29 顿日常';$('today-portion').textContent='9 月 2 日起，每天记一勾';
    $('open-today-record-label').textContent='查看分次喂食';$('today-action-label').textContent='查看日历';$('today-action').disabled=false;
  }
  renderMeals();renderWeights();
}
function todayISO(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function weightMap(){const map={...(state.weights||{})};for(const op of Object.values(queue))if(op.kind==='weight')map[op.day]={hundredths:Math.round(op.kg*100)};return map;}
function weightFor(day){return WeightModel.effective(weightMap(),day,todayISO());}
const weightText=w=>(w.hundredths/100).toFixed(2)+' kg';
const weightSource=w=>w.measured?'当天已记录':w.sourceDay?`沿用 9 月 ${w.sourceDay} 日体重`:'沿用初始体重';
function renderWeights(){
  const date=todayISO(),t=today(),current=date.startsWith('2026-09')?weightFor(t.day):null;
  $('open-weight').disabled=!loaded||!current;
  $('today-weight').textContent=current?weightText(current):'—';
  $('today-weight-source').textContent=current?weightSource(current):'九月体重记录';
  for(let d=1;d<=30;d++){
    const w=weightFor(d),button=$('weight-'+d);button.hidden=!w;
    if(w){button.textContent=weightText(w);button.disabled=!loaded;button.classList.toggle('measured',w.measured);button.title=`9 月 ${d} 日 · ${weightSource(w)} · 点击记录或修改`;button.setAttribute('aria-label',`9月${d}日体重 ${weightText(w)}，${weightSource(w)}，点击修改`);}
    const option=$('weight-option-'+d);option.disabled=!w;option.hidden=!w;
  }
  if($('weight-dialog').open){const w=weightFor(Number($('weight-day').value));$('weight-source').textContent=w?`${weightText(w)} · ${weightSource(w)}`:'日期尚未到来';}
}
function openWeight(day){
  const w=weightFor(day);if(!w||!loaded)return;
  $('weight-day').value=String(day);$('weight-kg').value=(w.hundredths/100).toFixed(2);
  if(!$('weight-dialog').open)$('weight-dialog').showModal();renderWeights();$('weight-kg').focus();$('weight-kg').select();
}
function renderMeals(){
  if(!$('feed-dialog').open)return;
  const sum=total(selectedDay),diff=target(selectedDay)*10-sum;
  $('meal-target').textContent=target(selectedDay)+' g';$('meal-total').textContent=amount(sum)+' g';
  $('remaining-label').textContent=diff<0?'超出':'还差';$('meal-remaining').textContent=amount(Math.abs(diff))+' g';
  $('meal-message').textContent=diff>0?`还需 ${amount(diff)} g 达到当天目标。`:diff===0?'当天的目标已经完成啦。':`累计已达标，超过当天目标 ${amount(-diff)} g。`;
  $('meal-message').classList.toggle('achieved',diff<=0);$('add-meal').disabled=!loaded;
  const records=meals().filter(m=>m.day===selectedDay&&!m.deletedAt).reverse();$('meal-count').textContent=`${records.length} 次有效记录`;
  const list=$('meal-history');list.replaceChildren();
  if(!records.length){const li=document.createElement('li');li.className='empty-meals';li.textContent='还没有分次记录，喂完后记下第一顿吧。';list.append(li);}
  for(const m of records){
    const li=document.createElement('li');li.className='meal-row';
    const time=document.createElement('time');time.dateTime=m.recordedAt;time.textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(m.recordedAt));
    const qty=document.createElement('strong');qty.textContent=amount(m.tenths)+' g';
    const tag=document.createElement('span');tag.className='meal-tag';tag.textContent=m.pending?'待保存':'';
    const btn=document.createElement('button');btn.type='button';btn.textContent='撤销';btn.disabled=!loaded;
    btn.setAttribute('aria-label',`撤销 ${time.textContent} 的 ${amount(m.tenths)} 克记录`);
    btn.onclick=()=>enqueue({kind:'meal-status',mealId:m.id,deleted:true,recordedAt:new Date().toISOString()});
    const details=document.createElement('div');details.className='meal-quantity';details.append(qty);
    if(m.weighing){const formula=document.createElement('small');formula.textContent=`${amount(m.weighing.initialTenths)} − ${amount(m.weighing.endingTenths)} g`;details.append(formula);}
    li.append(time,details,tag,btn);list.append(li);
  }
}
function openMeals(day){selectedDay=day;$('feed-day').value=String(day);mealInput.reset();if(!$('feed-dialog').open)$('feed-dialog').showModal();renderMeals();mealInput.focus();}
function createCalendar(){
  const L=88,T=1208,cw=2304/7,rh=2092/5;
  for(let day=2;day<=30;day++){
    const row=Math.floor((day+1)/7),col=(day+1)%7,label=document.createElement('label');label.className='day';
    Object.assign(label.style,{left:(L+col*cw)/2480*100+'%',top:(T+row*rh)/3508*100+'%',width:cw/2480*100+'%',height:rh/3508*100+'%'});
    const input=document.createElement('input');input.type='checkbox';input.id='day-'+day;input.disabled=true;
    const tick=document.createElement('span');tick.className='check';tick.setAttribute('aria-hidden','true');tick.innerHTML='<svg viewBox="0 0 32 32"><path d="M6 17 L13 24 L27 7" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    label.append(input,tick);$('calendar').append(label);input.onchange=()=>enqueue({kind:'entry',day,done:input.checked});
    if(day>=FeedingPlan.changedFrom){const badge=document.createElement('span');badge.className='calendar-target';badge.textContent=target(day)+'g';badge.setAttribute('aria-hidden','true');label.append(badge);}
    const option=document.createElement('option');option.value=day;option.textContent=`9 月 ${day} 日 · ${target(day)} g`+(today().active&&today().day===day?' · 今天':'');$('feed-day').append(option);
  }
  for(let day=1;day<=30;day++){
    const row=Math.floor((day+1)/7),col=(day+1)%7,button=document.createElement('button');
    button.type='button';button.id='weight-'+day;button.className='calendar-weight';button.hidden=true;
    Object.assign(button.style,{left:(L+(col+1)*cw-190)/2480*100+'%',top:(T+row*rh+18)/3508*100+'%',width:175/2480*100+'%'});
    button.onclick=()=>openWeight(day);$('calendar').append(button);
    const option=document.createElement('option');option.id='weight-option-'+day;option.value=day;option.textContent=`9 月 ${day} 日`;option.disabled=true;$('weight-day').append(option);
  }
}
$('open-weight').onclick=()=>openWeight(today().day);
$('close-weight').onclick=()=>$('weight-dialog').close();
$('weight-day').onchange=()=>openWeight(Number($('weight-day').value));
$('weight-form').onsubmit=event=>{
  event.preventDefault();const day=Number($('weight-day').value),raw=$('weight-kg').value.trim(),kg=Number(raw);
  if(!weightFor(day)){toast('不能提前记录未来日期的体重');return;}
  if(!/^\d+(\.\d{1,2})?$/.test(raw)||!Number.isFinite(kg)||kg<.01||kg>100){toast('请输入 0.01–100 kg，最多两位小数');return;}
  enqueue({kind:'weight',day,kg});$('weight-dialog').close();
};
$('today-action').onclick=()=>{const t=today();if(t.active)enqueue({kind:'entry',day:t.day,done:!isDone(t.day)});else $('calendar').scrollIntoView({behavior:'smooth'});};
$('open-today-record').onclick=$('open-records').onclick=()=>openMeals(today().active?today().day:2);
$('close-feed').onclick=()=>$('feed-dialog').close();
$('feed-day').onchange=()=>{selectedDay=Number($('feed-day').value);mealInput.reset();renderMeals();};
$('back-today').onclick=()=>openMeals(today().active?today().day:2);
$('feed-form').onsubmit=event=>{
  event.preventDefault();if(!loaded)return;
  const result=mealInput.read();if(result.error)return;
  const n=result.grams;
  mealInput.reset();enqueue({kind:'meal',day:selectedDay,grams:n,...(result.weighing?{weighing:result.weighing}:{}),recordedAt:new Date().toISOString()});mealInput.focus();
};
$('export').onclick=async()=>{
  if(Object.keys(queue).length){await flush();if(Object.keys(queue).length){toast('还有记录未同步到私有仓库，请稍后再导出');return;}}
  try{const data=await api('export'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`妙妙九月喂饭备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，包含每次喂食记录');
  }catch{toast('暂时无法导出，请检查连接');}
};
$('import').onclick=()=>{if(busy||Object.keys(queue).length){toast('请等当前记录保存完成');return;}$('file').click();};
$('file').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>2000000)throw new Error();const data=JSON.parse(await file.text());
    if(data.app!==APP||![1,2,3,4].includes(data.version)||data.month!=='2026-09'||!data.entries||Array.isArray(data.entries))throw new Error();
    for(const [day,value] of Object.entries(data.entries))if(!/^([2-9]|[12][0-9]|30)$/.test(day)||typeof value?.done!=='boolean')throw new Error();
    backup=data;backupOpId=crypto.randomUUID();$('restore-dialog').showModal();
  }catch{toast('这不是有效的妙妙九月日历备份');}
};
$('cancel-restore').onclick=()=>$('restore-dialog').close();
$('confirm-restore').onclick=async()=>{
  $('confirm-restore').disabled=true;
  try{accept(await api('import',backup));cache();render();status('已同步至私有仓库');$('restore-dialog').close();toast('备份已恢复');}
  catch(e){toast(e.status?e.message:'未收到恢复确认，请检查连接后重试');}
  finally{$('confirm-restore').disabled=false;}
};
const sync=()=>{if(cloud&&loaded)return Object.keys(queue).length?flush():refresh();};
window.addEventListener('online',sync);
window.addEventListener('storage',event=>{if(event.key===KEY&&cloud&&loaded&&!busy){const own=queue;readCache();queue={...queue,...own};render();sync();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();sync();}});
const TOKEN_KEY=APP+':github-token';let backupOpId=null;
function showAuth(message=''){$('auth-panel').hidden=false;$('auth-error').textContent=message;$('auth-token').value='';}
async function connect(token,remember){
  $('connect').disabled=true;$('auth-error').textContent='正在连接私有仓库…';
  try{
    const candidate=new CloudData.GitHubStore({token});const data=(await candidate.read()).state;
    cloud=candidate;readCache();state=data;loaded=true;
    localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
    (remember?localStorage:sessionStorage).setItem(TOKEN_KEY,token);
    $('auth-token').value='';$('auth-panel').hidden=true;$('workspace').hidden=false;$('connection-tools').hidden=false;
    cache();render();if(Object.keys(queue).length)await flush();else status('已同步至私有仓库');
  }catch(e){$('auth-error').textContent=e.message||'连接失败，请检查网络和授权';}
  finally{$('connect').disabled=false;}
}
$('auth-form').onsubmit=e=>{e.preventDefault();const token=$('auth-token').value.trim();if(token)connect(token,$('remember-token').checked);};
$('reconnect').onclick=()=>showAuth('输入新的授权钥匙后重新连接；尚未同步的操作会保留。');
$('logout').onclick=()=>{
  if(busy||Object.keys(queue).length){toast('请先完成同步，再退出');return;}
  localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);localStorage.removeItem(KEY);
  rewards?.clear();cloud=null;loaded=false;state=CloudData.empty();queue={};render();$('workspace').hidden=true;$('connection-tools').hidden=true;
  showAuth();status('尚未连接私有记录');
};
createCalendar();render();
try{const token=localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(TOKEN_KEY);if(token)connect(token,!!localStorage.getItem(TOKEN_KEY));else status('尚未连接私有记录');}catch{showAuth('浏览器存储不可用，请允许此网站保存本地数据。');}
setInterval(()=>{if(!document.hidden)sync();},60000);
