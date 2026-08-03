// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ── MULTIPLAYER HELPERS ───────────────────────────────────────────────────────
function mpSend(data) {
  if (!MP.active) return;
  if (MP.isHost) {
    // Host broadcasts to all clients
    MP.connections.forEach(conn => { try { conn.send(data); } catch(e){} });
  } else {
    // Client sends to host
    try { MP.hostConn.send(data); } catch(e) {}
  }
}

function mpSyncState() {
  // Host sends full game state to all clients
  if (!MP.isHost) return;
  mpSend({
    type: "sync",
    state: {
      players: G.players, owned: G.owned, houses: G.houses,
      mortgaged: G.mortgaged, cur: G.cur, phase: G.phase,
      log: G.log.slice(-20), pawnPos: {...G.pawnPos}, freePot: G.freePot,
      dice: G.dice, busy: G.busy,
    }
  });
}

function mpApplySync(state) {
  // Als er nu een lokale spiegel-animatie loopt (dobbelstenen/pion van de andere
  // speler), bufferen we deze sync — anders "springt" het bord midden in de
  // animatie naar de eindstatus. Zodra de animatie klaar is, passen we hem alsnog toe.
  if (MP.animatingPid != null) {
    MP.pendingSync = state;
    return;
  }
  mpApplySyncNow(state);
}

function mpApplySyncNow(state) {
  // Client applies state received from host
  G.players = state.players;
  G.owned = {}; Object.entries(state.owned||{}).forEach(([k,v])=>{G.owned[parseInt(k)]=v;});
  G.houses = {}; Object.entries(state.houses||{}).forEach(([k,v])=>{G.houses[parseInt(k)]=v;});
  G.mortgaged = {}; Object.entries(state.mortgaged||{}).forEach(([k,v])=>{G.mortgaged[parseInt(k)]=v;});
  G.cur = state.cur; G.phase = state.phase; G.freePot = state.freePot;
  G.log = state.log || []; G.dice = state.dice || [1,1]; G.busy = state.busy;
  // Animate pawns to new positions
  Object.entries(state.pawnPos||{}).forEach(([k,v])=>{
    const pid = parseInt(k);
    if (G.pawnPos[pid] !== v) {
      G.pawnPos[pid] = v;
      placePawn(pid, v);
    }
  });
  scrollToPos(G.pawnPos[G.cur] ?? 0);
  refreshUI();
  // Als er een geopend beheer/rescue-scherm is, ververs die met de nieuwe status
  if (G._activeOverlay === "manage") renderManageModal();
  else if (G._activeOverlay === "rescue") renderRescueModal();
  // Nieuw rescue-scherm automatisch openen, maar alleen bij de speler die het aangaat
  else if (G.phase === "rescue" && G.cur === MP.myPid) renderOverlays({rescue:true});
}

function mpHandleMessage(data, fromConn) {
  if (!data || !data.type) return;
  if (MP.isHost) {
    // Host verwerkt handshake van een nieuwe client
    if (data.type === "client_hello") {
      const pid = MP.connections.indexOf(fromConn) + 1; // 1-based
      MP.roster[pid] = { name: sanitizeName(data.name) || `Speler ${pid+1}`, isHuman: true };
      // Stuur de VOLLEDIGE roster naar iedereen zodat alle lobbies synchroon lopen
      mpBroadcastRoster();
      renderMPLobby();
      return;
    }
    // Host receives actions from clients
    if (data.type === "action") {
      const { action, payload } = data;
      // Only process if it's that client's turn
      const senderPid = MP.connections.indexOf(fromConn) + 1;
      if (G.cur !== senderPid) return;
      if (action === "roll")     handleRoll();
      else if (action === "buy") handleBuy();
      else if (action === "skip") handleSkip();
      else if (action === "endturn") handleEndTurn();
      else if (action === "bailout") handleBailOut();
      else if (action === "build" && payload?.sid != null) doBuild(payload.sid);
      else if (action === "sell"  && payload?.sid != null) doSell(payload.sid);
      else if (action === "mortgage" && payload?.sid != null) doMortgage(payload.sid);
      else if (action === "unmortgage" && payload?.sid != null) doUnmortgage(payload.sid);
      else if (action === "trade_submit" && payload) {
        tradeDraft = payload.draft;
        submitTrade();
      }
      else if (action === "trade_confirm" && payload) {
        execTrade(payload.offerIds,payload.reqIds,payload.mo,payload.mr,payload.fromId,payload.toId);
        addLog("Ruil geaccepteerd! ✅","#4caf50");
        refreshUI(); // syncen gebeurt al automatisch binnen refreshUI() voor de host
      }
      else if (action === "trade_reject") {
        addLog("Ruil geweigerd.","#888");
        refreshUI();
      }
      else if (action === "bankrupt_self") declareBankrupt(senderPid);
    }
    // Chat is geen spelstatus-actie (geen beurt-check nodig) — apart afgehandeld.
    if (data.type === "chat_send") {
      const senderPid = MP.connections.indexOf(fromConn) + 1;
      const text = String(data.text||"").trim().slice(0,300);
      if (!text) return;
      const toPid = data.to ?? null;
      const senderName = G.players[senderPid]?.name || MP.roster[senderPid]?.name || `Speler ${senderPid+1}`;
      const msg = { from: senderPid, name: senderName, text, ts: Date.now() };
      if (toPid == null) {
        // Groep: relay naar iedereen BEHALVE de afzender zelf (die toonde het al optimistisch)
        MP.connections.forEach(c=>{ if (c!==fromConn) { try{ c.send({type:"chat",from:senderPid,to:null,name:senderName,text,ts:msg.ts}); }catch(e){} } });
        chatStore("group", msg, true);
      } else if (toPid === MP.myPid) {
        // DM gericht aan de host zelf
        chatStore(String(senderPid), msg, true);
      } else {
        const c = MP.connections[toPid-1];
        if (c) { try{ c.send({type:"chat",from:senderPid,to:toPid,name:senderName,text,ts:msg.ts}); }catch(e){} }
      }
    }
  } else {
    // Client receives from host
    if (data.type === "sync") mpApplySync(data.state);
    else if (data.type === "turn_animate") {
      // Host stuurt dit VOORDAT hij zelf begint te animeren — wij spelen
      // exact dezelfde dobbelsteen- en loopanimatie lokaal na, zodat beide
      // spelers hetzelfde zien gebeuren, in plaats van alleen het eindresultaat.
      const { pid, d1, d2, wasInJail, jailTurns } = data;
      const fromPos = G.players[pid]?.pos ?? 0;
      // Zelfde regel als in executeMove(): in de cel blijven zitten (geen dubbel,
      // nog geen 3e mislukte poging) betekent geen pion-beweging — anders leek het
      // bij de andere speler alsof iemand vrolijk over het bord liep terwijl die
      // gewoon vastzat.
      const staysInJail = wasInJail && d1!==d2 && jailTurns<2;
      MP.animatingPid = pid;
      animateDice(d1, d2, () => {
        if(staysInJail){
          MP.animatingPid = null;
          if (MP.pendingSync) { const s = MP.pendingSync; MP.pendingSync = null; mpApplySyncNow(s); }
          return;
        }
        animatePawn(pid, fromPos, d1+d2, () => {
          MP.animatingPid = null;
          // Als er ondertussen een sync is binnengekomen, verwerk die nu alsnog
          if (MP.pendingSync) { const s = MP.pendingSync; MP.pendingSync = null; mpApplySyncNow(s); }
        });
      });
    }
    else if (data.type === "roster_update") {
      // Host stuurt de volledige, actuele deelnemerslijst — dit is de
      // enige bron van waarheid, overschrijft lokale placeholder-namen
      MP.roster = data.roster || [];
      MP.cpuSlots = data.cpuSlots || [];
      renderMPLobby();
    }
    else if (data.type === "your_pid") {
      // Host vertelt ons welk spelernummer we hebben gekregen
      MP.myPid = data.pid;
      renderMPLobby();
    }
    else if (data.type === "trade_request") {
      // Host is asking client to confirm a trade
      G.tradeRequest = data;
      renderOverlays({tradeConfirmMP: data});
    }
    else if (data.type === "chat") {
      const threadKey = (data.to==null) ? "group" : String(data.from);
      chatStore(threadKey, { from:data.from, name:data.name, text:data.text, ts:data.ts }, true);
    }
    else if (data.type === "card_reveal") {
      showCardFlip(data.opts);
    }
    else if (data.type === "player_joined") {
      showToast(`${data.name} heeft de lobby betreden!`, "#4caf50");
    }
    else if (data.type === "game_start") {
      MP.myPid = data.pid; // definitief spelernummer bij start
      MP.active = true;    // was nooit gezet op de client — brak alle beurt-gating
      // Zet de status RECHTSTREEKS (niet via mpApplySync/refreshUI), want die
      // functies verwachten bestaande spel-DOM elementen (topBar/bord/pionnen/etc)
      // — die bestaan bij de gast nog niet, hij zat immers nog in de lobby.
      // Eerst status zetten, DAN de DOM bouwen op basis daarvan.
      const st = data.state;
      G.players = st.players; G.prevMoney = {}; G.wonPid = null; chatReset();
      G.owned = {}; Object.entries(st.owned||{}).forEach(([k,v])=>{G.owned[parseInt(k)]=v;});
      G.prevOwned = {...G.owned};
      G.houses = {}; Object.entries(st.houses||{}).forEach(([k,v])=>{G.houses[parseInt(k)]=v;});
      G.mortgaged = {}; Object.entries(st.mortgaged||{}).forEach(([k,v])=>{G.mortgaged[parseInt(k)]=v;});
      G.cur = st.cur; G.phase = st.phase||"roll"; G.freePot = st.freePot||0;
      G.log = st.log || []; G.dice = st.dice || [1,1]; G.busy = st.busy||false;
      G.pawnPos = {}; Object.entries(st.pawnPos||{}).forEach(([k,v])=>{G.pawnPos[parseInt(k)]=v;});
      DOM.app.innerHTML = "";
      DOM.app.style.cssText = "height:100%;display:flex;flex-direction:column;";
      DOM.overlayContainer.innerHTML = ""; // sluit het lobby-scherm, dat stond los als overlay
      buildGameScreen(); // bouwt nu de DOM correct op basis van de al-gezette status
    }
    else if (data.type === "kicked") {
      mpReset();
      showToast("Je bent uit het spel verwijderd.", "#f44");
      showMenu();
    }
  }
}

// Host: broadcast de volledige roster naar alle verbonden clients
function mpBroadcastRoster() {
  if (!MP.isHost) return;
  MP.connections.forEach(c => { try { c.send({ type:"roster_update", roster: MP.roster, cpuSlots: MP.cpuSlots }); } catch(e){} });
}

// Client sends an action to host
function mpAction(action, payload) {
  if (!MP.active) return;
  if (MP.isHost) {
    // Host acts directly — no round-trip needed
  } else {
    mpSend({ type: "action", action, payload });
  }
}

// Universele router voor alle acties die de spelstatus muteren (huizen bouwen/
// verkopen, hypotheek, vrijkopen, etc). Client: stuurt de actie naar de host en
// voert NIETS lokaal uit (voorkomt dat lokale wijzigingen straks door de
// volgende sync worden overschreven — dat was de kern van het "elkaars speler
// besturen"-probleem). Host of offline spel: voert gewoon direct lokaal uit.
function mpDo(action, payload, localFn) {
  if (MP.active && !MP.isHost) {
    mpAction(action, payload);
  } else {
    localFn();
  }
}

function mpReset() {
  if (MP.peer) { try { MP.peer.destroy(); } catch(e){} }
  MP.active = false; MP.isHost = false; MP.peer = null;
  MP.connections = []; MP.hostConn = null;
  MP.myPid = 0; MP.roomCode = null; MP.status = ""; MP.cpuSlots = [];
  chatReset(); chatHide();
}

// Generate short room code from PeerJS id
function makeRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ── HOST: Create room ─────────────────────────────────────────────────────────
function mpCreateRoom(playerName) {
  const code = makeRoomCode();
  MP.roomCode = code;
  MP.isHost = true;
  MP.myPid = 0;
  MP.status = "Lobby aanmaken...";
  MP.roster = [{ name: playerName || "Host", isHuman: true }]; // host is altijd pid 0
  renderMPLobby();

  MP.peer = new Peer("propertix-" + code, {
    host: "0.peerjs.com", port: 443, path: "/", secure: true,
    debug: 0,
  });

  MP.peer.on("open", () => {
    MP.status = "Lobby actief";
    renderMPLobby();
  });

  MP.peer.on("connection", (conn) => {
    conn.on("open", () => {
      MP.connections.push(conn);
      const pid = MP.connections.length; // 1-based voor clients
      conn.metadata = { pid };
      // Naam komt pas binnen via het "client_hello" bericht (zie mpHandleMessage) —
      // tot die tijd een tijdelijke placeholder in de roster zodat de lijst klopt qua aantal
      if (!MP.roster[pid]) MP.roster[pid] = { name: `Speler ${pid+1}`, isHuman: true };
      // Vertel de nieuwe client meteen zijn eigen spelernummer
      conn.send({ type: "your_pid", pid });
      renderMPLobby();
    });
    conn.on("data", (data) => mpHandleMessage(data, conn));
    conn.on("close", () => {
      const idx = MP.connections.indexOf(conn);
      MP.connections = MP.connections.filter(c => c !== conn);
      if (idx >= 0) MP.roster.splice(idx+1, 1); // verwijder uit roster
      mpBroadcastRoster();
      renderMPLobby();
    });
  });

  MP.peer.on("error", (err) => {
    MP.status = "Fout: " + err.type;
    showToast("Verbindingsfout: " + err.type, "#f44");
    renderMPLobby();
  });
}

// ── CLIENT: Join room ─────────────────────────────────────────────────────────
function mpJoinRoom(code, playerName) {
  MP.isHost = false;
  MP.roomCode = code;
  MP.status = "Verbinden...";
  renderMPLobby();

  MP.peer = new Peer(undefined, {
    host: "0.peerjs.com", port: 443, path: "/", secure: true, debug: 0,
  });

  MP.peer.on("open", (id) => {
    const conn = MP.peer.connect("propertix-" + code, {
      metadata: { name: playerName },
      reliable: true,
    });
    MP.hostConn = conn;

    conn.on("open", () => {
      MP.status = "Verbonden met lobby";
      conn.send({ type: "client_hello", name: playerName });
      renderMPLobby();
    });
    conn.on("data", (data) => mpHandleMessage(data, conn));
    conn.on("close", () => {
      MP.status = "Verbinding verbroken";
      showToast("Verbinding met host verbroken.", "#f44");
      mpReset(); showMenu();
    });
  });

  MP.peer.on("error", (err) => {
    MP.status = "Kan niet verbinden. Controleer de code.";
    showToast("Kan niet verbinden: " + err.type, "#f44");
    renderMPLobby();
  });
}

// ── HOST: Start the multiplayer game ─────────────────────────────────────────
// Stuurt de HUIDIGE (host-)spelstatus als "game_start" naar alle verbonden
// clients. Herbruikt zowel bij een gloednieuw spel als bij het laden van een
// opgeslagen spel — in beide gevallen moet elke client exact dezelfde status
// krijgen als waarmee de host net is begonnen.
function mpBroadcastGameStart(){
  if(!MP.isHost) return;
  MP.connections.forEach((conn, i) => {
    conn.send({ type: "game_start", pid: i+1, state: {
      players: G.players, owned: G.owned, houses: G.houses,
      mortgaged: G.mortgaged, cur: G.cur, phase: G.phase,
      log: G.log, pawnPos: {...G.pawnPos}, freePot: G.freePot,
      dice: G.dice, busy: G.busy,
    }});
  });
}

function mpStartGame() {
  if (!MP.isHost) return;
  const numPlayers = 1 + MP.connections.length;
  // Build playerSetup direct vanuit MP.roster — de enige correcte bron van namen,
  // want die is gesynchroniseerd via echte client_hello handshakes
  G.playerSetup = Array.from({length: numPlayers}, (_,i) => ({
    name: MP.roster[i]?.name || (i===0 ? "Host" : `Speler ${i+1}`),
    isHuman: true,
  }));
  // Door de host toegevoegde CPU's komen er ACHTERAAN bij, zodat de al-vaststaande
  // pid's van de echte (verbonden) spelers niet verschuiven.
  MP.cpuSlots.forEach(cpu => G.playerSetup.push({ name: cpu.name, isHuman: false }));
  MP.active = true;
  startGame();
  // After startGame builds state, sync to all clients (pid staat al vast sinds connectie)
  setTimeout(mpBroadcastGameStart, 500);
}

// Host laadt een lokaal opgeslagen spel (of de autosave) en stuurt die status
// naar ALLE verbonden spelers, zodat iedereen tegelijk met hetzelfde spel verder gaat.
function mpLoadSavedGame(slotOrAuto){
  if(!MP.isHost) return;
  try{
    const key = slotOrAuto==="auto" ? "prx_auto" : `prx_${slotOrAuto}`;
    const r=localStorage.getItem(key);
    if(!r){showToast("Geen opgeslagen spel gevonden.","#f44");return;}
    const d=JSON.parse(r);

    const numConnected = 1 + MP.connections.length;
    if(!d.players || d.players.length !== numConnected){
      showToast(`⚠️ Deze save heeft ${d.players?.length||0} spelers, maar er zijn nu ${numConnected} verbonden. Aantal moet gelijk zijn.`,"#f44");
      return;
    }

    applySaveData(d);

    MP.active=true;
    DOM.overlayContainer.innerHTML=""; // sluit de lobby
    DOM.app.innerHTML="";
    DOM.app.style.cssText="height:100%;display:flex;flex-direction:column;";
    buildGameScreen();

    showToast("✅ Opgeslagen spel geladen voor iedereen!","#4caf50");
    setTimeout(mpBroadcastGameStart, 500);
  }catch(e){showToast("❌ Laden mislukt.","#f44");}
}

// Patch existing action handlers to sync after each action
function mpWrapHandlers() {
  const orig = {
    roll: handleRoll, buy: handleBuy, skip: handleSkip,
    endTurn: handleEndTurn, bailOut: handleBailOut,
  };
  // After any state-changing action on host, sync to clients
  // We do this by hooking into refreshUI
  const origRefreshUI = refreshUI;
  window._refreshUI = origRefreshUI;
}
