/* Shared no-score game report for teachers/guardians.
   Uses only website-recorded play-page duration, not inferred game performance. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration=u=>{
    if(u?.durationMs!==undefined&&u.durationMs!==null&&Number.isFinite(Number(u.durationMs)))
      return Math.max(0,Number(u.durationMs));
    const str=String(u?.duration||'');
    if(!str)return null;
    const h=Number((str.match(/(\d+)\s*ชั่วโมง/)||[])[1]||0);
    const m=Number((str.match(/(\d+)\s*นาที/)||[])[1]||0);
    const s=Number((str.match(/(\d+)\s*วินาที/)||[])[1]||0);
    return /ชั่วโมง|นาที|วินาที/.test(str)?(h*3600+m*60+s)*1000:null;
  };
  const sorted=us=>[...(us||[])].sort((a,b)=>Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0));
  function render(us,title){
    const valid=sorted(us).filter(x=>duration(x)!==null);
    const total=valid.reduce((sum,x)=>sum+duration(x),0);
    return `<section class="usage-report">
      <div class="usage-report-summary">
        <div class="stat"><div class="label">จำนวนครั้งที่เปิดเล่น</div><div class="value">${valid.length}</div><div class="sub">ครั้งที่เว็บไซต์มีข้อมูลเวลา</div></div>
        <div class="stat"><div class="label">เวลาเปิดหน้าเกมรวม</div><div class="value">${Math.round(total/1000)}</div><div class="sub">วินาที</div></div>
      </div>
      ${valid.length?`<div class="usage-chart-wrap"><h3>กราฟเวลาเข้าเล่นแต่ละครั้ง — ${esc(title)}</h3><canvas data-usage-chart aria-label="กราฟเวลาเข้าเล่นแต่ละครั้ง"></canvas><p class="hint">วัดเวลาที่เปิดหน้าเกมจากเว็บไซต์ ไม่ใช่เวลาที่เล่นภายในเกมจริง</p></div>`:'<div class="empty">ยังไม่มีข้อมูลเวลาเข้าเล่นของเกมนี้</div>'}
    </section>`;
  }
  function draw(root,us){
    const canvas=root?.querySelector?.('[data-usage-chart]'); if(!canvas)return;
    const entries=sorted(us).map(x=>duration(x)).filter(x=>x!==null).map(x=>x/1000);
    if(!entries.length)return;
    const dpi=window.devicePixelRatio||1,w=Math.max(320,Math.round(canvas.getBoundingClientRect().width||650)),h=265;
    canvas.width=Math.round(w*dpi);canvas.height=Math.round(h*dpi);
    const c=canvas.getContext('2d');c.scale(dpi,dpi);
    const left=56,right=18,top=24,bottom=42,plotW=w-left-right,plotH=h-top;
    const ymax=Math.max(1,Math.ceil(Math.max(...entries)*1.1/10)*10);
    for(let i=0;i<=4;i++){
      const y=top+(h-top-bottom)*i/4;
      c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.strokeStyle='#e7eaf4';c.stroke();
      c.fillStyle='#66738a';c.font='12px sans-serif';c.textAlign='right';c.fillText(String(Math.round(ymax*(1-i/4))),left-9,y+4);
    }
    c.fillStyle='#5969dc';
    const step=plotW/entries.length,barWidth=Math.min(72,step*.58);
    entries.forEach((v,i)=>{
      const x=left+step*(i+.5),y=top+(h-top-bottom)*(1-v/ymax);
      c.fillStyle='#5969dc';c.fillRect(x-barWidth/2,y,barWidth,top+h-bottom-y);
      if(entries.length<=15){c.textAlign='center';c.fillStyle='#55627a';c.font='12px sans-serif';c.fillText(String(i+1),x,h-15);}
    });
    c.save();c.translate(12,h/2);c.rotate(-Math.PI/2);c.textAlign='center';c.font='12px sans-serif';c.fillStyle='#53627d';c.fillText('วินาที',0,0);c.restore();
  }
  window.UsageChart={render,draw,duration};
})();
