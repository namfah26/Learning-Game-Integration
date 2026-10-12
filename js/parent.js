(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  let student=null,games=[],usage=[],results=[];
  const gameKey=x=>{
    const id=String(x?.gameId||x?.gameTitle||"").trim();
    if(/^thaiw(?:-unity)?$/i.test(id)){
      const linked=games.filter(g=>/games\/thaiw\/?/i.test(String(g.url||"")));
      const named=linked.find(g=>String(g.title)===String(x?.gameTitle||""));
      return named?.id||(linked.length===1?linked[0].id:"thaiw-unity");
    }
    return id;
  };
  const resultDate=r=>new Date(r?.report?.session?.endedAtIso||r?.savedAtIso||r?.createdAt||0).getTime()||0;
  const usageDate=u=>new Date(u?.createdAt||0).getTime()||0;
  function toast(msg){const e=$("parentToast");e.textContent=msg;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2500)}
  function normalizeDob(v){if(!v)return"";const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m){let y=Number(m[1]);if(y>2400)y-=543;return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`}m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m){let y=Number(m[3]);if(y>2400)y-=543;return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`}return s}
  function load(){AppData.ensureSeedData();games=AppData.readArray("games").map(AppData.normalizeGame);usage=AppData.readArray("usageHistory");results=AppData.readArray("gameResults")}
  function login(){load();const id=$("parentStudentId").value.trim(),dob=normalizeDob($("parentStudentDob").value),err=$("parentLoginError");const found=AppData.findStudent(id);if(!found||found.active===false||normalizeDob(found.dob)!==dob){err.textContent="รหัสนักเรียนหรือวันเกิดไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน";err.style.display="block";return}student=found;sessionStorage.setItem("parentStudentId",student.id);err.style.display="none";showApp()}
  function restore(){load();const id=sessionStorage.getItem("parentStudentId");if(id){const found=AppData.findStudent(id);if(found&&found.active!==false){student=found;showApp();return}}$("parentLogin").classList.remove("hidden")}
  function showApp(){load();student=AppData.findStudent(student.id)||student;$("parentLogin").classList.add("hidden");$("parentApp").classList.remove("hidden");renderAll()}
  function logout(){sessionStorage.removeItem("parentStudentId");student=null;location.reload()}
  function fmtDate(v){if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString("th-TH",{day:"2-digit",month:"short",year:"numeric"})}
  function fmtDateTime(v){if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}
  function durationMs(u){if(Number.isFinite(Number(u.durationMs)))return Number(u.durationMs);const t=String(u.duration||"");const h=Number((t.match(/(\d+)\s*ชั่วโมง/)||[])[1]||0),m=Number((t.match(/(\d+)\s*นาที/)||[])[1]||0),s=Number((t.match(/(\d+)\s*วินาที/)||[])[1]||0);return ((h*3600)+(m*60)+s)*1000}
  function renderAll(){load();student=AppData.findStudent(student.id)||student;renderProfile();renderSummary();renderGameCards();$("parentGameDetail").innerHTML=""}
  function renderProfile(){$("parentProfile").innerHTML=`<section class="card"><div class="profile-head"><div><div class="profile-name">${esc(student.name)}</div><div class="profile-meta"><span class="badge badge-purple">รหัส ${esc(student.id)}</span></div></div><button class="btn btn-soft" onclick="ParentApp.openEdit()">✏ แก้ไขข้อมูลติดต่อ</button></div><div class="info-grid" style="margin-top:16px"><div class="info-item"><div class="k">วันเกิด</div><div class="v">${esc(student.dob||'-')}</div></div><div class="info-item"><div class="k">เบอร์โทรนักเรียน</div><div class="v">${esc(student.studentPhone||'-')}</div></div><div class="info-item"><div class="k">ชื่อผู้ปกครอง</div><div class="v">${esc(student.guardianName||'-')}</div></div><div class="info-item"><div class="k">ความสัมพันธ์</div><div class="v">${esc(student.guardianRelationship||'-')}</div></div><div class="info-item"><div class="k">เบอร์โทรผู้ปกครอง</div><div class="v">${esc(student.guardianPhone||'-')}</div></div><div class="info-item"><div class="k">ที่อยู่</div><div class="v">${esc(student.address||'-')}</div></div></div></section>`}
  function childUsage(){return usage.filter(u=>String(u.studentId)===String(student.id))}function childResults(){return results.filter(r=>String(r.studentId)===String(student.id))}
  function renderSummary(){const us=childUsage(),rs=childResults(),keys=new Set([...us.map(gameKey),...rs.map(gameKey)].filter(Boolean)),total=us.reduce((a,u)=>a+durationMs(u),0),latest=Math.max(0,...us.map(usageDate),...rs.map(resultDate));$("parentSummary").innerHTML=`<section class="grid grid-4"><div class="stat"><div class="label">เกมที่เคยเล่น</div><div class="value">${keys.size}</div><div class="sub">เกม</div></div><div class="stat"><div class="label">รอบการเล่น</div><div class="value">${Math.max(us.length,rs.length)}</div><div class="sub">รายการ</div></div><div class="stat"><div class="label">เวลาเล่นรวม</div><div class="value">${Math.round(total/60000)}</div><div class="sub">นาที</div></div><div class="stat"><div class="label">เล่นล่าสุด</div><div class="value" style="font-size:17px">${latest?fmtDate(latest):'-'}</div><div class="sub">วันที่ล่าสุด</div></div></section>`}
  function gameFromKey(k){return games.find(g=>String(g.id)===String(k))||games.find(g=>String(g.title)===String(k))||null}
  function renderGameCards(){
    const us=childUsage();
    const rs=childResults();
    const keys=[...new Set([...us.map(gameKey),...rs.map(gameKey)].filter(Boolean))];
    if(!keys.length){
      $("parentGameCards").innerHTML='<div class="empty">บุตรหลานยังไม่มีประวัติการเล่นเกม</div>';
      return;
    }
    const cards=keys.map(k=>{
      const gr=rs.filter(r=>gameKey(r)===k).sort((a,b)=>resultDate(b)-resultDate(a));
      const gu=us.filter(u=>gameKey(u)===k);
      const g=gameFromKey(k);
      const latest=gr[0];
      const title=g?.title||latest?.gameTitle||gu[0]?.gameTitle||k;
      const scorePct=latest?.report?.session?.scorePct;
      const rawScore=latest?.score??latest?.result?.score??latest?.report?.session?.score;
      const encodedKey=encodeURIComponent(k);
      return `<article class="game-card">
        <img class="game-cover" src="${esc(g?.image||'./assets/animal-direction-cover.png')}" alt="">
        <div class="game-body">
          <div class="game-title">${esc(title)}</div>
          <div class="game-desc">${esc(g?.description||'')}</div>
          <div class="hint">เล่น ${Math.max(gr.length,gu.length)} ครั้ง</div>
          <div class="game-actions"><button class="btn btn-sm btn-primary" onclick="ParentApp.openEncodedGame('${encodedKey}')">ดูผลเกม</button></div>
        </div>
      </article>`;
    }).join("");
    $("parentGameCards").innerHTML=`<div class="game-grid">${cards}</div>`;
  }
  function openEncodedGame(encoded){ openGame(decodeURIComponent(encoded)); }
  function openGame(k){
    load();
    const game=gameFromKey(k);
    if(ThaiWDashboard.isThaiW({gameId:game?.id||k})){
      const rs=childResults().filter(r=>gameKey(r)===k).sort((a,b)=>resultDate(a)-resultDate(b));
      const us=childUsage().filter(u=>gameKey(u)===k).sort((a,b)=>usageDate(a)-usageDate(b));
      const title=game?.title||rs[0]?.gameTitle||us[0]?.gameTitle||k;
      const target=$("parentGameDetail");
      target.innerHTML=ThaiWDashboard.renderDetail(student.id,rs,us,title);
      ThaiWDashboard.attach(target,student.id,rs,us);
      requestAnimationFrame(()=>ThaiWDashboard.draw(target,student.id,rs,us));
      scrollDetail();
      return;
    }
    const rs=childResults().filter(r=>gameKey(r)===k).sort((a,b)=>resultDate(a)-resultDate(b)),us=childUsage().filter(u=>gameKey(u)===k).sort((a,b)=>usageDate(b)-usageDate(a)),g=gameFromKey(k),title=g?.title||rs[0]?.gameTitle||us[0]?.gameTitle||k;if(!rs.some(r=>r?.report?.session?.scorePct!=null||r?.report?.session?.score!=null||r?.score!=null||r?.result?.score!=null)){
    $("parentGameDetail").innerHTML=`<section class="card"><h2>${esc(title)}</h2><p class="hint">เกมนี้ยังไม่มีผลคะแนน จึงแสดงเฉพาะเวลาเข้าเล่นที่เว็บไซต์บันทึกได้</p>${UsageChart.render(us,title)}</section>`;
    requestAnimationFrame(()=>UsageChart.draw($("parentGameDetail"),us));scrollDetail();return;
  }const latest=rs[rs.length-1],s=latest.report?.session||{},r=latest.report?.overallRadar||{},points=rs.map((x,i)=>({label:String(i+1),value:num(x.report?.session?.scorePct)}));$("parentGameDetail").innerHTML=`<section class="card"><div class="profile-head"><div><h2>${esc(title)}</h2><div class="hint">ผลรอบล่าสุด ${fmtDateTime(s.endedAtIso||latest.savedAtIso)}</div></div><span class="badge badge-purple">เล่นแล้ว ${rs.length} รอบที่มีคะแนน</span></div><div class="result-hero" style="margin-top:16px"><div class="score-ring" style="--score:${Math.round(num(s.scorePct))}%"><div class="inside"><div class="num">${Math.round(num(s.scorePct))}%</div><div class="lab">คะแนนรวม</div></div></div>${bars(r)}</div></section><section class="chart-grid"><div class="chart-box"><h3>ผล 4 ทิศ — รอบล่าสุด</h3><canvas id="parentRadar"></canvas></div><div class="chart-box"><h3>พัฒนาการของคะแนน</h3><canvas id="parentTrend"></canvas></div></section><section class="card"><h2>ประวัติการเล่น</h2><div class="table-wrap"><table><thead><tr><th>ครั้ง</th><th>วันที่</th><th>คะแนน</th><th>เวลาเล่น</th></tr></thead><tbody>${[...rs].reverse().map((x,i)=>{const ss=x.report?.session||{};return `<tr><td>${rs.length-i}</td><td>${fmtDateTime(ss.endedAtIso||x.savedAtIso)}</td><td><span class="badge badge-green">${Math.round(num(ss.scorePct))}%</span></td><td>${Math.round(num(ss.measuredDurationMs)/1000)} วิ</td></tr>`}).join("")}</tbody></table></div></section>`;requestAnimationFrame(()=>{GameCharts.drawRadar($("parentRadar"),r);GameCharts.drawTrend($("parentTrend"),points)});scrollDetail()}
  function bars(r){return `<div class="direction-list">${[["↑ บน",r.up],["→ ขวา",r.right],["↓ ล่าง",r.down],["← ซ้าย",r.left]].map(([l,v])=>`<div class="dir-row"><div class="dir-label">${l}</div><div class="bar"><span style="--pct:${Math.round(num(v))}%"></span></div><div class="dir-val">${Math.round(num(v))}%</div></div>`).join("")}</div>`}
  function usageTable(us){if(!us.length)return'<div class="empty">ยังไม่มีประวัติการเล่น</div>';return `<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>วันที่</th><th>เริ่ม</th><th>จบ</th><th>ระยะเวลา</th></tr></thead><tbody>${us.map(u=>`<tr><td>${esc(u.date||fmtDate(u.createdAt))}</td><td>${esc(u.startTime||'-')}</td><td>${esc(u.endTime||'-')}</td><td>${esc(u.duration||Math.round(durationMs(u)/1000)+' วิ')}</td></tr>`).join("")}</tbody></table></div>`}
  // All game types use the same close control, regardless of telemetry support.
  function closeGameDetail(){
    const report=$("parentGameDetail");
    if(report)report.replaceChildren();
    const cards=$("parentGameCards");
    if(cards)cards.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function scrollDetail(){
    const report=$("parentGameDetail");
    if(report && report.children.length && !report.querySelector(".game-report-toolbar")){
      const toolbar=document.createElement("div");
      toolbar.className="game-report-toolbar";
      const close=document.createElement("button");
      close.type="button";
      close.className="btn btn-soft game-report-close";
      close.textContent="✕ ปิดผลเกม";
      close.setAttribute("aria-label","ปิดผลเกมและกลับไปเลือกเกม");
      close.addEventListener("click",closeGameDetail);
      toolbar.appendChild(close);
      report.prepend(toolbar);
    }
    setTimeout(()=>report?.scrollIntoView({behavior:"smooth",block:"start"}),60);
  }
  function openEdit(){$("editStudentPhone").value=student.studentPhone||"";$("editGuardianName").value=student.guardianName||"";$("editGuardianRelationship").value=student.guardianRelationship||"";$("editGuardianPhone").value=student.guardianPhone||"";$("editAddress").value=student.address||"";$("profileEditModal").classList.add("show")}
  function closeEdit(){$("profileEditModal").classList.remove("show")}
  function saveEdit(e){e.preventDefault();student=AppData.saveStudent({...student,studentPhone:$("editStudentPhone").value.trim(),guardianName:$("editGuardianName").value.trim(),guardianRelationship:$("editGuardianRelationship").value.trim(),guardianPhone:$("editGuardianPhone").value.trim(),address:$("editAddress").value.trim()},"parent");closeEdit();renderAll();toast("อัปเดตข้อมูลแล้ว ข้อมูลหน้าครูจะเปลี่ยนตามใน browser เดียวกัน")}
  $("parentEditForm").addEventListener("submit",saveEdit);$("parentStudentDob").addEventListener("keydown",e=>{if(e.key==="Enter")login()});window.addEventListener("storage",()=>{if(student)renderAll()});
  window.ParentApp={login,logout,openGame,openEncodedGame,closeGameDetail,openEdit,closeEdit};
  restore();
})();
