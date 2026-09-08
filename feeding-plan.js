/* September 2026 plan: the change starts on September 8, not the viewing date. */
(function(root){
  'use strict';
  const target=day=>day>=8?55:Math.min(70,50+Math.floor((day-2)/2)*5);
  const api={target,changedFrom:8};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FeedingPlan=api;
})(typeof window!=='undefined'?window:globalThis);
