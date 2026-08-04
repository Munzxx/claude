// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer=null;
function showToast(msg,color="#FFD700"){
  let t=document.querySelector(".toast");
  if(t)t.remove();
  t=document.createElement("div");
  t.className="toast";
  t.textContent=msg;
  t.style.color=color;
  t.style.border=`1px solid ${color}`;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{if(t.parentNode)t.remove();},2600);
}

// ─── RECONNECT-STATUSBALK ──────────────────────────────────────────────────────
// Niet-blokkerend (geen overlay/backdrop, de speler kan gewoon verder kijken),
// blijft zichtbaar tot mpReconnectBannerHide() — in tegenstelling tot de toast,
// die vanzelf verdwijnt. Lazy gebouwd bij het eerste gebruik, want dit komt zelden voor.
function mpReconnectBannerShow(msg){
  if(!DOM.reconnectBanner){
    DOM.reconnectBanner=document.createElement("div");
    DOM.reconnectBanner.style.cssText="position:fixed;top:0;left:0;right:0;z-index:250;background:#7a1f1f;color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-family:Georgia,serif;box-shadow:0 2px 8px rgba(0,0,0,0.4);";
    document.body.appendChild(DOM.reconnectBanner);
  }
  DOM.reconnectBanner.textContent=msg||"🔄 Verbinding herstellen…";
  DOM.reconnectBanner.style.display="block";
}
function mpReconnectBannerHide(){
  if(DOM.reconnectBanner) DOM.reconnectBanner.style.display="none";
}

// ─── ANIMATION ENGINE ─────────────────────────────────────────────────────────
// Dice: only touches the two die DOM elements
function animateDice(d1,d2,onDone){
  // Start spin CSS
  DOM.dieEls.forEach(el=>{if(el)el.classList.add("die-rolling");});
  let count=0;
  const iv=setInterval(()=>{
    count++;
    // Show random faces while spinning
    setDieFace(DOM.dieEls[0],rng());
    setDieFace(DOM.dieEls[1],rng());
    if(count>=12){
      clearInterval(iv);
      // Stop spin, show final result
      DOM.dieEls.forEach(el=>{if(el)el.classList.remove("die-rolling");});
      setDieFace(DOM.dieEls[0],d1);
      setDieFace(DOM.dieEls[1],d2);
      G.dice=[d1,d2];
      // Wait 400ms so player can see the result, THEN call onDone
      setTimeout(onDone,400);
    }
  },70);
}

function setDieFace(el,val){
  if(!el)return;
  el.innerHTML="";
  (DOTS[val]||DOTS[1]).forEach(([cx,cy])=>{
    const d=document.createElement("div");
    d.style.cssText=`position:absolute;left:${cx}%;top:${cy}%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#222`;
    el.appendChild(d);
  });
}

// Pawn: moves the CSS-transitioned pawn element step by step
function animatePawn(pid,from,steps,onDone,backward){
  // Pion beweegt via CSS transform (GPU, geen ghosting).
  // Camera scrollt INSTANT elke stap mee — smooth scroll vecht met
  // de CSS transition en geeft ghosting. Instant = geen conflict.
  // backward=true (bv. "Ga 3 stappen terug"-kaart): pion loopt achteruit
  // i.p.v. bijna het hele bord vooruit rond te lopen naar dezelfde positie.
  let step=0;
  function next(){
    step++;
    const pos=backward?(((from-step)%40+40)%40):((from+step)%40);
    G.pawnPos[pid]=pos;
    placePawn(pid,pos);        // GPU transform — pion schuift soepel
    scrollToPos(pos, true);    // instant scroll — camera volgt elke stap
    if(step<steps) setTimeout(next,220);
    else setTimeout(onDone,250);
  }
  next();
}

function placePawn(pid,sid){
  const el=DOM.pawns[pid];if(!el)return;
  const{x,y}=pawnXY(pid,sid);
  // Use transform:translate instead of left/top for GPU-composited movement (no ghosting)
  el.style.transform=`translate(${x}px,${y}px)`;
  G.pawnPos[pid]=sid; // keep state in sync
}

function scrollToPos(sid,instant){
  const sc=DOM.boardScroll;if(!sc)return;
  const{x,y}=spaceCenter(sid);
  // Use sc.clientWidth/Height but fall back to window dimensions if 0
  const vw=sc.clientWidth||window.innerWidth||375;
  const vh=sc.clientHeight||(window.innerHeight-160)||500;
  const tx=Math.max(0,x-vw/2);
  const ty=Math.max(0,y-vh/2);
  sc.scrollLeft=tx;  // Direct property assignment — most reliable on iOS Safari
  sc.scrollTop=ty;   // Avoids scrollTo() quirks with behavior:auto on iOS
}

// ─── BUILD GAME SCREEN (once) ─────────────────────────────────────────────────
function buildGameScreen(){
  // Clear app
  DOM.app.innerHTML="";
  DOM.cells={};DOM.pawns=[];DOM.dieEls=[null,null];

  // Top bar
  DOM.topBar=document.createElement("div");
  DOM.topBar.style.cssText="background:#071207;border-bottom:1px solid #2a4a2a;padding:5px 8px;display:flex;gap:6px;overflow-x:auto;flex-shrink:0;align-items:center;";

  // Board scroll container
  DOM.boardScroll=document.createElement("div");
  DOM.boardScroll.style.cssText="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px;position:relative;background:radial-gradient(ellipse at center,#0f2a0f,#081708 75%);";

  // Board div (fixed size, holds all cells and pawns)
  DOM.boardDiv=document.createElement("div");
  DOM.boardDiv.style.cssText=`position:relative;width:${BOARD}px;height:${BOARD}px;margin:0 auto;box-shadow:0 6px 24px rgba(0,0,0,0.55),0 1px 0 rgba(255,255,255,0.04) inset;border-radius:3px;`;

  // Build all 40 space cells
  SPACES.forEach(sp=>{
    const[col,row]=gridPos(sp.id);const sz=cellSz(sp.id);
    const isCorner=[0,10,20,30].includes(sp.id);
    const isBottom=row===10,isLeft=col===0,isTop=row===0;
    const cell=document.createElement("div");
    cell.style.cssText=`position:absolute;left:${cellPx(col)}px;top:${cellPx(row)}px;width:${sz}px;height:${sz}px;box-sizing:border-box;border:1px solid #3a5a3a;background:#e8f5e9;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;font-size:5.5px;cursor:pointer;z-index:1;font-family:Georgia,serif;box-shadow:0 1px 3px rgba(0,0,0,0.3),0 1px 0 rgba(255,255,255,0.5) inset;`;
    cell.addEventListener("click",()=>openSpaceInfo(sp.id));
    DOM.cells[sp.id]=cell;
    DOM.boardDiv.appendChild(cell);
  });

  // Center panel (dice live here — never removed)
  const center=document.createElement("div");
  center.style.cssText=`position:absolute;left:${CORNER}px;top:${CORNER}px;width:${CELL*9}px;height:${CELL*9}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#1a4a1a,#091409);pointer-events:none;gap:4px;`;
  const title=document.createElement("div");
  title.style.cssText="font-size:14px;font-weight:bold;color:#FFD700;letter-spacing:3px;font-family:Georgia,serif;";
  title.textContent="PROPERTIX";
  center.appendChild(title);
  const diceRow=document.createElement("div");
  diceRow.style.cssText="display:flex;gap:10px;margin-top:4px;";
  for(let i=0;i<2;i++){
    const die=document.createElement("div");
    die.style.cssText="width:52px;height:52px;background:#fff;border-radius:10px;border:2px solid #ccc;position:relative;box-shadow:0 3px 8px rgba(0,0,0,0.4);flex-shrink:0;";
    diceRow.appendChild(die);DOM.dieEls[i]=die;
  }
  setDieFace(DOM.dieEls[0],1);setDieFace(DOM.dieEls[1],1);
  center.appendChild(diceRow);
  DOM.diceLabel=document.createElement("div");
  DOM.diceLabel.style.cssText="font-size:10px;color:#aaa;margin-top:4px;text-align:center;font-family:Georgia,serif;";
  center.appendChild(DOM.diceLabel);
  DOM.freePotLabel=document.createElement("div");
  DOM.freePotLabel.style.cssText="font-size:9px;color:#4caf50;margin-top:2px;font-family:Georgia,serif;";
  center.appendChild(DOM.freePotLabel);
  DOM.boardDiv.appendChild(center);

  // Pawn elements (one per player, appended to boardDiv)
  G.players.forEach((p,i)=>{
    const el=document.createElement("div");
    el.className="pawn";
    el.textContent=p.token;
    const lbl=document.createElement("div");
    lbl.className="pawn-label";
    lbl.style.color=PCOLORS[i];
    lbl.style.border=`1px solid ${PCOLORS[i]}`;
    lbl.textContent=p.name;
    el.appendChild(lbl);
    DOM.pawns[i]=el;
    DOM.boardDiv.appendChild(el);
    // Place at starting position without transition so there's no slide-in from 0,0
    el.style.transition="none";
    const startSid=G.pawnPos[i]!=null?G.pawnPos[i]:0;
    const{x,y}=pawnXY(i,startSid);
    el.style.transform=`translate(${x}px,${y}px)`;
  });

  DOM.boardScroll.appendChild(DOM.boardDiv);
  // After DOM is appended, enable transitions and scroll in next paint cycle

  // Bottom bar
  DOM.bottomBar=document.createElement("div");
  DOM.bottomBar.style.cssText="background:#071207;border-top:2px solid #2a4a2a;padding:8px 12px;flex-shrink:0;";

  // overlayContainer is persistent on document.body — just clear it
  DOM.overlayContainer.innerHTML="";

  DOM.app.appendChild(DOM.topBar);
  DOM.app.appendChild(DOM.boardScroll);
  DOM.app.appendChild(DOM.bottomBar);
  // overlayContainer stays on body (not inside app) so it always exists

  // Chat: alleen tonen tijdens online spel; tabs opnieuw opbouwen voor de nieuwe sessie
  if (MP.active) { chatRebuildTabs(); chatShow(); } else { chatHide(); }

  // Initial render of dynamic parts
  refreshUI();

  // Scroll to start
  // Double rAF: first frame paints pawns at correct position (no transition),
  // second frame enables transitions so future moves animate smoothly,
  // then scroll to current player
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      // Enable transitions on all pawns now that they're painted in correct spots
      DOM.pawns.forEach(el=>{if(el)el.style.transition="transform 0.2s ease";});
      // Scroll to current player's position
      const sid=G.pawnPos[G.cur]!=null?G.pawnPos[G.cur]:(G.players[G.cur]?.pos||0);
      scrollToPos(sid,true);
    });
  });
}

// ─── refreshUI: updates ONLY the dynamic parts, never touches board cells directly ──
function refreshUI(){
  refreshTopBar();
  refreshCells();
  refreshPawnLabels();
  refreshCenter();
  refreshBottomBar();
  refreshOverlayWinner();
  refreshLog();
  checkNewPurchases();
  // Auto-sync to clients after every state change (host only)
  if (MP.active && MP.isHost) mpSyncState();
}

// Vergelijkt G.owned met de vorige render en toont de deed-card flip voor elk vakje dat
// er sinds de vorige keer bij is gekomen. Werkt via een diff (i.p.v. een directe aanroep
// vanuit handleBuy) zodat het ook op MP-clients getoond wordt — die voeren handleBuy()
// zelf nooit uit (dat doet alleen de host), maar zien de aankoop wel via de gesyncte state.
function checkNewPurchases(){
  if(!G.prevOwned)G.prevOwned={};
  Object.keys(G.owned).forEach(sidStr=>{
    const sid=parseInt(sidStr);
    if(G.prevOwned[sid]==null){
      showDeedCardFlip(SPACES[sid]);
    }
  });
  G.prevOwned={...G.owned};
}

function refreshTopBar(){
  const tb=DOM.topBar;tb.innerHTML="";
  if(!G.prevMoney)G.prevMoney={};
  G.players.forEach((p,i)=>{
    const card=document.createElement("div");
    card.style.cssText=`background:${G.cur===i&&!p.bankrupt?"rgba(255,215,0,0.12)":"rgba(255,255,255,0.04)"};border:1px solid ${G.cur===i&&!p.bankrupt?"#FFD700":"#2a4a2a"};border-radius:8px;padding:4px 8px;flex-shrink:0;opacity:${p.bankrupt?0.3:1};font-family:Georgia,serif;position:relative;`;
    const nameRow=document.createElement("div");
    nameRow.style.cssText="display:flex;align-items:center;gap:3px";
    nameRow.innerHTML=`<span style="font-size:13px">${esc(p.token)}</span><span style="font-size:10px;color:${PCOLORS[i]};font-weight:bold">${esc(p.name)}</span>${G.cur===i&&!p.bankrupt?'<span style="font-size:9px;color:#FFD700">▶</span>':''}`;
    card.appendChild(nameRow);
    const moneyDiv=document.createElement("div");
    moneyDiv.style.cssText="font-size:11px;color:#4caf50;font-weight:bold";
    card.appendChild(moneyDiv);
    if(p.inJail){const jl=document.createElement("div");jl.style.cssText="font-size:8px;color:#ff8800";jl.textContent="🔒 cel";card.appendChild(jl);}
    tb.appendChild(card);

    // Geld-teller: bij een verschil met de vorige render tellen we vloeiend op/af
    // i.p.v. instant te springen, en tonen we een zwevend +€/-€ bedrag.
    const prev=G.prevMoney[p.id];
    const delta=(prev!=null)?p.money-prev:0;
    if(delta!==0){
      const start=prev,end=p.money,dur=600,t0=performance.now();
      (function tick(now){
        const k=Math.min(1,(now-t0)/dur);
        moneyDiv.textContent="€"+Math.round(start+(end-start)*k);
        if(k<1)requestAnimationFrame(tick);else moneyDiv.textContent="€"+end;
      })(t0);
      const badge=document.createElement("div");
      badge.className="money-float";
      badge.textContent=(delta>0?"+€":"-€")+Math.abs(delta);
      badge.style.cssText=`position:absolute;top:-4px;left:50%;font-size:10px;font-weight:bold;color:${delta>0?"#69f0ae":"#ff5252"};text-shadow:0 1px 2px rgba(0,0,0,0.7);pointer-events:none;z-index:5;white-space:nowrap;`;
      card.appendChild(badge);
      setTimeout(()=>badge.remove(),1150);
    } else {
      moneyDiv.textContent="€"+p.money;
    }
    G.prevMoney[p.id]=p.money;
  });
  const btnGrp=document.createElement("div");btnGrp.style.cssText="margin-left:auto;display:flex;gap:5px;flex-shrink:0;";
  const saveBtn=document.createElement("button");
  saveBtn.style.cssText="padding:6px 10px;background:rgba(255,215,0,0.1);border:1px solid #4a8a4a;border-radius:8px;color:#FFD700;font-size:11px;cursor:pointer;font-weight:bold;";
  saveBtn.textContent="💾";saveBtn.onclick=()=>renderOverlays({savePanel:true});
  const menuBtn=document.createElement("button");
  menuBtn.style.cssText="padding:6px 10px;background:rgba(255,255,255,0.05);border:1px solid #3a5a3a;border-radius:8px;color:#aaa;font-size:11px;cursor:pointer;";
  menuBtn.textContent="🏠";menuBtn.onclick=()=>confirmBackToMenu();
  btnGrp.appendChild(saveBtn);btnGrp.appendChild(menuBtn);
  tb.appendChild(btnGrp);
}

function refreshCells(){
  SPACES.forEach(sp=>{
    const cell=DOM.cells[sp.id];if(!cell)return;
    const[col,row]=gridPos(sp.id);const isCorner=[0,10,20,30].includes(sp.id);
    const isBottom=row===10,isLeft=col===0,isTop=row===0;
    const oid=G.owned[sp.id];const h=G.houses[sp.id]||0;
    const cb=sp.color?CMAP[sp.color]:null;const isMort=G.mortgaged[sp.id];
    const isHere=G.players.some(p=>p.pos===sp.id&&!p.bankrupt);
    cell.style.background=isMort?"linear-gradient(160deg,#efe8d8,#ddd3ba)":isHere?"linear-gradient(160deg,#fffef0,#fff4c4)":"linear-gradient(160deg,#f1f9f2,#dcebde)";
    cell.style.border=`1px solid ${isHere?"#FFD700":"#3a5a3a"}`;
    cell.style.zIndex=isHere?2:1;
    cell.innerHTML="";
    if(cb){const strip=document.createElement("div");strip.style.cssText=`position:absolute;${isBottom?"top:0;left:0;right:0;height:8px":isLeft?"right:0;top:0;bottom:0;width:8px":isTop?"bottom:0;left:0;right:0;height:8px":"left:0;top:0;bottom:0;width:8px"};background:${isMort?"#bbb":`linear-gradient(${isLeft?"90deg":isTop||isBottom?"180deg":"90deg"},${shadeColor(cb,0.18)},${cb} 55%,${shadeColor(cb,-0.15)})`};box-shadow:0 0 2px rgba(0,0,0,0.3) inset;`;cell.appendChild(strip);}
    const icon=document.createElement("div");icon.style.cssText=`font-size:${isCorner?"16":"10"}px;line-height:1`;
    icon.textContent=sp.type==="go"?"🏁":sp.type==="jail"?"🔒":sp.type==="gotojail"?"👮":sp.type==="free"?"🅿":sp.type==="tax"?"💸":sp.type==="chest"?"🎁":sp.type==="chance"?"❓":sp.type==="railroad"?"🚂":sp.type==="utility"?(sp.id===12?"⚡":"💧"):"";
    cell.appendChild(icon);
    const nm=document.createElement("div");nm.style.cssText=`text-align:center;line-height:1.2;font-size:${isCorner?"6.5":"5"}px;font-weight:700;color:${isMort?"#999":"#1a3a1a"};padding:0 1px;margin-top:1px;word-break:break-word`;nm.textContent=sp.name;cell.appendChild(nm);
    if(sp.price>0){const pr=document.createElement("div");pr.style.cssText="font-size:5px;color:#555";pr.textContent="€"+sp.price;cell.appendChild(pr);}
    if(isMort){const ml=document.createElement("div");ml.style.cssText="font-size:5px;color:#c62828;font-weight:bold";ml.textContent="HYPO";cell.appendChild(ml);}
    if(oid!=null&&!isMort){
      // Vlagje in de hoek i.p.v. het oude stipje — duidelijker zichtbaar, en de hoek
      // wordt gekozen zodat 'ie nooit over de kleurstrook van de straat heen valt.
      const fc=PCOLORS[oid],N=isBottom?9:8;
      const pos=isBottom?"bottom:0;right:0;":isLeft?"top:0;left:0;":"top:0;right:0;"; // isTop en de rest (rechterkolom) delen top-right
      const border=isBottom?`border-bottom:${N}px solid ${fc};border-right:${N}px solid transparent;`
                 :isLeft?`border-top:${N}px solid ${fc};border-right:${N}px solid transparent;`
                 :`border-top:${N}px solid ${fc};border-left:${N}px solid transparent;`;
      const flag=document.createElement("div");
      flag.style.cssText=`position:absolute;${pos}width:0;height:0;${border}filter:drop-shadow(0 1px 1px rgba(0,0,0,0.45));z-index:2;`;
      cell.appendChild(flag);
    }
    if(sp.id===20&&G.freePot>0){const pl=document.createElement("div");pl.style.cssText="font-size:5px;color:#4caf50;font-weight:bold";pl.textContent="€"+G.freePot;cell.appendChild(pl);}
    // Houses
    if(h>0){
      const hw=document.createElement("div");
      if(h>=5){hw.style.cssText="font-size:6.5px;margin-top:1px";hw.textContent="🏨";}
      else{hw.style.cssText="display:flex;flex-wrap:wrap;gap:1px;justify-content:center;margin-top:1px;max-width:"+(isCorner?"24":"18")+"px";for(let i=0;i<h;i++){const sq=document.createElement("div");sq.style.cssText=`width:${isCorner?"5":"4"}px;height:${isCorner?"5":"4"}px;border-radius:1px;background:#1b5e20;border:1px solid #fff;flex-shrink:0`;hw.appendChild(sq);}}
      cell.appendChild(hw);
    }
  });
}

function refreshPawnLabels(){
  G.players.forEach((p,i)=>{
    const el=DOM.pawns[i];if(!el)return;
    el.style.display=p.bankrupt?"none":"flex";
    const lbl=el.querySelector(".pawn-label");
    if(lbl)lbl.style.display=G.cur===i?"block":"none";
  });
}

function refreshCenter(){
  if(DOM.diceLabel){
    const cp=G.players[G.cur];
    const diceTotal=G.dice[0]+G.dice[1];
    const showDice=G.phase!=="roll"&&diceTotal>0;
    DOM.diceLabel.textContent=cp?(showDice?`${cp.name} gooide ${G.dice[0]}+${G.dice[1]}=${diceTotal}`:`${cp.name} is aan de beurt`):"";
  }
  if(DOM.freePotLabel)DOM.freePotLabel.textContent=G.freePot>0?`🅿 Pot: €${G.freePot}`:"";
}

function refreshBottomBar(){
  const bb=DOM.bottomBar;bb.innerHTML="";
  const curP=G.players[G.cur];const curSp=curP?SPACES[curP.pos]:null;
  // In online multiplayer: alleen actieknoppen tonen als G.cur ECHT "mijn" speler is —
  // dit geldt zowel voor de host als voor clients. Zonder deze check ziet de host
  // altijd de knoppen (want curP.isHuman is true voor alle MP-spelers), en moest
  // de host dus zelf de beurten van andere spelers besturen.
  const isMyTurnMP = !MP.active || G.cur === MP.myPid;
  // Space label
  if(curSp&&curP?.isHuman&&isMyTurnMP){
    const lbl=document.createElement("div");
    lbl.style.cssText="text-align:center;font-size:12px;color:#ccc;margin-bottom:6px;font-family:Georgia,serif;";
    lbl.innerHTML=`<b style="color:${curP.color}">${esc(curP.name)}</b> staat op: <b style="color:#FFD700">${curSp.name}</b>${curSp.price>0?` — €${curSp.price}`:""}${curP.inJail?'<span style="color:#ff8800"> 🔒</span>':""}`;
    bb.appendChild(lbl);
  }
  // Action buttons row
  const row=document.createElement("div");
  row.style.cssText="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";
  if(G.phase==="roll"&&curP?.isHuman&&isMyTurnMP){
    const rollFn = MP.active && !MP.isHost ? ()=>mpAction("roll") : handleRoll;
    const rb=mkBtn(G.busy?"🎲 Gooien...":curP.inJail?"🎲 Gooi dubbel (gratis)":"🎲 Dobbelstenen gooien","flex:1 1 auto;max-width:220px;padding:14px 0;font-size:16px;font-weight:bold;background:"+(G.busy?"#555":"#FFD700")+";color:"+(G.busy?"#999":"#000")+";border:none;border-radius:10px;",rollFn,G.busy);
    row.appendChild(rb);
    if(curP.inJail&&!G.busy){const bb2=mkBtn("🔓 Vrijkopen (€50)","flex:1 1 auto;max-width:170px;padding:14px 0;font-size:13px;font-weight:bold;background:"+(curP.money>=50?"#b71c1c":"#333")+";color:"+(curP.money>=50?"#fff":"#666")+";border:none;border-radius:10px;",()=>mpDo("bailout",{},handleBailOut),curP.money<50);row.appendChild(bb2);}
  } else if(G.phase==="rescue"&&curP?.isHuman&&isMyTurnMP){
    const debtEl=document.createElement("div");
    debtEl.style.cssText="text-align:center;font-size:13px;color:#ff4444;margin-bottom:6px;font-weight:bold;font-family:Georgia,serif;";
    debtEl.textContent=`⚠️ ${curP.name} heeft €${Math.abs(curP.money)} te weinig! Verkoop bezittingen om te betalen.`;
    bb.appendChild(debtEl);
    const btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";
    btnRow.appendChild(mkBtn("🏗️ Verkopen/Verhypotheken","flex:1 1 auto;max-width:240px;padding:13px 0;font-size:14px;font-weight:bold;background:#b71c1c;color:#fff;border:none;border-radius:10px;",()=>renderOverlays({rescue:true})));
    btnRow.appendChild(mkBtn("💀 Opgeven (failliet)","flex:1 1 auto;max-width:160px;padding:13px 0;font-size:13px;background:#333;color:#aaa;border:none;border-radius:10px;",()=>declareBankrupt(G.cur)));
    bb.appendChild(btnRow);
  } else if(G.phase==="buy"&&curP?.isHuman&&curSp&&isMyTurnMP){
    const buyFn  = MP.active && !MP.isHost ? ()=>mpAction("buy")  : handleBuy;
    const skipFn = MP.active && !MP.isHost ? ()=>mpAction("skip") : handleSkip;
    row.appendChild(mkBtn(`✅ Kopen (€${curSp.price})`,"flex:1 1 auto;padding:13px 0;font-size:15px;font-weight:bold;background:#2e7d32;color:#fff;border:none;border-radius:10px;",buyFn));
    row.appendChild(mkBtn("❌ Niet kopen","flex:1 1 auto;padding:13px 0;font-size:15px;background:#424242;color:#fff;border:none;border-radius:10px;",skipFn));
  } else if(G.phase==="endturn"&&curP?.isHuman&&isMyTurnMP){
    const endFn = MP.active && !MP.isHost ? ()=>mpAction("endturn") : handleEndTurn;
    row.appendChild(mkBtn("🏗️ Beheren/Ruilen","flex:1 1 auto;max-width:160px;padding:13px 0;font-size:13px;font-weight:bold;background:#1a3a1a;color:#FFD700;border:1px solid #FFD700;border-radius:10px;",()=>renderOverlays({manage:true})));
    row.appendChild(mkBtn("➡️ Beurt beëindigen","flex:1 1 auto;max-width:200px;padding:13px 0;font-size:15px;font-weight:bold;background:#1a6e1a;color:#fff;border:none;border-radius:10px;",endFn));
  } else if(!curP?.isHuman){
    const w=document.createElement("div");w.style.cssText="color:#666;font-size:13px;padding:13px 0;text-align:center;width:100%;font-family:Georgia,serif;";w.textContent=`${curP?.name} speelt... ⏳`;row.appendChild(w);
  } else if(MP.active && !isMyTurnMP){
    // Geldt nu voor ZOWEL host als client: als het niet jouw beurt is, wachtscherm tonen
    const w=document.createElement("div");w.style.cssText="color:#666;font-size:13px;padding:13px 0;text-align:center;width:100%;font-family:Georgia,serif;";
    w.textContent=`${curP?.name} is aan de beurt... ⏳`;row.appendChild(w);
  }
  bb.appendChild(row);
}

function refreshLog(){
  // Log is part of bottom bar
  const bb=DOM.bottomBar;
  const logDiv=document.createElement("div");
  logDiv.style.cssText="margin-top:7px;border-top:1px solid #0d1a0d;padding-top:5px;";
  G.log.slice(-3).reverse().forEach(e=>{const d=document.createElement("div");d.style.cssText=`font-size:10px;color:${e.color};line-height:1.45;font-family:Georgia,serif;`;d.textContent=e.msg;logDiv.appendChild(d);});
  bb.appendChild(logDiv);
}

// Vrolijk oplopend arpeggio, volledig gesynthetiseerd — geen geluidsbestand nodig
function playWinSound(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const notes=[523.25,659.25,783.99,1046.50]; // C5 E5 G5 C6
    notes.forEach((freq,i)=>{
      const t=ctx.currentTime+i*0.11;
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type="triangle";osc.frequency.setValueAtTime(freq,t);
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.18,t+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(t);osc.stop(t+0.4);
    });
  }catch(e){/* geen audio beschikbaar — geen probleem, spel werkt gewoon door */}
}
function triggerConfetti(container){
  const colors=["#FFD700","#4caf50","#42A5F5","#F06292","#FF7043","#E53935"];
  for(let i=0;i<36;i++){
    const p=document.createElement("div");
    const left=(Math.random()*100).toFixed(1),dur=(1.8+Math.random()*1.2).toFixed(2),
          delay=(Math.random()*0.4).toFixed(2),size=5+Math.random()*4,rot=Math.random()*360;
    p.style.cssText=`position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size*0.4}px;background:${colors[i%colors.length]};opacity:0.9;transform:rotate(${rot}deg);animation:confettiFall ${dur}s ease-in ${delay}s forwards;pointer-events:none;z-index:250;`;
    container.appendChild(p);
    setTimeout(()=>p.remove(),(parseFloat(dur)+parseFloat(delay))*1000+150);
  }
}
function refreshOverlayWinner(){
  const active=G.players.filter(p=>!p.bankrupt);
  if(active.length===1&&G.players.length>1){
    const w=active[0];
    const ov=document.createElement("div");
    ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:200;display:flex;align-items:center;justify-content:center;overflow:hidden;";
    ov.innerHTML=`<div style="background:#1a3a1a;border:3px solid #FFD700;border-radius:20px;padding:40px;text-align:center;max-width:300px;font-family:Georgia,serif"><div style="font-size:52px">${esc(w.token)}</div><h2 style="color:#FFD700;font-size:24px;margin:12px 0 6px">${esc(w.name)} wint!</h2><p style="color:#aaa;margin-bottom:20px">Eindsaldo: €${w.money}</p></div>`;
    const btn=document.createElement("button");btn.textContent="Nieuw spel";btn.style.cssText="padding:12px 28px;background:#FFD700;color:#000;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-weight:bold;font-family:Georgia,serif;";btn.onclick=()=>showMenu();ov.querySelector("div").appendChild(btn);
    DOM.overlayContainer.innerHTML="";DOM.overlayContainer.appendChild(ov);
    // Confetti + geluid maar ÉÉN keer per overwinning, ook al wordt refreshOverlayWinner()
    // daarna nog vaker aangeroepen (bv. door refreshUI() tijdens MP-sync).
    if(G.wonPid!==w.id){
      G.wonPid=w.id;
      triggerConfetti(ov);
      playWinSound();
    }
  }
}

function mkBtn(label,css,onClick,disabled){
  const b=document.createElement("button");b.textContent=label;
  b.style.cssText=css+"font-family:Georgia,serif;cursor:"+(disabled?"not-allowed":"pointer")+";opacity:"+(disabled?0.5:1)+";touch-action:manipulation;";
  if(!disabled)b.addEventListener("click",onClick);return b;
}

// ─── OVERLAYS (modals) ───────────────────────────────────────────────────────
function renderOverlays(opts={}){
  DOM.overlayContainer.innerHTML="";
  const active=G.players.filter(p=>!p.bankrupt);
  if(active.length===1&&G.players.length>1){refreshOverlayWinner();return;}

  if(opts.spaceInfo!=null)      renderSpaceInfoModal(opts.spaceInfo);
  else if(opts.manage)          renderManageModal();
  else if(opts.rescue)          renderRescueModal();
  else if(opts.trade!=null)     renderTradeModal(opts.trade);
  else if(opts.tradeConfirm)    renderTradeConfirmModal(opts.tradeConfirm);
  else if(opts.tradeConfirmMP)  renderOverlaysMPTradeConfirm(opts.tradeConfirmMP);
  else if(opts.savePanel)       renderSavePanel();
}

function openSpaceInfo(id){renderOverlays({spaceInfo:id});}
function closeOverlay(keepDraft){
  DOM.overlayContainer.innerHTML="";
  if(!keepDraft) tradeDraft=null;
  G._activeOverlay=null;
}

function backdrop(content,onClick){
  const bd=document.createElement("div");
  bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:180;display:flex;align-items:flex-end;justify-content:center;";
  bd.addEventListener("click",onClick||closeOverlay);
  content.addEventListener("click",e=>e.stopPropagation());
  bd.appendChild(content);DOM.overlayContainer.appendChild(bd);
}
function panel(extraCss){
  const p=document.createElement("div");
  p.style.cssText="background:#0f2a0f;border-radius:20px 20px 0 0;padding:16px 16px 28px;width:100%;max-width:440px;color:#fff;max-height:80vh;overflow-y:auto;font-family:Georgia,serif;"+extraCss;
  return p;
}

function renderSpaceInfoModal(id){
  const sp=SPACES[id];const oid=G.owned[id];const owner=oid!=null?G.players[oid]:null;
  const h=G.houses[id]||0;const grp=CGROUPS[sp.color]||[];const mono=grp.length>0&&grp.every(gid=>G.owned[gid]===oid);
  const cb=sp.color?CMAP[sp.color]:null;const isMort=G.mortgaged[id];
  const p=panel("");
  let html=`${cb?`<div style="height:10px;background:${cb};border-radius:8px;margin-bottom:12px"></div>`:""}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <h2 style="margin:0;font-size:20px;color:#FFD700">${sp.name}${isMort?" 🏦":""}</h2>
      <button onclick="closeOverlay()" style="background:none;border:none;color:#888;font-size:22px;cursor:pointer">✕</button>
    </div>`;
  if(isMort)html+=`<div style="background:rgba(198,40,40,0.15);border:1px solid #c62828;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:12px;color:#ef9a9a">⚠️ Hypotheek actief — geen huur te innen</div>`;
  if(owner)html+=`<div style="margin-bottom:8px;font-size:13px;color:${PCOLORS[oid]}">Eigenaar: ${esc(owner.token)} ${esc(owner.name)}${mono?" ✦ Monopoly":""}</div>`;
  if(!owner&&sp.price>0)html+=`<div style="margin-bottom:8px;font-size:13px;color:#aaa">Te koop voor <b style="color:#FFD700">€${sp.price}</b></div>`;
  if(sp.type==="free")html+=`<div style="font-size:14px;color:#4caf50;margin-bottom:8px">🅿 Huidige pot: €${G.freePot}</div>`;
  if(sp.type==="property"){
    html+=`<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px"><thead><tr style="border-bottom:1px solid #2a4a2a"><th style="text-align:left;padding:4px 0;color:#aaa;font-weight:normal">Situatie</th><th style="text-align:right;padding:4px 0;color:#aaa;font-weight:normal">Huur</th></tr></thead><tbody>`;
    ["Zonder huis","1 huis","2 huizen","3 huizen","4 huizen","Hotel"].forEach((lbl,i)=>{
      const active=h===i;const rv=(i===0&&mono&&oid!=null)?sp.rent[0]*2:sp.rent[i];
      html+=`<tr style="background:${active?"rgba(255,215,0,0.12)":"transparent"};border-bottom:1px solid #1a3a1a"><td style="padding:5px 4px;color:${active?"#FFD700":"#ccc"}">${i===0&&mono&&oid!=null?"Zonder huis (monopoly)":lbl}${active?" ◀":""}</td><td style="text-align:right;padding:5px 4px;color:${active?"#FFD700":"#fff"};font-weight:${active?"bold":"normal"}">€${rv}</td></tr>`;
    });
    html+=`</tbody></table><div style="font-size:12px;color:#aaa;border-top:1px solid #2a4a2a;padding-top:8px">🏠 Huis: €${sp.houseCost} | Verkoop: €${Math.floor(sp.houseCost/2)} | Hypotheek: €${sp.mortgage}</div>`;
  }
  if(sp.type==="railroad"){
    html+=`<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #2a4a2a"><th style="text-align:left;color:#aaa;font-weight:normal;padding:4px 0">Stations</th><th style="text-align:right;color:#aaa;font-weight:normal">Huur</th></tr></thead><tbody>`;
    ["1 station","2 stations","3 stations","4 stations"].forEach((lbl,i)=>{html+=`<tr style="border-bottom:1px solid #1a3a1a"><td style="padding:5px 4px;color:#ccc">${lbl}</td><td style="text-align:right;padding:5px 4px;color:#fff">€${sp.rent[i]}</td></tr>`;});
    html+=`</tbody></table>`;
  }
  if(sp.type==="utility")html+=`<div style="font-size:13px;color:#ccc;line-height:2">1 nutsbedrijf: worp × 4<br>2 nutsbedrijven: worp × 10</div>`;
  p.innerHTML=html;backdrop(p);
}

function renderRescueModal(){
  G._activeOverlay="rescue";
  const prevPanel=DOM.overlayContainer.querySelector(".rescue-scroll");
  const prevScroll=prevPanel?prevPanel.scrollTop:0;
  DOM.overlayContainer.innerHTML="";
  const pid=G.cur;const p=G.players[pid];
  const debt=Math.abs(p.money);
  const panel_el=panel("");
  panel_el.className="rescue-scroll";

  // Header
  const hdr=document.createElement("div");
  hdr.style.cssText="margin-bottom:12px;";
  hdr.innerHTML=`<h3 style="color:#ff4444;margin:0 0 4px">⚠️ Te weinig geld!</h3><div style="font-size:13px;color:#ccc">${esc(p.name)} heeft <b style="color:#ff4444">€${debt}</b> te weinig. Verkoop huizen of verhypotheek straten om te betalen.</div>`;
  panel_el.appendChild(hdr);

  // Current balance
  const bal=document.createElement("div");
  bal.style.cssText=`font-size:14px;font-weight:bold;color:${p.money<0?"#ff4444":"#4caf50"};margin-bottom:12px;text-align:center;`;
  bal.textContent=`Saldo: €${p.money}`;
  panel_el.appendChild(bal);

  // Properties list with sell/mortgage options — nu via mpDo + de gecentraliseerde
  // doSell/doMortgage functies (die zelf checkRescueResolved aanroepen), zodat
  // dit ook correct via de host loopt in multiplayer i.p.v. lokaal te muteren.
  const props=p.properties;
  if(props.length===0){
    const d=document.createElement("div");d.style.cssText="color:#555;font-size:13px;text-align:center;padding:12px;";
    d.textContent="Geen bezittingen meer om te verkopen.";panel_el.appendChild(d);
  }
  props.forEach(sid=>{
    const sp=SPACES[sid];const h=G.houses[sid]||0;const cb=sp.color?CMAP[sp.color]:null;const isMort=G.mortgaged[sid];
    const card=document.createElement("div");card.style.cssText="border-radius:8px;border:1px solid #1a3a1a;margin-bottom:8px;overflow:hidden;";
    const header=document.createElement("div");
    header.style.cssText=`background:${cb||"#1a3a1a"};padding:5px 10px;display:flex;justify-content:space-between;align-items:center;`;
    header.innerHTML=`<span style="font-weight:bold;font-size:12px;color:#fff;text-shadow:0 1px 2px #000">${sp.name}</span><span style="font-size:11px;color:rgba(255,255,255,0.8)">${isMort?"🏦":h>=5?"🏨":h>0?`🏠×${h}`:""}`;
    const btns=document.createElement("div");btns.style.cssText="padding:7px 8px;background:#0d1a0d;display:flex;flex-wrap:wrap;gap:5px;";

    if(sp.type==="property"&&h>0){
      const grp=CGROUPS[sp.color]||[];
      const maxH=Math.max(...grp.map(id=>G.houses[id]||0));
      const canSell=h===maxH;
      const sellPrice=Math.floor(sp.houseCost/2);
      btns.appendChild(mkBtn(`💰 Verkoop ${h>=5?"hotel":"huis"} +€${sellPrice}`,`padding:5px 10px;font-size:11px;background:${canSell?"#b71c1c":"#1a0a0a"};color:${canSell?"#fff":"#444"};border:none;border-radius:6px;`,()=>{
        if(!canSell)return;
        mpDo("sell",{sid},()=>{doSell(sid);if(G.phase==="rescue")renderRescueModal();});
      },!canSell));
    }

    if(!isMort){
      const grp=CGROUPS[sp.color]||[];
      const hasHouses=sp.type==="property"&&grp.some(id=>G.houses[id]>0);
      const canMort=!hasHouses;
      btns.appendChild(mkBtn(`🏦 Hypotheek +€${sp.mortgage}`,`padding:5px 10px;font-size:11px;background:${canMort?"#f57c00":"#1a1000"};color:${canMort?"#fff":"#444"};border:none;border-radius:6px;`,()=>{
        if(!canMort)return;
        mpDo("mortgage",{sid},()=>{doMortgage(sid);if(G.phase==="rescue")renderRescueModal();});
      },!canMort));
    }

    if(btns.children.length>0){card.appendChild(header);card.appendChild(btns);panel_el.appendChild(card);}
  });

  // Declare bankrupt button — ook via mpDo (host moet dit uitvoeren)
  const bkBtn=mkBtn("💀 Opgeven — ik ben failliet","width:100%;padding:11px 0;background:#1a0a0a;color:#888;border:1px solid #333;border-radius:8px;font-size:13px;margin-top:8px;",()=>mpDo("bankrupt_self",{},()=>declareBankrupt(pid)));
  panel_el.appendChild(bkBtn);

  backdrop(panel_el,null); // null = don't close on backdrop tap (player must act)
  panel_el.scrollTop=prevScroll;
}

function confirmBackToMenu(){
  DOM.overlayContainer.innerHTML="";
  const bd=document.createElement("div");
  bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  const box=document.createElement("div");
  box.style.cssText="background:#0f1a0f;border:2px solid #4a8a4a;border-radius:14px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:Georgia,serif;color:#fff;";
  box.innerHTML=`<div style="font-size:28px;margin-bottom:8px">🏠</div><h3 style="color:#FFD700;margin:0 0 8px;font-size:16px">Terug naar menu?</h3><p style="color:#aaa;font-size:13px;margin-bottom:18px">Sla het spel eerst op, anders gaat je voortgang verloren.</p>`;
  const btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:10px;justify-content:center;";
  const cancelBtn=document.createElement("button");cancelBtn.textContent="Annuleren";
  cancelBtn.style.cssText="flex:1;padding:11px 0;background:#333;color:#aaa;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:Georgia,serif;";
  cancelBtn.onclick=()=>{DOM.overlayContainer.innerHTML="";};
  const goBtn=document.createElement("button");goBtn.textContent="Naar menu";
  goBtn.style.cssText="flex:1;padding:11px 0;background:#1a6e1a;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;font-family:Georgia,serif;";
  goBtn.onclick=()=>{
    DOM.overlayContainer.innerHTML=""; // sluit overlay VOOR showMenu
    showMenu();
  };
  btnRow.appendChild(cancelBtn);btnRow.appendChild(goBtn);
  box.appendChild(btnRow);bd.appendChild(box);
  DOM.overlayContainer.appendChild(bd);
}

function renderMPLobby() {
  DOM.overlayContainer.innerHTML = "";
  const bd = document.createElement("div");
  bd.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Georgia,serif;";
  const box = document.createElement("div");
  box.style.cssText = "background:#0f2a0f;border:2px solid #4a8a4a;border-radius:18px;padding:24px 20px;width:100%;max-width:360px;color:#fff;text-align:center;";

  const numConnected = MP.connections.length;
  const cpuCount = MP.cpuSlots.length;
  const totalPlayers = 1 + numConnected + cpuCount; // host + echte spelers + CPU's
  const totalSlots = MP.isHost ? 4 : null;

  box.innerHTML = `
    <div style="font-size:32px;margin-bottom:6px">🌐</div>
    <h2 style="color:#FFD700;margin:0 0 4px;font-size:20px">Multiplayer Lobby</h2>
    <div style="font-size:12px;color:#aaa;margin-bottom:14px">${MP.status}</div>
    ${MP.isHost ? `<div style="background:rgba(255,215,0,0.1);border:1px solid #FFD700;border-radius:10px;padding:10px;margin-bottom:14px">
      <div style="font-size:11px;color:#aaa;margin-bottom:4px">Kamercode — deel dit met andere spelers:</div>
      <div style="font-size:36px;font-weight:bold;color:#FFD700;letter-spacing:8px">${MP.roomCode}</div>
    </div>` : `<div style="font-size:13px;color:#ccc;margin-bottom:14px">Code: <b style="color:#FFD700;letter-spacing:3px">${MP.roomCode}</b></div>`}
    <div style="text-align:left;margin-bottom:14px">
      <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Spelers in lobby</div>
      ${MP.roster.map((entry,pid) => {
        const name = entry?.name || (pid===0?"Host":`Speler ${pid+1}`);
        const isMe = pid === MP.myPid;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:5px;border:1px solid ${isMe?"#FFD700":"#2a4a2a"}">
          <span style="font-size:16px">${TOKENS[pid]}</span>
          <span style="font-size:13px;color:${PCOLORS[pid]};font-weight:bold;flex:1">${name}</span>
          ${isMe?'<span style="font-size:9px;color:#FFD700">Jij</span>':""}
          ${pid===0?'<span style="font-size:9px;color:#aaa">Host</span>':""}
        </div>`;
      }).join("")}
      <div id="cpuSlotsRow"></div>
      ${MP.isHost && totalPlayers<4 ? `<div style="font-size:11px;color:#555;padding:6px 10px;font-style:italic">Wachten op meer spelers, of voeg een CPU toe... (${totalPlayers}/4)</div>`:""}
    </div>
  `;

  // CPU-rijen los toegevoegd (i.p.v. via de template string) zodat de host er
  // een verwijderknop bij kan krijgen zonder de HTML-opbouw te compliceren.
  const cpuRow = box.querySelector("#cpuSlotsRow");
  MP.cpuSlots.forEach((cpu,i) => {
    const pid = 1 + numConnected + i;
    const row = document.createElement("div");
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:5px;border:1px solid #2a4a2a`;
    row.innerHTML = `<span style="font-size:16px">🤖</span><span style="font-size:13px;color:${PCOLORS[pid]||"#aaa"};font-weight:bold;flex:1">${esc(cpu.name)}</span><span style="font-size:9px;color:#888">CPU</span>`;
    if (MP.isHost) {
      const rm = document.createElement("button");
      rm.textContent="✕";rm.style.cssText="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0 2px;";
      rm.onclick=()=>{MP.cpuSlots.splice(i,1);mpBroadcastRoster();renderMPLobby();};
      row.appendChild(rm);
    }
    cpuRow.appendChild(row);
  });

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;";

  if (MP.isHost) {
    if (totalPlayers<4) {
      const addCpuBtn = mkBtn("🤖 CPU-speler toevoegen","width:100%;padding:9px 0;font-size:12px;background:rgba(255,255,255,0.06);color:#ccc;border:1px dashed #4a8a4a;border-radius:8px;margin-bottom:10px;",()=>{
        MP.cpuSlots.push({name:`CPU ${MP.cpuSlots.length+1}`});
        mpBroadcastRoster();renderMPLobby();
      });
      box.appendChild(addCpuBtn); // komt na de innerHTML-inhoud, vóór btnRow (die pas hierna wordt toegevoegd)
    }
    const startBtn = mkBtn(
      totalPlayers<2 ? "⏳ Wacht op spelers" : `▶ Start nieuw spel (${totalPlayers} spelers)`,
      "flex:1;padding:12px 0;font-size:14px;font-weight:bold;background:" + (totalPlayers>=2?"#FFD700":"#333") + ";color:" + (totalPlayers>=2?"#000":"#666") + ";border:none;border-radius:10px;",
      mpStartGame, totalPlayers<2
    );
    btnRow.appendChild(startBtn);
  }

  const leaveBtn = mkBtn("❌ Verlaten","flex:1;padding:12px 0;font-size:14px;background:#333;color:#aaa;border:none;border-radius:10px;",()=>{
    mpReset();
    DOM.overlayContainer.innerHTML="";
    showMenu();
  });
  btnRow.appendChild(leaveBtn);
  box.appendChild(btnRow);

  // ── Host: opgeslagen spel laden en meteen naar alle verbonden spelers sturen ──
  if (MP.isHost && numConnected > 0) {
    loadSlotMeta(); // ververst G.savedSlots + G.autoSaveSlot
    const numNeeded = numConnected + 1;
    const loadSection = document.createElement("div");
    loadSection.style.cssText = "margin-top:14px;border-top:1px solid #2a4a2a;padding-top:12px;text-align:left;";
    const loadTitle = document.createElement("div");
    loadTitle.style.cssText = "font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;";
    loadTitle.textContent = `Of laad een opgeslagen spel voor ${numNeeded} spelers`;
    loadSection.appendChild(loadTitle);

    const slots = [
      { key: "auto", meta: G.autoSaveSlot, label: "⚡ Autosave" },
      { key: 0, meta: G.savedSlots[0], label: "Slot 1" },
      { key: 1, meta: G.savedSlots[1], label: "Slot 2" },
      { key: 2, meta: G.savedSlots[2], label: "Slot 3" },
    ];
    let anyMatch = false;
    slots.forEach(s => {
      if (!s.meta) return;
      const savedPlayerCount = (s.meta.names || "").split(",").filter(x=>x.trim()).length;
      const matches = savedPlayerCount === numNeeded;
      if (matches) anyMatch = true;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px 10px;border:1px solid #2a4a2a;";
      const info = document.createElement("div"); info.style.flex="1";
      info.innerHTML = `<div style="font-size:11px;color:#FFD700;font-weight:bold">${s.label}</div><div style="font-size:9px;color:#888">${s.meta.date} — ${esc(s.meta.names)}</div>`;
      row.appendChild(info);
      row.appendChild(mkBtn(matches?"📂 Laden":"Aantal komt niet overeen", `padding:6px 10px;font-size:11px;background:${matches?"#1a6e1a":"#222"};color:${matches?"#fff":"#555"};border:none;border-radius:6px;`, ()=>mpLoadSavedGame(s.key), !matches));
      loadSection.appendChild(row);
    });
    if (!anyMatch) {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:10px;color:#666;font-style:italic;margin-top:4px;";
      hint.textContent = `Geen enkele save heeft precies ${numNeeded} spelers.`;
      loadSection.appendChild(hint);
    }
    box.appendChild(loadSection);
  }

  bd.appendChild(box);
  DOM.overlayContainer.appendChild(bd);
}

function showMPSetup() {
  // Show the multiplayer setup screen
  DOM.overlayContainer.innerHTML="";
  const bd=document.createElement("div");
  bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Georgia,serif;";
  const box=document.createElement("div");
  box.style.cssText="background:#0f2a0f;border:2px solid #4a8a4a;border-radius:18px;padding:24px 20px;width:100%;max-width:360px;color:#fff;";
  box.innerHTML=`<div style="font-size:32px;margin-bottom:6px;text-align:center">🌐</div><h2 style="color:#FFD700;margin:0 0 4px;font-size:20px;text-align:center">Online Multiplayer</h2><p style="color:#aaa;font-size:12px;text-align:center;margin-bottom:18px">Speel met vrienden op andere apparaten via een kamercode</p>`;

  // Name input
  const nameRow=document.createElement("div");nameRow.style.cssText="margin-bottom:14px;";
  nameRow.innerHTML=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">Jouw naam:</div>`;
  const nameInp=document.createElement("input");
  nameInp.type="text";nameInp.placeholder="Bijv. Mark";nameInp.maxLength=12;
  nameInp.value=G.playerSetup?.[0]?.name||"Speler 1";
  nameInp.style.cssText="width:100%;padding:9px 12px;font-size:14px;background:#1a3a1a;color:#fff;border:1px solid #4a8a4a;border-radius:8px;font-family:Georgia,serif;box-sizing:border-box;";
  nameRow.appendChild(nameInp);box.appendChild(nameRow);

  // Create room button
  box.appendChild(mkBtn("🏠 Kamer aanmaken (Host)","width:100%;padding:12px 0;font-size:15px;font-weight:bold;background:#FFD700;color:#000;border:none;border-radius:10px;margin-bottom:10px;",()=>{
    mpCreateRoom(sanitizeName(nameInp.value)||"Host"); // mpCreateRoom zet MP.roster[0] zelf correct
  }));

  // Divider
  const div=document.createElement("div");div.style.cssText="text-align:center;color:#3a6a3a;font-size:12px;margin:12px 0;";div.textContent="— of —";box.appendChild(div);

  // Join room
  const joinLabel=document.createElement("div");joinLabel.style.cssText="font-size:11px;color:#aaa;margin-bottom:5px;";joinLabel.textContent="Kamercode invoeren:";box.appendChild(joinLabel);
  const codeRow=document.createElement("div");codeRow.style.cssText="display:flex;gap:8px;margin-bottom:14px;";
  const codeInp=document.createElement("input");
  codeInp.type="number";codeInp.placeholder="1234";codeInp.maxLength=4;
  codeInp.style.cssText="flex:1;padding:9px 12px;font-size:18px;letter-spacing:6px;background:#1a3a1a;color:#FFD700;border:1px solid #4a8a4a;border-radius:8px;font-family:Georgia,serif;text-align:center;";
  codeRow.appendChild(codeInp);
  codeRow.appendChild(mkBtn("Verbinden","padding:9px 16px;font-size:14px;font-weight:bold;background:#1a6e1a;color:#fff;border:none;border-radius:8px;",()=>{
    const code=codeInp.value.trim();
    if(code.length!==4){showToast("Voer een 4-cijferige code in","#f44");return;}
    // MP.myPid wordt straks door de host gezet via het "your_pid" bericht
    mpJoinRoom(code, sanitizeName(nameInp.value)||"Speler");
  }));
  box.appendChild(codeRow);

  // Cancel
  box.appendChild(mkBtn("← Terug","width:100%;padding:10px 0;font-size:13px;background:#1a2a1a;color:#aaa;border:1px solid #2a4a2a;border-radius:8px;",()=>{DOM.overlayContainer.innerHTML="";}));
  bd.appendChild(box);DOM.overlayContainer.appendChild(bd);
}

// Trade confirm for MP clients (host sends trade request, client accepts/rejects)
function renderOverlaysMPTradeConfirm(data) {
  DOM.overlayContainer.innerHTML="";
  const bd=document.createElement("div");bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:190;display:flex;align-items:center;justify-content:center;padding:16px;";
  const p=document.createElement("div");p.style.cssText="background:#0f2a0f;border:2px solid #4a8a4a;border-radius:16px;padding:20px;width:100%;max-width:340px;color:#fff;font-family:Georgia,serif;";
  p.innerHTML=`<h3 style="color:#FFD700;margin:0 0 12px;text-align:center">Ruilvoorstel</h3>
    <div style="font-size:12px;color:#ccc;margin-bottom:8px"><b style="color:${PCOLORS[data.fromId]}">${G.players[data.fromId]?.name}</b> biedt:<div style="color:#4caf50;margin-top:4px">${(data.offerIds||[]).map(id=>`<div>• ${SPACES[id].name}</div>`).join("")}${data.mo>0?`<div>• €${data.mo}</div>`:""}</div></div>
    <div style="font-size:12px;color:#ccc;margin-bottom:14px">In ruil voor:<div style="color:#ff8a65;margin-top:4px">${(data.reqIds||[]).map(id=>`<div>• ${SPACES[id].name}</div>`).join("")}${data.mr>0?`<div>• €${data.mr}</div>`:""}</div></div>
    <div style="display:flex;gap:8px">`;
  const acc=mkBtn("✅ Accepteren","flex:1;padding:11px 0;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:14px;",()=>{mpAction("trade_confirm",{offerIds:data.offerIds,reqIds:data.reqIds,mo:data.mo,mr:data.mr,fromId:data.fromId,toId:data.tid});DOM.overlayContainer.innerHTML="";});
  const rej=mkBtn("❌ Weigeren","flex:1;padding:11px 0;background:#424242;color:#fff;border:none;border-radius:8px;font-size:14px;",()=>{mpAction("trade_reject");DOM.overlayContainer.innerHTML="";});
  p.querySelector("div:last-child").appendChild(acc);p.querySelector("div:last-child").appendChild(rej);
  bd.appendChild(p);DOM.overlayContainer.appendChild(bd);
}

function renderManageModal(){
  G._activeOverlay="manage";
  // Scrollpositie onthouden: dit paneel wordt na elke bouw/verkoop/hypotheek-actie
  // herbouwd, en zonder dit sprong je telkens weer naar boven.
  const prevPanel=DOM.overlayContainer.querySelector(".mgmt-scroll");
  const prevScroll=prevPanel?prevPanel.scrollTop:0;
  DOM.overlayContainer.innerHTML="";
  const p=panel("");
  p.className="mgmt-scroll";
  p.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:12px"><h3 style="color:#FFD700;margin:0">🏗️ Beheer bezittingen</h3><button onclick="closeOverlay()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button></div>`;
  const sortedProps=sortedByGroup(G.players[G.cur]?.properties||[]);
  if(sortedProps.length===0){const d=document.createElement("div");d.style.cssText="color:#555;font-size:13px;text-align:center;padding:20px";d.textContent="Nog geen bezittingen.";p.appendChild(d);}
  let lastKey=null;
  sortedProps.forEach(sid=>{
    const sp=SPACES[sid];const h=G.houses[sid]||0;const cb=sp.color?CMAP[sp.color]:null;const isMort=G.mortgaged[sid];
    // Group header
    const gkey=sp.color||sp.type;
    if(gkey!==lastKey){
      lastKey=gkey;
      const grpGroup=CGROUPS[sp.color]||[];
      const complete=grpGroup.length>0&&grpGroup.every(id=>G.owned[id]===G.cur&&!G.mortgaged[id]);
      const ghdr=document.createElement("div");ghdr.style.cssText="display:flex;align-items:center;gap:5px;margin:10px 0 4px;";
      if(cb){const dot=document.createElement("div");dot.style.cssText=`width:12px;height:12px;border-radius:2px;background:${cb};flex-shrink:0`;ghdr.appendChild(dot);}
      const glbl=document.createElement("span");glbl.style.cssText="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-weight:bold";
      glbl.textContent=sp.type==="railroad"?"Stations":sp.type==="utility"?"Nutsbedrijven":(gkey||"Overig");
      ghdr.appendChild(glbl);
      if(complete){const badge=document.createElement("span");badge.style.cssText="font-size:10px;color:#FFD700;margin-left:4px";badge.textContent="✦ Monopoly";ghdr.appendChild(badge);}
      p.appendChild(ghdr);
    }
    const card=document.createElement("div");card.style.cssText="border-radius:10px;border:1px solid #1a3a1a;margin-bottom:8px;overflow:hidden;";
    const header=document.createElement("div");header.style.cssText=`background:${cb||"#1a3a1a"};padding:6px 10px;display:flex;justify-content:space-between;align-items:center;`;
    header.innerHTML=`<span style="font-weight:bold;font-size:13px;color:#fff;text-shadow:0 1px 3px #000">${sp.name}</span><span style="font-size:12px;color:rgba(255,255,255,0.8)">${isMort?"🏦 Hypotheek":h===0?"Onbebouwd":h>=5?"🏨 Hotel":`🏠 ${h} huis${h>1?"en":""}`}</span>`;
    const btns=document.createElement("div");btns.style.cssText="padding:8px 10px;background:#0d1a0d;display:flex;flex-wrap:wrap;gap:6px;";
    if(sp.type==="property"){
      const bOk=canBuildHouse(sid),sOk=canSellHouse(sid);
      btns.appendChild(mkBtn(`🏠 Bouw (€${sp.houseCost})`,`padding:5px 10px;font-size:11px;background:${bOk?"#2e7d32":"#1a2a1a"};color:${bOk?"#fff":"#444"};border:none;border-radius:6px;`,()=>{mpDo("build",{sid},()=>{doBuild(sid);renderManageModal();});},!bOk));
      btns.appendChild(mkBtn(`💰 Verkoop (€${Math.floor(sp.houseCost/2)})`,`padding:5px 10px;font-size:11px;background:${sOk?"#b71c1c":"#1a0a0a"};color:${sOk?"#fff":"#444"};border:none;border-radius:6px;`,()=>{mpDo("sell",{sid},()=>{doSell(sid);renderManageModal();});},!sOk));
    }
    if(!isMort){const mOk=canMortgage(sid);btns.appendChild(mkBtn(`🏦 Hypotheek (€${sp.mortgage})`,`padding:5px 10px;font-size:11px;background:${mOk?"#f57c00":"#1a1000"};color:${mOk?"#fff":"#444"};border:none;border-radius:6px;`,()=>{mpDo("mortgage",{sid},()=>{doMortgage(sid);renderManageModal();});},!mOk));}
    else{const uOk=canUnmortgage(sid);btns.appendChild(mkBtn(`✅ Aflossen (€${Math.floor(sp.mortgage*1.1)})`,`padding:5px 10px;font-size:11px;background:${uOk?"#1a6e1a":"#0a0a0a"};color:${uOk?"#fff":"#444"};border:none;border-radius:6px;`,()=>{mpDo("unmortgage",{sid},()=>{doUnmortgage(sid);renderManageModal();});},!uOk));}
    card.appendChild(header);card.appendChild(btns);p.appendChild(card);
  });
  const others=G.players.filter((p2,i)=>i!==G.cur&&!p2.bankrupt);
  if(others.length>0){
    const tr=document.createElement("div");tr.style.cssText="border-top:1px solid #1a3a1a;padding-top:12px;margin-top:4px;";
    tr.innerHTML=`<div style="font-size:13px;color:#FFD700;font-weight:bold;margin-bottom:8px">🔄 Ruilen met speler</div>`;
    const row=document.createElement("div");row.style.cssText="display:flex;gap:8px;flex-wrap:wrap;";
    others.forEach(pl=>{row.appendChild(mkBtn(`${pl.token} Ruil met ${pl.name}`,"padding:8px 14px;font-size:12px;background:#1a3a1a;color:#fff;border:1px solid #4a8a4a;border-radius:8px;",()=>{tradeDraft={tid:pl.id,offerIds:[],reqIds:[],mo:0,mr:0};closeOverlay();renderOverlays({trade:pl.id});},false));});
    tr.appendChild(row);p.appendChild(tr);
  }
  backdrop(p);
  p.scrollTop=prevScroll;
}

function renderTradeModal(tid){
  const target=G.players[tid];const myProps=G.players[G.cur]?.properties||[];const theirProps=target?.properties||[];
  if(!tradeDraft)tradeDraft={tid,offerIds:[],reqIds:[],mo:0,mr:0};
  const p=panel("");
  const hdr=document.createElement("div");hdr.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;";
  hdr.innerHTML=`<h3 style="color:#FFD700;margin:0;font-size:16px">Ruilen met ${esc(target?.token)} ${esc(target?.name)}</h3><button onclick="closeOverlay()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1">✕</button>`;
  p.appendChild(hdr);
  // Live summary
  const summary=document.createElement("div");
  summary.style.cssText="font-size:11px;color:#aaa;margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:6px;padding:6px 8px;";
  const offerNames=(tradeDraft.offerIds||[]).map(id=>SPACES[id].name).join(", ")||"—";
  const reqNames=(tradeDraft.reqIds||[]).map(id=>SPACES[id].name).join(", ")||"—";
  const moneyStr=[(tradeDraft.mo>0?`jij geeft €${tradeDraft.mo}`:""),(tradeDraft.mr>0?`jij ontvangt €${tradeDraft.mr}`:"")].filter(Boolean).join(" | ")||"geen geld";
  summary.innerHTML=`<span style="color:#FFD700">Aanbod:</span> ${offerNames} &nbsp;|&nbsp; <span style="color:#ff8a65">Wil:</span> ${reqNames} &nbsp;|&nbsp; ${moneyStr}`;
  p.appendChild(summary);

  function propSection(sectionLabel,sectionColor,ids,selectedIds,toggle){
    const wrap=document.createElement("div");
    const ttl=document.createElement("div");ttl.style.cssText=`font-size:11px;font-weight:bold;color:${sectionColor};margin-bottom:6px`;ttl.textContent=sectionLabel;wrap.appendChild(ttl);
    if(ids.length===0){const e=document.createElement("div");e.style.cssText="font-size:11px;color:#555;margin-bottom:10px";e.textContent="Geen bezittingen";wrap.appendChild(e);return wrap;}
    // Group by color
    groupedProps(ids).forEach(grp=>{
      const grpDiv=document.createElement("div");grpDiv.style.cssText="margin-bottom:10px;";
      // Color group header
      const grpHdr=document.createElement("div");
      grpHdr.style.cssText=`display:flex;align-items:center;gap:5px;margin-bottom:4px;`;
      if(grp.color){const dot=document.createElement("div");dot.style.cssText=`width:10px;height:10px;border-radius:2px;background:${grp.color};flex-shrink:0`;grpHdr.appendChild(dot);}
      const grpLbl=document.createElement("span");grpLbl.style.cssText="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px";grpLbl.textContent=grp.label;grpHdr.appendChild(grpLbl);
      // Check if this group is complete (monopoly) for the owner
      const firstId=grp.ids[0];const sp0=SPACES[firstId];const grpGroup=CGROUPS[sp0.color]||[];
      if(grpGroup.length>0){
        const ownerId=G.owned[firstId];const complete=ownerId!=null&&grpGroup.every(gid=>G.owned[gid]===ownerId);
        if(complete){const badge=document.createElement("span");badge.style.cssText="font-size:9px;color:#FFD700;margin-left:4px";badge.textContent="✦ Monopoly";grpHdr.appendChild(badge);}
      }
      grpDiv.appendChild(grpHdr);
      const btnRow=document.createElement("div");btnRow.style.cssText="display:flex;flex-wrap:wrap;gap:5px;";
      grp.ids.forEach(id=>{
        const sel=selectedIds.includes(id);
        const h=G.houses[id]||0;
        const houseLabel=h>=5?"🏨":h>0?`🏠${h}`:"";
        const b=mkBtn(SPACES[id].name+(houseLabel?" "+houseLabel:""),
          `padding:5px 9px;font-size:11px;background:${sel?"#2e7d32":"#1a3a1a"};color:#fff;border:1px solid ${sel?"#4caf50":"#4a8a4a"};border-radius:6px;`,
          ()=>{toggle(id);closeOverlay(true);renderOverlays({trade:tid});},false);
        btnRow.appendChild(b);
      });
      grpDiv.appendChild(btnRow);grpDiv.appendChild(btnRow);grpDiv.appendChild(document.createElement("div"));
      wrap.appendChild(grpDiv);
    });
    return wrap;
  }
  p.appendChild(propSection("Jouw aanbod (selecteer):","#FFD700",myProps,tradeDraft.offerIds,id=>{tradeDraft.offerIds=tradeDraft.offerIds.includes(id)?tradeDraft.offerIds.filter(x=>x!==id):[...tradeDraft.offerIds,id];}));

  const moRow=document.createElement("div");moRow.style.cssText="display:flex;gap:8px;margin-bottom:12px;align-items:center;";
  moRow.innerHTML=`<span style="font-size:11px;color:#FFD700">+ Geld aanbod: €</span>`;
  const moInp=document.createElement("input");moInp.type="number";moInp.min="0";moInp.value=tradeDraft.mo;moInp.style.cssText="width:70px;padding:4px 6px;font-size:12px;background:#1a3a1a;color:#fff;border:1px solid #4a8a4a;border-radius:6px;";
  moInp.oninput=e=>{tradeDraft.mo=Math.max(0,Number(e.target.value));};moRow.appendChild(moInp);p.appendChild(moRow);

  p.appendChild(propSection(`Jij wilt van ${target?.name}:`,"#ff8a65",theirProps,tradeDraft.reqIds,id=>{tradeDraft.reqIds=tradeDraft.reqIds.includes(id)?tradeDraft.reqIds.filter(x=>x!==id):[...tradeDraft.reqIds,id];}));

  const mrRow=document.createElement("div");mrRow.style.cssText="display:flex;gap:8px;margin-bottom:14px;align-items:center;";
  mrRow.innerHTML=`<span style="font-size:11px;color:#ff8a65">+ Geld verzoek: €</span>`;
  const mrInp=document.createElement("input");mrInp.type="number";mrInp.min="0";mrInp.value=tradeDraft.mr;mrInp.style.cssText="width:70px;padding:4px 6px;font-size:12px;background:#1a3a1a;color:#fff;border:1px solid #4a8a4a;border-radius:6px;";
  mrInp.oninput=e=>{tradeDraft.mr=Math.max(0,Number(e.target.value));};mrRow.appendChild(mrInp);p.appendChild(mrRow);

  p.appendChild(mkBtn("📤 Ruilvoorstel versturen","width:100%;padding:12px 0;background:#1a6e1a;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:bold;",()=>{tradeDraft.mo=Number(moInp.value)||0;tradeDraft.mr=Number(mrInp.value)||0;submitTrade();}));
  backdrop(p);
}

function renderTradeConfirmModal(tc){
  const bd=document.createElement("div");bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:190;display:flex;align-items:center;justify-content:center;padding:16px;";
  const p=document.createElement("div");p.style.cssText="background:#0f2a0f;border:2px solid #4a8a4a;border-radius:16px;padding:20px;width:100%;max-width:340px;color:#fff;font-family:Georgia,serif;";
  p.innerHTML=`<h3 style="color:#FFD700;margin:0 0 12px;text-align:center">Ruilvoorstel</h3>
    <div style="font-size:12px;color:#ccc;margin-bottom:8px"><b style="color:${PCOLORS[tc.fromId]}">${G.players[tc.fromId]?.name}</b> biedt aan:<div style="color:#4caf50;margin-top:4px">${tc.offerIds.map(id=>`<div>• ${SPACES[id].name}</div>`).join("")}${tc.mo>0?`<div>• €${tc.mo} geld</div>`:""}</div></div>
    <div style="font-size:12px;color:#ccc;margin-bottom:14px">In ruil voor van <b style="color:${PCOLORS[tc.tid]}">${G.players[tc.tid]?.name}</b>:<div style="color:#ff8a65;margin-top:4px">${tc.reqIds.map(id=>`<div>• ${SPACES[id].name}</div>`).join("")}${tc.mr>0?`<div>• €${tc.mr} geld</div>`:""}</div></div>
    <div style="display:flex;gap:8px">`;
  const acc=mkBtn("✅ Accepteren","flex:1;padding:11px 0;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:14px;",()=>{execTrade(tc.offerIds,tc.reqIds,tc.mo,tc.mr,tc.fromId,tc.tid);addLog("Ruil geaccepteerd! ✅","#4caf50");closeOverlay();refreshUI();});
  const rej=mkBtn("❌ Weigeren","flex:1;padding:11px 0;background:#424242;color:#fff;border:none;border-radius:8px;font-size:14px;",()=>{addLog("Ruil geweigerd.","#888");closeOverlay();});
  p.querySelector("div:last-child").appendChild(acc);p.querySelector("div:last-child").appendChild(rej);
  bd.appendChild(p);DOM.overlayContainer.appendChild(bd);
}

function renderSavePanel(){
  loadSlotMeta();
  const bd=document.createElement("div");bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:150;display:flex;align-items:center;justify-content:center;padding:16px;";
  bd.addEventListener("click",closeOverlay);
  const p=document.createElement("div");p.style.cssText="background:#0f2a0f;border:2px solid #4a8a4a;border-radius:16px;padding:24px 20px;width:100%;max-width:320px;color:#fff;font-family:Georgia,serif;";
  p.addEventListener("click",e=>e.stopPropagation());
  p.innerHTML=`<h2 style="color:#FFD700;margin:0 0 16px;font-size:18px;text-align:center">💾 Opslaan / Laden</h2>`;
  [0,1,2].forEach(i=>{
    const row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;border:1px solid #2a4a2a;";
    const info=document.createElement("div");info.style.flex="1";info.innerHTML=`<div style="font-size:12px;color:#FFD700;font-weight:bold">Slot ${i+1}</div>${G.savedSlots[i]?`<div style="font-size:10px;color:#aaa;line-height:1.5">${G.savedSlots[i].date} — ${esc(G.savedSlots[i].names)}</div>`:'<div style="font-size:10px;color:#555;font-style:italic">Leeg</div>'}`;
    row.appendChild(info);
    row.appendChild(mkBtn("💾","padding:7px 10px;font-size:11px;background:#2e7d32;color:#fff;border:none;border-radius:7px;font-weight:bold;",()=>saveGame(i)));
    row.appendChild(mkBtn("📂",`padding:7px 10px;font-size:11px;background:${G.savedSlots[i]?"#1a6e1a":"#222"};color:${G.savedSlots[i]?"#fff":"#555"};border:none;border-radius:7px;`,()=>{loadGame(i);closeOverlay();},!G.savedSlots[i]));
    row.appendChild(mkBtn("🗑️",`padding:7px 8px;font-size:11px;background:${G.savedSlots[i]?"#7f0000":"#1a0000"};color:${G.savedSlots[i]?"#fff":"#333"};border:none;border-radius:7px;`,()=>confirmDeleteGame(i),!G.savedSlots[i]));
    p.appendChild(row);
  });
  p.appendChild(mkBtn("Sluiten","width:100%;padding:10px;background:#1a3a1a;color:#aaa;border:none;border-radius:8px;font-size:13px;margin-top:4px;",closeOverlay));
  bd.appendChild(p);DOM.overlayContainer.appendChild(bd);
}

// ─── MENU ─────────────────────────────────────────────────────────────────────
function showMenu(){
  chatHide(); // menu betekent nooit "in een actief spel" — chat hoort hier nooit zichtbaar te zijn
  loadSlotMeta();
  // Init default setup if not set
  if(!G.playerSetup||G.playerSetup.length!==G.numPlayers){
    G.playerSetup=Array.from({length:G.numPlayers},(_,i)=>({
      name:i===0?"Speler 1":`CPU ${i}`,
      isHuman:i===0
    }));
  }
  DOM.app.innerHTML="";
  DOM.app.style.cssText="min-height:100%;background:linear-gradient(135deg,#1a3a1a,#2d5a27);display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;padding:16px;overflow:auto;";
  const box=document.createElement("div");
  box.style.cssText="background:rgba(0,0,0,0.7);border-radius:20px;padding:24px 18px;text-align:center;color:#fff;max-width:380px;width:100%;border:2px solid #4a8a4a;";
  box.innerHTML=`<div style="font-size:44px;margin-bottom:4px">🏙️</div><h1 style="font-size:26px;font-weight:bold;color:#FFD700;margin:0 0 2px;letter-spacing:3px">PROPERTIX</h1><p style="color:#aaa;font-size:11px;margin-bottom:2px">Het klassieke vastgoedspel</p><p style="color:#4a8a4a;font-size:10px;margin-bottom:16px">${APP_VERSION}</p>`;

  // ── New game section ──────────────────────────────────────────────────────
  const newGame=document.createElement("div");
  newGame.style.cssText="background:rgba(255,255,255,0.04);border:1px solid #3a6a3a;border-radius:12px;padding:14px 12px;margin-bottom:14px;text-align:left;";

  const ngTitle=document.createElement("div");
  ngTitle.style.cssText="font-size:13px;color:#FFD700;font-weight:bold;margin-bottom:10px;text-align:center;";
  ngTitle.textContent="🆕 Nieuw spel";newGame.appendChild(ngTitle);

  // Number of players
  const numRow=document.createElement("div");
  numRow.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:12px;justify-content:center;";
  numRow.innerHTML=`<span style="font-size:12px;color:#ccc;">Spelers:</span>`;
  [2,3,4].forEach(n=>{
    const b=mkBtn(String(n),`padding:8px 16px;border-radius:8px;border:2px solid ${G.numPlayers===n?"#FFD700":"#4a8a4a"};background:${G.numPlayers===n?"#FFD700":"transparent"};color:${G.numPlayers===n?"#000":"#fff"};font-size:17px;font-weight:bold;`,()=>{
      G.numPlayers=n;
      G.playerSetup=Array.from({length:n},(_,i)=>({
        name:G.playerSetup[i]?.name||(i===0?"Speler 1":`CPU ${i}`),
        isHuman:G.playerSetup[i]?.isHuman??i===0
      }));
      showMenu();
    });
    numRow.appendChild(b);
  });
  newGame.appendChild(numRow);

  // Player rows
  const pLabel=document.createElement("div");pLabel.style.cssText="font-size:11px;color:#888;margin-bottom:6px;";pLabel.textContent="Stel per speler in:";newGame.appendChild(pLabel);

  G.playerSetup.forEach((setup,i)=>{
    const row=document.createElement("div");
    row.style.cssText=`display:flex;align-items:center;gap:6px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px 8px;border:1px solid ${PCOLORS[i]}44;`;

    const tokenSpan=document.createElement("span");tokenSpan.style.fontSize="18px";tokenSpan.textContent=TOKENS[i];row.appendChild(tokenSpan);

    // Name input
    const inp=document.createElement("input");
    inp.type="text";inp.value=setup.name;inp.maxLength=10;
    inp.style.cssText="flex:1;padding:5px 7px;font-size:13px;background:#1a3a1a;color:#fff;border:1px solid #3a6a3a;border-radius:6px;font-family:Georgia,serif;";
    inp.oninput=e=>{G.playerSetup[i].name=e.target.value||`Speler ${i+1}`;};
    row.appendChild(inp);

    // Human / CPU toggle
    const tog=document.createElement("button");
    tog.style.cssText=`padding:5px 10px;font-size:11px;border-radius:6px;border:none;cursor:pointer;font-weight:bold;font-family:Georgia,serif;background:${setup.isHuman?"#1a6e1a":"#555"};color:#fff;flex-shrink:0;`;
    tog.textContent=setup.isHuman?"👤 Mens":"🤖 CPU";
    tog.onclick=()=>{G.playerSetup[i].isHuman=!G.playerSetup[i].isHuman;showMenu();};
    row.appendChild(tog);

    newGame.appendChild(row);
  });

  const humanCount=G.playerSetup.filter(s=>s.isHuman).length;
  if(humanCount===0){
    const warn=document.createElement("div");warn.style.cssText="font-size:11px;color:#ff8800;margin-bottom:8px;text-align:center;";warn.textContent="⚠️ Minimaal 1 menselijke speler vereist.";newGame.appendChild(warn);
  }

  newGame.appendChild(mkBtn("▶ Spel starten","width:100%;padding:13px 0;font-size:16px;font-weight:bold;background:#FFD700;color:#000;border:none;border-radius:10px;margin-top:4px;",startGame,humanCount===0));
  box.appendChild(newGame);

  // ── Auto-save section ────────────────────────────────────────────────────────
  if(G.autoSaveSlot){
    const asDiv=document.createElement("div");
    asDiv.style.cssText="background:rgba(255,215,0,0.06);border:1px solid #4a6a2a;border-radius:12px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px;";
    asDiv.innerHTML=`<div style="flex:1"><div style="font-size:12px;color:#FFD700;font-weight:bold;margin-bottom:2px">⚡ Autosave</div><div style="font-size:10px;color:#aaa">${G.autoSaveSlot.date} — ${esc(G.autoSaveSlot.names)}</div></div>`;
    asDiv.appendChild(mkBtn("▶ Hervat","padding:8px 14px;font-size:13px;font-weight:bold;background:#FFD700;color:#000;border:none;border-radius:8px;",loadAutoSave));
    box.appendChild(asDiv);
  }

  // ── Multiplayer section ──────────────────────────────────────────────────────
  const mpSection=document.createElement("div");
  mpSection.style.cssText="background:rgba(255,255,255,0.04);border:1px solid #3a6a3a;border-radius:12px;padding:14px 12px;margin-bottom:14px;text-align:center;";
  mpSection.innerHTML=`<div style="font-size:13px;color:#FFD700;font-weight:bold;margin-bottom:6px">🌐 Online Multiplayer</div><p style="color:#aaa;font-size:11px;margin-bottom:10px">Speel met vrienden op andere apparaten</p>`;
  mpSection.appendChild(mkBtn("🌐 Online spelen","width:100%;padding:12px 0;font-size:15px;font-weight:bold;background:#1a6e1a;color:#fff;border:none;border-radius:10px;",showMPSetup));
  box.appendChild(mpSection);

  // ── Saved games section ───────────────────────────────────────────────────
  const saves=document.createElement("div");
  saves.style.cssText="background:rgba(255,255,255,0.04);border:1px solid #3a6a3a;border-radius:12px;padding:14px 12px;";
  saves.innerHTML=`<div style="font-size:13px;color:#FFD700;font-weight:bold;margin-bottom:10px">💾 Opgeslagen spellen</div>`;
  [0,1,2].forEach(i=>{
    const row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;border:1px solid #2a4a2a;";
    const info=document.createElement("div");info.style.flex="1";info.style.textAlign="left";
    info.innerHTML=`<div style="font-size:11px;color:#FFD700;font-weight:bold">Slot ${i+1}</div>${G.savedSlots[i]?`<div style="font-size:10px;color:#aaa;line-height:1.5">${G.savedSlots[i].date}<br>${esc(G.savedSlots[i].names)}</div>`:'<div style="font-size:10px;color:#555;font-style:italic">Leeg</div>'}`;
    row.appendChild(info);
    row.appendChild(mkBtn("📂 Laden",`padding:7px 10px;font-size:12px;background:${G.savedSlots[i]?"#1a6e1a":"#222"};color:${G.savedSlots[i]?"#fff":"#555"};border:none;border-radius:7px;`,()=>loadGame(i),!G.savedSlots[i]));
    row.appendChild(mkBtn("🗑️",`padding:7px 8px;font-size:12px;background:${G.savedSlots[i]?"#7f0000":"#1a0000"};color:${G.savedSlots[i]?"#fff":"#333"};border:none;border-radius:7px;`,()=>confirmDeleteGame(i),!G.savedSlots[i]));
    saves.appendChild(row);
  });
  box.appendChild(saves);
  DOM.app.appendChild(box);
}

function startGame(){
  const p=initPlayers(G.playerSetup);const pp={};p.forEach(pl=>{pp[pl.id]=0;});
  G.players=p;G.pawnPos=pp;G.owned={};G.houses={};G.mortgaged={};G.prevMoney={};G.wonPid=null;G.prevOwned={};chatReset();
  G.cur=0;G.phase="roll";G.log=[];G.freePot=0;G.busy=false;
  G.chanceCards=shuffle(CHANCE);G.chestCards=shuffle(CHEST);G.chanceIdx=0;G.chestIdx=0;
  tradeDraft=null;
  DOM.app.style.cssText="height:100%;display:flex;flex-direction:column;";
  buildGameScreen();
}
