(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui={pal:document.querySelector('#pal-count'),orb:document.querySelector('#orb-count'),berry:document.querySelector('#berry-count'),wood:document.querySelector('#wood-count'),hp:document.querySelector('#hp-bar'),hpText:document.querySelector('#hp-text'),title:document.querySelector('#quest-title'),desc:document.querySelector('#quest-desc'),bar:document.querySelector('#quest-bar'),count:document.querySelector('#quest-count'),toast:document.querySelector('#toast'),dialog:document.querySelector('#dialog'),content:document.querySelector('#dialog-content'),flash:document.querySelector('#flash')};
let W=2200,H=1600,dpr=1,cw=0,ch=0,last=0,toastTimer=0;
function resize(){dpr=Math.min(devicePixelRatio||1,2);cw=innerWidth;ch=innerHeight;canvas.width=Math.floor(cw*dpr);canvas.height=Math.floor(ch*dpr);canvas.style.width=cw+'px';canvas.style.height=ch+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
const player={x:1110,y:800,r:17,hp:100,maxHp:100,dir:0,speed:210,invuln:0};
const state={orbs:5,berries:0,wood:0,pals:[],caught:0,quest:0,kills:0,clock:0,room:'',coop:false};
const seed=(n)=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const flora=[],resources=[],creatures=[];
for(let i=0;i<145;i++){let x=90+seed(i+11)*(W-180),y=90+seed(i+981)*(H-180);if(Math.hypot(x-1110,y-800)<210)continue;flora.push({x,y,type:seed(i+87),s:.72+seed(i+812)*.85})}
for(let i=0;i<36;i++){let x=140+seed(i+1801)*(W-280),y=140+seed(i+2381)*(H-280);if(Math.hypot(x-1110,y-800)<210)continue;resources.push({x,y,type:i%3===0?'wood':i%3===1?'berry':'stone',taken:false})}
const kinds=[{name:'Mosskin',color:'#9bd883',accent:'#e9f2b1',hp:3},{name:'Embercub',color:'#f59d70',accent:'#ffcf82',hp:4},{name:'Puddlepop',color:'#79c8d0',accent:'#d6f7e6',hp:3}];
for(let i=0;i<9;i++){let x=850+seed(i+621)*580,y=570+seed(i+903)*480;let k=i%3;creatures.push({x,y,homeX:x,homeY:y,r:18+k*1.5,kind:k,hp:kinds[k].hp,max:kinds[k].hp,dir:seed(i+441)*6,phase:seed(i+710)*8,tamed:false,stun:0})}
const SAVE_KEY='wildbound-save-v1';
function saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({player:{x:player.x,y:player.y,hp:player.hp},inventory:{orbs:state.orbs,berries:state.berries,wood:state.wood},caught:state.caught,quest:state.quest,kills:state.kills,resources:resources.map(r=>r.taken),creatures:creatures.map(c=>({x:c.x,y:c.y,hp:c.hp,tamed:c.tamed}))}))}catch(_){}}
function loadGame(){try{const data=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!data)return;const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;if(data.player){player.x=number(data.player.x,42,W-42,player.x);player.y=number(data.player.y,42,H-42,player.y);player.hp=number(data.player.hp,1,player.maxHp,player.hp)}if(data.inventory){state.orbs=number(data.inventory.orbs,0,999,state.orbs);state.berries=number(data.inventory.berries,0,999,state.berries);state.wood=number(data.inventory.wood,0,999,state.wood)}state.caught=number(data.caught,0,999,0);state.quest=number(data.quest,0,2,0);state.kills=number(data.kills,0,999,0);if(Array.isArray(data.resources))resources.forEach((r,i)=>r.taken=data.resources[i]===true);if(Array.isArray(data.creatures))creatures.forEach((c,i)=>{const saved=data.creatures[i];if(!saved)return;c.x=number(saved.x,0,W,c.x);c.y=number(saved.y,0,H,c.y);c.hp=number(saved.hp,1,c.max,c.max);c.tamed=saved.tamed===true;if(c.tamed)state.pals.push(c)});}catch(error){console.warn('Could not load Wildbound save:',error)}}
loadGame();
const keys=new Set(),input={x:0,y:0};let lastAction=0,lastAttack=0,mouse={x:0,y:0},saveTimer=0;
addEventListener('keydown',e=>{let k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k===' '||k==='e')capture();if(k==='f')interact();if(k==='j')attack();if(k==='c')craft()});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const stick=document.querySelector('#stick'),nub=document.querySelector('#nub');let stickPointer=null;
stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e)});
function moveStick(e){let r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.min(1,Math.hypot(dx,dy)/36),a=Math.atan2(dy,dx);input.x=Math.cos(a)*m;input.y=Math.sin(a)*m;nub.style.transform=`translate(${input.x*25}px,${input.y*25}px)`}
function releaseStick(e){if(e.pointerId===stickPointer){stickPointer=null;input.x=input.y=0;nub.style.transform=''}}stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
function bind(id,fn){let el=document.getElementById(id);el.addEventListener('pointerdown',e=>{e.preventDefault();fn()})}
bind('capture-btn',capture);bind('attack-btn',attack);bind('interact-btn',interact);bind('craft-btn',craft);
function say(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1750)}
function nearestCreature(max=210){let out=null,dist=max;for(const c of creatures){if(c.tamed)continue;let d=Math.hypot(c.x-player.x,c.y-player.y);if(d<dist){dist=d;out=c}}return out}
function capture(){let now=performance.now();if(now-lastAction<450)return;lastAction=now;if(state.orbs<=0){say('Out of capture orbs!');return}let c=nearestCreature(205);if(!c){say('Get closer to a wild Pal');return}state.orbs--;let chance=Math.max(.15,Math.min(.92,.22+(1-c.hp/c.max)*.7));if(Math.random()<chance){c.tamed=true;c.x=player.x-34;c.y=player.y+26;state.pals.push(c);state.caught++;ui.flash.classList.remove('pop');void ui.flash.offsetWidth;ui.flash.classList.add('pop');say(`${kinds[c.kind].name} joined your team!`);if(state.quest===0)state.quest=1}else{c.stun=.6;say('Almost! Weaken it first · '+Math.round(chance*100)+'% chance')}updateUI();sendState()}
function attack(){let now=performance.now();if(now-lastAttack<360)return;lastAttack=now;let c=nearestCreature(82);if(c){c.hp--;c.stun=.35;if(c.hp<=0){c.hp=c.max;c.x=c.homeX+(Math.random()-.5)*140;c.y=c.homeY+(Math.random()-.5)*140;state.kills++;if(Math.random()<.35)state.berries++;say('Wild Pal staggered · '+state.kills+' encounters')}else say('Nice hit! '+c.hp+' strength left')}else say('No wild Pals in reach');updateUI()}
function interact(){let r=resources.find(o=>!o.taken&&Math.hypot(o.x-player.x,o.y-player.y)<68);if(r){r.taken=true;if(r.type==='wood'){state.wood+=2;say('Collected driftwood +2')}else if(r.type==='berry'){state.berries+=2;say('Sweet berries +2')}else{state.wood++;say('Collected island stone +1')}updateUI();return}let c=nearestCreature(130);if(c){say(`${kinds[c.kind].name} · weaken it, then toss an orb!`);return}say('Explore the meadow for supplies and wild Pals')}
function craft(){if(state.berries>=2&&state.wood>=1){state.berries-=2;state.wood--;state.orbs+=2;say('Crafted 2 capture orbs!');updateUI()}else say('Need 2 berries + 1 driftwood to craft orbs')}
function updateUI(){ui.pal.textContent=state.pals.length;ui.orb.textContent=state.orbs;ui.berry.textContent=state.berries;ui.wood.textContent=state.wood;ui.hp.style.width=Math.max(0,player.hp/player.maxHp*100)+'%';ui.hpText.textContent=Math.ceil(player.hp)+'%';if(state.quest===0){ui.title.textContent='A FRIEND IN THE WILD';ui.desc.textContent='Find a wild Pal and befriend it with a capture orb.';ui.count.textContent=`${Math.min(state.caught,1)} / 1`;ui.bar.style.width=(state.caught?100:10)+'%'}else if(state.quest===1){ui.title.textContent='A TASTE OF THE ISLAND';ui.desc.textContent='Gather 3 sweet berries to make a field snack.';ui.count.textContent=`${Math.min(state.berries,3)} / 3`;ui.bar.style.width=Math.min(100,state.berries/3*100)+'%';if(state.berries>=3){state.quest=2;say('Journal updated · supplies gathered!')}}else{ui.title.textContent='A GROWING CREW';ui.desc.textContent='Befriend 3 wild Pals to complete your expedition.';ui.count.textContent=`${Math.min(state.pals.length,3)} / 3`;ui.bar.style.width=Math.min(100,state.pals.length/3*100)+'%';if(state.pals.length>=3&&!document.querySelector('.quest-done')){ui.title.textContent='ISLAND ALLY';ui.desc.textContent='You made a home on Sunmeadow Isle. Keep exploring!';ui.desc.classList.add('quest-done');say('Expedition complete! The island is yours.')}}saveGame()}
function getMove(){let x=input.x,y=input.y;if(keys.has('w')||keys.has('arrowup'))y-=1;if(keys.has('s')||keys.has('arrowdown'))y+=1;if(keys.has('a')||keys.has('arrowleft'))x-=1;if(keys.has('d')||keys.has('arrowright'))x+=1;let l=Math.hypot(x,y);if(l>1){x/=l;y/=l}return{x,y}}
function tick(dt){state.clock+=dt;let m=getMove();player.x=Math.max(42,Math.min(W-42,player.x+m.x*player.speed*dt));player.y=Math.max(42,Math.min(H-42,player.y+m.y*player.speed*dt));if(m.x||m.y)player.dir=Math.atan2(m.y,m.x);for(let c of creatures){c.phase+=dt*3;if(c.tamed){let i=state.pals.indexOf(c),tx=player.x-Math.cos(player.dir)*36-(i%2)*14,ty=player.y-Math.sin(player.dir)*36+((i%3)-1)*19;let d=Math.hypot(tx-c.x,ty-c.y);if(d>4){c.x+=(tx-c.x)*Math.min(1,dt*3.1);c.y+=(ty-c.y)*Math.min(1,dt*3.1)}}else if(c.stun>0)c.stun-=dt;else{let toward=Math.atan2(c.homeY-c.y,c.homeX-c.x),wand=Math.sin(c.phase*.38)*.7;c.dir=toward+wand;c.x+=Math.cos(c.dir)*Math.sin(c.phase)*9*dt;c.y+=Math.sin(c.dir)*Math.sin(c.phase)*9*dt}}if(player.hp<100)player.hp=Math.min(100,player.hp+dt*1.4);saveTimer+=dt;if(saveTimer>=5){saveTimer=0;saveGame()}}
function draw(){let camX=Math.max(0,Math.min(W-cw,player.x-cw/2)),camY=Math.max(0,Math.min(H-ch,player.y-ch/2));ctx.clearRect(0,0,cw,ch);ctx.save();ctx.translate(-camX,-camY);
// grassy island with a hand-painted meadow palette
ctx.fillStyle='#98cc8a';ctx.fillRect(0,0,W,H);ctx.fillStyle='#a5d496';ctx.beginPath();ctx.ellipse(1110,800,1020,760,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b8d993';ctx.beginPath();ctx.ellipse(1110,810,760,565,0,0,Math.PI*2);ctx.fill();
// winding sandy track
ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#d9c68a';ctx.lineWidth=118;ctx.beginPath();ctx.moveTo(500,1200);ctx.bezierCurveTo(790,1030,690,780,1080,760);ctx.bezierCurveTo(1500,735,1310,490,1770,380);ctx.stroke();ctx.strokeStyle='#e7d59b';ctx.lineWidth=86;ctx.stroke();
// small pond
ctx.fillStyle='#7dc6c0';ctx.beginPath();ctx.ellipse(1640,1120,160,91,-.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c3e3ad';ctx.lineWidth=11;ctx.stroke();ctx.fillStyle='#a7ded0';ctx.beginPath();ctx.ellipse(1615,1095,95,20,-.2,0,Math.PI*2);ctx.fill();
for(const f of flora){let x=f.x,y=f.y;ctx.save();ctx.translate(x,y);if(f.type<.32){drawTree(f.s)}else if(f.type<.72){ctx.fillStyle=f.type<.5?'#5eaa70':'#71b876';ctx.beginPath();ctx.ellipse(0,3,13*f.s,9*f.s,0,0,7);ctx.fill();ctx.fillStyle='#ffdc8a';ctx.beginPath();ctx.arc(-3*f.s,-2*f.s,2.4*f.s,0,7);ctx.arc(4*f.s,2*f.s,2*f.s,0,7);ctx.fill()}else{ctx.fillStyle='#76b575';ctx.beginPath();ctx.ellipse(0,3,8*f.s,5*f.s,0,0,7);ctx.fill();ctx.strokeStyle='#e9dc9d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,1);ctx.lineTo(1,-6*f.s);ctx.stroke();ctx.fillStyle='#fff0bb';ctx.beginPath();ctx.arc(1,-7*f.s,2.5*f.s,0,7);ctx.fill()}ctx.restore()}
for(const r of resources){if(r.taken)continue;ctx.save();ctx.translate(r.x,r.y);ctx.fillStyle='#25463838';ctx.beginPath();ctx.ellipse(0,8,15,7,0,0,7);ctx.fill();if(r.type==='berry'){ctx.fillStyle='#4b9959';ctx.beginPath();ctx.arc(0,0,10,Math.PI,0);ctx.fill();ctx.fillStyle='#ef796e';for(let j=0;j<3;j++){ctx.beginPath();ctx.arc((j-1)*6,-4,4,0,7);ctx.fill()}ctx.fillStyle='#ffded0';ctx.beginPath();ctx.arc(1,-5,1.3,0,7);ctx.fill()}else if(r.type==='wood'){ctx.save();ctx.rotate(-.25);ctx.fillStyle='#9b6946';ctx.fillRect(-13,-4,26,10);ctx.fillStyle='#c48c5d';ctx.fillRect(-12,-4,24,3);ctx.restore()}else{ctx.fillStyle='#899c95';ctx.beginPath();ctx.moveTo(-12,5);ctx.lineTo(-8,-8);ctx.lineTo(2,-13);ctx.lineTo(12,-5);ctx.lineTo(10,6);ctx.closePath();ctx.fill();ctx.fillStyle='#bcc9ae';ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(2,-10);ctx.lineTo(4,-4);ctx.closePath();ctx.fill()}ctx.restore()}
for(const c of creatures)drawPal(c);
drawPlayer();if(state.coop)for(const peer of peers.values())drawPeer(peer);
ctx.restore();drawMiniMap(camX,camY);}
function drawTree(s){ctx.fillStyle='#496d4e';ctx.beginPath();ctx.ellipse(2,8,18*s,10*s,0,0,7);ctx.fill();ctx.fillStyle='#956c4a';ctx.fillRect(-3*s,-10*s,6*s,20*s);ctx.fillStyle='#43895a';ctx.beginPath();ctx.arc(-7*s,-13*s,12*s,0,7);ctx.arc(7*s,-15*s,13*s,0,7);ctx.arc(0,-24*s,13*s,0,7);ctx.fill();ctx.fillStyle='#67a968';ctx.beginPath();ctx.arc(-3*s,-23*s,7*s,0,7);ctx.fill()}
function drawPal(c){ctx.save();ctx.translate(c.x,c.y);let k=kinds[c.kind],bob=Math.sin(c.phase*2)*2;ctx.fillStyle='#36564038';ctx.beginPath();ctx.ellipse(0,13,19,8,0,0,7);ctx.fill();ctx.translate(0,bob);ctx.fillStyle=k.color;ctx.beginPath();ctx.ellipse(0,0,c.r*1.06,c.r*.88,0,0,7);ctx.fill();ctx.fillStyle=k.accent;ctx.beginPath();ctx.ellipse(0,7,c.r*.55,c.r*.34,0,0,7);ctx.fill();ctx.fillStyle='#293d3b';ctx.beginPath();ctx.arc(-6,-3,2.2,0,7);ctx.arc(6,-3,2.2,0,7);ctx.fill();ctx.strokeStyle='#34534a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,2,4,.2,Math.PI-.2);ctx.stroke();if(c.kind===0){ctx.fillStyle=k.color;ctx.beginPath();ctx.moveTo(-12,-12);ctx.lineTo(-14,-24);ctx.lineTo(-4,-15);ctx.moveTo(12,-12);ctx.lineTo(14,-24);ctx.lineTo(4,-15);ctx.fill()}if(c.kind===1){ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(0,-c.r*.8,4,0,7);ctx.arc(-10,-c.r*.6,3,0,7);ctx.arc(10,-c.r*.6,3,0,7);ctx.fill()}if(c.tamed){ctx.fillStyle='#f7e9a1';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('✦',0,-c.r-9)}else if(c.hp<c.max){ctx.fillStyle='#fff';ctx.fillRect(-14,-c.r-12,28,4);ctx.fillStyle='#e88973';ctx.fillRect(-14,-c.r-12,28*c.hp/c.max,4)}ctx.restore()}
function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.fillStyle='#294a4c44';ctx.beginPath();ctx.ellipse(0,14,18,8,0,0,7);ctx.fill();ctx.rotate(player.dir);ctx.fillStyle='#e8f0d7';ctx.beginPath();ctx.ellipse(0,0,14,17,0,0,7);ctx.fill();ctx.fillStyle='#3d6c61';ctx.beginPath();ctx.ellipse(0,-3,10,12,0,0,7);ctx.fill();ctx.fillStyle='#efbd78';ctx.beginPath();ctx.arc(2,-7,7,0,7);ctx.fill();ctx.fillStyle='#d98559';ctx.beginPath();ctx.arc(-1,-12,8,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#f8eed3';ctx.beginPath();ctx.arc(18,1,6,0,7);ctx.fill();ctx.restore()}
function drawPeer(p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#28464477';ctx.beginPath();ctx.ellipse(0,12,15,6,0,0,7);ctx.fill();ctx.fillStyle='#a4c7f7';ctx.beginPath();ctx.arc(0,0,13,0,7);ctx.fill();ctx.fillStyle='#eed096';ctx.beginPath();ctx.arc(0,-3,6,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText(p.name||'TRAILMATE',0,-21);ctx.restore()}
function drawMiniMap(camX,camY){let w=76,h=56,x=cw-93,y=ch-80;ctx.save();ctx.globalAlpha=.88;ctx.fillStyle='#17343bc9';ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();ctx.strokeStyle='#ffffff45';ctx.stroke();ctx.fillStyle='#b0d394';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.39,h*.37,0,0,7);ctx.fill();ctx.fillStyle='#f5ecd0';ctx.beginPath();ctx.arc(x+player.x/W*w,y+player.y/H*h,3.2,0,7);ctx.fill();for(let c of creatures)if(!c.tamed){ctx.fillStyle='#ea9072';ctx.beginPath();ctx.arc(x+c.x/W*w,y+c.y/H*h,1.6,0,7);ctx.fill()}ctx.restore()}
function loop(t){let dt=Math.min(.04,(t-last)/1000||0);last=t;tick(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);updateUI();

// Co-op presence is shared between game tabs on the same browser using BroadcastChannel.
// This keeps the game playable without a backend; it is not internet matchmaking.
const peers=new Map();
let roomChannel=null,playerName='EXPLORER',peerPulse=0;
function sendState(){
  if(!roomChannel)return;
  roomChannel.postMessage({type:'state',id:peerId,name:playerName,x:player.x,y:player.y,pals:state.pals.length,at:Date.now()});
}
const peerId='wb-'+Math.random().toString(36).slice(2,9);
function leaveRoom(){
  if(roomChannel){roomChannel.postMessage({type:'leave',id:peerId});roomChannel.close();roomChannel=null;}
  peers.clear();state.coop=false;state.room='';
}
function joinRoom(code){
  code=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  if(code.length<4){say('Room codes need at least 4 characters');return false}
  if(!('BroadcastChannel' in window)){say('Co-op rooms are not supported in this browser');return false}
  leaveRoom();state.room=code;state.coop=true;
  roomChannel=new BroadcastChannel('wildbound-room-'+code);
  roomChannel.onmessage=({data})=>{
    if(!data||data.id===peerId)return;
    if(data.type==='leave'){peers.delete(data.id);refreshPartyStatus();return}
    if(data.type==='hello'||data.type==='state'){
      peers.set(data.id,{name:String(data.name||'TRAILMATE').slice(0,14),x:Number(data.x)||0,y:Number(data.y)||0,pals:Number(data.pals)||0,seen:Date.now()});
      if(data.type==='hello')sendState();
      refreshPartyStatus();
    }
  };
  roomChannel.postMessage({type:'hello',id:peerId,name:playerName,x:player.x,y:player.y,pals:state.pals.length});
  sendState();
  refreshPartyStatus();
  say('Joined co-op room '+code);
  return true;
}
function refreshPartyStatus(){
  const status=document.querySelector('#party-status');
  if(status)status.textContent=state.coop?`Room ${state.room} · ${peers.size} other explorer${peers.size===1?'':'s'} here`:'Not in a room yet. Co-op works between tabs in this browser.';
}
function openParty(){
  ui.content.innerHTML=`<div class="tag">ISLAND CO-OP</div><h1>Bring a trailmate</h1><p>Create or join a six-character room to see another explorer on the island. Open this game in another tab on the same browser and enter the same code. This lightweight demo uses browser-local co-op, not internet matchmaking.</p><div class="dialog-actions"><button class="big-btn" id="create-room">Create room</button><input class="code-input" id="room-code" maxlength="6" placeholder="ROOM CODE" aria-label="Room code"><button class="big-btn secondary" id="join-room">Join</button></div><div class="dialog-actions"><input class="code-input" id="player-name" maxlength="14" value="${playerName}" aria-label="Explorer name" style="width:150px;letter-spacing:normal;text-transform:none"><button class="big-btn secondary" id="leave-room">Leave room</button><button class="big-btn secondary" id="close-dialog">Back to game</button></div><div class="party-status" id="party-status"></div>`;
  ui.dialog.classList.add('open');
  document.querySelector('#create-room').onclick=()=>{
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    if(joinRoom(code)){document.querySelector('#room-code').value=code;refreshPartyStatus()}
  };
  document.querySelector('#join-room').onclick=()=>{const field=document.querySelector('#room-code');if(joinRoom(field.value))field.value=state.room};
  document.querySelector('#leave-room').onclick=()=>{leaveRoom();refreshPartyStatus();say('You left the co-op room')};
  document.querySelector('#close-dialog').onclick=closeDialog;
  document.querySelector('#player-name').onchange=e=>{playerName=e.target.value.trim().slice(0,14)||'EXPLORER';sendState()};
  refreshPartyStatus();
}
function openHelp(){
  ui.content.innerHTML='<div class="tag">FIELD GUIDE</div><h1>Explore together</h1><p><b>Move:</b> WASD or arrow keys on desktop; drag the left stick on mobile.<br><b>Collect:</b> stand near a berry, driftwood, or stone and press F / USE.<br><b>Capture:</b> get close and toss an orb with SPACE / ORB. Weaken a Pal first with J / HIT to improve your odds.<br><b>Craft:</b> trade 2 berries + 1 driftwood for 2 capture orbs.<br><b>Co-op:</b> use the party button to create or join a room between tabs in the same browser.</p><div class="dialog-actions"><button class="big-btn" id="close-dialog">Let’s go</button></div>';
  ui.dialog.classList.add('open');
  document.querySelector('#close-dialog').onclick=closeDialog;
}
function closeDialog(){ui.dialog.classList.remove('open')}
document.querySelector('#party-open').addEventListener('click',openParty);
document.querySelector('#help-open').addEventListener('click',openHelp);
ui.dialog.addEventListener('pointerdown',e=>{if(e.target===ui.dialog)closeDialog()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog()});
addEventListener('beforeunload',()=>{saveGame();if(roomChannel)roomChannel.postMessage({type:'leave',id:peerId})});
setInterval(()=>{
  if(roomChannel){sendState();const now=Date.now();for(const [id,p] of peers)if(now-p.seen>6500)peers.delete(id);}
},1200);
})();
