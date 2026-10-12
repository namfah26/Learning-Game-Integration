import { TELEMETRY_CONFIG } from "./telemetry-config.js";

console.log("[ArrowGame] child-friendly telemetry UI v4 loaded");

const channel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel(TELEMETRY_CONFIG.channelName)
  : null;

let overlay = null;
const persistedSessions = new Set();

function clampPct(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
}

function getContext(){
  const p=new URLSearchParams(location.search);
  return {
    studentId:String(p.get("studentId")||"").trim(),
    studentName:String(p.get("studentName")||"").trim(),
    gameId:String(p.get("gameId")||"animal-direction").trim(),
    gameTitle:String(p.get("gameTitle")||"Animal Direction Adventure").trim(),
    launchSessionId:String(p.get("launchSessionId")||"").trim()
  };
}

function broadcastPlayerContext(){
  const context=getContext();
  if(!context.studentName)return;
  try{channel?.postMessage({type:"player-context",context})}catch(_){}
}

function ensureStyles(){
  document.getElementById("telemetry-final-style")?.remove();
  const style=document.createElement("style");
  style.id="telemetry-final-style";
  style.textContent=`
    #telemetry-final-overlay{
      position:fixed;inset:0;z-index:10000;
      display:flex;justify-content:center;align-items:flex-start;
      padding:45vh 18px 18px;
      pointer-events:none;
      font-family:Tahoma,Arial,sans-serif;
    }
    #telemetry-final-card{
      width:min(690px,calc(100vw - 36px));
      background:rgba(255,255,255,.30);
      border:1px solid rgba(255,255,255,.55);
      border-radius:26px;
      box-shadow:0 12px 34px rgba(44,54,110,.12);
      padding:16px 20px 15px;
      color:#2d3155;
      pointer-events:none;
    }
    .telemetry-summary{
      display:grid;
      grid-template-columns:132px 1fr;
      gap:18px;
      align-items:center;
    }
    .telemetry-score-orb{
      width:122px;height:122px;border-radius:50%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      margin:auto;
      background:linear-gradient(145deg,#ff4f87,#ff9a3d 52%,#ffd54a);
      box-shadow:0 10px 24px rgba(255,91,105,.28),inset 0 0 0 5px rgba(255,255,255,.48);
      color:white;text-align:center;
    }
    .telemetry-score-orb strong{font-size:39px;line-height:1;font-weight:1000;text-shadow:0 2px 6px rgba(129,45,74,.24)}
    .telemetry-score-orb span{font-size:13px;font-weight:900;margin-top:6px;text-shadow:0 1px 3px rgba(0,0,0,.15)}
    .telemetry-bars{display:grid;gap:8px}
    .telemetry-bar-row{display:grid;grid-template-columns:72px 1fr 48px;gap:9px;align-items:center}
    .telemetry-bar-label{font-weight:1000;font-size:15px;color:#30345b;text-shadow:0 1px 2px rgba(255,255,255,.75)}
    .telemetry-track{height:15px;border-radius:999px;background:rgba(255,255,255,.60);overflow:hidden;box-shadow:inset 0 1px 4px rgba(52,57,105,.10)}
    .telemetry-fill{height:100%;width:var(--pct);border-radius:inherit;box-shadow:0 1px 5px rgba(0,0,0,.10)}
    .telemetry-up{background:linear-gradient(90deg,#ff5fa2,#ff8bcb)}
    .telemetry-right{background:linear-gradient(90deg,#ff9b3f,#ffd34e)}
    .telemetry-down{background:linear-gradient(90deg,#19c9b7,#5be6d6)}
    .telemetry-left{background:linear-gradient(90deg,#7468ff,#ae72ff)}
    .telemetry-pct{text-align:right;font-weight:1000;font-size:15px;color:#35395e;text-shadow:0 1px 2px rgba(255,255,255,.8)}
    .telemetry-message{
      margin:11px 0 0;
      text-align:center;
      font-size:16px;font-weight:1000;line-height:1.45;
      color:#393d69;
      text-shadow:0 1px 3px rgba(255,255,255,.95);
    }
    @media(max-width:700px){
      #telemetry-final-overlay{padding-top:43vh;padding-left:10px;padding-right:10px}
      #telemetry-final-card{width:min(96vw,560px);padding:13px 14px;border-radius:21px}
      .telemetry-summary{grid-template-columns:104px 1fr;gap:12px}
      .telemetry-score-orb{width:98px;height:98px}
      .telemetry-score-orb strong{font-size:31px}
      .telemetry-score-orb span{font-size:11px}
      .telemetry-bar-row{grid-template-columns:62px 1fr 43px;gap:7px}
      .telemetry-track{height:13px}
      .telemetry-bar-label,.telemetry-pct{font-size:13px}
      .telemetry-message{font-size:14px;margin-top:8px}
    }
  `;
  document.head.appendChild(style);
}

function cleanup(){
  document.querySelectorAll('#telemetry-final-overlay,[id^="report-telemetry-"],[id^="telemetry-legacy-"],#telemetry-report-overlay').forEach(el=>el.remove());
  overlay=null;
}

function directionRows(values){
  const rows=[
    ["↑ บน",values.up,"telemetry-up"],
    ["→ ขวา",values.right,"telemetry-right"],
    ["↓ ล่าง",values.down,"telemetry-down"],
    ["← ซ้าย",values.left,"telemetry-left"]
  ];
  return rows.map(([label,value,cssClass])=>{
    const p=Math.round(clampPct(value));
    return `<div class="telemetry-bar-row"><div class="telemetry-bar-label">${label}</div><div class="telemetry-track"><div class="telemetry-fill ${cssClass}" style="--pct:${p}%"></div></div><div class="telemetry-pct">${p}%</div></div>`;
  }).join("");
}

function encouragement(values,score){
  const dirs=[
    ["ทิศบน",clampPct(values.up)],
    ["ทิศขวา",clampPct(values.right)],
    ["ทิศล่าง",clampPct(values.down)],
    ["ทิศซ้าย",clampPct(values.left)]
  ];
  dirs.sort((a,b)=>a[1]-b[1]);
  if(score>=90)return "ยอดเยี่ยมมาก! ทำได้ดีมากทั้ง 4 ทิศ 🎉";
  if(score>=75)return `ทำได้ดีมาก! ลองฝึก ${dirs[0][0]} เพิ่มอีกนิดนะ ⭐`;
  if(score>=50)return `เก่งขึ้นแล้ว! ลองเล่นอีกครั้งและฝึก ${dirs[0][0]} เพิ่มนะ 💪`;
  return `ลองอีกครั้งนะ! เริ่มจากฝึก ${dirs[0][0]} แล้วค่อย ๆ ทำให้ดีขึ้น 🌟`;
}

function render(report){
  cleanup();ensureStyles();
  const session=report?.session||{};
  const values=report?.overallRadar||{};
  const score=Math.round(clampPct(session.scorePct ?? values.score));
  overlay=document.createElement("div");
  overlay.id="telemetry-final-overlay";
  overlay.innerHTML=`<section id="telemetry-final-card" aria-label="สรุปผลการเล่น">
    <div class="telemetry-summary">
      <div class="telemetry-score-orb"><strong>${score}%</strong><span>คะแนนของฉัน</span></div>
      <div class="telemetry-bars">${directionRows(values)}</div>
    </div>
    <div class="telemetry-message">${encouragement(values,score)}</div>
  </section>`;
  document.body.appendChild(overlay);
}

function hideIntegratedNameInput(){
  const context=getContext();
  if(!context.studentName)return;
  document.querySelectorAll('input,textarea').forEach(el=>{
    try{
      if(el instanceof HTMLInputElement && ["button","submit","checkbox","radio","range","color","file"].includes(el.type))return;
      if("value" in el)el.value=context.studentName;
      el.style.setProperty("display","none","important");
      el.setAttribute("aria-hidden","true");
      el.tabIndex=-1;
    }catch(_){}
  });
}

function postToContainer(message){
  if(window.parent&&window.parent!==window){window.parent.postMessage(message,location.origin);return}
  if(window.opener){window.opener.postMessage(message,location.origin);return}
  if(message.type==="learning-game-replay")location.reload();
  if(message.type==="learning-game-exit"){try{window.close()}catch(_){}}
}

function readArray(key){try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v:[]}catch(_){return[]}}
function writeArray(key,value){localStorage.setItem(key,JSON.stringify(value))}
function formatDuration(ms){const total=Math.max(0,Math.floor(Number(ms||0)/1000));const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return `${h} ชั่วโมง ${m} นาที ${s} วินาที`}

function persistIntegratedResult(report){
  const session=report?.session;
  if(!session?.sessionId||persistedSessions.has(session.sessionId))return;
  const context=getContext();
  if(!context.studentId)return;
  const result={
    schemaVersion:2,
    resultId:`result-${session.sessionId}`,
    sessionId:session.sessionId,
    launchSessionId:context.launchSessionId,
    studentId:context.studentId,
    studentName:context.studentName||session.playerName||session.username||"",
    gameId:context.gameId,
    gameTitle:context.gameTitle,
    savedAtIso:new Date().toISOString(),
    report
  };
  try{
    const results=readArray("gameResults");
    const index=results.findIndex(x=>String(x?.sessionId||"")===String(session.sessionId));
    if(index===-1)results.unshift(result);else results[index]=result;
    if(results.length>500)results.length=500;
    writeArray("gameResults",results);

    const history=readArray("usageHistory");
    const exists=history.some(x=>(context.launchSessionId&&String(x?.launchSessionId||"")===context.launchSessionId)||String(x?.telemetrySessionId||"")===String(session.sessionId));
    if(!exists){
      const start=new Date(session.startedAtIso||Date.now()),end=new Date(session.endedAtIso||Date.now());
      history.unshift({
        launchSessionId:context.launchSessionId,telemetrySessionId:session.sessionId,
        studentId:context.studentId,studentName:result.studentName,gameId:context.gameId,gameTitle:context.gameTitle,
        date:end.toLocaleDateString("th-TH"),startTime:start.toLocaleTimeString("th-TH"),endTime:end.toLocaleTimeString("th-TH"),
        duration:formatDuration(session.measuredDurationMs),durationMs:Number(session.measuredDurationMs||0),createdAt:end.toISOString(),source:"telemetry-auto"
      });
      writeArray("usageHistory",history);
    }
    persistedSessions.add(session.sessionId);
    const message={type:"learning-game-result",result};
    if(window.parent&&window.parent!==window)window.parent.postMessage(message,location.origin);
    if(window.opener)window.opener.postMessage(message,location.origin);
  }catch(error){console.error("[ArrowGame] persist failed",error)}
}

channel?.addEventListener("message",event=>{
  const msg=event.data||{};
  if(msg.type==="show-report"&&msg.report){persistIntegratedResult(msg.report);render(msg.report);return}
  if(msg.type==="session-started"){cleanup();broadcastPlayerContext();hideIntegratedNameInput();return}
  if(msg.type==="hide-report"){cleanup();return}
  if(msg.type==="request-exit"){postToContainer({type:"learning-game-exit"});return}
});

broadcastPlayerContext();
hideIntegratedNameInput();
const nameInputObserver=new MutationObserver(()=>hideIntegratedNameInput());
nameInputObserver.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>{broadcastPlayerContext();hideIntegratedNameInput()},400);
setTimeout(()=>{broadcastPlayerContext();hideIntegratedNameInput()},1200);
