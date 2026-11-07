(() => {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const W = 1440, H = 810;
  let t = 0, speed = 36, steer = 0, jump = 0, jumpV = 0, trickSpin = 0, started = false, escaped = false;
  let distance = 0.8, score = 0, cameraMode = 0, dismounted = false, sprint = false, shake = 0;
  const keys = new Set(), pointers = new Map();
  const ui = { speed:document.getElementById('speed'), dist:document.getElementById('distance'), obj:document.getElementById('objective'), combo:document.getElementById('combo'), toast:document.getElementById('toast'), center:document.getElementById('centerMessage'), flash:document.getElementById('flash') };
  function resize(){const r=canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0)}
  new ResizeObserver(resize).observe(canvas); resize();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function poly(points, fill, stroke, lw=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke()}}
  function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()}
  function drawSky(){
    const g=ctx.createLinearGradient(0,0,0,470);g.addColorStop(0,'#68bbd0');g.addColorStop(.52,'#b9d1c8');g.addColorStop(.77,'#efc18d');g.addColorStop(1,'#f3d09d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const sun=ctx.createRadialGradient(1080,180,4,1080,180,260);sun.addColorStop(0,'#fff6d5aa');sun.addColorStop(.17,'#ffe9b455');sun.addColorStop(1,'#ffe2a000');ctx.fillStyle=sun;ctx.fillRect(790,0,520,460);
    ctx.fillStyle='#fff0c8';ctx.beginPath();ctx.arc(1080,180,31,0,7);ctx.fill();
    // layered dusty hills
    poly([[0,395],[90,330],[180,350],[285,285],[400,342],[510,300],[600,367],[700,320],[790,370],[890,314],[1000,360],[1110,286],[1210,350],[1320,305],[1440,360],[1440,480],[0,480]],'#798e82');
    poly([[0,411],[130,368],[225,380],[335,330],[442,381],[570,341],[665,389],[790,345],[891,390],[1000,350],[1122,389],[1250,335],[1350,377],[1440,350],[1440,480],[0,480]],'#8ea093');
    // distant city haze
    for(let i=0;i<27;i++){let x=i*59-12, h=20+(i*37%54), y=409-h;ctx.fillStyle=i%3?'#677d7c88':'#d0b99899';ctx.fillRect(x,y,38,h+60);ctx.fillStyle='#e7d2a866';for(let j=0;j<3;j++)ctx.fillRect(x+6+j*10,y+9,4,5)}
  }
  function drawBuilding(x,y,w,h,color,side=0){
    ctx.fillStyle='#6b6960';ctx.fillRect(x,y,w,h);
    const front=color;ctx.fillStyle=front;ctx.fillRect(x+side,y,w-side,h);
    poly([[x,y],[x+side,y-8],[x+w+side,y-8],[x+w,y]],'#d6c6a9');
    ctx.fillStyle='#4b5553';ctx.fillRect(x+side,y+8,w-side,5);
    const cols=Math.max(2,Math.floor(w/29)), rows=Math.max(2,Math.floor(h/31));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){let wx=x+side+7+c*((w-side-14)/cols), wy=y+22+r*31;ctx.fillStyle=(r*3+c)%5===0?'#d9b677':'#425d61';ctx.fillRect(wx,wy,Math.max(4,(w-side-19)/cols*.56),12);ctx.fillStyle='#ffffff25';ctx.fillRect(wx,wy,2,12)}
    ctx.fillStyle='#d5c6a6';ctx.fillRect(x+side,y+h-12,w-side,12);
  }
  function palm(x,y,s,lean=0){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle='#77634a';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(lean,-90,lean*.7,-205);ctx.stroke();
    ctx.fillStyle='#344f3c';for(let i=0;i<9;i++){let a=-Math.PI*.98+i*Math.PI*1.22/8;ctx.save();ctx.translate(lean*.7,-203);ctx.rotate(a);ctx.beginPath();ctx.ellipse(32,-3,44,8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#82915d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,0);ctx.quadraticCurveTo(24,7,67,0);ctx.stroke();ctx.restore()}
    ctx.fillStyle='#8c5a37';ctx.beginPath();ctx.ellipse(lean*.7,-202,7,11,0,0,7);ctx.fill();ctx.restore();
  }
  function drawCity(){
    // roadside facades, perspective scale into the skyline
    drawBuilding(0,282,172,244,'#b89770',8);drawBuilding(129,321,128,207,'#aaa28a',6);drawBuilding(235,349,112,175,'#c7ae83',4);
    drawBuilding(1240,279,200,248,'#9b8a72',10);drawBuilding(1146,327,133,202,'#c2a57f',5);drawBuilding(1072,355,98,173,'#927f68',4);
    // awnings and shopfronts
    for(let x=14;x<164;x+=48){ctx.fillStyle='#e9d8b7';ctx.fillRect(x,444,40,31);ctx.fillStyle='#526263';ctx.fillRect(x+5,449,30,24);ctx.fillStyle='#d58f5e';ctx.fillRect(x,439,42,7)}
    for(let x=1270;x<1430;x+=50){ctx.fillStyle='#ded0ad';ctx.fillRect(x,446,42,31);ctx.fillStyle='#526263';ctx.fillRect(x+5,451,32,24);ctx.fillStyle='#5e7772';ctx.fillRect(x,440,44,8)}
    // sidewalks and curb
    poly([[0,461],[536,421],[550,810],[0,810]],'#b49d7d');poly([[1440,459],[914,421],[890,810],[1440,810]],'#b49d7d');
    poly([[0,455],[536,414],[541,426],[0,470]],'#e4d1aa');poly([[1440,455],[914,414],[909,426],[1440,470]],'#e4d1aa');
    // road plane
    poly([[531,414],[909,414],[1384,810],[53,810]],'#414744');
    // lane edges and tar seams
    poly([[536,416],[540,416],[183,810],[169,810]],'#e5d7af');poly([[904,416],[908,416],[1272,810],[1258,810]],'#e5d7af');
    const flow=(t*speed*.38)%190;
    for(let k=0;k<8;k++){let y=430+k*57+flow*.7, q=(y-414)/396;if(y<810){let half=5+q*7;ctx.fillStyle='#e7dfbd';ctx.globalAlpha=.78;ctx.fillRect(718-half/2,y,half,13+q*24);ctx.globalAlpha=1}}
    // road grit and sun shimmer flecks
    for(let i=0;i<55;i++){let x=(i*173+31)%1440,y=(i*97+Math.floor(t*speed*9))%810;if(y>420&&x>190&&x<1250){ctx.globalAlpha=.1+(i%3)*.035;ctx.fillStyle=i%2?'#e7d6ac':'#111';ctx.fillRect(x,y,1+i%3,1)} }ctx.globalAlpha=1;
    // streetlights & palms
    for(let side of [-1,1])for(let i=0;i<4;i++){let z=(i*180+(t*speed*3)%180), s=.28+z/360;let x=side<0?488-z*.75:952+z*.75,y=395+z*.17;palm(x,y,s,side*13);let lx=side<0?514-z*.9:926+z*.9;ctx.strokeStyle='#56605b';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(lx,y+25*s);ctx.lineTo(lx,y-87*s);ctx.lineTo(lx+side*23*s,y-87*s);ctx.stroke();ctx.fillStyle='#f7e7b6';ctx.beginPath();ctx.ellipse(lx+side*23*s,y-87*s,8*s,3*s,0,0,7);ctx.fill()}
  }
  function drawCar(x,y,s,color,police=false,phase=0){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    // shadow
    ctx.fillStyle='#1118';ctx.beginPath();ctx.ellipse(0,4,68,16,0,0,7);ctx.fill();
    poly([[-64,-29],[-49,-47],[-23,-63],[28,-61],[51,-42],[67,-34],[72,-10],[62,0],[-60,0],[-72,-11]],color,'#202624',2);
    poly([[-39,-44],[-20,-58],[24,-56],[43,-41]],'#394b4d','#d5d5c4',1);
    poly([[-18,-55],[0,-57],[0,-43],[-31,-43]],'#9cc2c1');poly([[5,-56],[22,-54],[38,-42],[5,-42]],'#9cc2c1');
    ctx.fillStyle='#e9ddbd';ctx.fillRect(-57,-29,20,7);ctx.fillStyle='#ff544b';ctx.fillRect(49,-29,13,7);
    ctx.fillStyle='#212523';ctx.fillRect(-50,-6,16,13);ctx.fillRect(39,-6,16,13);ctx.fillStyle='#9ca09a';ctx.fillRect(-47,-5,9,10);ctx.fillRect(42,-5,9,10);
    ctx.fillStyle='#252b29';ctx.fillRect(-15,-35,31,8);ctx.fillStyle='#ddd8c5';ctx.fillRect(-9,-34,18,5);
    if(police){ctx.fillStyle='#e5e5db';ctx.fillRect(-62,-33,122,10);ctx.fillStyle='#183f4d';ctx.fillRect(-61,-26,122,5);ctx.fillStyle='#151a1a';ctx.fillRect(-15,-68,30,7);ctx.fillStyle='#ef3e42';ctx.fillRect(-12,-70,11,4);ctx.fillStyle='#45d5ff';ctx.fillRect(2,-70,11,4);let pulse=(Math.sin(t*13+phase)+1)/2;ctx.globalAlpha=.24+.28*pulse;ctx.fillStyle='#ea2737';ctx.beginPath();ctx.ellipse(-10,-68,32,16,0,0,7);ctx.fill();ctx.fillStyle='#28aaff';ctx.beginPath();ctx.ellipse(10,-68,32,16,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#e9eee2';ctx.font='bold 8px Arial';ctx.fillText('POLICE',-19,-13)}
    ctx.restore();
  }
  function drawTraffic(){
    // traffic on both sides of the chase
    const drift=(t*speed*1.7)%560;
    const cars=[{x:1070-drift*.45,y:500+drift*.22,s:.58+drift/1300,c:'#c8c0a5'},{x:425+drift*.23,y:493+drift*.12,s:.43+drift/1800,c:'#587c78'},{x:1195-(drift*.26),y:600+drift*.25,s:.66+drift/1100,c:'#c45c49'},{x:300+drift*.18,y:583+drift*.19,s:.58+drift/1400,c:'#d4d0ba'}];
    cars.forEach(a=>{if(a.y<790)drawCar(a.x,a.y,a.s,a.c)});
    let policeY=510+Math.sin(t*1.3)*8, policeX=715+Math.sin(t*.6)*48+steer*24;drawCar(policeX,policeY,1.05,'#e1e2d9',true);
    // dust wakes behind nearby traffic
    for(let i=0;i<10;i++){let x=policeX+(i%2?70:-70)+(Math.sin(t*2+i)*13), y=policeY+Math.floor(i/2)*10+20;ctx.globalAlpha=.08+(i%3)*.02;ctx.fillStyle='#f3d6a5';ctx.beginPath();ctx.ellipse(x,y,10+i*2,4+i,0,0,7);ctx.fill()}ctx.globalAlpha=1;
  }
  function drawBoardAndSkater(){
    const bob=Math.sin(t*8)*3, airborne=jump>0?Math.sin((1-jump)*Math.PI)*78:0, x=720+steer*40+Math.sin(t*1.2)*5, y=658-bob-airborne+(dismounted?20:0);
    ctx.save();ctx.translate(x,y);ctx.rotate(steer*.075 + (jump>0?trickSpin:Math.sin(t*2)*.018));
    // rider shadow
    ctx.globalAlpha=.26;ctx.fillStyle='#101513';ctx.beginPath();ctx.ellipse(0,20+airborne*.4,66,12,0,0,7);ctx.fill();ctx.globalAlpha=1;
    // skateboard, angled graphic deck
    ctx.save();ctx.translate(0,10+airborne*.35);ctx.rotate(Math.sin(t*2)*.035+(jump>0?trickSpin:0));
    poly([[-55,-4],[-44,-10],[43,-10],[58,-3],[47,5],[-44,5]],'#d1a96a','#271f1a',2);
    poly([[-38,-8],[-18,-9],[1,-9],[30,-8],[40,-4],[23,-2],[-21,-3]],'#ee5e45');
    ctx.strokeStyle='#f0da9a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-6,11,0,7);ctx.stroke();
    for(let wx of [-35,35]){ctx.fillStyle='#252927';ctx.beginPath();ctx.arc(wx,7,6,0,7);ctx.fill();ctx.fillStyle='#89918a';ctx.beginPath();ctx.arc(wx,7,2,0,7);ctx.fill()}
    ctx.restore();
    if(!dismounted){
      // rider shadow
      ctx.globalAlpha=.26;ctx.fillStyle='#101513';ctx.beginPath();ctx.ellipse(0,20+airborne*.4,66,12,0,0,7);ctx.fill();ctx.globalAlpha=1;
      // legs, baggy jeans
      poly([[-17,-78],[-2,-76],[8,-35],[32,-14],[26,-4],[0,-16],[-16,-42]],'#252b2a','#151a19',2);
      poly([[6,-76],[22,-75],[15,-41],[-3,-14],[-16,-18],[-3,-49]],'#303634','#151a19',2);
      poly([[20,-17],[34,-16],[46,-7],[43,-1],[18,-3],[12,-8]],'#ddd3bb','#262623',2);
      poly([[-18,-20],[-5,-18],[4,-9],[1,-3],[-25,-5],[-29,-11]],'#e2d4b8','#262623',2);
      // hoodie and arms lean into the carve
      poly([[-22,-145],[4,-153],[29,-139],[37,-102],[22,-74],[-15,-72],[-35,-100]],'#202726','#0e1415',3);
      poly([[-22,-144],[-42,-130],[-55,-103],[-46,-95],[-28,-119]],'#242a29','#111615',2);
      poly([[20,-140],[38,-135],[52,-109],[44,-103],[23,-122]],'#252b2a','#111615',2);
      ctx.fillStyle='#c89169';ctx.beginPath();ctx.ellipse(-50,-96,7,5,-.4,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(47,-104,6,5,.3,0,7);ctx.fill();
      // hood, profile, seams and backpack strap
      ctx.fillStyle='#1b2221';ctx.beginPath();ctx.ellipse(1,-158,20,23,-.2,0,7);ctx.fill();
      ctx.fillStyle='#b98160';ctx.beginPath();ctx.ellipse(10,-158,11,14,.1,0,7);ctx.fill();
      poly([[0,-177],[14,-180],[23,-171],[21,-161],[12,-168],[2,-165]],'#1b2221');
      ctx.strokeStyle='#66706a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-145);ctx.lineTo(1,-112);ctx.lineTo(-2,-93);ctx.stroke();ctx.beginPath();ctx.moveTo(-22,-104);ctx.quadraticCurveTo(0,-98,21,-104);ctx.stroke();
      ctx.strokeStyle='#626458';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-140);ctx.quadraticCurveTo(-4,-117,2,-99);ctx.stroke();
    }else{
      ctx.fillStyle='#c89169';ctx.beginPath();ctx.arc(5,-124,15,0,7);ctx.fill();rr(-15,-112,34,48,8,'#202726');poly([[-11,-72],[2,-72],[-12,-35],[-26,-24],[-32,-31]],'#292f2e');poly([[11,-72],[23,-70],[34,-35],[27,-27],[10,-46]],'#292f2e');
    }
    ctx.restore();
    // vignette motion streaks
    if(speed>44){ctx.globalAlpha=.1;ctx.strokeStyle='#f7edcf';ctx.lineWidth=2;for(let i=0;i<8;i++){let yy=470+i*34;ctx.beginPath();ctx.moveTo((i*213+Math.floor(t*speed*5))%1440,yy);ctx.lineTo((i*213+Math.floor(t*speed*5))%1440-38,yy+8);ctx.stroke()}ctx.globalAlpha=1}
  }
  function render(){
    ctx.clearRect(0,0,W,H);ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.9}
    drawSky();drawCity();drawTraffic();drawBoardAndSkater();
    // sunlight lens streak
    ctx.globalAlpha=.1;ctx.fillStyle='#fff1bd';ctx.beginPath();ctx.ellipse(1040,360,240,8,-.25,0,7);ctx.fill();ctx.globalAlpha=1;
    if(jump>0){ctx.fillStyle='#ffe477';ctx.font='800 16px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.fillText('+'+Math.floor(250+score%800),720,490);ctx.textAlign='left'}
    ctx.restore();
  }
  function say(text){ui.toast.innerHTML=text;ui.toast.classList.add('show');clearTimeout(say.timer);say.timer=setTimeout(()=>ui.toast.classList.remove('show'),1050)}
  function begin(){if(!started){started=true;ui.center.classList.remove('show')}}
  function doOllie(){begin();if(jump<=0&&!dismounted){jump=1;jumpV=1;trickSpin=0;score+=250;say('OLLIE <b>+250</b>');shake=2}}
  function doTrick(){begin();if(jump>0){trickSpin+=Math.PI*2;score+=750;say('KICKFLIP <b>+750</b>');ui.combo.textContent='×'+(1+Math.floor(score/1500)*.5).toFixed(1)}else{steer=steer||.6;say('CARVE <b>STYLE</b>')}}
  function doPush(){begin();speed=clamp(speed+5,0,76);say('PUSH <b>+5 MPH</b>')}
  function doDismount(){begin();dismounted=!dismounted;if(dismounted)say('BOARD RELEASED');else say('BACK ON BOARD');}
  function action(name){if(name==='push')doPush();if(name==='ollie')doOllie();if(name==='trick')doTrick();if(name==='dismount')doDismount();if(name==='camera'){cameraMode=(cameraMode+1)%3;document.querySelector('.screen').style.filter=['none','saturate(.8) contrast(1.08)','sepia(.14)'][cameraMode];say('CAMERA '+(cameraMode+1))}if(name==='shoot'){ui.flash.classList.remove('on');void ui.flash.offsetWidth;ui.flash.classList.add('on');say('SUPPRESSING PURSUIT')}if(name==='sprint'){sprint=!sprint;say(sprint?'SPRINT ON':'SPRINT OFF')}}
  document.querySelectorAll('[data-control]').forEach(btn=>{btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);btn.classList.add('pressed');let c=btn.dataset.control;if(c==='steer'){pointers.set(e.pointerId,{x:e.clientX,el:btn});begin()}else if(c==='sprint'){action(c)}else if(c==='push'){action(c)}else if(c==='ollie'){action(c)}else if(c==='trick'){action(c)}else if(c==='dismount'){action(c)}else action(c)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,e=>{btn.classList.remove('pressed');pointers.delete(e.pointerId)}))});
  window.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId)){const p=pointers.get(e.pointerId),r=p.el.getBoundingClientRect();steer=clamp((e.clientX-(r.left+r.width/2))/(r.width*.38),-1,1)}});
  const mapKey={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back', ' ':'ollie',e:'push',q:'trick',Shift:'sprint',x:'dismount',c:'camera',f:'shoot'};
  window.addEventListener('keydown',e=>{if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();let k=mapKey[e.key]||mapKey[e.key.toLowerCase()];if(k&&!keys.has(k)){keys.add(k);begin();if(k==='ollie')doOllie();if(k==='push')doPush();if(k==='trick')doTrick();if(k==='dismount')doDismount();if(k==='camera')action('camera');if(k==='shoot')action('shoot');if(k==='sprint')sprint=!sprint}});
  window.addEventListener('keyup',e=>keys.delete(mapKey[e.key]||mapKey[e.key.toLowerCase()]));
  document.querySelector('.screen').addEventListener('pointerdown',e=>{if(e.target===canvas){begin();let r=canvas.getBoundingClientRect();steer=clamp((e.clientX-r.left-r.width/2)/(r.width*.6),-1,1)}});
  function update(dt){t+=dt;let left=keys.has('left'),right=keys.has('right');if(left||right)steer+=(right?1:-1)*dt*2.7;else if(!pointers.size)steer*=Math.pow(.08,dt);steer=clamp(steer,-1,1);if(keys.has('forward'))speed=clamp(speed+dt*6,0,76);if(keys.has('back'))speed=clamp(speed-dt*12,0,76);if(sprint)speed=clamp(speed+dt*4,0,76);else speed=clamp(speed-dt*.3,0,76);
    if(jump>0){jump-=dt*1.65;if(jump<=0){jump=0;if(!dismounted)say('CLEAN LANDING <b>+'+Math.floor(250+score%700)+'</b>')}}
    if(started&&!escaped){distance-=dt*(speed/36)*.006;if(distance<=0){escaped=true;ui.obj.textContent='YOU LOST THE POLICE';ui.dist.textContent='SAFE';document.querySelectorAll('.star.active').forEach(x=>x.classList.remove('active'));say('PURSUIT LOST <b>+$5,000</b>');score+=5000}}
    ui.speed.textContent=Math.round(speed);ui.dist.textContent=escaped?'SAFE':Math.max(0,distance).toFixed(1)+' mi';if(!started&& !ui.center.classList.contains('show'))ui.center.classList.add('show');render();requestAnimationFrame(frame)}
  let last=performance.now();function frame(now){let dt=Math.min(.04,(now-last)/1000);last=now;update(dt)}requestAnimationFrame(frame);
})();
