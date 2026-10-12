/* ThaiW result dashboard. Animal Direction display functions remain unchanged.
   Never turn absent analytics into 0 or convert a raw score into a percent. */
(function () {
  'use strict';
  const modes = [
    { id: 'Letter', suffix: 'โหมดตัวหนังสือ', color: '#5969dc' },
    { id: 'Fruit', suffix: 'โหมดผลไม้', color: '#e39843' }
  ];
  const axes = [
    ['accuracy', 'ความแม่นยำ'], ['response', 'การตอบสนอง'],
    ['control', 'การควบคุมคลิก'], ['timeliness', 'ตอบทันเวลา'],
    ['progress', 'ความก้าวหน้า'], ['performance', 'ผลการเล่น']
  ];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defined = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
  const number = (obj, ...names) => {
    for (const name of names) if (defined(obj?.[name])) return Number(obj[name]);
    return null;
  };
  const numText = x => defined(x) ? String(Number(x)) : '—';
  const secText = x => defined(x) ? `${Number(x).toFixed(2)} วิ` : '—';
  const msText = x => defined(x) ? `${(Number(x) / 1000).toFixed(2)} วิ` : '—';
  const percent = x => defined(x) ? `${Number(x).toFixed(0)}%` : '—';
  const clamp = x => Math.min(100, Math.max(0, x));
  const storeGames = () => (window.AppData?.readArray?.('games') || []);
  const stage = r => r?.report?.session || r?.result || r || {};
  const modeOf = r => String(r?.mode || r?.result?.mode || r?.report?.session?.mode || '').toLowerCase();
  const timeOf = r => new Date(r?.savedAtIso || stage(r)?.endedAtIso || r?.createdAt || 0).getTime() || 0;
  const sorted = rs => [...rs].sort((a,b) => timeOf(a) - timeOf(b));

  function isThaiW(r) {
    const id = String(r?.gameId || r?.gameTitle || '').toLowerCase();
    if (id === 'thaiw' || id === 'thaiw-unity' || id.startsWith('thaiw-')) return true;
    return storeGames().some(g =>
      (String(g.id).toLowerCase() === id || String(g.title).toLowerCase() === id) &&
      /(?:\/|^)games\/thaiw(?:\/|$)/i.test(String(g.url || ''))
    );
  }

  function registeredTitle(rs, cfg) {
    const games = storeGames();
    const recent = rs?.length ? rs[rs.length - 1] : null;
    if (recent) {
      const byId = games.find(g => g.id && String(g.id) === String(recent.gameId));
      if (byId?.title) return String(byId.title);
      const byTitle = games.find(g => g.title && String(g.title) === String(recent.gameTitle));
      if (byTitle?.title) return String(byTitle.title);
    }
    const linked = games.filter(g => /(?:\/|^)games\/thaiw(?:\/|$)/i.test(String(g.url || '')));
    if (linked.length === 1 && linked[0].title) return String(linked[0].title);
    if (linked.length > 1) {
      const chosen = linked.find(g => g.id !== 'thaiw-unity') || linked[0];
      if (chosen.title) return String(chosen.title);
    }
    if (recent?.gameTitle) return String(recent.gameTitle);
    return 'เกมที่ยังไม่ระบุชื่อ';
  }
  const fullTitle = (rs,cfg) => `${registeredTitle(rs,cfg)} (${cfg.suffix})`;

  function metrics(r) {
    const s = stage(r), a = r?.analytics || r?.result?.analytics || r?.report?.analytics || {};
    const val = (names, otherNames=names) => number(s,...names) ?? number(a,...otherNames);
    return {
      score: val(['score']), scorePct: val(['scorePct']),
      correct: val(['correctClicks','correctAnswers']),
      wrong: val(['wrongClicks','wrongAnswers']),
      empty: val(['emptyClicks','otherClicks']),
      missed: val(['missedTargets']),
      reactionMs: val(['avgReactionMs','reactionTimeMs']),
      reactionSec: val(['avgReactionSeconds','reactionTimeSeconds']),
      durationSec: val(['totalTimeSeconds','playingTime']),
      level: val(['highestLevelReached']),
      accuracy: val(['accuracy'])
    };
  }

  // Spider chart uses ONLY percentages explicitly sent by the game.
  // Raw scores, counts and reaction times are not silently converted to skill ratings.
  function radarFields(r) {
    const s = stage(r);
    const sources = [r?.radar, r?.skillRadar, r?.result?.radar,
      r?.result?.skillRadar, r?.report?.skillRadar, s?.skillRadar,
      r?.analytics?.radar, r?.result?.analytics?.radar].filter(Boolean);
    const aliases = {
      accuracy:['accuracy','accuracyPct'], response:['response','responsePct'],
      control:['control','controlPct'], timeliness:['timeliness','timelinessPct'],
      progress:['progress','progressPct'], performance:['performance','performancePct']
    };
    const source = sources.find(x => axes.some(([key]) => aliases[key].some(k => defined(x?.[k]))));
    return axes.map(([key,label]) => {
      let value = source ? number(source,...aliases[key]) : null;
      // Accuracy from Unity is a real percentage, unlike derived or guessed skill ratings.
      if (key === 'accuracy' && value === null) value = number(s,'accuracy');
      if (value !== null && (value < 0 || value > 100)) value = null;
      return {label,value};
    });
  }
  function radarOf(r) {
    const fields=radarFields(r);
    return fields.every(x=>x.value!==null)?fields:null;
  }

  function shownScore(m) {
    if (defined(m.scorePct)) return percent(m.scorePct);
    if (defined(m.score)) return `${numText(m.score)} คะแนน`;
    return 'ยังไม่มีคะแนน';
  }
  const stat = (label,value) => `<div class="thaiw-stat"><div>${esc(label)}</div><strong>${esc(value)}</strong></div>`;

  function skillHero(item) {
    const {cfg,rs} = item, latest = rs[rs.length-1];
    const m = metrics(latest), fields=radarFields(latest), complete=radarOf(latest)!==null;
    return `<article class="thaiw-hero-card" style="--mode-color:${cfg.color}">
      <div class="thaiw-hero-headrow"><div>
        <h3 class="thaiw-hero-title">${esc(fullTitle(rs,cfg))}</h3>
        <div class="thaiw-count">ผลที่เกมส่งมา ${rs.length} รอบ</div>
      </div><span class="thaiw-score-pill">${esc(shownScore(m))}</span></div>
      <div class="thaiw-bars">${axes.map(([_,label],i) => {
        const v=fields[i]?.value;
        return `<div class="dir-row"><div class="dir-label">${label}</div>
          <div class="bar"><span style="--pct:${defined(v)?clamp(v):0}%;background:${cfg.color}"></span></div>
          <div class="dir-val">${percent(v)}</div></div>`;
      }).join('')}</div>
      ${!complete?'<p class="thaiw-note">เกมยังส่งคะแนนทักษะไม่ครบทั้ง 6 ด้าน จึงเว้นค่าที่ยังไม่มีไว้ ไม่ตีความเป็น 0%</p>':''}
    </article>`;
  }

  function history(rs,cfg) {
    return `<div class="table-wrap"><table><thead><tr><th>ครั้ง</th><th>วันที่</th><th>คะแนน</th><th>คลิกถูก</th><th>คลิกผิด</th><th>เวลา</th><th></th></tr></thead><tbody>${[...rs].reverse().map((r,index) => {
      const m=metrics(r), d=timeOf(r)?new Date(timeOf(r)).toLocaleString('th-TH'):'—';
      return `<tr><td>${rs.length-index}</td><td>${esc(d)}</td><td>${esc(shownScore(m))}</td>
      <td>${numText(m.correct)}</td><td>${numText(m.wrong)}</td><td>${secText(m.durationSec)}</td>
      <td><button type="button" class="btn btn-sm btn-soft" data-mode="${cfg.id}" data-round="${rs.length-1-index}" onclick="ThaiWDashboard.showRound(this)">รายละเอียด</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function levels(r) {
    const items = r?.report?.stages || r?.report?.levels || r?.result?.levels || r?.levels;
    if (!Array.isArray(items) || !items.length) return '<p class="thaiw-note">เกมยังไม่ได้ส่งข้อมูลรายด่าน</p>';
    return `<div class="table-wrap"><table><thead><tr><th>ด่าน/ระดับ</th><th>คะแนน</th><th>คลิกถูก</th><th>คลิกผิด</th><th>คลิกไม่ทัน</th><th>เวลาตอบเฉลี่ย</th><th>เวลาในด่าน</th></tr></thead><tbody>${items.map(x => {
      const score=defined(x.scorePct)?percent(x.scorePct):defined(x.score)?`${numText(x.score)} คะแนน`:'—';
      const duration=defined(x.durationSeconds)?secText(x.durationSeconds):msText(x.durationMs);
      return `<tr><td>${esc(x.level??x.phase??x.round??'—')}</td><td>${esc(score)}</td><td>${numText(x.correctClicks??x.correctAnswers)}</td><td>${numText(x.wrongClicks??x.wrongAnswers)}</td><td>${numText(x.missedTargets)}</td><td>${msText(x.avgReactionMs)}</td><td>${duration}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function rawPanel(item) {
    const {cfg,rs}=item, latest=rs[rs.length-1],m=metrics(latest);
    return `<article class="thaiw-mode" style="--mode-color:${cfg.color}"><h3>${esc(fullTitle(rs,cfg))}</h3>
      <div class="thaiw-stats">
        ${stat('คลิกถูก',numText(m.correct))}${stat('คลิกผิด',numText(m.wrong))}
        ${stat('คลิกไม่ทัน',numText(m.missed))}${stat('คลิกพื้นที่ว่าง',numText(m.empty))}
        ${stat('เวลาตอบเฉลี่ย',defined(m.reactionMs)?msText(m.reactionMs):secText(m.reactionSec))}
        ${stat('เวลาเล่นในเกม',secText(m.durationSec))}
        ${stat('ด่านสูงสุด',numText(m.level))}${stat('คะแนนล่าสุด',shownScore(m))}
      </div></article>`;
  }

  function drawRadar(canvas,sets) {
    if (!canvas||!sets.length) return;
    const dpi=window.devicePixelRatio||1,w=Math.max(340,Math.round(canvas.getBoundingClientRect().width||520)),h=345;
    canvas.width=Math.round(w*dpi);canvas.height=Math.round(h*dpi);
    const c=canvas.getContext('2d');c.scale(dpi,dpi);
    const cx=w/2,cy=155,radius=Math.min(110,w*.235);
    const xy=(i,t)=>{const a=-Math.PI/2+i*2*Math.PI/axes.length;return [cx+Math.cos(a)*radius*t,cy+Math.sin(a)*radius*t]};
    for(let step=1;step<=5;step++){
      c.beginPath();axes.forEach((_,i)=>{const [x,y]=xy(i,step/5);i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.strokeStyle='#dfe3ee';c.lineWidth=1;c.stroke();
    }
    axes.forEach(([,label],i)=>{
      const [x,y]=xy(i,1);c.beginPath();c.moveTo(cx,cy);c.lineTo(x,y);c.strokeStyle='#dfe3ee';c.stroke();
      const [lx,ly]=xy(i,1.30);c.fillStyle='#263558';c.font='12px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,lx,ly);
    });
    sets.forEach(({cfg,radar})=>{
      c.beginPath();radar.forEach(({value},i)=>{const [x,y]=xy(i,clamp(value)/100);i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();
      c.fillStyle=cfg.color;c.globalAlpha=.13;c.fill();c.globalAlpha=1;c.strokeStyle=cfg.color;c.lineWidth=2.5;c.stroke();
      radar.forEach(({value},i)=>{const [x,y]=xy(i,clamp(value)/100);c.beginPath();c.arc(x,y,3.5,0,2*Math.PI);c.fillStyle=cfg.color;c.fill()});
    });
  }

  function drawScores(canvas,series){
    if(!canvas||!series.length) return;
    const percentOnly=series.every(x=>x.rows.every(r=>r.kind==='pct'));
    const all=series.flatMap(x=>x.rows.map(r=>r.value));
    if(!all.length)return;
    const ymax=percentOnly?100:Math.max(1,Math.ceil(Math.max(...all)*1.1/10)*10);
    const dpi=window.devicePixelRatio||1,w=Math.max(300,Math.round(canvas.getBoundingClientRect().width||480)),h=245;
    canvas.width=Math.round(w*dpi);canvas.height=Math.round(h*dpi);const c=canvas.getContext('2d');c.scale(dpi,dpi);
    const left=45,right=12,top=12,bottom=35,plotW=w-left-right,plotH=h-top-bottom;
    for(let i=0;i<=4;i++){
      const y=top+plotH*i/4;c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.strokeStyle='#e9ecf6';c.lineWidth=1;c.stroke();
      c.fillStyle='#64718c';c.font='11px sans-serif';c.textAlign='right';c.fillText(String(Math.round(ymax*(1-i/4))),left-7,y+4);
    }
    const total=Math.max(...series.map(x=>x.count),1);
    series.forEach(({cfg,rows})=>{
      if(!rows.length)return;
      const xy=rows.map(({at,value})=>({x:left+(total===1?plotW/2:plotW*(at-1)/(total-1)),y:top+plotH*(1-value/ymax)}));
      c.beginPath();xy.forEach((p,i)=>{i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)});c.strokeStyle=cfg.color;c.lineWidth=2.5;c.stroke();
      xy.forEach(p=>{c.beginPath();c.arc(p.x,p.y,4,0,2*Math.PI);c.fillStyle=cfg.color;c.fill()});
    });
    for(let i=1;i<=total&&i<=20;i++){
      const x=left+(total===1?plotW/2:plotW*(i-1)/(total-1));c.font='11px sans-serif';c.textAlign='center';c.fillStyle='#64718c';c.fillText(String(i),x,h-12);
    }
  }

  function resultsFor(studentId,allResults){
    const rs=(allResults||[]).filter(r=>String(r.studentId)===String(studentId)&&isThaiW(r));
    return modes.map(cfg=>({cfg,rs:sorted(rs.filter(r=>modeOf(r)===cfg.id.toLowerCase()))})).filter(x=>x.rs.length);
  }

  function content(studentId,allResults,usage) {
    const active=resultsFor(studentId,allResults);
    if (!active.length) {
      const entries=(usage||[]).filter(u=>String(u.studentId)===String(studentId)&&isThaiW(u));
      const titles=entries.map(u=>u.gameTitle).filter(Boolean);
      const title=titles.length?titles[titles.length-1]:registeredTitle([],modes[0]);
      return `<section class="thaiw-plain-usage"><h3>${esc(title)}</h3><p class="thaiw-note">ยังไม่มีผลคะแนนจาก Unity จึงแสดงเฉพาะเวลาเปิดหน้าเกมที่เว็บไซต์บันทึกไว้</p>${window.UsageChart?.render(entries,title) || '<p>ยังไม่มีประวัติการเข้าเล่น</p>'}</section>`;
    }
    const validRadar=active.map(x=>({cfg:x.cfg,radar:radarOf(x.rs[x.rs.length-1]),rs:x.rs})).filter(x=>x.radar);
    const scoreSeries=active.map(x=>({cfg:x.cfg,count:x.rs.length,rows:x.rs.map((r,i)=>{
      const m=metrics(r);return defined(m.scorePct)?{at:i+1,value:m.scorePct,kind:'pct'}:defined(m.score)?{at:i+1,value:m.score,kind:'raw'}:null;
    }).filter(Boolean)})).filter(x=>x.rows.length);
    const types=new Set(scoreSeries.flatMap(x=>x.rows.map(y=>y.kind)));
    return `<div class="thaiw-overview">
      <div class="thaiw-step-heading"><h3>1. ภาพรวมผลการเล่นของแต่ละเกม</h3><p class="thaiw-note">ใช้ชื่อเกมที่ครูตั้งไว้ตอนเพิ่มเกม และแสดงคะแนนทักษะจาก JSON เท่านั้น</p></div>
      <div class="thaiw-horizontal${active.length===1?' thaiw-single':''}">${active.map(skillHero).join('')}</div>
      <div class="thaiw-step-heading"><h3>2. กราฟผลการเล่น</h3></div>
      <div class="thaiw-compare-grid">
        <section class="thaiw-chart-wide"><h4>กราฟสไปเดอร์ — ${active.length===2?'เปรียบเทียบสองเกม':'ผลของเกมที่เล่น'}</h4>
          ${validRadar.length?'<canvas data-thaiw-radar></canvas>':'<div class="empty">ยังไม่มีคะแนนทักษะครบทั้ง 6 แกนจาก JSON ของเกม จึงยังไม่สร้างกราฟจากค่าที่ไม่มี</div>'}
          <div class="thaiw-legend">${validRadar.map(x=>`<span style="color:${x.cfg.color}">● ${esc(fullTitle(x.rs,x.cfg))}</span>`).join(' ')}</div>
        </section>
        <section class="thaiw-chart-side"><h4>กราฟคะแนนแต่ละรอบ</h4>
          ${scoreSeries.length?'<canvas data-thaiw-score-trend></canvas>':'<div class="empty">ยังไม่มีคะแนนจากเกม</div>'}
          <div class="thaiw-legend">${scoreSeries.map(x=>`<span style="color:${x.cfg.color}">● ${esc(fullTitle(active.find(a=>a.cfg===x.cfg).rs,x.cfg))}</span>`).join(' ')}</div>
          ${types.size>1?'<p class="thaiw-note">บางรอบส่งคะแนนดิบ บางรอบส่งเปอร์เซ็นต์ จึงควรใช้หน่วยเดียวกันก่อนเปรียบเทียบแนวโน้ม</p>':'<p class="thaiw-note">จุดบนกราฟคือรอบที่มีคะแนนจริง หากคะแนนเต็มของสองเกมต่างกัน คะแนนดิบไม่ใช่ตัววัดความสามารถที่เทียบกันตรง ๆ ได้</p>'}
        </section>
      </div>
      <div class="thaiw-step-heading"><h3>3. ข้อมูลการคลิกและเวลา — รอบล่าสุด</h3></div>
      <div class="thaiw-columns${active.length===1?' thaiw-single':''}">${active.map(rawPanel).join('')}</div>
      <div class="thaiw-step-heading"><h3>4. ประวัติและรายละเอียดรายด่าน</h3><p class="thaiw-note">กดรายละเอียดของแต่ละรอบเพื่อดูข้อมูลรายด่านที่ Unity ส่งมาจริง</p></div>
      <div class="thaiw-columns${active.length===1?' thaiw-single':''}">${active.map(x=>`<section class="thaiw-mode" style="--mode-color:${x.cfg.color}"><h3>${esc(fullTitle(x.rs,x.cfg))}</h3>${history(x.rs,x.cfg)}</section>`).join('')}</div>
    </div>`;
  }

  // The score report is created only after a teacher or guardian selects a game.
  // title comes from the game registered by the teacher, NOT the Unity technology name.
  function renderDetail(studentId,allResults,usage=[],title='เกมการเรียนรู้'){
    return `<section class="card thaiw-dashboard">
      <div class="thaiw-heading"><h2>${esc(title)} — ผลการเล่น</h2></div>
      <div class="thaiw-detail">${content(studentId,allResults,usage)}</div>
    </section>`;
  }
  function attach(root,studentId,results,usage=[]){
    const section=root?.querySelector?.('.thaiw-dashboard');
    if(section)section.__thaiwData={studentId,results,usage};
  }
  function draw(root,studentId,results,usage=[]){
    if(!root)return;
    const active=resultsFor(studentId,results);
    const radarSets=active.map(x=>({cfg:x.cfg,radar:radarOf(x.rs[x.rs.length-1])})).filter(x=>x.radar);
    drawRadar(root.querySelector('[data-thaiw-radar]'),radarSets);
    const scoreSeries=active.map(x=>({cfg:x.cfg,count:x.rs.length,rows:x.rs.map((r,i)=>{
      const m=metrics(r);return defined(m.scorePct)?{at:i+1,value:m.scorePct,kind:'pct'}:defined(m.score)?{at:i+1,value:m.score,kind:'raw'}:null;
    }).filter(Boolean)})).filter(x=>x.rows.length);
    drawScores(root.querySelector('[data-thaiw-score-trend]'),scoreSeries);
    const usageRoot=root.querySelector('.thaiw-plain-usage');
    if(usageRoot)window.UsageChart?.draw(usageRoot,(usage||[]).filter(u=>String(u.studentId)===String(studentId)&&isThaiW(u)));
  }
  function showRound(btn){
    const section=btn.closest('.thaiw-dashboard'),data=section?.__thaiwData;
    if(!data)return;
    const cfg=modes.find(x=>x.id===btn.dataset.mode);if(!cfg)return;
    const selected=resultsFor(data.studentId,data.results).find(x=>x.cfg.id===cfg.id);
    if(!selected)return;
    const r=selected.rs[Number(btn.dataset.round)];if(!r)return;
    const m=metrics(r),old=document.getElementById('thaiw-round-modal');if(old)old.remove();
    const modal=document.createElement('div');modal.id='thaiw-round-modal';modal.className='modal show';
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><h2>รายละเอียดรอบการเล่น — ${esc(fullTitle(selected.rs,cfg))}</h2><button type="button" class="icon-btn" onclick="document.getElementById('thaiw-round-modal')?.remove()" aria-label="ปิด">✕</button></div><div class="thaiw-stats">
      ${stat('คะแนน',shownScore(m))}${stat('คลิกถูก',numText(m.correct))}${stat('คลิกผิด',numText(m.wrong))}${stat('คลิกไม่ทัน',numText(m.missed))}${stat('คลิกพื้นที่ว่าง',numText(m.empty))}${stat('เวลาตอบเฉลี่ย',defined(m.reactionMs)?msText(m.reactionMs):secText(m.reactionSec))}${stat('เวลาเล่นในเกม',secText(m.durationSec))}${stat('ด่านสูงสุด',numText(m.level))}
      </div><h3 style="margin-top:18px">รายละเอียดแต่ละด่าน</h3>${levels(r)}</div>`;
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});document.body.appendChild(modal);
  }
  window.ThaiWDashboard={renderDetail,attach,draw,isThaiW,showRound};
})();
