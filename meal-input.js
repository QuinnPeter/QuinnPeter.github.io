(function(root){
  'use strict';
  const text=tenths=>(tenths/10).toFixed(1).replace(/\.0$/,'');
  function parse(raw){
    raw=String(raw).trim();
    if(!/^\d+(\.\d)?$/.test(raw))return null;
    const n=Number(raw);
    return Number.isFinite(n)&&n<=10000?Math.round(n*10):null;
  }
  function calculate(initial,ending){
    if(!String(initial).trim()||!String(ending).trim())return {error:'请输入初始重量和结束重量。',empty:true};
    const start=parse(initial),end=parse(ending);
    if(start===null||end===null)return {error:'重量请输入 0–10000 g，最多一位小数。'};
    if(end>start)return {error:'结束重量不能大于初始重量，请检查称重数值。'};
    const tenths=start-end;
    if(tenths===0)return {error:'两次重量相同，本次吃了 0 g，无需记录。'};
    if(tenths>10000)return {error:'本次吃掉的粮食不能超过 1000 g，请检查称重数值。'};
    return {grams:tenths/10,formula:`${text(start)} − ${text(end)} = ${text(tenths)} g`};
  }
  function create(doc){
    const $=id=>doc.getElementById(id);
    let mode='weigh';
    function update(){
      const result=calculate($('meal-initial').value,$('meal-ending').value);
      $('meal-calculation').textContent=result.error?(result.empty?'本次吃了 — g':result.error):`本次吃了 ${text(Math.round(result.grams*10))} g`;
      $('meal-calculation').classList.toggle('invalid',!!result.error&&!result.empty);
      $('meal-formula').textContent=result.error?'初始重量 − 结束重量':result.formula;
      $('meal-input-error').textContent='';
    }
    function setMode(next){
      mode=next;
      for(const name of ['weigh','direct']){
        const active=name===mode;
        $('meal-mode-'+name).setAttribute('aria-pressed',String(active));
        $('meal-'+name+'-fields').hidden=!active;
      }
      $('meal-grams').disabled=mode!=='direct';
      $('meal-grams').required=mode==='direct';
      for(const id of ['meal-initial','meal-ending']){
        $(id).disabled=mode!=='weigh';$(id).required=mode==='weigh';
      }
      $('meal-input-error').textContent='';
    }
    function reset(){
      for(const id of ['meal-initial','meal-ending','meal-grams'])$(id).value='';
      update();
    }
    function focus(){ $(mode==='weigh'?'meal-initial':'meal-grams').focus(); }
    function read(){
      const result=mode==='weigh'?calculate($('meal-initial').value,$('meal-ending').value):(()=>{
        const tenths=parse($('meal-grams').value);
        return tenths!==null&&tenths>=1&&tenths<=10000?{grams:tenths/10}:{error:'请输入 0.1–1000 g，最多一位小数。'};
      })();
      $('meal-input-error').textContent=result.error||'';
      return result;
    }
    for(const name of ['weigh','direct'])$('meal-mode-'+name).onclick=()=>{setMode(name);focus();};
    for(const id of ['meal-initial','meal-ending'])$(id).addEventListener('input',update);
    $('meal-grams').addEventListener('input',()=>$('meal-input-error').textContent='');
    setMode('weigh');reset();
    return {reset,focus,read};
  }
  const api={calculate,create};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MealInput=api;
})(typeof window==='undefined'?globalThis:window);
