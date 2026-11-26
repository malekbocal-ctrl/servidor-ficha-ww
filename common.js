/* Cria o cliente do Supabase, usado por index.html e ficha.html. */
(function(){
  var c = window.WW_CONFIG;
  if(!c || !c.SUPABASE_URL || c.SUPABASE_URL.indexOf("COLE_AQUI") === 0 || !c.SUPABASE_ANON_KEY || c.SUPABASE_ANON_KEY.indexOf("COLE_AQUI") === 0){
    window.WW_MISSING = true; return;
  }
  if(!window.supabase){ window.WW_MISSING = true; window.WW_NOLIB = true; return; }
  window.sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
})();
