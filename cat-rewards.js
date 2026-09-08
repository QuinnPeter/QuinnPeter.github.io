/* Visual feedback only. Never writes feeding records or credentials. */
(function(root){
  'use strict';
  const plan=typeof module!=='undefined'&&module.exports?require('./feeding-plan.js'):root.FeedingPlan;
  const goalFor=day=>plan.target(day)*10;
  class Tracker{
    constructor(){this.intents=new Map();this.goals=new Set();}
    capture(op,before={},now=Date.now()){
      for(const [id,item] of this.intents)if(now-item.time>120000)this.intents.delete(id);
      if(op.kind==='meal'||(op.kind==='entry'&&op.done&&!before.done))this.intents.set(op.id,{time:now,before});
    }
    discard(id){this.intents.delete(id);}
    clear(){this.intents.clear();}
    confirm(op,saved,pending=[],now=Date.now()){
      const intent=this.intents.get(op.id);this.intents.delete(op.id);
      if(!intent||now-intent.time>120000||!saved.appliedIds?.includes(op.id))return null;
      if(op.kind==='entry'){
        if(!saved.entries[op.day]?.done||pending.some(p=>p.kind==='entry'&&p.day===op.day&&!p.done))return null;
        return 'check';
      }
      const meal=saved.meals?.find(m=>m.id===op.id&&!m.deletedAt);
      if(!meal||pending.some(p=>p.kind==='meal-status'&&p.mealId===op.id&&p.deleted))return null;
      const sum=saved.meals.filter(m=>m.day===op.day&&!m.deletedAt).reduce((n,m)=>n+m.tenths,0);
      const goal=goalFor(op.day);
      // Count only this confirmed meal's crossing, including concurrent writes.
      if(sum>=goal&&sum-meal.tenths<goal&&intent.before.total<goal&&!this.goals.has(op.day)){
        this.goals.add(op.day);return 'goal';
      }
      return 'meal';
    }
  }
  function create(){
    const tracker=new Tracker(),anchors=new Map();let panel,image,message,heart1,heart2,tick,timer,frame,generation=0;
    const sources={meal:'cat-meal-hd.webp',goal:'cat-goal-hd.webp',check:'cat-check-hd.webp'};
    const words={meal:'这一顿也记好啦～',goal:'今天的饭饭够啦！',check:'今天也把妙妙照顾好啦！'};
    const labels={meal:'吃饭的小猫',goal:'探头的小猫',check:'伸懒腰的小猫'};
    Object.values(sources).forEach(src=>{const preload=new Image();preload.src=src;});
    function hide(){
      generation++;
      clearTimeout(timer);cancelAnimationFrame(frame);
      if(panel){if(panel.matches(':popover-open'))panel.hidePopover();panel.hidden=true;panel.removeAttribute('data-play');}
    }
    function init(){
      if(panel)return;
      panel=document.createElement('div');panel.className='cat-reward';panel.hidden=true;panel.setAttribute('popover','manual');
      message=document.createElement('div');message.className='cat-reward-message';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
      image=document.createElement('img');image.className='cat-reward-image';image.width=132;image.height=132;
      heart1=document.createElement('span');heart1.className='cat-reward-heart';heart1.textContent='♥';
      heart2=document.createElement('span');heart2.className='cat-reward-heart second';heart2.textContent='♥';
      tick=document.createElement('span');tick.className='cat-reward-tick';tick.textContent='✓';
      [heart1,heart2,tick].forEach(el=>el.setAttribute('aria-hidden','true'));
      panel.append(message,image,heart1,heart2,tick);document.body.append(panel);
    }
    async function show(kind,anchor){
      if(document.hidden)return;
      hide();init();image.src=sources[kind];image.alt=labels[kind];message.textContent=words[kind];
      const current=++generation;
      if(image.decode)await image.decode();
      if(current!==generation||document.hidden)return;
      const viewport=window.visualViewport;
      const vw=viewport?.width||window.innerWidth,vh=viewport?.height||window.innerHeight;
      const ox=viewport?.offsetLeft||0,oy=viewport?.offsetTop||0;
      const rect=anchor?.isConnected&&anchor.getClientRects().length?anchor.getBoundingClientRect():null;
      const width=Math.min(224,vw-24),height=196;
      const x=rect?rect.left+rect.width/2-width/2:vw-width-16;
      const y=rect?(rect.top-height-10>=oy+12?rect.top-height-10:rect.bottom+10):vh-height-24;
      panel.style.width=width+'px';panel.style.left=Math.max(ox+12,Math.min(x,ox+vw-width-12))+'px';
      panel.style.top=Math.max(oy+12,Math.min(y,oy+vh-height-12))+'px';
      panel.hidden=false;
      if(typeof panel.showPopover==='function'){document.body.append(panel);panel.showPopover();}
      else (document.querySelector('dialog[open]')||document.body).append(panel);
      void panel.offsetWidth;
      frame=requestAnimationFrame(()=>{panel.dataset.play=kind;timer=setTimeout(hide,2400);});
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){hide();tracker.clear();anchors.clear();}});
    window.addEventListener('resize',hide);
    window.visualViewport?.addEventListener('resize',hide);
    // Animation failures must never interfere with saving or retrying data.
    const safe=fn=>(...args)=>{try{return fn(...args);}catch{try{hide();}catch{}}};
    return {
      capture:safe((op,before)=>{
        tracker.capture(op,before);anchors.set(op.id,op.kind==='meal'?document.getElementById('add-meal'):document.activeElement);
        if(op.kind==='meal-status'||(op.kind==='entry'&&!op.done))hide();
        for(const id of anchors.keys())if(!tracker.intents.has(id))anchors.delete(id);
      }),
      committed:safe((op,saved,pending)=>{const anchor=anchors.get(op.id);anchors.delete(op.id);const kind=tracker.confirm(op,saved,pending);if(kind)show(kind,anchor).catch(()=>{});}),
      discard:safe(id=>{tracker.discard(id);anchors.delete(id);}),
      clear:safe(()=>{tracker.clear();anchors.clear();hide();})
    };
  }
  const api={Tracker,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CatRewards=api;
})(typeof window!=='undefined'?window:globalThis);
