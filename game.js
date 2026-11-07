(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d', { alpha: false });
  const mini = document.getElementById('minimap'), mctx = mini.getContext('2d');
  const W = 640, H = 360, horizon = 180;
  canvas.width = W; canvas.height = H;
  const TAU = Math.PI * 2, FOV = Math.PI / 2.85;
  const player = { x: 3.7, y: 3.5, a: 0, health: 100, ammo: 12, reserve: 48, score: 0 };
  let started = false, gameOver = false, remaining = 6, lastTime = 0, fireTimer = 0, recoil = 0, damageFlash = 0, reloadTimer = 0, toastTimer = 0;
  const keys = Object.create(null), depth = new Float32Array(W), enemies = [], pickups = [];
  const walkTouches = new Set();
  const ui = {
    overlay: document.getElementById('overlay'), start: document.getElementById('start-button'),
    targets: document.getElementById('targets-left'), progress: document.getElementById('progress-fill'),
    health: document.getElementById('health-fill'), healthNum: document.getElementById('health-number'),
    ammo: document.getElementById('ammo-now'), reserve: document.getElementById('ammo-reserve'),
    toast: document.getElementById('toast'), hit: document.getElementById('hit-marker')
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fract = x => x - Math.floor(x);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const cellSolid = (x, y) => fract(x / 14) > 8 / 14 && fract(y / 14) > 8 / 14;
  const buildingStyle = (x, y) => (Math.floor(x / 14) * 7 + Math.floor(y / 14) * 11 + 180) % 8;

  function makeFacade(style) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const bricks = ['#785e4c','#756b5c','#6a5549','#777267','#624e47','#6e6256','#7a6656','#555754'];
    const base = bricks[style];
    g.fillStyle = base; g.fillRect(0,0,128,256);
    g.fillStyle = 'rgba(25,27,25,.22)';
    for (let y=0;y<256;y+=18) { g.fillRect(0,y,128,2); for(let x=(y/18%2)*12;x<128;x+=24)g.fillRect(x,y,1,18); }
    const warm = ['#d7b57b','#91a79b','#d0a47c','#8da4a5','#c59773','#9ca17e','#d1b188','#a8aba2'][style];
    for (let fy=0;fy<4;fy++) for(let fx=0;fx<2;fx++) {
      const x=12+fx*58, y=12+fy*59;
      g.fillStyle='#252a29';g.fillRect(x-3,y-3,35,43);
      g.fillStyle='#46504f';g.fillRect(x,y,29,37);
      const lit=hash(style*17+fx,fy)>.42;
      g.fillStyle=lit?warm:'#293d45';g.fillRect(x+3,y+4,23,29);
      if(lit){g.fillStyle='rgba(255,230,177,.32)';g.fillRect(x+3,y+4,23,5);g.fillStyle='rgba(27,30,30,.8)';g.fillRect(x+13,y+4,2,29);}
      g.fillStyle='#554f43';g.fillRect(x-4,y+37,37,4);g.fillRect(x-4,y-4,37,4);
    }
    g.fillStyle='rgba(24,27,26,.55)';
    for(let i=0;i<5;i++){const x=i*27-3;g.fillRect(x,0,2,256);}
    if(style===1||style===5){g.strokeStyle='#282c29';g.lineWidth=3;for(let y=35;y<220;y+=40){g.beginPath();g.moveTo(5,y);g.lineTo(123,y);g.lineTo(119,y+17);g.stroke();}for(let x=10;x<128;x+=35){g.beginPath();g.moveTo(x,30);g.lineTo(x,226);g.stroke();}}
    if(style===2||style===6){g.fillStyle='#d5c7a6';g.fillRect(4,224,120,21);g.fillStyle='#bd5038';g.fillRect(8,228,112,13);g.fillStyle='#e7d8b8';g.font='bold 9px monospace';g.fillText(style===2?'DELI   OPEN 24H':'HOTEL  ★★★',13,238);}
    g.fillStyle='rgba(12,17,18,.2)';g.fillRect(0,0,128,256);
    return c;
  }
  const facades = Array.from({length:8},(_,i)=>makeFacade(i));

  function drawSky() {
    const grad=ctx.createLinearGradient(0,0,0,horizon+38);
    grad.addColorStop(0,'#72899a'); grad.addColorStop(.58,'#b2a898'); grad.addColorStop(1,'#e1b688');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,horizon+45);
    // Far skyline haze and rooftops between close buildings.
    for(let i=0;i<22;i++){
      const x=((i*97 - player.x*8 + 4800)%820)-90, h=13+hash(i,8)*49;
      ctx.fillStyle=i%3===0?'#697578':'#788180';ctx.fillRect(x,horizon-h,x%3+23,h);
      ctx.fillStyle='#91918a';for(let j=0;j<3;j++)ctx.fillRect(x+3+j*6,horizon-h+5,3,7);
    }
    ctx.fillStyle='rgba(241,195,139,.27)';ctx.fillRect(0,horizon-4,W,34);
  }
  function floorPixel(x,y,dist) {
    const a=player.a+(x/W-.5)*FOV;
    const wx=player.x+Math.cos(a)*dist, wy=player.y+Math.sin(a)*dist;
    const fx=fract(wx/14), fy=fract(wy/14), roadX=fx<8/14, roadY=fy<8/14;
    let r,g,b;
    if(roadX&&roadY){r=57;g=59;b=55;
      // Manhattan's broken double-yellow line on avenues.
      if(Math.abs(fy-4/14)<.0017){r=177;g=151;b=77;}
      if(Math.abs(fx-4/14)<.0017){r=166;g=142;b=71;}
      const crossX=fx<.095||fx>.905, crossY=fy<.095||fy>.905;
      if((crossX||crossY)&& (Math.abs(fx-.08)<.019||Math.abs(fy-.08)<.019)){r=195;g=186;b=157;}
      // manholes and faint asphalt grain
      if(fract(wx*.21)<.09&&fract(wy*.21)<.08){r+=8;g+=7;b+=6;}
    }else if(!roadX&&!roadY){r=81;g=76;b=67;}
    else {r=119;g=111;b=94;
      if(Math.abs(fx-8/14)<.01||Math.abs(fy-8/14)<.01){r=166;g=154;b=127;}
      const joints=(Math.abs(fract(wx)-.04)<.016||Math.abs(fract(wy)-.04)<.016);
      if(joints){r-=15;g-=13;b-=10;}
    }
    const shade=clamp(1.02-dist*.009, .36, 1)*(.94+hash(Math.floor(wx*2),Math.floor(wy*2))*.12);
    const p=(y*W+x)*4;pixels[p]=r*shade;pixels[p+1]=g*shade;pixels[p+2]=b*shade;pixels[p+3]=255;
  }
  const frame=ctx.createImageData(W,H), pixels=frame.data;
  function renderFloor() {
    for(let y=horizon+1;y<H;y++){
      const dist=(H*.48)/(y-horizon);
      if(dist>54)continue;
      for(let x=0;x<W;x+=2){floorPixel(x,y,dist);floorPixel(x+1,y,dist);}
    }
    ctx.putImageData(frame,0,0,0,horizon+1,W,H-horizon-1);
  }
  function castRay(angle) {
    const dx=Math.cos(angle),dy=Math.sin(angle), mapX=Math.floor(player.x),mapY=Math.floor(player.y);
    const deltaX=Math.abs(1/dx),deltaY=Math.abs(1/dy);
    const stepX=dx<0?-1:1,stepY=dy<0?-1:1;
    let sideX=dx<0?(player.x-mapX)*deltaX:(mapX+1-player.x)*deltaX;
    let sideY=dy<0?(player.y-mapY)*deltaY:(mapY+1-player.y)*deltaY;
    let mx=mapX,my=mapY,side=0,dist=0;
    for(let i=0;i<160;i++){
      if(sideX<sideY){sideX+=deltaX;mx+=stepX;side=0;dist=sideX-deltaX;}
      else{sideY+=deltaY;my+=stepY;side=1;dist=sideY-deltaY;}
      if(dist>54)break;
      if(cellSolid(mx+.5,my+.5)){const hit=side===0?player.y+dist*dy:player.x+dist*dx;return {dist,side,u:fract(hit),mx,my,style:buildingStyle(mx,my)};}
    }
    return {dist:54,side:0,u:0,mx:0,my:0,style:0};
  }
  function renderWalls() {
    const step=2;
    for(let x=0;x<W;x+=step){
      const angle=player.a+(x/W-.5)*FOV, hit=castRay(angle), corrected=hit.dist*Math.cos(angle-player.a);
      for(let k=0;k<step;k++)depth[x+k]=corrected;
      const blockHeight=3.1+hash(Math.floor(hit.mx/14),Math.floor(hit.my/14))*2.2;
      const wallH=Math.min(H*2,H*1.04*blockHeight/corrected);
      const top=Math.max(0,Math.floor(horizon-wallH*.53)),bottom=Math.min(H,Math.floor(horizon+wallH*.47));
      const facade=facades[hit.style], sx=Math.min(127,Math.floor(hit.u*128));
      ctx.globalAlpha=hit.side===1?.79:.97;
      ctx.drawImage(facade,sx,0,1,256,x,top,step,bottom-top);
      ctx.globalAlpha=1;
      // warm sky-light along the cornice and dark ground contact.
      ctx.fillStyle='rgba(237,194,139,.18)';ctx.fillRect(x,top,step,Math.max(1,wallH*.025));
      ctx.fillStyle='rgba(10,13,13,.28)';ctx.fillRect(x,bottom-2,step,2);
      if(corrected>19){ctx.fillStyle=`rgba(190,191,174,${Math.min(.3,(corrected-19)*.009)})`;ctx.fillRect(x,top,step,bottom-top);}
    }
  }

  function makeEnemy(x,y,variant=0){return {x,y,hp:2,alive:true,variant,phase:Math.random()*6,shot:1.5+Math.random()*2,hit:0};}
  function seedEnemies(){
    enemies.length=0;
    [[9.5,3.5],[3.8,9.5],[18.5,3.7],[3.6,18.5],[10.5,18.4],[18.6,10.5]].forEach((p,i)=>enemies.push(makeEnemy(...p,i%4)));
    pickups.length=0;
  }
  seedEnemies();

  function drawEnemy(e,now){
    if(!e.alive)return;
    let dx=e.x-player.x,dy=e.y-player.y,dist=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)-player.a;
    while(angle>Math.PI)angle-=TAU;while(angle<-Math.PI)angle+=TAU;
    if(Math.abs(angle)>FOV*.62||dist<.25)return;
    const sx=(.5+angle/FOV)*W, size=clamp(H*1.14/dist,3,118), base=horizon+size*.51;
    if(sx<0||sx>=W||dist>depth[clamp(Math.floor(sx),0,W-1)]+.3)return;
    const bob=Math.sin(now*.004+e.phase)*size*.012, x=sx, s=size;
    ctx.save();ctx.translate(x,base+bob);
    const leg='#292b2a', shirt=['#596458','#6a4035','#515d68','#7b654a'][e.variant];
    ctx.fillStyle='rgba(13,16,15,.35)';ctx.beginPath();ctx.ellipse(0,0,s*.18,s*.045,0,0,TAU);ctx.fill();
    // legs, boots
    ctx.fillStyle=leg;ctx.fillRect(-s*.105,-s*.31,s*.075,s*.28);ctx.fillRect(s*.03,-s*.31,s*.075,s*.28);
    ctx.fillStyle='#171b1b';ctx.fillRect(-s*.12,-s*.06,s*.09,s*.045);ctx.fillRect(s*.02,-s*.06,s*.10,s*.045);
    // torso, shoulders, collar
    ctx.fillStyle=shirt;ctx.fillRect(-s*.15,-s*.69,s*.30,s*.38);ctx.fillRect(-s*.21,-s*.65,s*.11,s*.27);ctx.fillRect(s*.10,-s*.65,s*.11,s*.27);
    ctx.fillStyle='#d2aa84';ctx.fillRect(-s*.045,-s*.76,s*.09,s*.10);
    ctx.fillStyle=['#a36c4c','#bd916d','#835f48','#c19b75'][e.variant];ctx.beginPath();ctx.arc(0,-s*.82,s*.105,0,TAU);ctx.fill();
    ctx.fillStyle='#272927';ctx.beginPath();ctx.arc(0,-s*.85,s*.115,Math.PI,TAU);ctx.fill();ctx.fillRect(-s*.11,-s*.86,s*.22,s*.035);
    // aimed dark service pistol
    ctx.strokeStyle='#292d2b';ctx.lineWidth=Math.max(1,s*.035);ctx.beginPath();ctx.moveTo(s*.1,-s*.59);ctx.lineTo(s*.29,-s*.68);ctx.stroke();ctx.fillStyle='#272a28';ctx.fillRect(s*.24,-s*.705,s*.13,s*.042);
    if(e.hit>0){ctx.strokeStyle=`rgba(255,224,179,${e.hit})`;ctx.lineWidth=2;ctx.strokeRect(-s*.2,-s*.94,s*.4,s*.92);}
    ctx.restore();
    if(e.hp===1){const bw=s*.32;ctx.fillStyle='#171c1b';ctx.fillRect(sx-bw/2,base-s*1.06,bw,2);ctx.fillStyle='#ed7650';ctx.fillRect(sx-bw/2,base-s*1.06,bw*.55,2);}
  }
  function render(now){
    drawSky();renderFloor();renderWalls();
    enemies.filter(e=>e.alive).sort((a,b)=>Math.hypot(b.x-player.x,b.y-player.y)-Math.hypot(a.x-player.x,a.y-player.y)).forEach(e=>drawEnemy(e,now));
    drawWeapon();drawMinimap();
  }
  function drawWeapon(){
    const recoilY=recoil*14;
    ctx.save();ctx.translate(W*.5,H+10+recoilY);
    // illustrated hand and compact service sidearm in the foreground
    ctx.fillStyle='#b17b5d';ctx.beginPath();ctx.moveTo(-26,-6);ctx.lineTo(-13,-62);ctx.lineTo(18,-76);ctx.lineTo(42,-42);ctx.lineTo(28,0);ctx.fill();
    ctx.fillStyle='#303333';ctx.beginPath();ctx.moveTo(-19,-56);ctx.lineTo(-12,-99);ctx.lineTo(10,-111);ctx.lineTo(30,-100);ctx.lineTo(24,-53);ctx.lineTo(4,-36);ctx.closePath();ctx.fill();
    ctx.fillStyle='#515454';ctx.fillRect(-10,-124,36,29);ctx.fillStyle='#777b76';ctx.fillRect(-7,-122,30,4);ctx.fillStyle='#252928';ctx.fillRect(15,-118,5,10);
    ctx.fillStyle='#202323';ctx.beginPath();ctx.moveTo(-11,-95);ctx.lineTo(26,-95);ctx.lineTo(22,-82);ctx.lineTo(18,-54);ctx.lineTo(2,-48);ctx.lineTo(-2,-72);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#77756a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,-91);ctx.lineTo(22,-91);ctx.stroke();
    if(recoil>.12){ctx.fillStyle='#ffd38b';ctx.beginPath();ctx.moveTo(7,-127);ctx.lineTo(20,-148);ctx.lineTo(28,-125);ctx.fill();}
    ctx.restore();
  }
  function drawMinimap(){
    const s=mini.width, scale=3.4, cx=s/2,cy=s/2;
    mctx.clearRect(0,0,s,s);mctx.fillStyle='#242c2b';mctx.fillRect(0,0,s,s);
    for(let py=0;py<s;py+=2)for(let px=0;px<s;px+=2){
      const wx=player.x+(px-cx)/scale,wy=player.y+(py-cy)/scale,fx=fract(wx/14),fy=fract(wy/14);
      if(fx>8/14&&fy>8/14){mctx.fillStyle='#665f50';mctx.fillRect(px,py,2,2);}
      else if(fx>7/14||fy>7/14){mctx.fillStyle='#8c826d';mctx.fillRect(px,py,2,2);}
      else {mctx.fillStyle='#39403c';mctx.fillRect(px,py,2,2);}
    }
    for(const e of enemies)if(e.alive){const x=cx+(e.x-player.x)*scale,y=cy+(e.y-player.y)*scale;if(x>0&&x<s&&y>0&&y<s){mctx.fillStyle='#e76d4b';mctx.beginPath();mctx.arc(x,y,2.4,0,TAU);mctx.fill();}}
    mctx.save();mctx.translate(cx,cy);mctx.rotate(player.a);mctx.fillStyle='#e8eee1';mctx.beginPath();mctx.moveTo(0,-6);mctx.lineTo(4,5);mctx.lineTo(0,3);mctx.lineTo(-4,5);mctx.closePath();mctx.fill();mctx.restore();
    const grd=mctx.createRadialGradient(cx,cy,30,cx,cy,80);grd.addColorStop(0,'transparent');grd.addColorStop(1,'rgba(12,17,17,.6)');mctx.fillStyle=grd;mctx.fillRect(0,0,s,s);
  }
  function hasLine(x1,y1,x2,y2){const n=Math.ceil(Math.hypot(x2-x1,y2-y1)*4);for(let i=1;i<n;i++){const t=i/n;if(cellSolid(x1+(x2-x1)*t,y1+(y2-y1)*t))return false;}return true;}
  function shoot(){
    if(!started||gameOver||reloadTimer>0||fireTimer>0)return;
    if(player.ammo<=0){reload();return;}
    player.ammo--;fireTimer=.22;recoil=1;updateHud();
    const dir=player.a, candidates=enemies.filter(e=>e.alive).map(e=>{let a=Math.atan2(e.y-player.y,e.x-player.x)-dir;while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return {e,a,d:Math.hypot(e.x-player.x,e.y-player.y)}}).filter(o=>Math.abs(o.a)<.12&&o.d<34&&hasLine(player.x,player.y,o.e.x,o.e.y)).sort((a,b)=>a.d-b.d);
    if(candidates.length){const target=candidates[0].e;target.hp--;target.hit=.16;ui.hit.classList.add('show');setTimeout(()=>ui.hit.classList.remove('show'),105);if(target.hp<=0){target.alive=false;remaining--;player.score++;updateHud();if(remaining===0)secureBlock();}}
  }
  function reload(){if(!started||reloadTimer>0||player.ammo===12||player.reserve<=0)return;reloadTimer=1.05;setTimeout(()=>{if(!started)return;const n=Math.min(12-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;updateHud();},970);}
  function secureBlock(){ui.toast.classList.add('show');toastTimer=4.5;ui.toast.innerHTML='AREA SECURED <span>— MANHATTAN BREATHES EASIER</span>';}
  function updateHud(){ui.targets.textContent=remaining;ui.progress.style.width=`${((6-remaining)/6)*100}%`;ui.health.style.width=`${player.health}%`;ui.healthNum.textContent=player.health;ui.ammo.textContent=player.ammo;ui.reserve.textContent=player.reserve;}
  function damage(){if(gameOver)return;player.health=Math.max(0,player.health-8);damageFlash=.2;const el=document.createElement('div');el.className='damage-flash';document.getElementById('game-shell').appendChild(el);setTimeout(()=>el.remove(),280);updateHud();if(player.health===0){gameOver=true;ui.overlay.classList.remove('hidden');ui.overlay.querySelector('.title-kicker').textContent='END OF WATCH';ui.overlay.querySelector('h1').innerHTML='BLOCK<br><em>LOST.</em>';ui.overlay.querySelector('.overlay-panel p').textContent=`You held the line against ${player.score} hostiles. Manhattan needs you back.`;ui.start.querySelector('span').textContent='TRY AGAIN';}}
  function update(dt,now){
    if(!started||gameOver)return;
    fireTimer=Math.max(0,fireTimer-dt);recoil=Math.max(0,recoil-dt*5);reloadTimer=Math.max(0,reloadTimer-dt);if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}
    let f=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0), str=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
    const mag=Math.hypot(f,str)||1;f/=mag;str/=mag;
    const speed=(keys.shift?5.8:3.3)*dt, dx=(Math.cos(player.a)*f-Math.sin(player.a)*str)*speed,dy=(Math.sin(player.a)*f+Math.cos(player.a)*str)*speed;
    if(!cellSolid(player.x+dx*1.3,player.y))player.x+=dx;
    if(!cellSolid(player.x,player.y+dy*1.3))player.y+=dy;
    for(const e of enemies)if(e.alive){e.hit=Math.max(0,e.hit-dt*5);e.shot-=dt;const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<15&&d>3&&e.shot<=0&&hasLine(e.x,e.y,player.x,player.y)){e.shot=2.2+Math.random()*2.2;if(Math.random()<.54)damage();}}
    updateHud();
  }
  function loop(now){const dt=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;update(dt,now);render(now);requestAnimationFrame(loop);}
  function start(){if(gameOver){player.health=100;player.ammo=12;player.reserve=48;player.score=0;player.x=3.7;player.y=3.5;player.a=0;remaining=6;seedEnemies();gameOver=false;updateHud();}started=true;ui.overlay.classList.add('hidden');if(!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.();}
  ui.start.addEventListener('click',start);
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='r')reload();if(k===' '&&started)shoot();});
  document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&started)player.a+=e.movementX*.00235;});
  canvas.addEventListener('click',()=>{if(started&&document.pointerLockElement!==canvas&&!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.();else shoot();});
  document.addEventListener('pointerlockchange',()=>{});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)Object.keys(keys).forEach(k=>keys[k]=false);});
  // Touch aiming by dragging the view, with accessible on-screen movement controls.
  let touchX=null;canvas.addEventListener('touchstart',e=>{if(!started)return;touchX=e.touches[0].clientX;},{passive:true});
  canvas.addEventListener('touchmove',e=>{if(!started||touchX===null)return;const x=e.touches[0].clientX;player.a+=(x-touchX)*.009;touchX=x;},{passive:true});
  canvas.addEventListener('touchend',()=>touchX=null,{passive:true});
  document.querySelectorAll('.mobile-pad button').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;});['pointerup','pointercancel','pointerleave'].forEach(type=>b.addEventListener(type,()=>keys[k]=false));});
  document.getElementById('mobile-fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});document.getElementById('mobile-reload').addEventListener('pointerdown',reload);
  updateHud();requestAnimationFrame(loop);
})();
