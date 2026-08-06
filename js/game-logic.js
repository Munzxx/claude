// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ─── GAME LOGIC ──────────────────────────────────────────────────────────────
function addLog(msg,color="#bbb"){G.log=[...G.log.slice(-80),{msg,color}];}

function applyCard(pc,pid,result,oc){
  // Retourneert of nieuwe positie nog een landing-check nodig heeft
  // (moveBack/moveToNearest hebben zelf geen geldafhandeling)
  let needsLandingCheck=false;
  G._cardAnimType="forward"; // hoe de 2e animatie (naar de kaart-positie) moet lopen
  if(result.money)pc[pid]={...pc[pid],money:pc[pid].money+result.money};
  if(result.moveTo!=null)pc[pid]={...pc[pid],pos:result.moveTo};
  if(result.moveBack){pc[pid]={...pc[pid],pos:((pc[pid].pos-result.moveBack)+40)%40};needsLandingCheck=true;G._cardAnimType="back";}
  if(result.goToJail){pc[pid]={...pc[pid],pos:10,inJail:true,jailTurns:0};G._cardAnimType="teleport";addLog(`${pc[pid].name} moet naar de gevangenis zonder langs start te gaan. ${pc[pid].name} ontvangt geen €200.`,"#ff4444");}
  if(result.collectFromAll)pc.forEach((_,i)=>{if(i!==pid&&!pc[i].bankrupt){pc[i]={...pc[i],money:pc[i].money-result.collectFromAll};pc[pid]={...pc[pid],money:pc[pid].money+result.collectFromAll};}});
  if(result.moveToNearest){const rr=[5,15,25,35];pc[pid]={...pc[pid],pos:rr.find(r=>r>pc[pid].pos)||rr[0]};needsLandingCheck=true;}
  return needsLandingCheck;
}

function processLanding(pc,oc,pid,pos,diceTotal){
  const sp=SPACES[pos];const pl=pc[pid];let ph="endturn";
  if(sp.type==="go"){pc[pid]={...pl,money:pl.money+200};showToast("🏁 START! +€200 🎉");}
  else if(sp.type==="free"){
    if(G.freePot>0){pc[pid]={...pl,money:pl.money+G.freePot};showToast(`🅿 Vrij Parkeren! +€${G.freePot} 🎉`,"#4caf50");G.freePot=0;}
    else showToast("🅿 Vrij Parkeren — pot leeg.","#aaa");
  }
  else if(sp.type==="gotojail"){pc[pid]={...pl,pos:10,inJail:true,jailTurns:0};showToast("🚔 Naar de gevangenis!","#ff4444");addLog(`${pl.name} moet naar de gevangenis zonder langs start te gaan. ${pl.name} ontvangt geen €200.`,"#ff4444");G._cardAnimType="teleport";}
  else if(sp.type==="tax"){const t=sp.rent[0];pc[pid]={...pl,money:pl.money-t};G.freePot+=t;mpBroadcastCardReveal({title:sp.name,icon:"💸",colorBg:"#ff8800",lines:[`<b style="color:#c62828;font-size:15px">-€${t}</b>`,"gaat naar de gemeenschapspot"]});}
  else if(sp.type==="chest"){const c=G.chestCards[G.chestIdx%G.chestCards.length];G.chestIdx++;mpBroadcastCardReveal({title:"Algemeen Fonds",icon:"🎁",colorBg:"#9b59b6",lines:[c.t]});if(applyCard(pc,pid,c.a(),oc))G._needsSecondLanding=true;}
  else if(sp.type==="chance"){const c=G.chanceCards[G.chanceIdx%G.chanceCards.length];G.chanceIdx++;mpBroadcastCardReveal({title:"Kans",icon:"❓",colorBg:"#e67e22",lines:[c.t]});if(applyCard(pc,pid,c.a(),oc))G._needsSecondLanding=true;}
  else if(sp.type==="utility"){
    const oid=oc[sp.id];
    if(oid==null){ph=pl.isHuman?"buy":"endturn";if(!pl.isHuman)cpuBuy(pc,oc,pid,sp);}
    else if(oid!==pid&&!G.mortgaged[sp.id]){const cnt=Object.keys(oc).filter(k=>SPACES[+k]?.type==="utility"&&oc[k]===oid).length;const rent=diceTotal*(cnt===2?10:4);pc[pid]={...pc[pid],money:pc[pid].money-rent};pc[oid]={...pc[oid],money:pc[oid].money+rent};addLog(`${pl.name} betaalt €${rent} huur.`,"#ff4444");}
  }
  else if(sp.type==="railroad"){
    const oid=oc[sp.id];
    if(oid==null){ph=pl.isHuman?"buy":"endturn";if(!pl.isHuman)cpuBuy(pc,oc,pid,sp);}
    else if(oid!==pid&&!G.mortgaged[sp.id]){const cnt=Object.keys(oc).filter(k=>SPACES[+k]?.type==="railroad"&&oc[k]===oid).length;const rent=sp.rent[Math.min(cnt-1,3)]||25;pc[pid]={...pc[pid],money:pc[pid].money-rent};pc[oid]={...pc[oid],money:pc[oid].money+rent};addLog(`${pl.name} betaalt €${rent} huur.`,"#ff4444");}
  }
  else if(sp.type==="property"){
    const oid=oc[sp.id];
    if(oid==null){ph=pl.isHuman?"buy":"endturn";if(!pl.isHuman)cpuBuy(pc,oc,pid,sp);}
    else if(oid!==pid&&!G.mortgaged[sp.id]){const hc=G.houses[sp.id]||0;const grp=CGROUPS[sp.color]||[];const mono=grp.every(id=>oc[id]===oid);const rent=hc>0?sp.rent[Math.min(hc,5)]:(mono?sp.rent[0]*2:sp.rent[0]);pc[pid]={...pc[pid],money:pc[pid].money-rent};pc[oid]={...pc[oid],money:pc[oid].money+rent};addLog(`${pl.name} betaalt €${rent} huur aan ${pc[oid].name}.`,"#ff4444");}
  }
  return ph;
}
function cpuBuy(pc,oc,pid,sp){
  if(pc[pid].money>sp.price*1.1){oc[sp.id]=pid;pc[pid]={...pc[pid],money:pc[pid].money-sp.price,properties:[...pc[pid].properties,sp.id]};addLog(`${pc[pid].name} koopt ${sp.name}.`,PCOLORS[pid]);}
}
function cpuRaiseMoney(pc,oc,pid){
  // CPU tries to raise money: first sell hotels->houses, then mortgage cheapest first
  const p=pc[pid];let raised=false;

  // Pass 1: sell houses (most expensive group first to preserve monopolies)
  const houseProps=p.properties.filter(sid=>G.houses[sid]>0);
  houseProps.sort((a,b)=>SPACES[b].houseCost-SPACES[a].houseCost);
  for(const sid of houseProps){
    if(pc[pid].money>=0) break;
    const sp=SPACES[sid];
    // Check even-selling rule
    const grp=CGROUPS[sp.color]||[];
    const maxH=Math.max(...grp.map(id=>G.houses[id]||0));
    if((G.houses[sid]||0)<maxH) continue;
    const sell=Math.floor(sp.houseCost/2);
    G.houses[sid]=(G.houses[sid]||0)-1;
    pc[pid]={...pc[pid],money:pc[pid].money+sell};
    addLog(`${p.name} verkoopt huis op ${sp.name} (nood) +€${sell}.`,PCOLORS[pid]);
    raised=true;
  }

  // Pass 2: mortgage unbuilt properties (cheapest first)
  const mortProps=p.properties.filter(sid=>{
    if(G.mortgaged[sid]) return false;
    const grp=CGROUPS[SPACES[sid].color]||[];
    if(grp.some(id=>G.houses[id]>0)) return false; // can't mortgage group with houses
    return true;
  });
  mortProps.sort((a,b)=>SPACES[a].price-SPACES[b].price);
  for(const sid of mortProps){
    if(pc[pid].money>=0) break;
    const sp=SPACES[sid];
    G.mortgaged[sid]=true;
    pc[pid]={...pc[pid],money:pc[pid].money+sp.mortgage};
    addLog(`${p.name} hypotheekt ${sp.name} (nood) +€${sp.mortgage}.`,PCOLORS[pid]);
    raised=true;
  }
  return raised;
}

function checkBankrupt(pc,oc){
  pc.forEach((p,i)=>{
    if(!p.bankrupt && p.money<0){
      if(!p.isHuman){
        // CPU: try to raise money first
        cpuRaiseMoney(pc,oc,i);
        if(pc[i].money<0){
          // Still broke: bankrupt
          pc[i]={...pc[i],bankrupt:true};
          addLog(`💀 ${pc[i].name} is failliet!`,"#f44");
          Object.keys(oc).forEach(k=>{if(oc[k]===i)delete oc[k];});
        }
      } else {
        // Human: check if they have assets to raise money
        const canRaise=p.properties.some(sid=>{
          if(G.houses[sid]>0) return true;
          if(!G.mortgaged[sid]) return true;
          return false;
        });
        if(!canRaise){
          pc[i]={...p,bankrupt:true};
          addLog(`💀 ${p.name} is failliet!`,"#f44");
          Object.keys(oc).forEach(k=>{if(oc[k]===i)delete oc[k];});
        }
        // else: rescue modal shown by executeMove callback
      }
    }
  });
}

function isInDebt(pid){
  return G.players[pid] && G.players[pid].money < 0 && !G.players[pid].bankrupt;
}

function canPlayerRaiseMoney(pid){
  const p=G.players[pid];if(!p)return false;
  return p.properties.some(sid=>{
    if(G.houses[sid]>0) return true;
    if(!G.mortgaged[sid]) return true;
    return false;
  });
}

function declareBankrupt(pid){
  G.players=G.players.map((p,i)=>i===pid?{...p,bankrupt:true}:p);
  addLog(`💀 ${G.players[pid].name} is failliet!`,"#f44");
  // Remove all properties
  Object.keys(G.owned).forEach(k=>{if(G.owned[k]===pid)delete G.owned[k];});
  // Remove all houses
  G.players[pid].properties.forEach(sid=>{delete G.houses[sid];delete G.mortgaged[sid];});
  closeOverlay();
  G.phase="endturn";
  refreshUI();
  // Check if game over
  const active=G.players.filter(p=>!p.bankrupt);
  if(active.length===1) refreshOverlayWinner();
  else setTimeout(()=>handleEndTurn(),600);
}
function computeCPUTrade(fromId){
  const from=G.players[fromId];if(!from||from.bankrupt)return null;
  for(const[color,group]of Object.entries(CGROUPS)){
    const myIds=group.filter(id=>G.owned[id]===fromId);
    const theirMap={};group.forEach(id=>{const oid=G.owned[id];if(oid!=null&&oid!==fromId){theirMap[oid]=theirMap[oid]||[];theirMap[oid].push(id);}});
    if(myIds.length===group.length-1&&Object.keys(theirMap).length===1){
      const tid=Number(Object.keys(theirMap)[0]);const needed=theirMap[tid];
      if(needed.length===1&&!G.houses[needed[0]]){
        const cands=from.properties.filter(id=>{if(G.houses[id])return false;const sp=SPACES[id];if(sp.type!=="property"&&sp.type!=="railroad")return false;const grp=CGROUPS[sp.color]||[];return!(grp.length>0&&grp.every(gid=>G.owned[gid]===fromId));});
        if(cands.length>0){const offer=cands.sort((a,b)=>SPACES[a].price-SPACES[b].price)[0];const diff=SPACES[needed[0]].price-SPACES[offer].price;return{tid,offer:[offer],request:needed,mo:diff>0?diff:0,mr:diff<0?-diff:0};}
      }
    }
  }
  return null;
}
function cpuAcceptsTrade(tid,offer,request,mo,mr){
  const target=G.players[tid];if(!target||target.bankrupt)return false;

  // Calculate raw value of what target gives up vs receives
  const receives=offer.reduce((s,id)=>s+SPACES[id].price,0)+mo;
  const givesUp =request.reduce((s,id)=>s+SPACES[id].price,0)+mr;

  // Reject if compensation is less than 85% of value given up (not too generous)
  if(receives < givesUp*0.85) return false;

  // Check if receiving offer helps target complete a color group (monopoly)
  let helpsTarget=false;
  for(const id of offer){
    const grp=CGROUPS[SPACES[id].color]||[];
    if(grp.length>0){
      const willHave=grp.filter(gid=>G.owned[gid]===tid||offer.includes(gid));
      if(willHave.length===grp.length) helpsTarget=true;
    }
  }

  // Check if giving up request hurts target (breaks their near-monopoly)
  let hurtsSelf=false;
  for(const id of request){
    const grp=CGROUPS[SPACES[id].color]||[];
    if(grp.length>0){
      const hasNow=grp.filter(gid=>G.owned[gid]===tid);
      // If target has 2+ of a group and we're taking one, it hurts
      if(hasNow.length>=2) hurtsSelf=true;
    }
  }

  // Check if giving up request helps OPPONENT complete a monopoly — bad for target
  let helpsOpponent=false;
  const fromId=G.cur;
  for(const id of request){
    const grp=CGROUPS[SPACES[id].color]||[];
    if(grp.length>0){
      const opponentWillHave=grp.filter(gid=>G.owned[gid]===fromId||request.includes(gid));
      if(opponentWillHave.length===grp.length) helpsOpponent=true;
    }
  }

  // Never give opponent a monopoly unless massively compensated
  if(helpsOpponent && receives < givesUp*1.5) return false;

  // Accept if: helps self + fair value, OR significantly overpaid
  if(helpsTarget && !hurtsSelf && receives>=givesUp*0.9) return true;
  if(receives>=givesUp*1.1) return true; // overpaid by 10%+, always accept
  if(helpsTarget && receives>=givesUp*0.85) return true;

  return false;
}
function execTrade(offerIds,reqIds,mo,mr,fromId,toId){
  G.players=G.players.map((p,i)=>{
    if(i===fromId)return{...p,properties:[...p.properties.filter(x=>!offerIds.includes(x)),...reqIds],money:p.money-mo+mr};
    if(i===toId)return{...p,properties:[...p.properties.filter(x=>!reqIds.includes(x)),...offerIds],money:p.money-mr+mo};
    return p;
  });
  offerIds.forEach(id=>{G.owned[id]=toId;});reqIds.forEach(id=>{G.owned[id]=fromId;});
}

// ─── TURN FLOW ────────────────────────────────────────────────────────────────
function executeMove(pid,d1,d2,cb){
  const total=d1+d2;
  const pc=G.players.map(p=>({...p}));
  const oc={...G.owned};
  const pl=pc[pid];

  if(pl.inJail){
    if(d1===d2){pc[pid]={...pl,inJail:false,jailTurns:0};addLog(`${pl.name} gooit dubbel, verlaat gevangenis!`,PCOLORS[pid]);}
    else if(pl.jailTurns>=2){pc[pid]={...pl,inJail:false,jailTurns:0,money:pl.money-50};G.freePot+=50;addLog(`${pl.name} betaalt €50 boete.`,"#aaa");}
    else{pc[pid]={...pl,jailTurns:pl.jailTurns+1};addLog(`${pl.name} in gevangenis (${pl.jailTurns+1}/3).`,"#aaa");G.players=pc;G.owned=oc;cb("endturn");return;}
  }

  const from=pc[pid].pos;const to=(from+total)%40;
  if(to<from){
    pc[pid]={...pc[pid],money:pc[pid].money+200};
    if(to===0) addLog(`${pl.name} komt direct op START — dat telt als passeren én landen, dus 2x €200!`,"#FFD700");
    else addLog(`${pl.name} passeert START, ontvangt €200.`,"#FFD700");
  }
  pc[pid]={...pc[pid],pos:to};
  addLog(`${pl.name} gooit ${d1}+${d2}=${total} → ${SPACES[to].name}`,PCOLORS[pid]);

  // Animate pawn, THEN process landing
  animatePawn(pid,from,total,()=>{
    G.pawnPos[pid]=to;
    placePawn(pid,to);

    // Process landing — card effects may change pc[pid].pos
    G._needsSecondLanding=false;
    let np=processLanding(pc,oc,pid,to,total);
    checkBankrupt(pc,oc);
    // Set G.players and G.owned BEFORE finishMove so isInDebt/canPlayerRaiseMoney
    // read the correct updated state
    G.players=pc;G.owned=oc;

    const finalPos=pc[pid].pos;
    const needsSecondLanding=G._needsSecondLanding;

    function finishMove(){
      // Re-read from G.players (already updated above)
      if(G.players[pid]?.isHuman && isInDebt(pid) && canPlayerRaiseMoney(pid)){
        G.phase="rescue";G.busy=false;refreshUI();
        // Alleen lokaal openen als IK (dit apparaat) de speler ben die moet betalen —
        // anders zag de host dit scherm ook als het een client-speler betrof (en
        // omgekeerd). De client die het wél aangaat opent 'm zelf via mpApplySyncNow.
        if(!MP.active||pid===MP.myPid) renderOverlays({rescue:true});
      } else {
        cb(np);
      }
    }

    if(finalPos!==to){
      // Card moved player (moveBack, moveTo, moveToNearest, goToJail)
      const animType=G._cardAnimType||"forward";
      const afterSecondMove=()=>{
        G.pawnPos[pid]=finalPos;
        placePawn(pid,finalPos);
        scrollToPos(finalPos);
        // moveBack/moveToNearest: het nieuwe vakje moet alsnog normaal
        // verwerkt worden (kopen/huur betalen), want dat is nog niet gebeurd
        if(needsSecondLanding){
          np=processLanding(pc,oc,pid,finalPos,total);
          checkBankrupt(pc,oc);
          G.players=pc;G.owned=oc;
        }
        finishMove();
      };
      setTimeout(()=>{
        if(animType==="teleport"){
          // Gevangenis: direct teleporteren, geen stap-animatie — anders lijkt
          // het alsof de pion langs START loopt en €200 zou krijgen.
          afterSecondMove();
        } else if(animType==="back"){
          // "Ga 3 stappen terug": echt achteruit lopen, niet vooruit rond het bord.
          const steps=(to-finalPos+40)%40||40;
          animatePawn(pid,to,steps,afterSecondMove,true);
        } else {
          const steps=(finalPos-to+40)%40||40;
          animatePawn(pid,to,steps,afterSecondMove);
        }
      },400);
    } else {
      finishMove();
    }
  });
}

function handleRoll(){
  if(G.phase!=="roll"||G.busy)return;
  G.busy=true;
  const d1=rng(),d2=rng();
  // In multiplayer: stuur de dobbelwaarden EERST naar alle clients, zodat zij
  // exact dezelfde animatie tegelijk met de host kunnen afspelen — hierdoor ziet
  // iedereen wat er gedobbeld wordt en hoe het pion loopt, niet alleen het eindresultaat.
  if (MP.active && MP.isHost) {
    mpSend({ type:"turn_animate", pid:G.cur, d1, d2, wasInJail:!!G.players[G.cur]?.inJail, jailTurns:G.players[G.cur]?.jailTurns||0 });
  }
  // First animate dice, only AFTER they stop → move pawn
  animateDice(d1,d2,()=>{
    executeMove(G.cur,d1,d2,np=>{
      G.phase=np;G.busy=false;
      refreshUI();
    });
  });
}

function handleBailOut(){
  if(!G.players[G.cur]?.inJail||G.players[G.cur].money<50)return;
  const bailName=G.players[G.cur].name;
  G.players=G.players.map((p,i)=>i===G.cur?{...p,inJail:false,jailTurns:0,money:p.money-50}:p);
  G.freePot+=50;addLog(`${bailName} betaalt €50 borgtocht → pot.`,PCOLORS[G.cur]);
  showToast("🔓 Vrijgekocht voor €50!","#FFD700");refreshUI();
}
// Generieke omdraaiende kaart-overlay — gebruikt voor het kopen van een straat, maar
// ook voor kans/kist-kaarten en belasting, zodat die "op dezelfde manier" getoond
// worden. lines[] mag kleine inline HTML bevatten (alleen gevuld met eigen, vaste
// spelteksten — nooit met speler-input, dus geen esc() nodig op dat niveau).
function showCardFlip(opts){
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;pointer-events:none;perspective:800px;";
  const card=document.createElement("div");
  card.style.cssText="width:170px;height:230px;position:relative;transform-style:preserve-3d;animation:deedFlip 1s cubic-bezier(.4,0,.2,1) forwards;";
  const back=document.createElement("div");
  // Expliciete rotateY(0deg) + z-index: Firefox berekent backface-visibility soms
  // verkeerd bij rotateY+perspective (Mozilla bug 1306107) — zonder deze twee kan
  // de achterkant zichtbaar blijven staan i.p.v. om te draaien naar de voorkant.
  back.style.cssText="position:absolute;inset:0;border-radius:10px;background:linear-gradient(135deg,#1a3a1a,#0d1f0d);border:2px solid #FFD700;backface-visibility:hidden;transform:rotateY(0deg);z-index:1;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(0,0,0,0.6);";
  back.innerHTML=`<div style="font-size:28px">${opts.backIcon||"🏛️"}</div>`;
  const front=document.createElement("div");
  front.style.cssText="position:absolute;inset:0;border-radius:10px;background:#fdf6e3;border:2px solid #333;backface-visibility:hidden;transform:rotateY(180deg);z-index:2;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.6);display:flex;flex-direction:column;";
  front.innerHTML=`<div style="background:${opts.colorBg||"#555"};padding:8px 6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:12px;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.4)">${opts.icon?opts.icon+" ":""}${esc(opts.title)}</div>
    <div style="flex:1;padding:12px;color:#333;font-size:11px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:7px;line-height:1.45">${(opts.lines||[]).map(l=>`<div>${l}</div>`).join("")}</div>`;
  card.appendChild(back);card.appendChild(front);
  wrap.appendChild(card);
  DOM.overlayContainer.appendChild(wrap);
  // Lang genoeg laten staan om echt te kunnen lezen (was eerst 1.5s — te kort).
  setTimeout(()=>wrap.remove(),opts.duration||4000);
}
// Toont de kaart lokaal EN stuurt 'm naar alle verbonden spelers, zodat iedereen
// exact hetzelfde te zien krijgt — niet alleen degene bij wie de host toevallig
// de spellogica uitvoert.
function mpBroadcastCardReveal(opts){
  showCardFlip(opts);
  if(MP.active&&MP.isHost) mpSend({type:"card_reveal",opts});
}
function showDeedCardFlip(sp){
  const cb=CMAP[sp.color];
  const rentLine=sp.type==="utility"?"Huur: afhankelijk van worp":sp.type==="railroad"?`Huur: €${sp.rent[0]}+`:`Huur: €${sp.rent[0]}`;
  showCardFlip({title:sp.name,colorBg:cb||"#555",lines:[`<b style="color:#2e7d32;font-size:15px">€${sp.price}</b>`,rentLine,`<span style="color:#999;font-size:9px;letter-spacing:1px">GEKOCHT</span>`]});
}
function handleBuy(){
  const sp=SPACES[G.players[G.cur].pos];
  const buyerName=G.players[G.cur].name;
  if(G.players[G.cur].money<sp.price){addLog("Niet genoeg geld!","#f44");G.phase="endturn";refreshUI();return;}
  G.owned[sp.id]=G.cur;
  G.players=G.players.map((p,i)=>i===G.cur?{...p,money:p.money-sp.price,properties:[...p.properties,sp.id]}:p);
  addLog(`${buyerName} koopt ${sp.name} voor €${sp.price}.`,PCOLORS[G.cur]);G.phase="endturn";refreshUI();
}
function handleSkip(){addLog(`${G.players[G.cur].name} koopt ${SPACES[G.players[G.cur].pos].name} niet.`,"#888");G.phase="endturn";refreshUI();}

function canBuildHouse(sid){const sp=SPACES[sid];if(sp.type!=="property"||G.owned[sid]!==G.cur||G.mortgaged[sid])return false;const grp=CGROUPS[sp.color]||[];if(!grp.every(id=>G.owned[id]===G.cur&&!G.mortgaged[id]))return false;const h=G.houses[sid]||0;if(h>=5)return false;const min=Math.min(...grp.map(id=>G.houses[id]||0));return h<=min&&G.players[G.cur].money>=sp.houseCost;}
function canSellHouse(sid){const sp=SPACES[sid];if(sp.type!=="property"||G.owned[sid]!==G.cur)return false;const h=G.houses[sid]||0;if(h===0)return false;const max=Math.max(...(CGROUPS[sp.color]||[]).map(id=>G.houses[id]||0));return h===max;}
function canMortgage(sid){if(G.owned[sid]!==G.cur||G.mortgaged[sid])return false;if(SPACES[sid].type==="property"){const grp=CGROUPS[SPACES[sid].color]||[];if(grp.some(id=>G.houses[id]>0))return false;}return true;}
function canUnmortgage(sid){return G.owned[sid]===G.cur&&G.mortgaged[sid]&&G.players[G.cur].money>=Math.floor(SPACES[sid].mortgage*1.1);}
function checkRescueResolved(){
  // Host-autoritatieve check: als de speler in "rescue"-fase weer genoeg geld
  // heeft, sluiten we het scherm en gaan we door naar "endturn". Werkt zowel
  // lokaal als in multiplayer omdat dit altijd op de host (of het enige
  // apparaat bij lokaal spel) wordt uitgevoerd.
  if(G.phase==="rescue"&&G.players[G.cur]&&G.players[G.cur].money>=0){
    showToast(`✅ Schuld afbetaald! Saldo: €${G.players[G.cur].money}`,"#4caf50");
    closeOverlay();G.phase="endturn";G._activeOverlay=null;
  }
}
function doBuild(sid){const sp=SPACES[sid];G.houses[sid]=(G.houses[sid]||0)+1;G.players=G.players.map((p,i)=>i===G.cur?{...p,money:p.money-sp.houseCost}:p);addLog(`Huis op ${sp.name}.`,PCOLORS[G.cur]);refreshUI();}
function doSell(sid){const sp=SPACES[sid];const sell=Math.floor(sp.houseCost/2);G.houses[sid]--;G.players=G.players.map((p,i)=>i===G.cur?{...p,money:p.money+sell}:p);addLog(`Huis verkocht op ${sp.name} +€${sell}.`,PCOLORS[G.cur]);checkRescueResolved();refreshUI();}
function doMortgage(sid){const sp=SPACES[sid];G.mortgaged[sid]=true;G.players=G.players.map((p,i)=>i===G.cur?{...p,money:p.money+sp.mortgage}:p);addLog(`Hypotheek ${sp.name} +€${sp.mortgage}.`,PCOLORS[G.cur]);checkRescueResolved();refreshUI();}
function doUnmortgage(sid){const sp=SPACES[sid];const cost=Math.floor(sp.mortgage*1.1);G.mortgaged[sid]=false;G.players=G.players.map((p,i)=>i===G.cur?{...p,money:p.money-cost}:p);addLog(`Hypotheek afgelost ${sp.name}.`,PCOLORS[G.cur]);refreshUI();}

let tradeDraft=null;
function submitTrade(){
  if(!tradeDraft)return;
  const{tid,offerIds,reqIds,mo,mr}=tradeDraft;
  if(offerIds.length===0&&reqIds.length===0&&mo===0&&mr===0){showToast("Voeg iets toe aan het aanbod!","#f44");return;}

  if(MP.active && !MP.isHost){
    // Client: stuur voorstel naar de host, doe zelf niets lokaal —
    // de host is autoritatief en stuurt straks een bevestigingsverzoek
    // naar het JUISTE apparaat (mogelijk niet het onze).
    mpAction("trade_submit",{draft:{tid,offerIds,reqIds,mo,mr}});
    tradeDraft=null;closeOverlay();
    showToast("Ruilvoorstel verzonden, wachten op bevestiging...","#FFD700");
    return;
  }

  const target=G.players[tid];tradeDraft=null;
  const fromId=G.cur; // altijd de speler die aan zet is

  if(MP.active && MP.isHost){
    if(tid===0){
      // Doelspeler is de host zelf → lokale bevestiging
      renderOverlays({tradeConfirm:{fromId,tid,offerIds,reqIds,mo,mr}});
    } else {
      // Doelspeler is een ANDERE client → stuur alleen naar DIE verbinding,
      // zodat het bevestigingsscherm op het juiste apparaat verschijnt
      const conn=MP.connections[tid-1];
      if(conn){
        try{conn.send({type:"trade_request",fromId,tid,offerIds,reqIds,mo,mr});}catch(e){}
        showToast(`Ruilvoorstel verzonden naar ${target.name}...`,"#FFD700");
      }
    }
    return;
  }

  // Lokaal / offline pass-and-play — ongewijzigd gedrag
  if(!target.isHuman){
    if(cpuAcceptsTrade(tid,offerIds,reqIds,mo,mr)){execTrade(offerIds,reqIds,mo,mr,G.cur,tid);addLog(`${target.name} accepteert ruil! ✅`,PCOLORS[tid]);showToast(`${target.name} accepteert! ✅`,"#4caf50");}
    else{addLog(`${target.name} weigert ruil.`,PCOLORS[tid]);showToast(`${target.name} weigert.`,"#ff4444");}
    renderOverlays();
  } else {
    renderOverlays({tradeConfirm:{fromId:G.cur,tid,offerIds,reqIds,mo,mr}});
  }
}

function handleEndTurn(){
  // Autosave alleen als de HUIDIGE speler (die net zijn beurt beëindigt) menselijk is.
  // Zo niet gebeurt autosave nooit midden in een CPU-keten, wat een inconsistente
  // snapshot zou geven (G.cur op een CPU zonder dat er iets is dat hem laat spelen).
  if(G.players[G.cur]?.isHuman) autoSave();
  const active=G.players.filter(p=>!p.bankrupt);if(active.length<=1)return;
  let next=(G.cur+1)%G.players.length;while(G.players[next]?.bankrupt)next=(next+1)%G.players.length;
  G.cur=next;G.phase="roll";refreshUI();
  if(!G.players[next].isHuman)setTimeout(()=>runCPU(next),600);
}

function runCPU(pid){
  if(G.busy)return;G.busy=true;
  const d1=rng(),d2=rng();
  // Zelfde mirror-bericht als bij een menselijke worp, anders "springt" een CPU-beurt
  // gewoon naar het eindresultaat bij de andere spelers in plaats van te animeren.
  if (MP.active && MP.isHost) {
    mpSend({ type:"turn_animate", pid, d1, d2, wasInJail:!!G.players[pid]?.inJail, jailTurns:G.players[pid]?.jailTurns||0 });
  }
  animateDice(d1,d2,()=>{
    executeMove(pid,d1,d2,_np=>{
      // build houses
      G.players[pid].properties.forEach(sid=>{
        const sp=SPACES[sid];if(sp.type!=="property"||G.mortgaged[sid])return;
        const grp=CGROUPS[sp.color]||[];if(!grp.every(id=>G.owned[id]===pid&&!G.mortgaged[id]))return;
        const h=G.houses[sid]||0;const min=Math.min(...grp.map(id=>G.houses[id]||0));
        if(h>min||h>=5)return;
        if(G.players[pid].money>sp.houseCost*3){G.houses[sid]=(G.houses[sid]||0)+1;G.players[pid]={...G.players[pid],money:G.players[pid].money-sp.houseCost};addLog(`${G.players[pid].name} bouwt huis op ${sp.name}.`,PCOLORS[pid]);}
      });
      // trade
      const tr=computeCPUTrade(pid);
      if(tr&&cpuAcceptsTrade(tr.tid,tr.offer,tr.request,tr.mo,tr.mr)){execTrade(tr.offer,tr.request,tr.mo,tr.mr,pid,tr.tid);addLog(`${G.players[pid].name} ruilt met ${G.players[tr.tid].name}! ✅`,PCOLORS[pid]);}
      G.busy=false;refreshUI();
      setTimeout(()=>handleEndTurn(),400);
    });
  });
}
