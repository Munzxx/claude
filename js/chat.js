// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
function chatReset(){
  CHAT.open=false; CHAT.activeTab="group";
  CHAT.threads={group:[]}; CHAT.unread={group:0};
}

// ─── CHAT: verzenden ──────────────────────────────────────────────────────────
// toPid: null = groepschat (iedereen), of een spelerid voor een 1-op-1 bericht.
// Host: bewaart+toont lokaal meteen, en relayt naar de juiste verbinding(en).
// Client: stuurt naar de host (die relayt/bewaart correct) en toont zelf ook
// meteen lokaal (optimistisch), zodat je je eigen bericht niet ziet "wachten".
function chatSend(text, toPid){
  text = String(text||"").trim().slice(0,300);
  if(!text || !MP.active) return;
  const myName = G.players[MP.myPid]?.name || MP.roster[MP.myPid]?.name || "Speler";
  const msg = { from: MP.myPid, name: myName, text, ts: Date.now() };
  const threadKey = (toPid==null) ? "group" : String(toPid);
  chatStore(threadKey, msg, false); // eigen bericht — telt niet als ongelezen
  if (MP.isHost) {
    if (toPid==null) {
      MP.connections.forEach(c=>{ try{ c.send({type:"chat",from:MP.myPid,to:null,name:myName,text,ts:msg.ts}); }catch(e){} });
    } else if (toPid !== MP.myPid) {
      const c = MP.connections[toPid-1];
      if (c) { try{ c.send({type:"chat",from:MP.myPid,to:toPid,name:myName,text,ts:msg.ts}); }catch(e){} }
    }
  } else {
    mpSend({ type:"chat_send", to: toPid ?? null, text });
  }
}

// Bewaart een bericht in de juiste thread en werkt de ongelezen-teller/UI bij.
// incoming=true betekent: niet mijn eigen zojuist verstuurde bericht, dus telt
// mee voor de ongelezen-badge als het paneel dicht is of een andere tab open staat.
function chatStore(threadKey, msg, incoming){
  if (!CHAT.threads[threadKey]) CHAT.threads[threadKey] = [];
  CHAT.threads[threadKey].push(msg);
  if (CHAT.threads[threadKey].length > 200) CHAT.threads[threadKey] = CHAT.threads[threadKey].slice(-200);
  if (incoming && (!CHAT.open || CHAT.activeTab !== threadKey)) {
    CHAT.unread[threadKey] = (CHAT.unread[threadKey]||0) + 1;
  }
  chatRenderBadge();
  if (CHAT.open && CHAT.activeTab === threadKey) chatRenderMessages();
}

// ─── CHAT UI ─────────────────────────────────────────────────────────────────
// Persistent op document.body (net als DOM.overlayContainer), één keer gebouwd bij
// boot — NIET binnen buildGameScreen()/DOM.app, want die worden bij elk (her)starten
// van een spel geleegd, en modals legen DOM.overlayContainer bij het openen. Zichtbaarheid
// wordt aan/uit gezet via chatShow()/chatHide(), gestuurd door MP.active.
let chatTabEls = {}; // key -> {btn,dot} — voor het bijwerken van actieve tab/ongelezen-stip

function chatBuildDOM(){
  DOM.chatContainer=document.createElement("div");
  DOM.chatContainer.style.display="none";

  DOM.chatToggleBtn=document.createElement("button");
  DOM.chatToggleBtn.className="chat-toggle-btn";
  DOM.chatToggleBtn.textContent="💬";
  DOM.chatToggleBtn.onclick=chatToggle;
  DOM.chatBadge=document.createElement("span");
  DOM.chatBadge.className="chat-badge";
  DOM.chatBadge.style.display="none";
  DOM.chatToggleBtn.appendChild(DOM.chatBadge);

  DOM.chatPanel=document.createElement("div");
  DOM.chatPanel.className="chat-panel";

  const header=document.createElement("div");
  header.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;flex-shrink:0;";
  const title=document.createElement("div");
  title.style.cssText="font-weight:bold;color:#FFD700;font-size:14px;font-family:Georgia,serif;";
  title.textContent="💬 Chat";
  const closeBtn=document.createElement("button");
  closeBtn.textContent="✕";
  closeBtn.style.cssText="background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:4px 8px;";
  closeBtn.onclick=chatClose;
  header.appendChild(title);header.appendChild(closeBtn);

  DOM.chatTabsRow=document.createElement("div");
  DOM.chatTabsRow.style.cssText="display:flex;gap:6px;overflow-x:auto;padding:0 14px 10px;flex-shrink:0;";

  DOM.chatMessages=document.createElement("div");
  DOM.chatMessages.style.cssText="flex:1;overflow-y:auto;padding:4px 14px;display:flex;flex-direction:column;min-height:120px;";

  const inputRow=document.createElement("div");
  inputRow.style.cssText="display:flex;gap:8px;padding:10px 14px 14px;flex-shrink:0;";
  DOM.chatInput=document.createElement("input");
  DOM.chatInput.type="text";DOM.chatInput.placeholder="Typ een bericht...";DOM.chatInput.maxLength=300;
  DOM.chatInput.style.cssText="flex:1;padding:9px 12px;font-size:13px;background:#1a3a1a;color:#fff;border:1px solid #4a8a4a;border-radius:20px;font-family:Georgia,serif;";
  DOM.chatInput.addEventListener("keydown",(e)=>{if(e.key==="Enter"){e.preventDefault();chatSendFromInput();}});
  const sendBtn=document.createElement("button");
  sendBtn.textContent="➤";
  sendBtn.style.cssText="width:40px;height:40px;border-radius:50%;background:#FFD700;color:#000;border:none;font-size:15px;cursor:pointer;flex-shrink:0;";
  sendBtn.onclick=chatSendFromInput;
  inputRow.appendChild(DOM.chatInput);inputRow.appendChild(sendBtn);

  DOM.chatPanel.appendChild(header);
  DOM.chatPanel.appendChild(DOM.chatTabsRow);
  DOM.chatPanel.appendChild(DOM.chatMessages);
  DOM.chatPanel.appendChild(inputRow);
  DOM.chatContainer.appendChild(DOM.chatToggleBtn);
  DOM.chatContainer.appendChild(DOM.chatPanel);
  document.body.appendChild(DOM.chatContainer);
}

function chatSendFromInput(){
  if(!DOM.chatInput)return;
  const text=DOM.chatInput.value;
  if(!text.trim())return;
  const toPid=CHAT.activeTab==="group"?null:parseInt(CHAT.activeTab,10);
  chatSend(text,toPid);
  DOM.chatInput.value="";
}

// Bouwt de tabs opnieuw op basis van de huidige spelerslijst — wordt één keer per
// spelsessie aangeroepen (vanuit buildGameScreen), want de spelerslijst ligt vast
// zodra een online spel gestart is (geen mid-game joins in deze architectuur).
function chatRebuildTabs(){
  if(!DOM.chatTabsRow)return;
  DOM.chatTabsRow.innerHTML="";
  chatTabEls={};
  DOM.chatTabsRow.appendChild(chatMakeTab("group","Groep"));
  G.players.forEach((p,i)=>{
    if(i===MP.myPid||!p.isHuman)return; // geen DM-tab naar jezelf of naar CPU's
    DOM.chatTabsRow.appendChild(chatMakeTab(String(i),p.name));
  });
  if(!CHAT.threads[CHAT.activeTab])CHAT.activeTab="group";
  chatRenderBadge();
}
function chatMakeTab(key,label){
  const b=document.createElement("button");
  b.className="chat-tab"+(CHAT.activeTab===key?" chat-tab-active":"");
  b.textContent=label;
  b.onclick=()=>chatSwitchTab(key);
  const dot=document.createElement("span");
  dot.className="chat-tab-dot";dot.style.display="none";
  b.appendChild(dot);
  chatTabEls[key]={btn:b,dot:dot};
  return b;
}
function chatRenderTabDots(){
  Object.entries(chatTabEls).forEach(([key,els])=>{
    els.btn.classList.toggle("chat-tab-active",CHAT.activeTab===key);
    els.dot.style.display=(CHAT.unread[key]>0)?"block":"none";
  });
}
function chatSwitchTab(key){
  CHAT.activeTab=key;
  CHAT.unread[key]=0;
  chatRenderTabDots();
  chatRenderBadge();
  chatRenderMessages();
}
function chatRenderMessages(){
  if(!DOM.chatMessages)return;
  const msgs=CHAT.threads[CHAT.activeTab]||[];
  if(!msgs.length){
    DOM.chatMessages.innerHTML=`<div style="text-align:center;color:#555;font-size:11px;padding:20px 0;font-family:Georgia,serif;">Nog geen berichten.</div>`;
    return;
  }
  DOM.chatMessages.innerHTML=msgs.map(m=>{
    const mine=m.from===MP.myPid;
    const nameLbl=mine?"":`<div class="chat-bubble-name">${esc(m.name)}</div>`;
    return `<div class="chat-bubble ${mine?"chat-bubble-mine":"chat-bubble-theirs"}">${nameLbl}${esc(m.text)}</div>`;
  }).join("");
  DOM.chatMessages.scrollTop=DOM.chatMessages.scrollHeight;
}
function chatRenderBadge(){
  if(!DOM.chatBadge)return;
  const total=Object.values(CHAT.unread).reduce((a,b)=>a+(b||0),0);
  if(total>0&&!CHAT.open){
    DOM.chatBadge.textContent=total>9?"9+":String(total);
    DOM.chatBadge.style.display="flex";
  }else{
    DOM.chatBadge.style.display="none";
  }
  chatRenderTabDots();
}
function chatOpen(){
  CHAT.open=true;
  if(DOM.chatPanel)DOM.chatPanel.classList.add("chat-panel-open");
  CHAT.unread[CHAT.activeTab]=0;
  chatRenderTabDots();chatRenderBadge();chatRenderMessages();
}
function chatClose(){
  CHAT.open=false;
  if(DOM.chatPanel)DOM.chatPanel.classList.remove("chat-panel-open");
  chatRenderBadge();
}
function chatToggle(){if(CHAT.open)chatClose();else chatOpen();}
// Toont/verbergt de complete chat-UI (knop+paneel) — alleen tijdens online spel
function chatShow(){if(DOM.chatContainer)DOM.chatContainer.style.display="block";}
function chatHide(){if(DOM.chatContainer)DOM.chatContainer.style.display="none";chatClose();}
