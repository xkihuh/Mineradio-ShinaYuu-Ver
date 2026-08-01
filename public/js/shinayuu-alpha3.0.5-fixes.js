(function(){
'use strict';
var BOTH_KEY='shinayuu-account-source-mode-v1';
function text(vi,en){return window.appLanguage==='en'?en:vi;}
function setBoth(on){
  try{localStorage.setItem(BOTH_KEY,on?'both':'single');}catch(_){ }
  document.body.classList.toggle('shinayuu-both-sources',!!on);
  var b=document.getElementById('use-both-sources-btn'); if(b)b.classList.toggle('active',!!on);
  try{if(typeof window.refreshLoginStatus==='function')window.refreshLoginStatus();}catch(_){ }
}
window.enableBothMusicSources=function(){setBoth(true);try{if(typeof window.showToast==='function')window.showToast(text('Đã bật chế độ dùng cả YouTube Music và Spotify.','Both YouTube Music and Spotify are enabled.'));}catch(_){}};
function ensureSystemUpdate(){
  var button=document.getElementById('fx-check-update-btn');
  if(!button)return;
  var main=document.getElementById('fx-check-update-main');
  var status=document.getElementById('fx-check-update-status');
  if(main&&!main.dataset.busy)main.textContent=text('Kiểm tra cập nhật','Check for updates');
  if(status&&!status.textContent.trim())status.textContent=text('Sẵn sàng','Ready');
}
function tightenHistory(){var r=document.getElementById('search-results');if(r){r.style.setProperty('margin-top','0px','important');r.style.setProperty('top','auto','important');}}
function safeToastGuard(){
  if(typeof window.showToast!=='function'||window.showToast.__syGuard)return;
  var original=window.showToast;function wrapped(message){var m=String(message||'');if(/已开启歌词|歌词已开启|歌词已关闭|Đã bật lời bài hát|Đã tắt lời bài hát|Lyrics enabled|Lyrics disabled/i.test(m))return;return original.apply(this,arguments);}wrapped.__syGuard=true;window.showToast=wrapped;
}
function boot(){
  var mode='single';try{mode=localStorage.getItem(BOTH_KEY)||'single';}catch(_){ }
  setBoth(mode==='both');ensureSystemUpdate();tightenHistory();safeToastGuard();
  document.addEventListener('shinayuu-language-change',function(){ensureSystemUpdate();});
  setTimeout(function(){tightenHistory();ensureSystemUpdate();},0);setTimeout(function(){tightenHistory();ensureSystemUpdate();},600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
