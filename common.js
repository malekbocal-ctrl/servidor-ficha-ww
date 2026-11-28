/* Cria o cliente do Supabase, usado por index.html, ficha.html e combate.html. */
(function(){
  var c = window.WW_CONFIG;
  if(!c || !c.SUPABASE_URL || c.SUPABASE_URL.indexOf("COLE_AQUI") === 0 || !c.SUPABASE_ANON_KEY || c.SUPABASE_ANON_KEY.indexOf("COLE_AQUI") === 0){
    window.WW_MISSING = true; return;
  }
  if(!window.supabase){ window.WW_MISSING = true; window.WW_NOLIB = true; return; }
  window.sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
})();

/* Bot do Discord: o site pede e a função discord-bot (no Supabase) envia.
   O token do bot fica só no Supabase; nada de webhook no navegador. */
(function(){
  var sb = window.sb, c = window.WW_CONFIG;
  if(!sb){ return; }
  var URL_BOT = c.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/discord-bot", cfgP = null;
  window.WW_DISCORD = {
    /* canais escolhidos pelo mestre: {canal_combate, canal_rolagens, canal_status} ou null */
    canais: function(force){
      if(!cfgP || force){
        cfgP = sb.from("discord_config").select("canal_combate,canal_rolagens,canal_status").eq("id", 1).maybeSingle()
          .then(function(r){ return r.error ? null : (r.data || null); }, function(){ return null; });
      }
      return cfgP;
    },
    /* link do canal (https://discord.com/channels/servidor/canal) ou ID → ID; "" se vazio; null se inválido */
    canalId: function(v){
      v = (v || "").trim();
      if(!v){ return ""; }
      var m = /discord(?:app)?\.com\/channels\/(?:\d+|@me)\/(\d{5,25})/i.exec(v);
      if(m){ return m[1]; }
      return /^\d{5,25}$/.test(v) ? v : null;
    },
    /* canal de status próprio da ficha (ou "" se ela usa o canal padrão) */
    canalFicha: function(id){
      return sb.from("discord_fichas").select("canal_status").eq("ficha_id", id).maybeSingle()
        .then(function(r){ return r.error || !r.data ? "" : (r.data.canal_status || ""); }, function(){ return ""; });
    },
    enviar: function(acao, dados, imagem){
      return sb.auth.getSession().then(function(r){
        var s = r.data.session;
        if(!s){ throw new Error("sessão expirada; entre de novo no site."); }
        var headers = {Authorization: "Bearer " + s.access_token, apikey: c.SUPABASE_ANON_KEY}, body;
        if(imagem){
          body = new FormData();
          body.append("acao", acao); body.append("dados", JSON.stringify(dados || {})); body.append("imagem", imagem, "tabuleiro.png");
        } else {
          headers["Content-Type"] = "application/json";
          var o = {acao: acao}; Object.keys(dados || {}).forEach(function(k){ o[k] = dados[k]; });
          body = JSON.stringify(o);
        }
        return fetch(URL_BOT, {method: "POST", headers: headers, body: body}).then(function(resp){
          return resp.json().catch(function(){ return {}; }).then(function(j){
            if(resp.ok && j.ok){ return j; }
            var m = j.erro || (resp.status === 404 ? "a função discord-bot ainda não foi criada no Supabase." : "erro " + resp.status + " no bot.");
            var e = new Error(m); e.status = resp.status; throw e;
          });
        }, function(){ throw new Error("sem conexão com o bot (internet ou bloqueador)."); });
      });
    }
  };
})();

/* Aviso de combate: quando o mestre inicia um combate, aparece um pop-up
   em qualquer página do site (menos na própria página do combate). */
(function(){
  var sb = window.sb;
  if(!sb || /combate(\.html)?$/i.test(location.pathname)){ return; }
  var SEEN = "wanted-warriors-combate-visto", shown = "", box = null, started = false, pollT = null;
  function seen(){ try { return localStorage.getItem(SEEN) || ""; } catch(e){ return ""; } }
  function markSeen(v){ try { localStorage.setItem(SEEN, v); } catch(e){} }

  function style(){
    if(document.getElementById("ww-cb-style")){ return; }
    var s = document.createElement("style"); s.id = "ww-cb-style";
    s.textContent =
      ".ww-cb{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}" +
      ".ww-cb-box{width:min(440px,100%);background:var(--panel,#152636);color:var(--ink,#e6edf2);border:2px solid var(--gold,#d9a846);padding:22px 22px 18px;box-shadow:0 10px 40px rgba(0,0,0,.5);text-align:center;font-family:'Alegreya Sans',system-ui,sans-serif}" +
      ".ww-cb-box h2{font-family:'Pirata One',Georgia,serif;font-weight:400;font-size:1.9rem;line-height:1.1;margin:0 0 6px;color:var(--gold,#d9a846)}" +
      ".ww-cb-box p{margin:0 0 18px;color:var(--muted,#93a5b4)}" +
      ".ww-cb-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}" +
      ".ww-cb-go{font:inherit;font-weight:700;padding:8px 20px;background:var(--gold,#d9a846);color:#14283b;border:2px solid var(--gold,#d9a846);text-decoration:none;cursor:pointer}" +
      ".ww-cb-go:hover{filter:brightness(1.1)}" +
      ".ww-cb-no{font:inherit;padding:8px 16px;background:none;color:var(--muted,#93a5b4);border:1px solid var(--line,#2c4256);cursor:pointer}" +
      ".ww-cb-no:hover{color:var(--ink,#e6edf2);border-color:var(--ink,#e6edf2)}" +
      ".ww-cb a:focus-visible,.ww-cb button:focus-visible{outline:2px solid var(--sea,#58b4d1);outline-offset:2px}";
    document.head.appendChild(s);
  }
  function close(){ if(box){ box.remove(); box = null; } document.removeEventListener("keydown", onKey); }
  function onKey(ev){ if(ev.key === "Escape"){ markSeen(shown); close(); } }
  function show(row){
    shown = row.iniciado_em; style(); close();
    box = document.createElement("div"); box.className = "ww-cb";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "ww-cb-t");
    var d = document.createElement("div"); d.className = "ww-cb-box";
    var h = document.createElement("h2"); h.id = "ww-cb-t"; h.textContent = "⚔ Combate iniciado!";
    var p = document.createElement("p"); p.textContent = "O mestre começou um combate. Entre para ver o tabuleiro e a ordem de iniciativa.";
    var r = document.createElement("div"); r.className = "ww-cb-row";
    var go = document.createElement("a"); go.className = "ww-cb-go"; go.href = "combate.html"; go.textContent = "Ir para o combate";
    go.addEventListener("click", function(){ markSeen(shown); });
    var no = document.createElement("button"); no.type = "button"; no.className = "ww-cb-no"; no.textContent = "Agora não";
    no.addEventListener("click", function(){ markSeen(shown); close(); });
    r.appendChild(go); r.appendChild(no);
    d.appendChild(h); d.appendChild(p); d.appendChild(r); box.appendChild(d);
    document.body.appendChild(box);
    document.addEventListener("keydown", onKey);
    go.focus();
  }
  /* Botões "Ir para o combate" (atributo data-ww-combate): só aparecem com combate ativo */
  function links(on){
    document.querySelectorAll("[data-ww-combate]").forEach(function(a){ a.hidden = !on; });
  }
  function check(row){
    if(!row){ links(false); return; }
    links(!!row.ativo);
    if(!row.ativo){ if(box){ close(); } return; }   // combate encerrado: some o aviso
    if(!row.iniciado_em || row.iniciado_em === seen() || row.iniciado_em === shown){ return; }
    show(row);
  }
  function fetchRow(){
    sb.from("combate").select("ativo,iniciado_em").eq("id", 1).maybeSingle().then(function(r){
      if(!r.error){ check(r.data); }   // sem a tabela (combate.sql não rodado): fica quieto
    });
  }
  function start(){
    if(started){ return; } started = true;
    fetchRow();
    try {
      sb.channel("combate-aviso").on("postgres_changes", {event: "UPDATE", schema: "public", table: "combate"}, function(p){
        check(p.new);
      }).subscribe();
    } catch(e){}
    // reforço caso o tempo real não chegue (rede, aba em segundo plano, etc.)
    pollT = setInterval(fetchRow, 8000);
    document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "visible"){ fetchRow(); } });
    window.addEventListener("focus", fetchRow);
  }
  sb.auth.getSession().then(function(r){ if(r.data.session){ start(); } });
  sb.auth.onAuthStateChange(function(ev, s){ if(s){ setTimeout(start, 0); } });
})();
