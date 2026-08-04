// Onderdeel van Propertix — geladen via <script src> in propertix.html, deelt globale scope met de andere JS-bestanden (geen modules).
// ─── GAME DATA ────────────────────────────────────────────────────────────────
const SPACES=[
  {id:0,name:"START",type:"go",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:1,name:"Brugstraat",type:"property",color:"brown",price:60,rent:[2,10,30,90,160,250],houseCost:50,mortgage:30},
  {id:2,name:"Gemeentekas",type:"chest",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:3,name:"Kortstraat",type:"property",color:"brown",price:60,rent:[4,20,60,180,320,450],houseCost:50,mortgage:30},
  {id:4,name:"Inkoms.bel.",type:"tax",color:null,price:0,rent:[200],houseCost:0,mortgage:0},
  {id:5,name:"Station Noord",type:"railroad",color:"gray",price:200,rent:[25,50,100,200],houseCost:0,mortgage:100},
  {id:6,name:"Nieuwstraat",type:"property",color:"lblue",price:100,rent:[6,30,90,270,400,550],houseCost:50,mortgage:50},
  {id:7,name:"Kans",type:"chance",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:8,name:"Kerkstraat",type:"property",color:"lblue",price:100,rent:[6,30,90,270,400,550],houseCost:50,mortgage:50},
  {id:9,name:"Hoogstraat",type:"property",color:"lblue",price:120,rent:[8,40,100,300,450,600],houseCost:50,mortgage:60},
  {id:10,name:"Gevangenis",type:"jail",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:11,name:"Botermarkt",type:"property",color:"pink",price:140,rent:[10,50,150,450,625,750],houseCost:100,mortgage:70},
  {id:12,name:"Elektriciteit",type:"utility",color:"white",price:150,rent:[0],houseCost:0,mortgage:75},
  {id:13,name:"Kaasmarkt",type:"property",color:"pink",price:140,rent:[10,50,150,450,625,750],houseCost:100,mortgage:70},
  {id:14,name:"Bloemmarkt",type:"property",color:"pink",price:160,rent:[12,60,180,500,700,900],houseCost:100,mortgage:80},
  {id:15,name:"Station Oost",type:"railroad",color:"gray",price:200,rent:[25,50,100,200],houseCost:0,mortgage:100},
  {id:16,name:"Venestraat",type:"property",color:"orange",price:180,rent:[14,70,200,550,750,950],houseCost:100,mortgage:90},
  {id:17,name:"Gemeentekas",type:"chest",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:18,name:"Waterstraat",type:"property",color:"orange",price:180,rent:[14,70,200,550,750,950],houseCost:100,mortgage:90},
  {id:19,name:"Rembrandtpl.",type:"property",color:"orange",price:200,rent:[16,80,220,600,800,1000],houseCost:100,mortgage:100},
  {id:20,name:"Vrij Parkeren",type:"free",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:21,name:"Leidsestr.",type:"property",color:"red",price:220,rent:[18,90,250,700,875,1050],houseCost:150,mortgage:110},
  {id:22,name:"Kans",type:"chance",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:23,name:"Spiegelstr.",type:"property",color:"red",price:220,rent:[18,90,250,700,875,1050],houseCost:150,mortgage:110},
  {id:24,name:"Prinsengracht",type:"property",color:"red",price:240,rent:[20,100,300,750,925,1100],houseCost:150,mortgage:120},
  {id:25,name:"Station Zuid",type:"railroad",color:"gray",price:200,rent:[25,50,100,200],houseCost:0,mortgage:100},
  {id:26,name:"Keizersgracht",type:"property",color:"yellow",price:260,rent:[22,110,330,800,975,1150],houseCost:150,mortgage:130},
  {id:27,name:"Herengracht",type:"property",color:"yellow",price:260,rent:[22,110,330,800,975,1150],houseCost:150,mortgage:130},
  {id:28,name:"Waterbedrijf",type:"utility",color:"white",price:150,rent:[0],houseCost:0,mortgage:75},
  {id:29,name:"Singel",type:"property",color:"yellow",price:280,rent:[24,120,360,850,1025,1200],houseCost:150,mortgage:140},
  {id:30,name:"Naar Gevangenis",type:"gotojail",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:31,name:"Vondelstraat",type:"property",color:"green",price:300,rent:[26,130,390,900,1100,1275],houseCost:200,mortgage:150},
  {id:32,name:"Plantageweg",type:"property",color:"green",price:300,rent:[26,130,390,900,1100,1275],houseCost:200,mortgage:150},
  {id:33,name:"Gemeentekas",type:"chest",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:34,name:"Oosterpark",type:"property",color:"green",price:320,rent:[28,150,450,1000,1200,1400],houseCost:200,mortgage:160},
  {id:35,name:"Station West",type:"railroad",color:"gray",price:200,rent:[25,50,100,200],houseCost:0,mortgage:100},
  {id:36,name:"Kans",type:"chance",color:null,price:0,rent:[0],houseCost:0,mortgage:0},
  {id:37,name:"Museumplein",type:"property",color:"dblue",price:350,rent:[35,175,500,1100,1300,1500],houseCost:200,mortgage:175},
  {id:38,name:"Luxebelasting",type:"tax",color:null,price:0,rent:[100],houseCost:0,mortgage:0},
  {id:39,name:"Kalverstraat",type:"property",color:"dblue",price:400,rent:[50,200,600,1400,1700,2000],houseCost:200,mortgage:200},
];
const CMAP={brown:"#8B4513",lblue:"#42A5F5",pink:"#F06292",orange:"#FF7043",red:"#E53935",yellow:"#FDD835",green:"#43A047",dblue:"#1565C0",gray:"#9E9E9E",white:"#E0E0E0"};
const CGROUPS={brown:[1,3],lblue:[6,8,9],pink:[11,13,14],orange:[16,18,19],red:[21,23,24],yellow:[26,27,29],green:[31,32,34],dblue:[37,39]};
const GROUP_ORDER=["brown","lblue","pink","orange","red","yellow","green","dblue","railroad","utility"];
// Licht/donker maken van een hexkleur voor gradient-effecten (bordvakken meer diepte geven)
function shadeColor(hex,pct){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.max(0,(n>>16)+Math.round(255*pct)));
  const g=Math.min(255,Math.max(0,((n>>8)&255)+Math.round(255*pct)));
  const b=Math.min(255,Math.max(0,(n&255)+Math.round(255*pct)));
  return`#${(1<<24|r<<16|g<<8|b).toString(16).slice(1)}`;
}
function sortedByGroup(propIds){
  return [...propIds].sort((a,b)=>{
    const sa=SPACES[a],sb=SPACES[b];
    const oa=GROUP_ORDER.indexOf(sa.color||sa.type);
    const ob=GROUP_ORDER.indexOf(sb.color||sb.type);
    if(oa!==ob) return oa-ob;
    return sa.id-sb.id;
  });
}
function groupedProps(propIds){
  // Returns [{color,type,label,ids:[]}]
  const sorted=sortedByGroup(propIds);
  const groups=[];let cur=null;
  sorted.forEach(id=>{
    const sp=SPACES[id];const key=sp.color||sp.type;
    if(!cur||cur.key!==key){
      const label=sp.type==="railroad"?"Stations":sp.type==="utility"?"Nutsbedrijven":sp.color?sp.color.toUpperCase():"Overig";
      const cb=sp.color?CMAP[sp.color]:null;
      cur={key,label,color:cb,ids:[]};groups.push(cur);
    }
    cur.ids.push(id);
  });
  return groups;
}
const CHANCE=[
  {t:"Ga naar START. Ontvang €200!",a:()=>({money:200,moveTo:0})},
  {t:"Ga naar de gevangenis!",a:()=>({goToJail:true})},
  {t:"Bankfout in jouw voordeel. +€200.",a:()=>({money:200})},
  {t:"Ziekenhuiskosten: -€100.",a:()=>({money:-100})},
  {t:"Ga 3 stappen terug.",a:()=>({moveBack:3})},
  {t:"Jij bent jarig! +€150 van iedereen.",a:()=>({collectFromAll:150})},
  {t:"Ga naar dichtstbijzijnd station.",a:()=>({moveToNearest:"railroad"})},
  {t:"Rente ontvangen: +€100.",a:()=>({money:100})},
];
const CHEST=[
  {t:"Bankfout in jouw voordeel. +€200.",a:()=>({money:200})},
  {t:"Dokterskosten: -€50.",a:()=>({money:-50})},
  {t:"Bewezen diensten: +€25.",a:()=>({money:25})},
  {t:"Schoolgeld: -€150.",a:()=>({money:-150})},
  {t:"Erfenis ontvangen: +€100.",a:()=>({money:100})},
  {t:"Kerstbonus: +€100.",a:()=>({money:100})},
  {t:"Ga naar START. Ontvang €200!",a:()=>({money:200,moveTo:0})},
  {t:"Ga naar de gevangenis!",a:()=>({goToJail:true})},
];
const APP_VERSION="v16.3";
// Los van APP_VERSION: dit volgt alleen de VORM van save-data, niet de feature-versie.
// Ophogen alleen wanneer een save-veld van betekenis/type verandert (iets dat een
// eenvoudige ??-fallback niet kan opvangen) — niet bij elke nieuwe feature. Zie
// applySaveData() voor waar de daadwerkelijke compatibiliteitslogica staat.
const SAVE_SCHEMA_VERSION=1;
const TOKENS=["🎩","🚂","🐶","⚓"];
const PCOLORS=["#E53935","#1E88E5","#43A047","#FB8C00"];
const CELL=44,CORNER=60,BOARD=CORNER*2+CELL*9;
const DOTS={1:[[50,50]],2:[[25,25],[75,75]],3:[[25,25],[50,50],[75,75]],4:[[25,25],[75,25],[25,75],[75,75]],5:[[25,25],[75,25],[50,50],[25,75],[75,75]],6:[[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]]};

function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function rng(){return Math.ceil(Math.random()*6);}
// Spelernamen komen van andere spelers via het P2P-kanaal (client_hello) en zijn dus
// niet vertrouwd — deze escaped ze voor gebruik in innerHTML, zodat iemand geen
// <img onerror=...> als naam kan gebruiken om code te laten draaien bij andere spelers.
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// Trimt/knipt een binnenkomende naam af op intake (los van esc(), dat pas bij het renderen gebeurt)
function sanitizeName(n){return String(n??"").trim().slice(0,20);}
function gridPos(id){if(id<=9)return[10-id,10];if(id<=19)return[0,10-(id-10)];if(id<=29)return[id-20,0];return[10,id-30];}
function cellPx(c){return c===0?0:CORNER+(c-1)*CELL;}
function cellSz(id){return[0,10,20,30].includes(id)?CORNER:CELL;}
function spaceCenter(id){const[col,row]=gridPos(id);const sz=cellSz(id);return{x:cellPx(col)+sz/2,y:cellPx(row)+sz/2};}
function pawnXY(pid,sid){const c=spaceCenter(sid);const off=[[0,-8],[8,4],[-8,4],[0,10]];const[ox,oy]=off[pid]||[0,0];return{x:c.x+ox-18,y:c.y+oy-18};}
function initPlayers(setup){
  return setup.map((s,i)=>({
    id:i, name:s.name||`Speler ${i+1}`, token:TOKENS[i], color:PCOLORS[i],
    money:1500, pos:0, isHuman:s.isHuman,
    inJail:false, jailTurns:0, bankrupt:false, properties:[]
  }));
}
