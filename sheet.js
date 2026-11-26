/* Lógica da ficha (Wanted Warriors). Depende de window.CLOUD, definido em ficha.html. */
var KEY = "wanted-warriors-sheet-v3";
var SECS = ["tecnicas", "despertar", "ativas", "passivas"];
var DEF = {
  ident: {nome:"", funcao:"", doutrina:"", classe:""},
  tecnicas: [], despertar: [], ativas: [], passivas: []
};
var NEW = {
  tecnicas: ["Nova técnica","0 EST","Descreva o efeito da técnica."],
  despertar: ["Novo despertar","10 EST","Descreva o despertar. Bônus de atributo no formato +5 VIG."],
  ativas: ["Nova habilidade","1x por combate","Descreva a habilidade."],
  passivas: ["Nova habilidade passiva","","Descreva a habilidade."]
};
var KEYS = {"Força":"fo","Destreza":"des","Agilidade":"agi","Energia":"eng","Vigor":"vig","Inteligência":"int"};
var ABBR = {FOR:"fo",DEX:"des",AGI:"agi",ENG:"eng",VIG:"vig",INT:"int"};

var S = {ident:{}}, BASE = {fo:0,des:0,agi:0,eng:0,vig:0,int:0};
var atkReg = [], uses = {}, nid = 1, awakened = false, reg = [], lastHM = null, lastEM = null;

function fromDef(){
  S = {ident: JSON.parse(JSON.stringify(DEF.ident)), ataques: []};
  SECS.forEach(function(k){ S[k] = DEF[k].map(function(a){ return {id:nid++, n:a[0], c:a[1], d:a[2]}; }); });
}
fromDef();

function el(t, c){ var e = document.createElement(t); if(c){ e.className = c; } return e; }
function costEst(c){ var m = /(\d+)\s*EST/i.exec(c || ""); return m ? +m[1] : null; }
function costUses(c){ var m = /^\s*(\d+)\s*x/i.exec(c || ""); return m ? +m[1] : null; }

function makeEditable(e, ph, onInput){
  e.contentEditable = "true"; e.spellcheck = false;
  e.classList.add("ed"); e.setAttribute("data-ph", ph || "");
  e.addEventListener("input", function(){ if(e.textContent === ""){ e.innerHTML = ""; } onInput(e.textContent); });
  e.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); e.blur(); } });
  e.addEventListener("paste", function(ev){
    ev.preventDefault();
    var t = (ev.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
    document.execCommand("insertText", false, t);
  });
  return e;
}

function bonus(){
  var out = {}, it = S.despertar[0];
  if(!awakened || !it){ return out; }
  var re = /([+\-−]?\s*\d+)\s*(FOR|DEX|AGI|ENG|VIG|INT)/gi, m;
  while((m = re.exec(it.d || ""))){
    var k = ABBR[m[2].toUpperCase()], n = parseInt(m[1].replace("−", "-").replace(/\s/g, ""), 10);
    out[k] = (out[k] || 0) + (isNaN(n) ? 0 : n);
  }
  return out;
}
function effAttrs(){
  var A = {}, B = bonus();
  Object.keys(BASE).forEach(function(k){ A[k] = BASE[k] + (B[k] || 0); });
  return A;
}
function markDerived(){ var A = effAttrs(); lastHM = Math.max(0, A.vig * 20); lastEM = Math.max(0, A.eng * 5); }

function derivedOf(n, A){
  if(n.indexOf("(CC)") > -1){ return [5, SW.cc ? A.des : A.fo]; }
  if(n.indexOf("(CD)") > -1){ return [5, SW.cd ? A.fo : A.des]; }
  if(n.indexOf("(ESQV)") > -1){ return [5, A.agi]; }
  if(n === "Freestyle"){ return [4, SW.fs ? A.des : A.fo]; }
  if(n === "Técnica"){ return [2, SW.tc ? A.fo : A.des]; }
  return null;
}

var hp = document.getElementById("hp"), est = document.getElementById("est");
var hpc = document.getElementById("hpc"), hpm = document.getElementById("hpm");
var estc = document.getElementById("estc"), estm = document.getElementById("estm");

function syncGauges(){
  [[hp, hpc, hpm], [est, estc, estm]].forEach(function(g){
    var s = g[0];
    if(document.activeElement !== g[1]){ g[1].value = s.value; }
    if(document.activeElement !== g[2]){ g[2].value = s.max; }
    s.style.setProperty("--p", (+s.max > 0 ? 100 * s.value / s.max : 0) + "%");
  });
}
function bindGauge(s, cur, max){
  cur.addEventListener("input", function(){
    var v = parseInt(cur.value, 10); if(isNaN(v)){ return; }
    s.value = Math.max(0, Math.min(v, +s.max)); show();
  });
  max.addEventListener("input", function(){
    var v = parseInt(max.value, 10); if(isNaN(v) || v < 0){ return; }
    s.max = v; if(+s.value > v){ s.value = v; } show();
  });
  cur.addEventListener("change", show); max.addEventListener("change", show);
  s.addEventListener("input", show);
}
bindGauge(hp, hpc, hpm); bindGauge(est, estc, estm);

var lastAw = null;
function renderStats(){
  var A = effAttrs();
  var hm = Math.max(0, A.vig * 20), em = Math.max(0, A.eng * 5);
  if(hm !== lastHM){
    var awOff = lastAw === true && !awakened, dh = lastHM === null ? 0 : hm - lastHM;
    var oldHp = +hp.value, newHp = Math.max(0, oldHp + dh);
    if(awOff && oldHp > 0 && hm > 0){ newHp = Math.max(1, newHp); }
    lastHM = hm; hp.max = hm; hp.value = Math.min(hm, newHp);
  }
  if(em !== lastEM){
    var de = lastEM === null ? 0 : em - lastEM;
    var oldEst = +est.value;
    lastEM = em; est.max = em; est.value = Math.min(em, Math.max(0, oldEst + de));
  }
  lastAw = awakened;
  document.querySelectorAll(".stat").forEach(function(s){
    var n = s.querySelector(".n").textContent, v = s.querySelector(".v"), f = s.querySelector(".f");
    var val = null, base = null, d, db;
    if(KEYS[n]){ val = A[KEYS[n]]; base = BASE[KEYS[n]]; }
    else {
      d = derivedOf(n, A); db = derivedOf(n, BASE);
      if(d){
        var bk = bonusKey(n), bn = BONUS[bk] || 0;
        val = d[0] + d[1] + bn; base = db[0] + db[1];
        if(f){ f.textContent = d[0] + " + " + d[1] + (bn ? " " + (bn < 0 ? "− " : "+ ") + Math.abs(bn) : ""); }
      }
    }
    if(val !== null){ v.textContent = val; v.classList.toggle("up", val > base); }
  });
  document.querySelectorAll(".sw input").forEach(function(i){ i.checked = !!SW[i.getAttribute("data-k")]; });
  document.getElementById("desl").textContent = 5 + A.agi;
  syncGauges();
}

function addArrows(){
  document.querySelectorAll(".stat").forEach(function(s){
    var n = s.querySelector(".n").textContent, k = KEYS[n], bk = bonusKey(n);
    if(!k && !bk){ return; }
    s.classList.add("has-arrows");
    var box = el("div", "arrows");
    if(bk){ box.title = "Bônus de " + n; }
    [["▲", 1, "Aumentar "], ["▼", -1, "Diminuir "]].forEach(function(a){
      var b = el("button"); b.type = "button"; b.textContent = a[0]; b.setAttribute("aria-label", a[2] + (bk ? "bônus de " : "") + n);
      b.addEventListener("click", function(){
        if(k){ BASE[k] = Math.max(0, BASE[k] + a[1]); } else { BONUS[bk] += a[1]; }
        show();
      });
      box.appendChild(b);
    });
    s.appendChild(box);
  });
}

function addSwitches(){
  document.querySelectorAll(".stat").forEach(function(s){
    var n = s.querySelector(".n").textContent, k = bonusKey(n);
    if(k !== "cc" && k !== "cd" && k !== "fs" && k !== "tc"){ return; }
    var name = (k === "cc" || k === "cd") ? "Acuidade" : "Versátil";
    var lb = el("label", "sw"), i = el("input"), t = el("span", "trk"), tx = el("span", "lbl-t");
    i.type = "checkbox"; i.setAttribute("role", "switch"); i.setAttribute("data-k", k);
    i.setAttribute("aria-label", name + " em " + n);
    lb.title = k === "cc" ? "Ligado: soma Destreza em vez de Força" :
               k === "fs" ? "Ligado: soma Destreza em vez de Força" : "Ligado: soma Força em vez de Destreza";
    tx.textContent = name;
    i.addEventListener("change", function(){ SW[k] = i.checked; show(); });
    lb.appendChild(i); lb.appendChild(t); lb.appendChild(tx);
    s.appendChild(lb);
  });
}

function refreshUI(){
  renderStats();
  document.body.classList.toggle("awake", awakened);
  document.getElementById("awake-tag").hidden = !awakened;
  document.getElementById("add-despertar").hidden = S.despertar.length > 0;
  reg.forEach(function(r){
    var it = r.it, u = r.u, e = costEst(it.c), x = costUses(it.c);
    u.classList.remove("on");
    if(r.sec === "despertar"){
      u.hidden = false; u.textContent = awakened ? "Encerrar" : "Despertar";
      u.classList.toggle("on", awakened);
      u.disabled = !awakened && +est.value < (e || 0);
    } else if(e !== null){
      u.hidden = false; u.textContent = "Usar"; u.disabled = +est.value < e;
    } else if(x !== null){
      if(uses[it.id] === undefined || uses[it.id] > x){ uses[it.id] = x; }
      u.hidden = false; u.textContent = "Usar (" + uses[it.id] + "/" + x + ")"; u.disabled = uses[it.id] <= 0;
    } else { u.hidden = true; }
  });
}

var ICON_D20 = '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L21 7V17L12 22L3 17V7Z"/><path d="M12 7L17 15H7Z"/><path d="M12 2V7M21 7L17 15M3 7L7 15M12 22V15M21 17L17 15M3 17L7 15"/></svg>';
var ICON_SWORD = '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5L9.5 14.5" stroke-width="2.6"/><path d="M6.5 11.5L12.5 17.5"/><path d="M8.5 15.5L4.5 19.5"/><circle cx="4" cy="20" r="1.2"/></svg>';
var BONUS = {cc:0, cd:0, esqv:0, fs:0, tc:0};
var SW = {cc:false, cd:false, fs:false, tc:false};
function bonusKey(n){
  if(n.indexOf("(CC)") > -1){ return "cc"; }
  if(n.indexOf("(CD)") > -1){ return "cd"; }
  if(n.indexOf("(ESQV)") > -1){ return "esqv"; }
  if(n === "Freestyle"){ return "fs"; }
  if(n === "Técnica"){ return "tc"; }
  return null;
}
function atkMod(t){
  var A = effAttrs();
  return t === "CD" ? 5 + (SW.cd ? A.fo : A.des) + BONUS.cd : t === "FS" ? 4 + (SW.fs ? A.des : A.fo) + BONUS.fs : t === "TC" ? 2 + (SW.tc ? A.fo : A.des) + BONUS.tc : 5 + (SW.cc ? A.des : A.fo) + BONUS.cc;
}
function fmtMod(n){ return (n < 0 ? "−" : "+") + Math.abs(n); }
function rollAtkLabels(){
  atkReg.forEach(function(r){ r.b.innerHTML = ICON_D20 + "d20 " + fmtMod(atkMod(r.it.t)); });
}

function save(){
  CLOUD.save({S:S, BASE:BASE, BONUS:BONUS, SW:SW, seed2:true, uses:uses, nid:nid, aw:awakened,
    hp:hp.value, est:est.value, hpm:hp.max, estm:est.max});
}
function show(){ refreshUI(); rollAtkLabels(); save(); stSchedule(); }

function spend(n){ est.value = Math.max(0, +est.value - n); show(); }
function toggleAwake(){
  if(!awakened){
    var e = costEst((S.despertar[0] || {}).c) || 0;
    if(+est.value < e){ return; }
    est.value = +est.value - e; awakened = true;
  } else { awakened = false; }
  show();
}

function mkItem(sec, it){
  var d = el("div", "item" + (sec === "despertar" ? " awake" : ""));
  var h = el("div", "head");
  var nm = makeEditable(el("span", "nm"), "nome", function(v){ it.n = v; save(); });
  nm.textContent = it.n;
  var cs = makeEditable(el("span", "cost"), "custo", function(v){ it.c = v; refreshUI(); save(); });
  cs.textContent = it.c;
  var u = el("button", "use"); u.type = "button";
  u.addEventListener("click", function(){
    if(sec === "despertar"){ toggleAwake(); return; }
    var e = costEst(it.c), x = costUses(it.c);
    if(e !== null){ spend(e); }
    else if(x !== null && uses[it.id] > 0){ uses[it.id]--; show(); }
  });
  var ex = el("button", "ico exp"); ex.type = "button"; ex.textContent = "▾"; ex.setAttribute("aria-label", "Mostrar descrição");
  ex.addEventListener("click", function(){ d.classList.toggle("open"); });
  var dl = el("button", "ico"); dl.type = "button"; dl.textContent = "✕"; dl.setAttribute("aria-label", "Excluir " + it.n);
  dl.addEventListener("click", function(){
    S[sec] = S[sec].filter(function(x){ return x !== it; });
    delete uses[it.id];
    if(sec === "despertar"){ awakened = false; }
    renderAll(); show();
  });
  h.appendChild(nm); h.appendChild(cs); h.appendChild(u); h.appendChild(ex); h.appendChild(dl);
  var w = el("div", "desc"), i = el("div");
  var p = makeEditable(el("p"), "descrição", function(v){ it.d = v; if(sec === "despertar"){ refreshUI(); } save(); });
  p.classList.remove("ed"); p.textContent = it.d;
  i.appendChild(p); w.appendChild(i);
  d.appendChild(h); d.appendChild(w);
  reg.push({sec:sec, it:it, u:u});
  return d;
}

var DCKEY = "wanted-warriors-discord";
var DC_URL = "";
try { var dcs = localStorage.getItem(DCKEY); if(dcs !== null){ DC_URL = dcs; } } catch(e){}
function dcCheck(v){
  if(!v){ return "Cole a URL do webhook."; }
  if(!/^https:\/\//i.test(v)){ return "A URL precisa começar com https://"; }
  if(!/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\//i.test(v)){ return "O endereço não é do Discord (esperado: https://discord.com/api/webhooks/...)."; }
  if(v.indexOf("/api/webhooks/") < 0){ return "Faltou o trecho /api/webhooks/ na URL. Copie o link pelo botão “Copiar URL do Webhook” no Discord."; }
  if(!/\/api\/webhooks\/\d+\//.test(v)){ return "O número do webhook (ID) está ausente ou incorreto na URL."; }
  if(!/\/api\/webhooks\/\d+\/[\w\-]+\/?$/.test(v)){ return "O token no final da URL está ausente ou contém caracteres inválidos (a URL pode estar cortada ou ter texto extra)."; }
  return "";
}
function charName(){ return (S.ident && S.ident.nome || "").trim() || "Personagem"; }
var DC_NET = "Não foi possível conectar ao Discord. Verifique a internet, se alguma extensão/bloqueador impede acesso a discord.com ou se esta página está aberta em um ambiente que bloqueia conexões externas (como uma pré-visualização). Abra o arquivo direto no navegador.";
function dcHttp(st, body){
  var j = {}; try { j = JSON.parse(body); } catch(e){}
  var det = j.message ? " Resposta do Discord: " + j.message + (j.code ? " (código " + j.code + ")" : "") + "." : "";
  if(st === 401){ return "O Discord recusou o token do webhook (erro 401): a URL está incorreta ou foi regenerada." + det; }
  if(st === 404){ return "Webhook não encontrado (erro 404): ele foi excluído ou a URL está errada. Crie um novo no canal." + det; }
  if(st === 429){ return "Muitas mensagens em pouco tempo (erro 429). Aguarde" + (j.retry_after ? " cerca de " + Math.ceil(j.retry_after) + " s" : " um instante") + " e tente de novo."; }
  if(st === 400){ return "O Discord recusou a mensagem (erro 400)." + det; }
  if(st === 403){ return "Sem permissão para postar nesse webhook (erro 403)." + det; }
  if(st >= 500){ return "O Discord está com problemas no momento (erro " + st + "). Tente novamente mais tarde."; }
  return "Erro " + st + " ao enviar ao Discord." + det;
}
function dcPost(text){
  var p;
  try {
    p = fetch(DC_URL, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({content: text.slice(0, 1900), allowed_mentions: {parse: []}})
    });
  } catch(e){ return Promise.reject(new Error(DC_NET)); }
  return p.then(function(r){
    if(r.ok){ return; }
    return r.text().then(function(b){ throw new Error(dcHttp(r.status, b)); }, function(){ throw new Error(dcHttp(r.status, "")); });
  }, function(){ throw new Error(DC_NET); });
}
function dcSend(text, resEl){
  if(!DC_URL){ return; }
  var n = el("span", "dc"); n.textContent = "Enviando ao Discord…"; resEl.appendChild(n);
  dcPost(text).then(function(){ n.textContent = "Enviado ao Discord ✓"; })
    .catch(function(e){ n.textContent = "Falha ao enviar ao Discord: " + e.message; });
}

var STKEY = "wanted-warriors-discord-status", STMSG = "wanted-warriors-discord-status-msg";
var ST_URL = "", stMsg = {url:"", id:""}, stBusy = false, stDirty = false, stLast = "", stTimer = null;
try {
  var sts = localStorage.getItem(STKEY); if(sts !== null){ ST_URL = sts; }
  var stm = JSON.parse(localStorage.getItem(STMSG) || "null"); if(stm && stm.url === ST_URL){ stMsg = stm; }
} catch(e){}
function stSay(t, c){
  var e = document.getElementById("st-st"); if(!e){ return; }
  e.textContent = t; e.className = "st" + (c ? " " + c : "");
}
function stBar(c, m){
  var n = m > 0 ? Math.round(10 * Math.max(0, Math.min(c, m)) / m) : 0;
  return new Array(n + 1).join("▓") + new Array(11 - n).join("░");
}
function stText(){
  return "**" + charName() + "**\n❤️ Vida: " + hp.value + "/" + hp.max + " " + stBar(+hp.value, +hp.max) +
    "\n⚡ Estamina: " + est.value + "/" + est.max + " " + stBar(+est.value, +est.max) +
    "\n" + (awakened ? "🔥 **Despertado**" : "Estado: normal");
}
function stReq(method, url, body){
  var p;
  try {
    p = fetch(url, {method: method, headers: {"Content-Type": "application/json"}, body: body ? JSON.stringify(body) : undefined});
  } catch(e){ return Promise.reject(new Error(DC_NET)); }
  return p.then(function(r){
    if(r.ok){ return r.status === 204 ? null : r.json(); }
    return r.text().then(function(b){ var e = new Error(dcHttp(r.status, b)); e.status = r.status; throw e; },
                         function(){ var e = new Error(dcHttp(r.status, "")); e.status = r.status; throw e; });
  }, function(){ throw new Error(DC_NET); });
}
function stBase(){ return ST_URL.replace(/\/$/, ""); }
function stRun(force){
  if(!ST_URL){ return Promise.resolve(); }
  if(stBusy){ stDirty = true; return Promise.resolve(); }
  var txt = stText();
  if(!force && txt === stLast){ return Promise.resolve(); }
  var body = {content: txt, allowed_mentions: {parse: []}};
  function create(){
    return stReq("POST", stBase() + "?wait=true", body).then(function(m){
      if(m && m.id){
        stMsg = {url: ST_URL, id: m.id};
        try { localStorage.setItem(STMSG, JSON.stringify(stMsg)); } catch(e){}
      }
    });
  }
  stBusy = true;
  var p = (stMsg.id && stMsg.url === ST_URL)
    ? stReq("PATCH", stBase() + "/messages/" + stMsg.id, body).catch(function(e){
        if(e.status === 404){ stMsg = {url: ST_URL, id: ""}; return create(); }
        throw e;
      })
    : create();
  return p.then(function(){
    stLast = txt;
    var d = new Date(), z = function(n){ return (n < 10 ? "0" : "") + n; };
    stSay("Status atualizado às " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds()) + ".", "ok");
  }).catch(function(e){ stSay("Falha ao atualizar o status: " + e.message, "err"); })
    .then(function(){ stBusy = false; if(stDirty){ stDirty = false; stSchedule(); } });
}
function stSchedule(){
  if(!ST_URL){ return; }
  clearTimeout(stTimer);
  stTimer = setTimeout(function(){ stRun(false); }, 1000);
}

function die(n){
  try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n + 1; }
  catch(e){ return Math.floor(Math.random() * n) + 1; }
}
function parseDmg(txt){
  var m = /(?:^|[^A-Za-zÀ-ÿ\d])(\d*)\s*d\s*(\d+)(?!\d)\s*(?:([+\-−])\s*(\d+))?/i.exec(txt || "");
  if(!m){ return null; }
  var n = m[1] === "" ? 1 : +m[1], sd = +m[2], flat = m[4] ? (m[3] === "+" ? +m[4] : -m[4]) : 0;
  if(n < 1 || n > 100 || sd < 2){ return null; }
  return {n:n, sides:sd, flat:flat};
}
function mkAttack(it){
  var d = el("div", "item atk");
  var h = el("div", "head");
  var nm = makeEditable(el("span", "nm"), "nome", function(v){ it.n = v; save(); });
  nm.textContent = it.n;
  var tp = el("select", "tp"); tp.setAttribute("aria-label", "Tipo do ataque");
  [["CC","CC"],["CD","CD"],["FS","FS"],["TC","TC"]].forEach(function(o){
    var op = el("option"); op.value = o[0]; op.textContent = o[1]; tp.appendChild(op);
  });
  tp.value = it.t || "CC";
  var dm = el("span", "dm"); dm.title = "Dano lido da descrição";
  function updDm(){
    var q = parseDmg(it.d) || parseDmg(it.dm);
    dm.textContent = q ? q.n + "d" + q.sides + (q.flat ? fmtMod(q.flat) : "") : "sem dano";
  }
  updDm();
  var res = el("div", "res"); res.setAttribute("aria-live", "polite"); res.hidden = true;
  var b = el("button", "roll"); b.type = "button";
  var bd = el("button", "roll dmg"); bd.type = "button"; bd.innerHTML = ICON_SWORD + "Dano"; bd.title = "Rolar dano"; b.title = "Rolar ataque";
  var critNext = false;
  function dmgLabel(){ bd.innerHTML = ICON_SWORD + (critNext ? "Dano ×2" : "Dano"); bd.title = critNext ? "Crítico: os dados de dano serão rolados duas vezes" : "Rolar dano"; }
  tp.addEventListener("change", function(){ it.t = tp.value; show(); });
  b.addEventListener("click", function(){
    var r = die(20), m = atkMod(it.t), tot = r + m;
    critNext = r === 20; dmgLabel();
    var cls = r === 20 ? "crit" : r === 1 ? "fail" : "";
    res.innerHTML = it.t + " · d20 [<span class=\"" + cls + "\">" + r + "</span>] " + fmtMod(m) + " = <b>" + tot + "</b>" +
      "";
    if(r === 20 || r === 1){
      var ln = el("span", "ex " + (r === 20 ? "crit" : "fail"));
      ln.textContent = r === 20 ? "Crítico! Acerto garantido e dano dobrado" : "Falha crítica...";
      res.appendChild(ln);
    }
    res.hidden = false;
    dcSend("🎲 **" + charName() + "** — " + it.n + " (" + it.t + "): d20 [" + r + "] " + fmtMod(m) + " = **" + tot + "**" +
      (r === 20 ? "\n✨ Crítico! Acerto garantido e dano dobrado" : r === 1 ? "\n💀 Falha crítica..." : ""), res);
  });
  bd.addEventListener("click", function(){
    var p = parseDmg(it.d) || parseDmg(it.dm);
    if(!p){ res.textContent = "Nenhum dado de dano na descrição (escreva por exemplo 2d6+3)."; res.hidden = false; return; }
    var crit = critNext, nd = crit ? p.n * 2 : p.n, rolls = [], sum = 0, i, dmgTxt;
    if(crit){ critNext = false; dmgLabel(); }
    for(i = 0; i < nd; i++){ var x = die(p.sides); rolls.push(x); sum += x; }
    var tot = sum + p.flat;
    res.innerHTML = "Dano " + p.n + "d" + p.sides + (p.flat ? fmtMod(p.flat) : "") +
      (crit ? " <span class=\"crit\">(crítico: " + nd + "d" + p.sides + ")</span>" : "") +
      " [" + rolls.join(", ") + "]" + (p.flat ? " " + fmtMod(p.flat) : "") + " = <b>" + tot + "</b>";
    dmgTxt = "⚔️ **" + charName() + "** — " + it.n + ": dano " + nd + "d" + p.sides + " [" + rolls.join(", ") + "]" +
      (p.flat ? " " + fmtMod(p.flat) : "") + " = **" + tot + "**" + (crit ? "\n✨ Crítico: dados rolados duas vezes" : "");
    res.hidden = false;
    dcSend(dmgTxt, res);
  });
  var ex = el("button", "ico exp"); ex.type = "button"; ex.textContent = "▾"; ex.setAttribute("aria-label", "Mostrar descrição");
  ex.addEventListener("click", function(){ d.classList.toggle("open"); });
  var dl = el("button", "ico"); dl.type = "button"; dl.textContent = "✕"; dl.setAttribute("aria-label", "Excluir " + it.n);
  dl.addEventListener("click", function(){
    S.ataques = S.ataques.filter(function(x){ return x !== it; });
    renderAll(); show();
  });
  h.appendChild(nm); h.appendChild(tp); h.appendChild(dm); h.appendChild(b); h.appendChild(bd); h.appendChild(ex); h.appendChild(dl);
  var w = el("div", "desc"), i2 = el("div");
  var p = makeEditable(el("p"), "dano e efeitos do ataque", function(v){ it.d = v; updDm(); save(); });
  p.classList.remove("ed"); p.textContent = it.d || "";
  i2.appendChild(p);
  w.appendChild(i2);
  d.appendChild(h); d.appendChild(w); d.appendChild(res);
  atkReg.push({it:it, b:b});
  return d;
}

function renderAll(){
  atkReg = [];
  var ar = document.getElementById("ataques"); ar.innerHTML = "";
  S.ataques.forEach(function(it){ ar.appendChild(mkAttack(it)); });
  reg = [];
  SECS.forEach(function(sec){
    var root = document.getElementById(sec); root.innerHTML = "";
    S[sec].forEach(function(it){ root.appendChild(mkItem(sec, it)); });
  });
}

function addItem(sec){
  if(sec === "ataques"){
    S.ataques.push({id:nid++, n:"Novo ataque", t:"CC", d:"Dano: 1d6. Descreva os efeitos do ataque."});
    renderAll(); show();
    var an = document.querySelector("#ataques .item:last-child .nm");
    if(an){
      an.focus();
      var r0 = document.createRange(); r0.selectNodeContents(an);
      var s0 = window.getSelection(); s0.removeAllRanges(); s0.addRange(r0);
    }
    return;
  }
  var t = NEW[sec];
  S[sec].push({id:nid++, n:t[0], c:t[1], d:t[2]});
  renderAll(); show();
  var nm = document.querySelector("#" + sec + " .item:last-child .nm");
  if(nm){
    nm.focus();
    var r = document.createRange(); r.selectNodeContents(nm);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
}
document.querySelectorAll("[data-add]").forEach(function(b){
  b.addEventListener("click", function(){ addItem(b.getAttribute("data-add")); });
});

function resetUses(secs){
  secs.forEach(function(sec){
    S[sec].forEach(function(it){ var x = costUses(it.c); if(x !== null){ uses[it.id] = x; } });
  });
}
document.getElementById("reset-uses").addEventListener("click", function(){ resetUses(["ativas"]); show(); });
document.getElementById("reset").addEventListener("click", function(){
  hp.value = hp.max; est.value = est.max; awakened = false; resetUses(SECS); show();
});
(function(){
  var btn = document.getElementById("dc-btn"), pn = document.getElementById("dc-panel"),
      inp = document.getElementById("dc-url"), st = document.getElementById("dc-st");
  function say(t, c){ st.textContent = t; st.className = "st" + (c ? " " + c : ""); }
  function sync(){ btn.classList.toggle("on", !!(DC_URL || ST_URL)); }
  function idle(){
    if(!DC_URL){ say("Cole a URL de um webhook (Configurações do canal → Integrações → Webhooks). Ela fica salva só neste navegador."); }
    else { say("Webhook configurado: ataques e danos são enviados ao Discord.", "ok"); }
  }
  inp.value = DC_URL; sync(); idle();
  btn.addEventListener("click", function(){
    pn.hidden = !pn.hidden; btn.setAttribute("aria-expanded", String(!pn.hidden));
    if(!pn.hidden){ inp.focus(); }
  });
  document.getElementById("dc-save").addEventListener("click", function(){
    var v = inp.value.trim(), er = dcCheck(v);
    if(er){ say(er, "err"); return; }
    DC_URL = v;
    try { localStorage.setItem(DCKEY, v); } catch(e){}
    sync(); idle();
  });
  document.getElementById("dc-test").addEventListener("click", function(){
    var v = inp.value.trim(), er = dcCheck(v);
    if(er){ say(er, "err"); return; }
    var old = DC_URL; DC_URL = v; say("Enviando teste…");
    dcPost("✅ Ficha **" + charName() + "** conectada ao Discord.")
      .then(function(){ say("Teste enviado com sucesso. Confira o canal no Discord.", "ok"); })
      .catch(function(e){ say("Falha no teste: " + e.message, "err"); })
      .then(function(){ DC_URL = old; });
  });
  document.getElementById("dc-clear").addEventListener("click", function(){
    DC_URL = ""; inp.value = "";
    try { localStorage.setItem(DCKEY, ""); } catch(e){}
    sync(); idle();
  });

  var sin = document.getElementById("st-url");
  sin.value = ST_URL;
  if(ST_URL){ stSay("Status ativo: a mensagem é atualizada sempre que Vida, Estamina ou Despertado mudarem.", "ok"); }
  else { stSay("Cole a URL de um webhook de outro canal. A ficha cria uma mensagem de status e a edita sempre que algo mudar."); }
  sync();
  document.getElementById("st-save").addEventListener("click", function(){
    var v = sin.value.trim(), er = dcCheck(v);
    if(er){ stSay(er, "err"); return; }
    if(v !== ST_URL){ stMsg = {url: v, id: ""}; }
    ST_URL = v; stLast = "";
    try { localStorage.setItem(STKEY, v); localStorage.setItem(STMSG, JSON.stringify(stMsg)); } catch(e){}
    sync(); stSay("Enviando status…"); stRun(true);
  });
  document.getElementById("st-clear").addEventListener("click", function(){
    var old = stBase(), id = stMsg.id;
    clearTimeout(stTimer);
    ST_URL = ""; sin.value = ""; stMsg = {url: "", id: ""}; stLast = "";
    try { localStorage.setItem(STKEY, ""); localStorage.removeItem(STMSG); } catch(e){}
    if(old && id){ try { fetch(old + "/messages/" + id, {method: "DELETE"}).catch(function(){}); } catch(e){} }
    sync(); stSay("Status removido. A mensagem de status foi apagada do canal, se possível.");
  });
})();
(function(){
  var KEYP = "wanted-warriors-portrait";
  var box = document.getElementById("portrait"), img = document.getElementById("pt-img"),
      ph = document.getElementById("pt-ph"), chg = document.getElementById("pt-chg"),
      file = document.getElementById("pt-file"), rm = document.getElementById("pt-rm");
  function setImg(src){
    var has = !!src;
    if(has){ img.src = src; } else { img.removeAttribute("src"); }
    img.hidden = !has; chg.hidden = !has; rm.hidden = !has; ph.hidden = has;
    box.classList.toggle("has", has);
  }
  setImg(CLOUD.portrait || "");
  rm.addEventListener("click", function(ev){
    ev.preventDefault(); ev.stopPropagation();
    CLOUD.savePortrait("");
    setImg(""); file.value = "";
  });
  file.addEventListener("change", function(){
    var f = file.files && file.files[0];
    if(!f){ return; }
    if(f.type.indexOf("image/") !== 0){ alert("Escolha um arquivo de imagem."); file.value = ""; return; }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function(){
      var MAX = 600, k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var data = c.toDataURL("image/webp", 0.88);
      if(data.indexOf("data:image/webp") !== 0){ data = c.toDataURL("image/jpeg", 0.88); }
      setImg(data);
      CLOUD.savePortrait(data);
      file.value = "";
    };
    im.onerror = function(){ URL.revokeObjectURL(url); alert("Não foi possível ler essa imagem."); file.value = ""; };
    im.src = url;
  });
})();
document.getElementById("print").addEventListener("click", function(){ window.print(); });

hp.max = BASE.vig * 20; hp.value = hp.max;
est.max = BASE.eng * 5; est.value = est.max;
markDerived();

try {
  var sv = CLOUD.data || null;
  if(sv && sv.S && SECS.every(function(k){ return Array.isArray(sv.S[k]); })){
    S = sv.S; S.ident = S.ident || {}; S.ataques = Array.isArray(S.ataques) ? S.ataques : [];
    if(sv.BASE){ Object.keys(BASE).forEach(function(k){ if(typeof sv.BASE[k] === "number"){ BASE[k] = Math.max(0, sv.BASE[k]); } }); }
    if(sv.BONUS){ Object.keys(BONUS).forEach(function(k){ if(typeof sv.BONUS[k] === "number"){ BONUS[k] = sv.BONUS[k]; } }); }
    if(sv.SW){ Object.keys(SW).forEach(function(k){ if(typeof sv.SW[k] === "boolean"){ SW[k] = sv.SW[k]; } }); }
    else if(BONUS.cc === 15){ BONUS.cc = 0; }
    uses = sv.uses || {}; nid = sv.nid || 1000;
    if(!sv.seed2){
      ["despertar", "ativas", "passivas"].forEach(function(k){
        if(!S[k].length){ S[k] = DEF[k].map(function(a){ return {id:nid++, n:a[0], c:a[1], d:a[2]}; }); }
      });
    } awakened = !!sv.aw && S.despertar.length > 0;
    if(+sv.hpm > 0){ hp.max = sv.hpm; } if(+sv.estm > 0){ est.max = sv.estm; }
    hp.value = sv.hp; est.value = sv.est;
    markDerived();
  }
} catch(e){}

document.querySelectorAll(".ed-id").forEach(function(e){
  var k = e.getAttribute("data-k");
  e.textContent = S.ident[k] !== undefined ? S.ident[k] : DEF.ident[k];
  makeEditable(e, e.getAttribute("data-ph"), function(v){ S.ident[k] = v; save(); stSchedule(); });
});

function buildLogo(){
  var g = document.getElementById("logo-letters"), W = 74, P = 80, out = "";
  [["WANTED", 190], ["WARRIORS", 720]].forEach(function(w){
    w[0].split("").forEach(function(ch, i){
      var cx = w[1] + W / 2 + i * P;
      out += '<text x="' + cx + '" y="245" text-anchor="middle" textLength="' + W + '" lengthAdjust="spacingAndGlyphs" transform="translate(0 245) scale(1 1.3) translate(0 -245)">' + ch + '</text>';
      if("NEDRBPH".indexOf(ch) > -1){ out += '<ellipse class="bg" cx="' + (cx - W * 0.2) + '" cy="170" rx="3.5" ry="34"/>'; }
      else if("TI".indexOf(ch) > -1){ out += '<ellipse class="bg" cx="' + cx + '" cy="165" rx="3.5" ry="36"/>'; }
    });
  });
  g.innerHTML = out;
}
buildLogo();
renderAll();
addArrows();
addSwitches();
show();
