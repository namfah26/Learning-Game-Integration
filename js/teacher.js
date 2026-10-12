(function(){
  "use strict";

  const state={students:[],games:[],usage:[],results:[],selectedStudentId:"",selectedGameKey:""};
  const MAX_ACTIVE_GAMES=5;
  const COVER_MAX_WIDTH=960;
  const COVER_MAX_HEIGHT=540;
  const COVER_QUALITY=0.72;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const attr=esc;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;

  function toast(message){const el=$("teacherToast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
  function load(){AppData.ensureSeedData();state.students=AppData.readArray("students").map(AppData.normalizeStudent);state.games=AppData.readArray("games").map(AppData.normalizeGame);state.usage=AppData.readArray("usageHistory");state.results=AppData.readArray("gameResults")}
  function fmtDate(v){if(!v)return "-";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString("th-TH",{day:"2-digit",month:"short",year:"numeric"})}
  function fmtDateTime(v){if(!v)return "-";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}
  function fmtMs(ms){const s=Math.max(0,Math.round(num(ms)/1000));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?`${h} ชม. ${m} นาที`:m?`${m} นาที ${sec} วิ`:`${sec} วิ`}
  function resultDate(r){return new Date(r?.report?.session?.endedAtIso||r?.savedAtIso||r?.createdAt||0).getTime()||0}
  function usageDate(u){return new Date(u?.createdAt||0).getTime()||0}
  function gameKey(item){
    const id=String(item?.gameId||item?.gameTitle||"").trim();
    if(/^thaiw(?:-unity)?$/i.test(id)){
      const linked=state.games.filter(g=>/games\/thaiw\/?/i.test(String(g.url||"")));
      const named=linked.find(g=>String(g.title)===String(item?.gameTitle||""));
      return named?.id||(linked.length===1?linked[0].id:"thaiw-unity");
    }
    return id;
  }
  function gameFromKey(key){return state.games.find(g=>String(g.id)===String(key))||state.games.find(g=>String(g.title)===String(key))||null}

  function login(){const u=$("teacherUsername").value.trim(),p=$("teacherPassword").value;const e=$("teacherLoginError");if(u==="admin"&&p==="12345678"){sessionStorage.setItem("teacherLoggedIn","1");e.style.display="none";showApp();return}e.textContent="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";e.style.display="block"}
  function logout(){sessionStorage.removeItem("teacherLoggedIn");location.reload()}
  function showApp(){load();$("teacherLogin").classList.add("hidden");$("teacherApp").classList.remove("hidden");renderAll();showView("dashboard");optimizeStoredGameImages().catch(error=>console.warn("[Teacher] cover optimization failed",error))}

  function showView(name){document.querySelectorAll(".teacher-view").forEach(v=>v.classList.add("hidden"));const target=$("view-"+name);if(target)target.classList.remove("hidden");document.querySelectorAll("#teacherNav .nav-tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="dashboard")renderDashboard();if(name==="students")renderStudents();if(name==="games")renderGames();if(name==="results")renderResultStudents();if(name==="tools")renderTools()}

  function renderAll(){renderDashboard();renderStudents();renderGames();renderResultStudents();renderTools()}

  function renderDashboard(){load();const activeStudents=state.students.length,activeGames=state.games.length;const totalMinutes=Math.round(state.usage.reduce((a,u)=>a+durationFromUsage(u),0)/60000);$("dashboardStats").innerHTML=[
    ["นักเรียนทั้งหมด",activeStudents,"คน"],["เกมในระบบ",activeGames,"เกม"],["รอบการเล่น",state.usage.length,"ครั้ง"],["ผลเกมที่รับได้",state.results.length,"รอบ"]
  ].map(([l,v,s])=>`<div class="stat"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

    const latest=[...state.usage].sort((a,b)=>usageDate(b)-usageDate(a)).slice(0,8);
    $("recentUsage").innerHTML=latest.length?`<div class="table-wrap"><table><thead><tr><th>นักเรียน</th><th>เกม</th><th>ล่าสุด</th></tr></thead><tbody>${latest.map(u=>`<tr><td>${esc(u.studentName||u.studentId||"-")}</td><td>${esc(u.gameTitle||"-")}</td><td>${esc(u.date||fmtDate(u.createdAt))}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ยังไม่มีประวัติการเล่น</div>`;
    const backend=(window.BackendConfig&&window.BackendConfig.sheetsEnabled)?`<div class="notice">Google Sheet endpoint ถูกตั้งค่าแล้ว ผลเกมที่รองรับจะพยายามส่งขึ้น Sheet อัตโนมัติ</div>`:`<div class="notice warn">ขณะนี้ข้อมูลหลักยังอยู่ใน LocalStorage ของ browser เหมาะสำหรับทดลองในเครื่องเดียวกัน ก่อนย้ายไปฐานข้อมูลกลาง</div>`;
    $("systemStatus").innerHTML=`${backend}<div class="stat" style="margin-top:12px"><div class="label">เวลาเล่นรวมโดยประมาณ</div><div class="value">${totalMinutes}</div><div class="sub">นาที จากประวัติที่บันทึกไว้</div></div>`;
  }

  function durationFromUsage(u){if(Number.isFinite(Number(u.durationMs)))return Number(u.durationMs);const text=String(u.duration||"");const h=Number((text.match(/(\d+)\s*ชั่วโมง/)||[])[1]||0),m=Number((text.match(/(\d+)\s*นาที/)||[])[1]||0),s=Number((text.match(/(\d+)\s*วินาที/)||[])[1]||0);return ((h*3600)+(m*60)+s)*1000}

  function renderStudents(){load();const q=String($("studentSearch")?.value||"").toLowerCase().trim();let rows=[...state.students];if(q)rows=rows.filter(s=>`${s.id} ${s.name} ${s.guardianName}`.toLowerCase().includes(q));rows.sort((a,b)=>String(a.id).localeCompare(String(b.id),"th"));$("studentTable").innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ผู้ปกครอง</th><th>โทร</th><th>จัดการ</th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.id)}</b></td><td>${esc(s.name)}</td><td>${esc(s.guardianName||"-")}</td><td>${esc(s.guardianPhone||s.studentPhone||"-")}</td><td><button class="btn btn-sm btn-soft" onclick="TeacherApp.editStudent('${attr(s.id)}')">แก้ไข</button> <button class="btn btn-sm btn-primary" onclick="TeacherApp.openStudentProfile('${attr(s.id)}')">ดูผล</button> <button class="btn btn-sm btn-danger" onclick="TeacherApp.deleteStudent('${attr(s.id)}')">ลบ</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ไม่พบนักเรียน</div>`}

  function studentFormSubmit(e){e.preventDefault();load();const id=$("studentId").value.trim(),editing=$("studentEditingId").value.trim();if(!id||!$("studentName").value.trim()||!$("studentDob").value)return;if(!editing&&state.students.some(s=>String(s.id)===id)){alert("รหัสนักเรียนนี้มีอยู่แล้ว");return}if(editing&&editing!==id&&state.students.some(s=>String(s.id)===id)){alert("รหัสนักเรียนใหม่ซ้ำกับนักเรียนคนอื่น");return}let old=editing?state.students.find(s=>String(s.id)===editing):null;if(editing&&editing!==id){const list=state.students.filter(s=>String(s.id)!==editing);AppData.writeArray("students",list);migrateStudentId(editing,id)}AppData.saveStudent({...(old||{}),id,name:$("studentName").value.trim(),dob:$("studentDob").value,studentPhone:$("studentPhone").value.trim(),guardianName:$("guardianName").value.trim(),guardianRelationship:$("guardianRelationship").value.trim(),guardianPhone:$("guardianPhone").value.trim(),address:$("studentAddress").value.trim(),active:true},"teacher");cancelStudentEdit();load();renderAll();toast("บันทึกข้อมูลนักเรียนแล้ว")}
  function migrateStudentId(oldId,newId){["usageHistory","gameResults"].forEach(key=>{const arr=AppData.readArray(key).map(x=>String(x.studentId)===String(oldId)?{...x,studentId:newId}:x);AppData.writeArray(key,arr)})}
  function editStudent(id){load();const s=state.students.find(x=>String(x.id)===String(id));if(!s)return;$("studentEditingId").value=s.id;$("studentId").value=s.id;$("studentName").value=s.name;$("studentDob").value=s.dob;$("studentPhone").value=s.studentPhone||"";$("guardianName").value=s.guardianName||"";$("guardianRelationship").value=s.guardianRelationship||"";$("guardianPhone").value=s.guardianPhone||"";$("studentAddress").value=s.address||"";$("studentFormTitle").textContent="แก้ไขข้อมูลนักเรียน";$("studentCancelEdit").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"})}
  function cancelStudentEdit(){$("studentForm").reset();$("studentEditingId").value="";$("studentFormTitle").textContent="เพิ่มนักเรียน";$("studentCancelEdit").classList.add("hidden")}

  function deleteStudent(id){load();const student=state.students.find(s=>String(s.id)===String(id));if(!student)return;const ok=confirm(`ยืนยันลบนักเรียน “${student.name}” (${student.id}) ออกจากระบบหรือไม่?\n\nประวัติการเล่นและผลเกมเดิมจะยังถูกเก็บไว้จนกว่าคุณครูจะสั่ง “ล้างประวัติการเล่นทั้งหมด”`);if(!ok)return;AppData.deleteStudent(id);if(String(state.selectedStudentId)===String(id)){state.selectedStudentId="";state.selectedGameKey=""}load();renderAll();toast("ลบนักเรียนออกจากระบบแล้ว") }

  async function importStudents(){const file=$("studentExcelFile").files[0];if(!file){alert("กรุณาเลือกไฟล์ Excel");return}if(typeof XLSX==="undefined"){alert("ไม่สามารถโหลด SheetJS ได้ กรุณาเชื่อมอินเทอร์เน็ตแล้วลองใหม่");return}const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array",cellDates:true});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});let added=0,updated=0;for(const r of rows){const id=pick(r,["รหัสนักเรียน","รหัส","studentId","id"]);const name=pick(r,["ชื่อ-นามสกุล","ชื่อ","name"]);if(!id||!name)continue;const existing=AppData.findStudent(String(id));const dob=normalizeExcelDate(pick(r,["วันเกิด","วันเดือนปีเกิด","dob"]));AppData.saveStudent({...(existing||{}),id:String(id).trim(),name:String(name).trim(),dob:dob||(existing?.dob||""),studentPhone:String(pick(r,["เบอร์โทรนักเรียน","โทรนักเรียน","studentPhone"])||existing?.studentPhone||""),guardianName:String(pick(r,["ชื่อผู้ปกครอง","guardianName"])||existing?.guardianName||""),guardianRelationship:String(pick(r,["ความสัมพันธ์","guardianRelationship"])||existing?.guardianRelationship||""),guardianPhone:String(pick(r,["เบอร์โทรผู้ปกครอง","โทรผู้ปกครอง","guardianPhone"])||existing?.guardianPhone||""),address:String(pick(r,["ที่อยู่","address"])||existing?.address||""),active:true},"teacher-import");existing?updated++:added++}load();renderAll();toast(`นำเข้าแล้ว เพิ่ม ${added} / อัปเดต ${updated}`)}
  function pick(obj,keys){for(const k of keys){if(Object.prototype.hasOwnProperty.call(obj,k)&&obj[k]!=="")return obj[k]}return ""}
  function normalizeExcelDate(v){if(!v)return "";if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m){let y=Number(m[1]);if(y>2400)y-=543;return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`}m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m){let y=Number(m[3]);if(y>2400)y-=543;return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`}return ""}

  function renderGames(){load();const currentCount=state.games.length;const limitEl=$("gameLimitStatus");if(limitEl){limitEl.textContent=`เกมในระบบ ${currentCount}/${MAX_ACTIVE_GAMES}`;limitEl.className=`badge ${currentCount>=MAX_ACTIVE_GAMES?'badge-gray':'badge-purple'}`}const games=[...state.games];$("gameList").innerHTML=games.length?`<div class="game-grid">${games.map(g=>`<article class="game-card"><img class="game-cover" src="${attr(g.image||'./assets/animal-direction-cover.png')}" alt=""><div class="game-body"><div class="game-title">${esc(g.title)}</div><div class="game-desc">${esc(g.description||"ยังไม่มีคำอธิบาย")}</div><div>${g.supportsTelemetry?'<span class="badge badge-purple">ส่งผลคะแนนได้</span>':'<span class="badge badge-gray">เก็บเวลาเล่น</span>'}</div><div class="game-actions"><button class="btn btn-sm btn-primary" onclick="TeacherApp.previewGame('${attr(g.id)}')">ทดลอง</button><button class="btn btn-sm btn-soft" onclick="TeacherApp.editGame('${attr(g.id)}')">แก้ไข</button><button class="btn btn-sm btn-danger" onclick="TeacherApp.deleteGame('${attr(g.id)}')">ลบ</button></div></div></article>`).join("")}</div>`:`<div class="empty">ยังไม่มีเกม</div>`}

  function deleteGame(id){load();const game=state.games.find(g=>String(g.id)===String(id));if(!game)return;const ok=confirm(`ยืนยันลบเกม “${game.title}” ออกจากรายการหรือไม่?\n\nผลการเล่นและประวัติเดิมของเกมนี้จะยังถูกเก็บไว้จนกว่าคุณครูจะสั่ง “ล้างประวัติการเล่นทั้งหมด”`);if(!ok)return;AppData.deleteGame(id);if(String(state.selectedGameKey)===String(id))state.selectedGameKey="";load();renderAll();toast("ลบเกมออกจากรายการแล้ว") }

  async function gameFormSubmit(e){
    e.preventDefault();
    load();
    const editing=$("gameEditingId").value.trim();
    const old=editing?state.games.find(g=>String(g.id)===editing):null;
    const currentCount=state.games.length;
    if(!old&&currentCount>=MAX_ACTIVE_GAMES){alert(`รุ่นทดลองนี้เพิ่มเกมได้สูงสุด ${MAX_ACTIVE_GAMES} เกม\nกรุณาลบเกมที่ไม่ใช้ก่อน แล้วจึงเพิ่มเกมใหม่`);return}
    let image=old?.image||"";
    const file=$("gameImage").files[0];
    try{
      if(file)image=await optimizeImageFile(file);
      const game={...(old||{}),id:editing||AppData.makeId("game"),title:$("gameTitle").value.trim(),url:$("gameUrl").value.trim(),description:$("gameDescription").value.trim(),image,supportsTelemetry:$("gameTelemetry").checked,active:true};
      AppData.saveGame(game);
    }catch(error){
      console.error("[Teacher] save game failed",error);
      if(error?.name==="QuotaExceededError"||String(error).toLowerCase().includes("quota")) alert("พื้นที่เก็บข้อมูลใน browser เต็ม\nระบบพยายามบีบอัดรูปแล้ว แต่ข้อมูลเดิมอาจมีรูปขนาดใหญ่ กรุณาแก้ไขเกมเดิมแล้วเลือกรูปปกใหม่อีกครั้ง หรือลบเกมที่ไม่ใช้");
      else alert("บันทึกเกมไม่สำเร็จ: "+(error?.message||error));
      return;
    }
    cancelGameEdit();load();renderAll();toast("บันทึกเกมแล้ว");
  }

  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsDataURL(file)})}
  function imageFromUrl(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("อ่านรูปภาพไม่สำเร็จ"));img.src=url})}
  async function compressDataUrl(dataUrl,maxWidth=COVER_MAX_WIDTH,maxHeight=COVER_MAX_HEIGHT,quality=COVER_QUALITY){
    if(!String(dataUrl||"").startsWith("data:image/"))return dataUrl;
    const img=await imageFromUrl(dataUrl);
    const scale=Math.min(1,maxWidth/img.naturalWidth,maxHeight/img.naturalHeight);
    const width=Math.max(1,Math.round(img.naturalWidth*scale)),height=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,width,height);
    let out=canvas.toDataURL("image/webp",quality);
    if(!out.startsWith("data:image/webp"))out=canvas.toDataURL("image/jpeg",quality);
    return out.length<dataUrl.length?out:dataUrl;
  }
  async function optimizeImageFile(file){
    if(!file.type.startsWith("image/"))throw new Error("ไฟล์ที่เลือกไม่ใช่รูปภาพ");
    if(file.size>15*1024*1024)throw new Error("รูปปกมีขนาดใหญ่เกิน 15 MB");
    const raw=await fileToDataUrl(file);
    return compressDataUrl(raw);
  }
  async function optimizeStoredGameImages(){
    if(sessionStorage.getItem("gameCoversOptimizedV31")==="1")return;
    const games=AppData.readArray("games").map(AppData.normalizeGame);let changed=false;
    for(const game of games){
      const image=String(game.image||"");
      if(image.startsWith("data:image/")&&image.length>250000){
        try{const smaller=await compressDataUrl(image);if(smaller&&smaller.length<image.length){game.image=smaller;changed=true}}catch(error){console.warn("[Teacher] skip cover",game.id,error)}
      }
    }
    if(changed){AppData.writeArray("games",games);load();renderAll();toast("ปรับขนาดรูปปกเดิมให้ประหยัดพื้นที่แล้ว")}
    sessionStorage.setItem("gameCoversOptimizedV31","1");
  }
  function previewGame(id){load();const g=state.games.find(x=>String(x.id)===String(id));if(!g)return;const p=new URLSearchParams({title:g.title,url:g.url,gameId:g.id,back:"teacher"});window.open(`./game-player.html?${p.toString()}`,"_blank")}

  function editGame(id){load();const g=state.games.find(x=>String(x.id)===String(id));if(!g)return;$("gameEditingId").value=g.id;$("gameTitle").value=g.title;$("gameUrl").value=g.url;$("gameDescription").value=g.description||"";$("gameTelemetry").checked=Boolean(g.supportsTelemetry);$("gameFormTitle").textContent="แก้ไขเกม";$("gameCancelEdit").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"})}
  function cancelGameEdit(){$("gameForm").reset();$("gameEditingId").value="";$("gameFormTitle").textContent="เพิ่มเกมการเรียนรู้";$("gameCancelEdit").classList.add("hidden")}


  function renderResultStudents(){load();const q=String($("resultStudentSearch")?.value||"").toLowerCase().trim();let students=[...state.students];if(q)students=students.filter(s=>`${s.id} ${s.name}`.toLowerCase().includes(q));$("resultStudentList").innerHTML=students.length?`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักเรียน</th><th>เกมที่เคยเล่น</th><th>รอบการเล่น</th><th>ล่าสุด</th><th></th></tr></thead><tbody>${students.map(s=>{const us=state.usage.filter(u=>String(u.studentId)===String(s.id));const rs=state.results.filter(r=>String(r.studentId)===String(s.id));const games=new Set([...us.map(gameKey),...rs.map(gameKey)].filter(Boolean));const latest=Math.max(0,...us.map(usageDate),...rs.map(resultDate));return `<tr><td><b>${esc(s.id)}</b></td><td><button class="btn btn-sm btn-ghost" onclick="TeacherApp.openStudentProfile('${attr(s.id)}')">${esc(s.name)}</button></td><td>${games.size}</td><td>${us.length||rs.length}</td><td>${latest?fmtDateTime(latest):'-'}</td><td><button class="btn btn-sm btn-primary" onclick="TeacherApp.openStudentProfile('${attr(s.id)}')">ดูข้อมูล</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty">ไม่พบนักเรียน</div>`}

  function openStudentProfile(id){load();state.selectedStudentId=String(id);showView("profile");renderStudentProfile()}
  function renderStudentProfile(){const s=state.students.find(x=>String(x.id)===state.selectedStudentId);if(!s){$("studentProfile").innerHTML='<div class="empty">ไม่พบนักเรียน</div>';return}const us=state.usage.filter(u=>String(u.studentId)===String(s.id)),rs=state.results.filter(r=>String(r.studentId)===String(s.id));const keys=[...new Set([...us.map(gameKey),...rs.map(gameKey)].filter(Boolean))];const latest=Math.max(0,...us.map(usageDate),...rs.map(resultDate));const totalMs=us.reduce((a,u)=>a+durationFromUsage(u),0);$("studentProfile").innerHTML=`
    <section class="card"><div class="profile-head"><div><div class="profile-name">${esc(s.name)}</div><div class="profile-meta"><span class="badge badge-purple">รหัส ${esc(s.id)}</span></div></div><button class="btn btn-soft" onclick="TeacherApp.editStudentFromProfile()">แก้ไขข้อมูล</button></div>
      <div class="info-grid" style="margin-top:16px"><div class="info-item"><div class="k">วันเกิด</div><div class="v">${esc(s.dob||'-')}</div></div><div class="info-item"><div class="k">เบอร์โทรนักเรียน</div><div class="v">${esc(s.studentPhone||'-')}</div></div><div class="info-item"><div class="k">ผู้ปกครอง</div><div class="v">${esc(s.guardianName||'-')}</div></div><div class="info-item"><div class="k">ความสัมพันธ์</div><div class="v">${esc(s.guardianRelationship||'-')}</div></div><div class="info-item"><div class="k">เบอร์ผู้ปกครอง</div><div class="v">${esc(s.guardianPhone||'-')}</div></div><div class="info-item"><div class="k">ที่อยู่</div><div class="v">${esc(s.address||'-')}</div></div></div>
    </section>
    <section class="grid grid-4"><div class="stat"><div class="label">เกมที่เคยเล่น</div><div class="value">${keys.length}</div><div class="sub">เกม</div></div><div class="stat"><div class="label">รอบการเล่น</div><div class="value">${Math.max(us.length,rs.length)}</div><div class="sub">รายการ</div></div><div class="stat"><div class="label">เวลาเล่นรวม</div><div class="value">${Math.round(totalMs/60000)}</div><div class="sub">นาที</div></div><div class="stat"><div class="label">ล่าสุด</div><div class="value" style="font-size:17px">${latest?fmtDate(latest):'-'}</div><div class="sub">วันที่ล่าสุด</div></div></section>
    <section class="card"><h2>เกมของนักเรียนคนนี้</h2>${renderStudentGameCards(s,keys,us,rs)}</section>`;
    $("studentGameDetail").innerHTML="";
  }

  function renderStudentGameCards(s,keys,us,rs){if(!keys.length)return '<div class="empty">นักเรียนยังไม่มีประวัติการเล่นเกม</div>';return `<div class="game-grid">${keys.map(k=>{const gr=rs.filter(r=>gameKey(r)===k).sort((a,b)=>resultDate(b)-resultDate(a));const gu=us.filter(u=>gameKey(u)===k).sort((a,b)=>usageDate(b)-usageDate(a));const g=gameFromKey(k);const title=g?.title||gr[0]?.gameTitle||gu[0]?.gameTitle||k;const latest=gr[0];const score=latest?.report?.session?.scorePct;const rawScore=latest?.score??latest?.result?.score??latest?.report?.session?.score;const isTw=ThaiWDashboard.isThaiW(latest||{gameId:k})||String(k).toLowerCase().startsWith("thaiw");return `<article class="game-card"><img class="game-cover" src="${attr(g?.image||'./assets/animal-direction-cover.png')}" alt=""><div class="game-body"><div class="game-title">${esc(title)}</div><div class="game-desc">${esc(g?.description||'')}</div><div class="hint">เล่น ${Math.max(gr.length,gu.length)} ครั้ง</div><div class="game-actions"><button class="btn btn-sm btn-primary" onclick="TeacherApp.openGameDetail('${attr(k)}')">ดูผลเกม</button></div></div></article>`}).join("")}</div>`}
  function editStudentFromProfile(){const id=state.selectedStudentId;showView("students");editStudent(id)}

  function openGameDetail(key){
    load();
    state.selectedGameKey=String(key);
    const game=gameFromKey(key);
    if(ThaiWDashboard.isThaiW({gameId:game?.id||key})){
      const sid=state.selectedStudentId;
      const rs=state.results.filter(r=>String(r.studentId)===sid&&gameKey(r)===String(key)).sort((a,b)=>resultDate(a)-resultDate(b));
      const us=state.usage.filter(u=>String(u.studentId)===sid&&gameKey(u)===String(key)).sort((a,b)=>usageDate(a)-usageDate(b));
      const title=game?.title||rs[0]?.gameTitle||us[0]?.gameTitle||key;
      const target=$("studentGameDetail");
      target.innerHTML=ThaiWDashboard.renderDetail(sid,rs,us,title);
      ThaiWDashboard.attach(target,sid,rs,us);
      requestAnimationFrame(()=>ThaiWDashboard.draw(target,sid,rs,us));
      scrollDetail();
      return;
    }
    renderGameDetail();
  }
  function renderGameDetail(){const sid=state.selectedStudentId,key=state.selectedGameKey,s=state.students.find(x=>String(x.id)===sid);if(!s)return;const rs=state.results.filter(r=>String(r.studentId)===sid&&gameKey(r)===key).sort((a,b)=>resultDate(a)-resultDate(b));const us=state.usage.filter(u=>String(u.studentId)===sid&&gameKey(u)===key).sort((a,b)=>usageDate(b)-usageDate(a));const g=gameFromKey(key);const title=g?.title||rs[0]?.gameTitle||us[0]?.gameTitle||key;if(!rs.some(r=>r?.report?.session?.scorePct!=null||r?.report?.session?.score!=null||r?.score!=null||r?.result?.score!=null)){
      $("studentGameDetail").innerHTML=`<section class="card"><h2>${esc(title)}</h2><p class="hint">เกมนี้ยังไม่มีผลคะแนน จึงแสดงเฉพาะเวลาเข้าเล่นที่เว็บไซต์บันทึกได้</p>${UsageChart.render(us,title)}</section>`;
      requestAnimationFrame(()=>UsageChart.draw($("studentGameDetail"),us));scrollDetail();return;
    }
    const latest=rs[rs.length-1],session=latest.report?.session||{},radar=latest.report?.overallRadar||{};const points=rs.map((r,i)=>({label:String(i+1),value:num(r.report?.session?.scorePct)}));$("studentGameDetail").innerHTML=`<section class="card"><div class="profile-head"><div><h2>${esc(title)}</h2><div class="hint">ผลรอบล่าสุด ${fmtDateTime(session.endedAtIso||latest.savedAtIso)}</div></div><span class="badge badge-purple">${rs.length} รอบที่มีผลคะแนน</span></div><div class="result-hero" style="margin-top:16px"><div class="score-ring" style="--score:${Math.round(num(session.scorePct))}%"><div class="inside"><div class="num">${Math.round(num(session.scorePct))}%</div><div class="lab">คะแนนรวม</div></div></div>${directionBars(radar)}</div></section>
    <section class="chart-grid"><div class="chart-box"><h3>กราฟ 4 ทิศ — รอบล่าสุด</h3><canvas id="teacherRadar"></canvas></div><div class="chart-box"><h3>แนวโน้มคะแนนแต่ละรอบ</h3><canvas id="teacherTrend"></canvas></div></section>
    <section class="card"><h2>ข้อมูลรอบล่าสุด</h2><div class="grid grid-4"><div class="stat"><div class="label">ตอบถูก</div><div class="value">${num(session.correctClicks)}</div></div><div class="stat"><div class="label">ตอบผิด</div><div class="value">${num(session.wrongClicks)}</div></div><div class="stat"><div class="label">กดอื่น</div><div class="value">${num(session.otherClicks)}</div></div><div class="stat"><div class="label">เวลาตอบเฉลี่ย</div><div class="value" style="font-size:23px">${(num(session.avgReactionMs)/1000).toFixed(2)}</div><div class="sub">วินาที</div></div></div></section>
    <section class="card"><h2>ประวัติรอบการเล่น</h2>${renderResultTable(rs)}</section>`;
    requestAnimationFrame(()=>{GameCharts.drawRadar($("teacherRadar"),radar);GameCharts.drawTrend($("teacherTrend"),points)});scrollDetail()}
  // One standard close control for Direction, ThaiW, and games with usage data only.
  function closeGameDetail(){
    state.selectedGameKey="";
    const report=$("studentGameDetail");
    if(report)report.replaceChildren();
    const cards=$("studentProfile")?.querySelector(".game-grid") || $("studentProfile");
    if(cards)cards.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function scrollDetail(){
    const report=$("studentGameDetail");
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
  function directionBars(r){const items=[["↑ บน",r.up],["→ ขวา",r.right],["↓ ล่าง",r.down],["← ซ้าย",r.left]];return `<div class="direction-list">${items.map(([l,v])=>`<div class="dir-row"><div class="dir-label">${l}</div><div class="bar"><span style="--pct:${Math.round(num(v))}%"></span></div><div class="dir-val">${Math.round(num(v))}%</div></div>`).join("")}</div>`}
  function renderUsageTable(us){if(!us.length)return '<div class="empty">ยังไม่มีประวัติการเล่น</div>';return `<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>เริ่ม</th><th>จบ</th><th>ระยะเวลา</th></tr></thead><tbody>${us.map(u=>`<tr><td>${esc(u.date||fmtDate(u.createdAt))}</td><td>${esc(u.startTime||'-')}</td><td>${esc(u.endTime||'-')}</td><td>${esc(u.duration||fmtMs(u.durationMs))}</td></tr>`).join("")}</tbody></table></div>`}
  function renderResultTable(rs){return `<div class="table-wrap"><table><thead><tr><th>ครั้ง</th><th>วันที่</th><th>คะแนน</th><th>ถูก</th><th>ผิด</th><th>ตอบเฉลี่ย</th><th></th></tr></thead><tbody>${[...rs].reverse().map((r,idx)=>{const s=r.report?.session||{};return `<tr><td>${rs.length-idx}</td><td>${fmtDateTime(s.endedAtIso||r.savedAtIso)}</td><td><span class="badge badge-green">${Math.round(num(s.scorePct))}%</span></td><td>${num(s.correctClicks)}</td><td>${num(s.wrongClicks)}</td><td>${(num(s.avgReactionMs)/1000).toFixed(2)} วิ</td><td><button class="btn btn-sm btn-soft" onclick="TeacherApp.showRound('${attr(r.resultId)}')">รายละเอียด</button></td></tr>`}).join("")}</tbody></table></div>`}
  function showRound(id){load();const r=state.results.find(x=>String(x.resultId)===String(id));if(!r)return;const s=r.report?.session||{},stages=Array.isArray(r.report?.stages)?r.report.stages:[];$("roundModalBody").innerHTML=`<div class="grid grid-4"><div class="stat"><div class="label">คะแนน</div><div class="value">${Math.round(num(s.scorePct))}%</div></div><div class="stat"><div class="label">ถูก</div><div class="value">${num(s.correctClicks)}</div></div><div class="stat"><div class="label">ผิด</div><div class="value">${num(s.wrongClicks)}</div></div><div class="stat"><div class="label">คลิกทั้งหมด</div><div class="value">${num(s.totalClicks)}</div></div></div><h3 style="margin-top:18px">รายละเอียดแต่ละด่าน (สำหรับครู)</h3>${stages.length?`<div class="table-wrap"><table><thead><tr><th>ด่าน</th><th>คะแนน</th><th>ถูก</th><th>ผิด</th><th>ตอบเฉลี่ย</th></tr></thead><tbody>${stages.map(st=>`<tr><td>${num(st.level)}</td><td>${Math.round(num(st.scorePct))}%</td><td>${num(st.correctClicks)}</td><td>${num(st.wrongClicks)}</td><td>${(num(st.avgReactionMs)/1000).toFixed(2)} วิ</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">ไม่มีข้อมูลรายด่าน</div>'}<div class="notice" style="margin-top:12px">ClickEvents เก็บไว้สำหรับวิเคราะห์/Export แต่ไม่แสดงเต็มหน้าจอเพื่อลดความรก</div>`;$("roundModal").classList.add("show")}
  function closeRoundModal(){$("roundModal").classList.remove("show")}

  function clearHistory(){
    load();
    const totalUsage=state.usage.length,totalResults=state.results.length;
    if(!totalUsage&&!totalResults){alert("ตอนนี้ยังไม่มีประวัติการเล่นให้ล้าง");return}
    const first=confirm(`ยืนยันล้างประวัติการเล่นทั้งหมดหรือไม่?\n\nจะลบ:\n• ประวัติการเข้าเล่น ${totalUsage} รายการ\n• ผลเกม ${totalResults} รอบ\n• รายละเอียดด่านและ ClickEvents ที่อยู่ในผลเกม\n\nรายชื่อนักเรียนและรายการเกมจะไม่ถูกลบ`);
    if(!first)return;
    const second=confirm("ยืนยันอีกครั้ง: ข้อมูลประวัติและผลเกมทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้\n\nต้องการดำเนินการต่อหรือไม่?");
    if(!second)return;
    AppData.writeArray("usageHistory",[]);
    AppData.writeArray("gameResults",[]);
    state.selectedGameKey="";
    load();
    renderAll();
    if(state.selectedStudentId&&state.students.some(s=>String(s.id)===String(state.selectedStudentId))){renderStudentProfile()}
    toast("ล้างประวัติการเล่นทั้งหมดแล้ว");
  }

  function renderTools(){const on=Boolean(window.BackendConfig?.sheetsEnabled);$("backendStatus").innerHTML=on?'<div class="notice">ตั้งค่า Google Apps Script URL แล้ว ผลเกมที่รองรับจะส่งขึ้น Sheet อัตโนมัติ</div>':'<div class="notice warn">ยังไม่ได้ตั้งค่า Google Sheet Web App ระบบจึงบันทึกใน LocalStorage เท่านั้น</div>'}
  function exportStudents(){load();if(typeof XLSX==="undefined"){alert("ไม่สามารถโหลด SheetJS ได้");return}const data=state.students.map(s=>({"รหัสนักเรียน":s.id,"ชื่อ-นามสกุล":s.name,"วันเกิด":s.dob,"เบอร์โทรนักเรียน":s.studentPhone,"ชื่อผู้ปกครอง":s.guardianName,"ความสัมพันธ์":s.guardianRelationship,"เบอร์โทรผู้ปกครอง":s.guardianPhone,"ที่อยู่":s.address}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),"Students");XLSX.writeFile(wb,"รายชื่อนักเรียน.xlsx")}
  function exportAll(){load();if(typeof XLSX==="undefined"){alert("ไม่สามารถโหลด SheetJS ได้");return}const wb=XLSX.utils.book_new();const add=(name,data)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.length?data:[{}]),name);add("Students",state.students);add("Games",state.games.map(g=>({...g,image:g.image?"[image stored]":""})));add("UsageHistory",state.usage);add("GameResults",state.results.map(r=>{const s=r.report?.session||{};return {resultId:r.resultId,studentId:r.studentId,studentName:r.studentName,gameId:r.gameId,gameTitle:r.gameTitle,savedAtIso:r.savedAtIso,scorePct:s.scorePct,score:s.score,correctClicks:s.correctClicks,wrongClicks:s.wrongClicks,otherClicks:s.otherClicks,totalClicks:s.totalClicks,upPct:s.upPct,rightPct:s.rightPct,downPct:s.downPct,leftPct:s.leftPct,avgReactionMs:s.avgReactionMs,measuredDurationMs:s.measuredDurationMs}}));const stages=[],clicks=[];state.results.forEach(r=>{(r.report?.stages||[]).forEach(st=>stages.push({resultId:r.resultId,studentId:r.studentId,gameId:r.gameId,...st,directionStats:JSON.stringify(st.directionStats||{})}));(r.report?.session?.clicks||[]).forEach(c=>clicks.push({resultId:r.resultId,studentId:r.studentId,gameId:r.gameId,...c}))});add("StageSummary",stages);add("ClickEvents",clicks);XLSX.writeFile(wb,"ข้อมูลระบบการเรียนรู้ทั้งหมด.xlsx")}

  function wire(){$("studentForm").addEventListener("submit",studentFormSubmit);$("gameForm").addEventListener("submit",gameFormSubmit);$("studentSearch").addEventListener("input",renderStudents);$("resultStudentSearch").addEventListener("input",renderResultStudents);document.querySelectorAll("#teacherNav .nav-tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));$("teacherPassword").addEventListener("keydown",e=>{if(e.key==="Enter")login()});window.addEventListener("storage",()=>{if(!$("teacherApp").classList.contains("hidden"))renderAll()})}

  window.TeacherApp={login,logout,showView,editStudent,cancelStudentEdit,deleteStudent,importStudents,exportStudents,editGame,cancelGameEdit,deleteGame,previewGame,openStudentProfile,editStudentFromProfile,openGameDetail,closeGameDetail,showRound,closeRoundModal,clearHistory,exportAll};
  wire();
  if(sessionStorage.getItem("teacherLoggedIn")==="1")showApp();
})();
