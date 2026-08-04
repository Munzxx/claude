// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ─── STATE ────────────────────────────────────────────────────────────────────
let G={
  screen:"menu",numPlayers:2,playerSetup:null, // playerSetup: [{name,isHuman}]
  players:[],owned:{},houses:{},mortgaged:{},
  cur:0,pawnPos:{},dice:[1,1],
  phase:"roll",log:[],freePot:0,
  chanceCards:shuffle(CHANCE),chestCards:shuffle(CHEST),chanceIdx:0,chestIdx:0,
  savedSlots:[null,null,null],
  autoSaveSlot:null,
  _needsSecondLanding:false, // interne vlag: heeft kaart-verplaatsing nog een landing-check nodig?
  _activeOverlay:null, // welk scherm nu open is ("manage"/"rescue"/null) — zodat een
                        // binnenkomende MP-sync dat scherm live kan verversen
  // animation lock — pawn can only move when this is false
  busy:false,
};

// ─── MULTIPLAYER STATE ───────────────────────────────────────────────────────
const MP = {
  active: false,      // is multiplayer session active
  isHost: false,      // am I the host?
  peer: null,         // our PeerJS instance
  connections: [],    // host: list of DataConnections to clients
  hostConn: null,     // client: DataConnection to host
  myPid: 0,           // which player index am I?
  roomCode: null,     // 4-digit room code
  status: "",         // status message for UI
  roster: [],         // [{name,isHuman}] — enige bron van waarheid voor spelersnamen in de lobby,
                       // gesynchroniseerd via echte berichten (client_hello / roster_update),
                       // losstaand van G.playerSetup (dat is voor lokaal pass-and-play)
  animatingPid: null,  // client: pid waarvan de dobbel/loop-animatie nu lokaal wordt nagespeeld
  pendingSync: null,   // client: binnengekomen sync die wacht tot de animatie klaar is
  cpuSlots: [],         // host: door de host toegevoegde CPU-spelers, komen ná de echte connecties
  reconnecting: false,  // client: is er nu een hersteltoging aan de gang?
  reconnectDeadline: 0, // client: timestamp waarop de hersteltogingen worden opgegeven
};

// ─── CHAT STATE ───────────────────────────────────────────────────────────────
// Alleen actief tijdens online multiplayer (MP.active). Niet persistent — nooit
// opgeslagen in save-files en niet onderdeel van mpSyncState()/mpApplySync(),
// want chat is per-sessie en geen spelstatus. Wordt gereset op elk "vers spel"
// aanknopingspunt (zelfde plekken als G.prevMoney/G.wonPid/G.prevOwned) en bij mpReset().
const CHAT = {
  open: false,        // is het paneel nu uitgeklapt
  activeTab: "group",  // "group" of een pid (als string) voor een 1-op-1 gesprek
  threads: { group: [] }, // per thread-key een array van {from,name,text,ts}
  unread: { group: 0 },   // ongelezen-teller per thread-key
};

// ─── DOM LAYER REFERENCES ────────────────────────────────────────────────────
// We keep persistent DOM nodes so we never rebuild the board during animation
let DOM={
  app:null,          // #app root
  screen:null,       // current top-level screen element
  // game screen layers (persistent after game starts)
  topBar:null,
  boardScroll:null,
  boardDiv:null,
  bottomBar:null,
  overlayContainer:null,
  // per-space cells (id -> element)
  cells:{},
  // per-player pawn elements (index -> element)
  pawns:[],
  // center panel elements
  dieEls:[null,null],
  diceLabel:null,
  freePotLabel:null,
  // chat — persistent on document.body (net als overlayContainer), gebouwd één keer
  // bij boot zodat modals (die overlayContainer legen) 'm nooit wegvegen
  chatContainer:null,
  chatToggleBtn:null,
  chatBadge:null,
  chatPanel:null,
  chatTabsRow:null,
  chatMessages:null,
  chatInput:null,
  // niet-blokkerende statusbalk bovenaan tijdens een hersteltoging — lazy gebouwd
  // bij het eerste gebruik (in tegenstelling tot chat, die altijd nodig kan zijn
  // tijdens een online spel, komt dit zelden voor)
  reconnectBanner:null,
};
