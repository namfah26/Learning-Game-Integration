(function(){
  "use strict";
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));

  function prepareCanvas(canvas,height=260){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const width=Math.max(280,canvas.clientWidth||500);
    canvas.width=Math.round(width*dpr);
    canvas.height=Math.round(height*dpr);
    canvas.style.height=`${height}px`;
    const ctx=canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return {ctx,width,height};
  }

  function drawRadar(canvas,values={}){
    if(!canvas)return;
    const {ctx,width,height}=prepareCanvas(canvas,260);
    ctx.clearRect(0,0,width,height);
    const cx=width/2,cy=128,r=Math.min(82,width*.22);
    const dirs=[
      {k:"up",label:"บน",x:0,y:-1},
      {k:"right",label:"ขวา",x:1,y:0},
      {k:"down",label:"ล่าง",x:0,y:1},
      {k:"left",label:"ซ้าย",x:-1,y:0}
    ];
    ctx.lineWidth=1;
    for(let ring=1;ring<=5;ring++){
      const t=ring/5;
      ctx.beginPath();
      dirs.forEach((d,i)=>{
        const x=cx+d.x*r*t,y=cy+d.y*r*t;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      });
      ctx.closePath();ctx.strokeStyle="rgba(91,103,216,.22)";ctx.stroke();
    }
    dirs.forEach(d=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+d.x*r,cy+d.y*r);ctx.strokeStyle="rgba(91,103,216,.20)";ctx.stroke()});
    const pts=dirs.map(d=>({x:cx+d.x*r*clamp(values[d.k])/100,y:cy+d.y*r*clamp(values[d.k])/100}));
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle="rgba(91,103,216,.18)";ctx.strokeStyle="#5965d6";ctx.lineWidth=3;ctx.fill();ctx.stroke();
    pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle="#5965d6";ctx.fill()});
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#394269";ctx.font="800 13px Tahoma,Arial";
    dirs.forEach(d=>{
      const x=cx+d.x*(r+28),y=cy+d.y*(r+24);
      ctx.fillText(`${d.label} ${Math.round(clamp(values[d.k]))}%`,x,y);
    });
  }

  function drawTrend(canvas,points=[]){
    if(!canvas)return;
    const {ctx,width,height}=prepareCanvas(canvas,260);
    ctx.clearRect(0,0,width,height);
    const pad={l:42,r:18,t:20,b:38},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
    ctx.font="12px Tahoma,Arial";ctx.fillStyle="#7b8397";ctx.textAlign="right";ctx.textBaseline="middle";
    [0,25,50,75,100].forEach(v=>{
      const y=pad.t+h-(v/100)*h;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.strokeStyle="#edf0f7";ctx.stroke();ctx.fillText(String(v),pad.l-8,y);
    });
    if(!points.length){ctx.textAlign="center";ctx.fillText("ยังไม่มีข้อมูลแนวโน้ม",width/2,height/2);return}
    const xFor=i=>points.length===1?pad.l+w/2:pad.l+(i/(points.length-1))*w;
    const yFor=v=>pad.t+h-(clamp(v)/100)*h;
    ctx.beginPath();points.forEach((p,i)=>{const x=xFor(i),y=yFor(p.value);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#5b67d8";ctx.lineWidth=3;ctx.stroke();
    points.forEach((p,i)=>{const x=xFor(i),y=yFor(p.value);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle="#5b67d8";ctx.fill(); if(points.length<=8){ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle="#7b8397";ctx.font="11px Tahoma,Arial";ctx.fillText(p.label||String(i+1),x,height-pad.b+10)}});
  }

  window.GameCharts={drawRadar,drawTrend};
})();
