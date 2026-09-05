/* Only actual measurements are stored. Carry-forward values are derived for elapsed days. */
(function(root){
  function effective(weights,day,todayISO){
    if(day<1||day>30||`2026-09-${String(day).padStart(2,'0')}`>todayISO)return null;
    let hundredths=360,sourceDay=null;
    for(let d=1;d<=day;d++)if(weights[d]){hundredths=weights[d].hundredths;sourceDay=d;}
    return {hundredths,sourceDay,measured:sourceDay===day};
  }
  const api={effective};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WeightModel=api;
})(typeof window!=='undefined'?window:globalThis);
