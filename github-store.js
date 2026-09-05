/* Private repository adapter. No token is included in this file or in commits. */
(function(root){
  'use strict';
  const APP='miaomiao-feeding-2026-09';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const dateISO=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function invalid(message){const e=new Error(message);e.validation=true;throw e;}
  function id(v){if(typeof v!=='string'||!v.length||v.length>120||['__proto__','constructor','prototype'].includes(v))invalid('记录编号不正确');return v;}
  function day(v,weight=false,today=dateISO()){if(!Number.isInteger(v)||v<(weight?1:2)||v>30)invalid('日期不正确');if(weight&&`2026-09-${String(v).padStart(2,'0')}`>today)invalid('不能提前记录未来体重');return v;}
  function integer(v,min,max){if(!Number.isInteger(v)||v<min||v>max)invalid('记录数值不正确');return v;}
  function scaled(v,mult,max){if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v*mult-Math.round(v*mult))>1e-8)invalid('小数位数不正确');return integer(Math.round(v*mult),1,max);}
  function stamp(v){if(typeof v!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))invalid('记录时间不正确');return new Date(v).toISOString();}
  function empty(){return {app:APP,version:3,month:'2026-09',revision:0,entries:{},meals:[],weights:{},appliedIds:[]};}
  function validate(data,today=dateISO()){
    if(!data||data.app!==APP||![1,2,3].includes(data.version)||data.month!=='2026-09'||!data.entries||Array.isArray(data.entries)||typeof data.entries!=='object')invalid('不是有效的妙妙日历备份');
    const out=empty();
    for(const [key,v] of Object.entries(data.entries)){if(String(Number(key))!==key)invalid('日期不正确');day(Number(key));if(typeof v?.done!=='boolean')invalid('勾选状态不正确');out.entries[key]={done:v.done,updatedAt:stamp(v.updatedAt||new Date().toISOString())};}
    const meals=data.meals||[];if(!Array.isArray(meals))invalid('喂食记录格式不正确');const seen=new Set();
    for(const m of meals){const ident=id(m.id);if(seen.has(ident))invalid('喂食记录重复');seen.add(ident);out.meals.push({id:ident,day:day(m.day),tenths:integer(m.tenths,1,10000),recordedAt:stamp(m.recordedAt),deletedAt:m.deletedAt?stamp(m.deletedAt):null});}
    const weights=data.weights||{};if(typeof weights!=='object'||Array.isArray(weights))invalid('体重格式不正确');
    for(const [key,w] of Object.entries(weights)){if(String(Number(key))!==key)invalid('体重日期不正确');day(Number(key),true,today);out.weights[key]={hundredths:integer(w.hundredths,1,10000),updatedAt:stamp(w.updatedAt||new Date().toISOString())};}
    out.revision=Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0;
    if(data.appliedIds){if(!Array.isArray(data.appliedIds))invalid('同步历史格式不正确');out.appliedIds=[...new Set(data.appliedIds.map(id))];}
    return out;
  }
  function apply(source,op,today=dateISO()){
    const s=validate(source,today),ident=id(op.id);if(s.appliedIds.includes(ident))return s;
    const time=stamp(op.recordedAt||new Date().toISOString());
    switch(op.kind){
      case 'entry':day(op.day);if(typeof op.done!=='boolean')invalid('勾选状态不正确');s.entries[op.day]={done:op.done,updatedAt:time};break;
      case 'meal':{
        day(op.day);const tenths=scaled(op.grams,10,10000),existing=s.meals.find(m=>m.id===ident);
        if(existing&&(existing.day!==op.day||existing.tenths!==tenths))invalid('记录编号已存在');
        if(!existing)s.meals.push({id:ident,day:op.day,tenths,recordedAt:time,deletedAt:null});break;
      }
      case 'meal-status':{
        const m=s.meals.find(m=>m.id===op.mealId);if(!m)invalid('找不到该次喂食');if(typeof op.deleted!=='boolean')invalid('撤销状态不正确');m.deletedAt=op.deleted?time:null;break;
      }
      case 'weight':day(op.day,true,today);s.weights[op.day]={hundredths:scaled(op.kg,100,10000),updatedAt:time};break;
      case 'import':{
        const incoming=validate(op.payload,today);Object.assign(s.entries,incoming.entries);Object.assign(s.weights,incoming.weights);
        const map=new Map(s.meals.map(m=>[m.id,m]));incoming.meals.forEach(m=>map.set(m.id,m));s.meals=[...map.values()];break;
      }
      default:invalid('不支持的操作');
    }
    s.appliedIds.push(ident);s.revision++;return s;
  }
  function encode(value){const bytes=new TextEncoder().encode(JSON.stringify(value,null,2));let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text);}
  function decode(value){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0))));}
  class GitHubStore{
    constructor({token,owner='QuinnPeter',repo='miaomiao-data',branch='main',fetcher=fetch}){this.token=token;this.owner=owner;this.repo=repo;this.branch=branch;this.fetcher=fetcher;this.base=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;this.path='/contents/calendar-2026-09.json';this.checked=false;}
    async request(path,body){
      const r=await this.fetcher(this.base+path,{method:body?'PUT':'GET',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.token}`,'X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!r.ok){const e=new Error(r.status===401?'授权已失效，请重新连接':r.status===403?'无法访问，请检查仓库权限或稍后重试':r.status===404?'找不到私有仓库或记录文件，请检查授权':r.status===409?'另一台设备刚刚更新，正在合并':'GitHub 暂时无法保存，请稍后重试');e.status=r.status;throw e;}return r.json();
    }
    async check(){const info=await this.request('');if(!info.private)invalid('数据仓库必须保持私有，已停止连接');if(info.permissions&&(!info.permissions.pull||!info.permissions.push))invalid('请授予数据仓库 Contents 读写权限');this.checked=true;}
    async read(){if(!this.checked)await this.check();const file=await this.request(this.path+'?ref='+encodeURIComponent(this.branch));if(file.encoding!=='base64'||!file.content)invalid('数据文件不可读取');return {state:validate(decode(file.content)),sha:file.sha};}
    async write(op){
      for(let attempt=0;attempt<5;attempt++){
        const {state,sha}=await this.read();if(state.appliedIds.includes(op.id))return state;
        const next=apply(state,op);
        try{await this.request(this.path,{message:'Update calendar record',branch:this.branch,sha,content:encode(next)});return next;}
        catch(e){if(e.status!==409&&e.status!==422)throw e;}
      }
      throw new Error('其他设备正在更新，已保留本次操作，稍后重试');
    }
  }
  const api={GitHubStore,apply,validate,empty,encode,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CloudData=api;
})(typeof window!=='undefined'?window:globalThis);
