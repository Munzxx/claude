// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ─── SAVE / LOAD ─────────────────────────────────────────────────────────────
function loadSlotMeta(){
  G.savedSlots=[0,1,2].map(i=>{
    try{const r=localStorage.getItem(`prx_${i}`);if(!r)return null;const d=JSON.parse(r);return{date:d.date,names:d.players.map(p=>p.name).join(", ")};}catch{return null;}
  });
  // Auto-save slot
  try{
    const r=localStorage.getItem("prx_auto");
    if(r){const d=JSON.parse(r);G.autoSaveSlot={date:d.date,names:d.players?.map(p=>p.name).join(", ")||""};}
    else G.autoSaveSlot=null;
  }catch{G.autoSaveSlot=null;}
}
function loadAutoSave(){
  try{
    const r=localStorage.getItem("prx_auto");
    if(!r){showToast("Geen autosave gevonden.","#f44");return;}
    const d=JSON.parse(r);
    applySaveData(d);
    DOM.app.innerHTML="";DOM.app.style.cssText="height:100%;display:flex;flex-direction:column;";
    showToast("✅ Autosave geladen!","#4caf50");
    buildGameScreen();
    // Vangnet: als de huidige speler een CPU is, start automatisch diens beurt
    if(G.players[G.cur]&&!G.players[G.cur].isHuman&&G.phase==="roll"){
      setTimeout(()=>runCPU(G.cur),700);
    }
  }catch(e){showToast("❌ Autosave laden mislukt.","#f44");}
}

function deleteGame(slot){
  try{
    localStorage.removeItem(`prx_${slot}`);
    G.savedSlots[slot]=null;
    showToast(`🗑️ Slot ${slot+1} verwijderd.`,"#aaa");
    // Refresh whichever panel is open
    if(G.screen==="menu") showMenu();
    else renderOverlays({savePanel:true});
  }catch{showToast("❌ Verwijderen mislukt.","#f44");}
}

function confirmDeleteGame(slot){
  // iOS Safari PWA blocks confirm() — use custom modal instead
  DOM.overlayContainer.innerHTML="";
  const bd=document.createElement("div");
  bd.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  const box=document.createElement("div");
  box.style.cssText="background:#1a0a0a;border:2px solid #7f0000;border-radius:14px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:Georgia,serif;color:#fff;";
  box.innerHTML=`<div style="font-size:28px;margin-bottom:8px">🗑️</div><h3 style="color:#ff4444;margin:0 0 8px;font-size:16px">Slot ${slot+1} verwijderen?</h3><p style="color:#aaa;font-size:13px;margin-bottom:18px">${esc(G.savedSlots[slot]?.names||"")}<br><span style="font-size:11px">${G.savedSlots[slot]?.date||""}</span></p>`;
  const btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:10px;justify-content:center;";
  const cancelBtn=document.createElement("button");cancelBtn.textContent="Annuleren";
  cancelBtn.style.cssText="flex:1;padding:11px 0;background:#333;color:#aaa;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:Georgia,serif;";
  cancelBtn.onclick=()=>{DOM.overlayContainer.innerHTML="";if(G.screen!=="menu")renderOverlays({savePanel:true});};
  const delBtn=document.createElement("button");delBtn.textContent="Verwijderen";
  delBtn.style.cssText="flex:1;padding:11px 0;background:#7f0000;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;font-family:Georgia,serif;";
  delBtn.onclick=()=>deleteGame(slot);
  btnRow.appendChild(cancelBtn);btnRow.appendChild(delBtn);
  box.appendChild(btnRow);bd.appendChild(box);
  DOM.overlayContainer.appendChild(bd);
}

function saveGame(slot){
  try{
    const d={
      schemaVersion:SAVE_SCHEMA_VERSION,
      date:new Date().toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}),
      players:G.players,owned:G.owned,houses:G.houses,mortgaged:G.mortgaged,
      cur:G.cur,phase:G.phase,log:G.log,pawnPos:{...G.pawnPos},freePot:G.freePot,
      chanceIdx:G.chanceIdx,chestIdx:G.chestIdx,
    };
    localStorage.setItem(`prx_${slot}`,JSON.stringify(d));
    G.savedSlots[slot]={date:d.date,names:G.players.map(p=>p.name).join(", ")};
    showToast(`✅ Opgeslagen in slot ${slot+1}!`,"#4caf50");
    renderOverlays();
  }catch{showToast("❌ Opslaan mislukt.","#f44");}
}

// ─── SAVE-COMPATIBILITEIT (v16.0+) ────────────────────────────────────────────
// Eén centrale plek die een geparste save (`d`) omzet naar geldige G-velden.
// Bedoeld om saves die VANAF v16.0 gemaakt zijn ook in latere versies te laten
// laden: als een toekomstige versie een nieuw G-veld toevoegt dat oudere saves
// niet kennen, hoort de fallback daarvoor HIER te komen (via `??`/`||`) — dan
// werkt het meteen voor alle 3 laadpaden (los slot, autosave, MP-lobby) tegelijk,
// in plaats van drie keer los te moeten worden bijgewerkt.
//
// d.schemaVersion volgt de VORM van de data, niet de featureversie (zie
// SAVE_SCHEMA_VERSION hierboven). Voor een ontbrekend veld is een stille,
// verstandige standaardwaarde het uitgangspunt (geen melding aan de speler).
// Mocht een veld ooit niet met een simpele fallback kunnen (bv. van vorm
// veranderen), voeg dan hier een `if(schemaVersion < N){...}` migratieblok toe.
function applySaveData(d){
  const schemaVersion = d.schemaVersion ?? 0; // 0 = van vóór dit systeem (v15.x of ouder)

  G.players = d.players || [];
  G.prevMoney = {}; G.wonPid = null; G.prevOwned = {}; chatReset();

  G.owned = {};
  Object.entries(d.owned||{}).forEach(([k,v])=>{ G.owned[parseInt(k)] = v; });
  G.prevOwned = {...G.owned};

  G.houses = {};
  Object.entries(d.houses||{}).forEach(([k,v])=>{ G.houses[parseInt(k)] = v; });

  G.mortgaged = {};
  Object.entries(d.mortgaged||{}).forEach(([k,v])=>{ G.mortgaged[parseInt(k)] = v; });

  G.cur = d.cur ?? 0;
  G.phase = d.phase || "roll";
  G.log = d.log || [];

  G.pawnPos = {};
  Object.entries(d.pawnPos||{}).forEach(([k,v])=>{ G.pawnPos[parseInt(k)] = v; });
  // Vangnet: elke speler moet een pawnPos hebben, ook als een save die (nog) niet meegaf
  G.players.forEach((p,i)=>{ if (G.pawnPos[i]==null) G.pawnPos[i] = p?.pos || 0; });

  G.freePot = d.freePot || 0;
  G.chanceIdx = d.chanceIdx || 0;
  G.chestIdx = d.chestIdx || 0;
  G.busy = false;

  return schemaVersion;
}

function loadGame(slot){
  try{
    const r=localStorage.getItem(`prx_${slot}`);
    if(!r){showToast("❌ Geen save gevonden.","#f44");return;}
    const d=JSON.parse(r);
    applySaveData(d);
    DOM.app.innerHTML="";
    DOM.app.style.cssText="height:100%;display:flex;flex-direction:column;";
    showToast("✅ Spel geladen!","#4caf50");
    buildGameScreen();
    // Vangnet: als de huidige speler een CPU is, start automatisch diens beurt
    if(G.players[G.cur]&&!G.players[G.cur].isHuman&&G.phase==="roll"){
      setTimeout(()=>runCPU(G.cur),700);
    }
  }catch{showToast("❌ Laden mislukt.","#f44");}
}

function autoSave(){
  try{
    // Bewaar de VOLGENDE speler (na deze beurt) i.p.v. de huidige,
    // zodat een geladen autosave altijd netjes bij "roll" van de juiste speler begint.
    const active=G.players.filter(p=>!p.bankrupt);
    let nextCur=G.cur;
    if(active.length>1){
      nextCur=(G.cur+1)%G.players.length;
      while(G.players[nextCur]?.bankrupt) nextCur=(nextCur+1)%G.players.length;
    }
    const d={
      schemaVersion:SAVE_SCHEMA_VERSION,
      date:new Date().toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}),
      players:G.players,owned:G.owned,houses:G.houses,mortgaged:G.mortgaged,
      cur:nextCur,phase:"roll",log:G.log.slice(-20),pawnPos:{...G.pawnPos},freePot:G.freePot,
      chanceIdx:G.chanceIdx,chestIdx:G.chestIdx,
    };
    localStorage.setItem("prx_auto",JSON.stringify(d));
  }catch(e){}
}
