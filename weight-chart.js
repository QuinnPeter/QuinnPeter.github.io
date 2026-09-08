(function(root){
  'use strict';
  const model=typeof module!=='undefined'&&module.exports?require('./weight-model.js'):root.WeightModel;
  const kg=n=>(n/100).toFixed(2);
  function series(weights,today){
    const points=[];let started=false;
    for(let day=1;day<=30;day++){
      if(`2026-09-${String(day).padStart(2,'0')}`>today)break;
      if(weights[day])started=true;
      if(started)points.push({day,...model.effective(weights,day,today)});
    }
    return points;
  }
  function bounds(points){
    const values=points.map(p=>p.hundredths),min=Math.min(...values),max=Math.max(...values);
    const step=Math.max(5,Math.ceil((max-min+10)/4/5)*5);
    const low=Math.max(0,Math.floor((min-5)/step)*step),high=Math.max(low+step*4,Math.ceil((max+5)/step)*step);
    return {low,high};
  }
  function create(doc){
    const $=id=>doc.getElementById(id),canvas=$('weight-chart-canvas'),svg=$('weight-chart-svg');
    let points=[],selected=null,signature='';
    const node=(name,attrs={},text)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
    function describe(p){return `9 月 ${p.day} 日 · ${kg(p.hundredths)} kg · ${p.measured?'当天实测':`沿用 9 月 ${p.sourceDay} 日体重`}`;}
    function select(day){
      selected=day;const p=points.find(p=>p.day===day);if(!p)return;
      $('weight-chart-detail').textContent=describe(p);
      for(const el of svg.querySelectorAll('[data-weight-day]')){
        const active=Number(el.getAttribute('data-weight-day'))===day;
        el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));
      }
    }
    function draw(){
      if(!points.length)return;
      const width=Math.max(280,canvas.clientWidth),height=240,L=52,R=24,T=20,B=38;
      const {low,high}=bounds(points),x=i=>points.length===1?(L+width-R)/2:L+i*(width-L-R)/(points.length-1),y=n=>T+(high-n)/(high-low)*(height-T-B);
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
      svg.append(node('title',{},'妙妙的九月体重走势'),node('desc',{},`从9月${points[0].day}日到9月${points.at(-1).day}日。实心点为当天实测，空心点为沿用前次体重。`));
      for(let i=0;i<=4;i++){
        const value=low+(high-low)*i/4,py=y(value);
        svg.append(node('line',{x1:L,x2:width-R,y1:py,y2:py,class:'weight-grid'}),node('text',{x:L-10,y:py+4,'text-anchor':'end',class:'weight-axis'},kg(value)));
      }
      const interval=Math.max(1,Math.ceil((points.length-1)/Math.max(1,Math.floor((width-L-R)/65))));
      points.forEach((p,i)=>{
        if(i){const prev=points[i-1];svg.append(node('line',{x1:x(i-1),y1:y(prev.hundredths),x2:x(i),y2:y(p.hundredths),class:`weight-line${p.measured?'':' carried'}`}));}
        if(i===0||i===points.length-1||(i%interval===0&&points.length-1-i>=interval))svg.append(node('text',{x:x(i),y:height-12,'text-anchor':'middle',class:'weight-axis'},`9/${p.day}`));
      });
      points.forEach((p,i)=>{
        const group=node('g',{'data-weight-day':p.day,tabindex:'0',role:'button','aria-label':describe(p),class:`weight-point${p.measured?' measured':''}`});
        group.append(node('title',{},describe(p)),node('circle',{cx:x(i),cy:y(p.hundredths),r:12,class:'weight-hit'}),node('circle',{cx:x(i),cy:y(p.hundredths),r:4.5,class:'weight-dot'}));
        group.addEventListener('click',()=>select(p.day));group.addEventListener('focus',()=>select(p.day));
        group.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();select(p.day);}
          if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
            event.preventDefault();const next=Math.max(0,Math.min(points.length-1,i+(event.key==='ArrowRight'?1:-1)));
            svg.querySelector(`[data-weight-day="${points[next].day}"]`).focus();
          }
        });
        svg.append(group);
      });
      select(selected);
    }
    function render(weights,today){
      const next=series(weights,today),key=JSON.stringify(next);if(key===signature)return;
      signature=key;points=next;
      $('weight-chart-empty').hidden=!!points.length;$('weight-chart-body').hidden=!points.length;
      if(!points.length){svg.replaceChildren();$('weight-chart-period').textContent='从首次称重，记录每一点成长';$('weight-chart-latest').textContent='—';$('weight-chart-change').textContent='初始体重 3.60 kg';selected=null;return;}
      const first=points[0],last=points.at(-1),delta=last.hundredths-first.hundredths;
      $('weight-chart-period').textContent=`9/${first.day} — 9/${last.day} · ${points.length} 天`;
      $('weight-chart-latest').textContent=kg(last.hundredths)+' kg';
      $('weight-chart-change').textContent=points.length===1?'第一笔体重记录':`较起点${delta>0?'增加':delta<0?'减少':'变化'} ${kg(Math.abs(delta))} kg`;
      if(!points.some(p=>p.day===selected))selected=last.day;
      canvas.style.minWidth=Math.max(280,points.length*24+76)+'px';
      draw();
    }
    if(root.ResizeObserver)new root.ResizeObserver(draw).observe(canvas);
    return {render};
  }
  const api={series,bounds,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WeightChart=api;
})(typeof window!=='undefined'?window:globalThis);
