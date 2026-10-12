(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  let student=null,games=[];
  function toast(msg){const e=$("studentToast");e.textContent=msg;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2500)}
  function load(){AppData.ensureSeedData();games=AppData.readArray("games").map(AppData.normalizeGame)}
  function login(){const id=$("studentLoginId").value.trim(),err=$("studentLoginError");const found=AppData.findStudent(id);if(!found||found.active===false){err.textContent="ไม่พบรหัสนักเรียนนี้ หรือบัญชีถูกปิดใช้งาน";err.style.display="block";return}student=found;sessionStorage.setItem("studentLogin",JSON.stringify({id:found.id}));err.style.display="none";showApp()}
  function restore(){try{const saved=JSON.parse(sessionStorage.getItem("studentLogin")||"null");if(saved?.id){const found=AppData.findStudent(saved.id);if(found&&found.active!==false){student=found;showApp();return}}}catch(_){}$("studentLogin").classList.remove("hidden")}
  function showApp(){load();$("studentLogin").classList.add("hidden");$("studentApp").classList.remove("hidden");$("studentWelcomeName").textContent=student?.name||"นักเรียน";renderGames()}
  function logout(){sessionStorage.removeItem("studentLogin");student=null;location.reload()}
  function refresh(){load();const latest=AppData.findStudent(student?.id);if(!latest||latest.active===false){logout();return}student=latest;renderGames();toast("อัปเดตเกมแล้ว")}
  function renderGames(){const active=games.filter(g=>g.active!==false);$("studentGameGrid").innerHTML=active.length?active.map(g=>`<article class="student-card"><img src="${esc(g.image||'./assets/animal-direction-cover.png')}" alt=""><div class="student-card-body"><h3>${esc(g.title)}</h3><p>${esc(g.description||'เกมการเรียนรู้ที่คุณครูจัดเตรียมไว้')}</p><div>${g.supportsTelemetry?'<span class="badge badge-purple">มีผลการเรียนรู้</span>':'<span class="badge badge-gray">บันทึกเวลาเล่น</span>'}</div><button class="btn btn-success btn-block" style="margin-top:auto" onclick="StudentApp.play('${esc(g.id)}')">▶ เล่นเกมนี้</button></div></article>`).join(""):'<div class="empty">ยังไม่มีเกมที่เปิดให้นักเรียนเล่น</div>'}
  function play(id){load();const g=games.find(x=>String(x.id)===String(id));if(!g||!student)return;const launch=AppData.makeId("launch");const p=new URLSearchParams({title:g.title,url:g.url,gameId:g.id,studentId:student.id,studentName:student.name,launchSessionId:launch,back:"student",telemetry:g.supportsTelemetry?"1":"0"});const w=window.open(`./game-player.html?${p.toString()}`,"_blank");if(!w)alert("กรุณาอนุญาต Popup เพื่อเปิดเกม")}
  window.addEventListener("message",event=>{if(event.origin!==location.origin)return;const m=event.data||{};if(m.type==="learning-game-result")toast("บันทึกผลการเล่นแล้ว ✓");if(m.type==="learning-game-player-closed")toast("กลับมาที่ห้องเกมแล้ว")});
  window.addEventListener("storage",()=>{if(student)refresh()});
  $("studentLoginId").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
  window.StudentApp={login,logout,refresh,play};
  restore();
})();
