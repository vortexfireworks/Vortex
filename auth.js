/* Shared sign-in for the Head Pyro Tools and Manage/Edit pages.
   Include with <script src="auth.js"></script>, then call Auth.require('hp') or Auth.require('admin') at the top of a page.

   How it works: the lock screens call Auth.login(), which asks the server to check the password and hands back a signed
   token that lasts a day. The token is kept for this browser tab only. Every request this page sends to the Google Apps
   Script gets that token added automatically, and the SERVER decides what it may see or change. If the server says the
   sign-in is missing or has run out, the person is sent back to the right password screen and returns here afterwards. */
(function(){
  var API = 'https://script.google.com/macros/s/AKfycbyh2E21uM3TooJlwllIOL4BfoHkcAnlNautV4zcpZpj2lEUnq66oDDN6TfUiaTbXgMsrQ/exec';
  var KEY = { hp: 'authToken_hp', admin: 'authToken_admin' };
  var LOCK_PAGE = { hp: 'hp-tools.html', admin: 'manage.html' };
  var realFetch = window.fetch.bind(window);
  var pageTier = null;      // the level this page asked for with Auth.require()

  function store(){ try{ return window.sessionStorage; } catch(e){ return null; } }
  function read(tier){ var s = store(); return s ? s.getItem(KEY[tier]) : null; }
  function clear(tier){ var s = store(); if(s) s.removeItem(KEY[tier]); }
  // A Manage/Edit sign-in also satisfies anything that only needs Head Pyro access.
  function has(tier){ return tier === 'admin' ? !!read('admin') : !!(read('hp') || read('admin')); }
  function bestToken(){ return read('admin') || read('hp') || ''; }
  function here(){ return (location.pathname.split('/').pop() || 'index.html') + location.search; }
  function toLock(tier, why){
    location.replace(LOCK_PAGE[tier] + '?next=' + encodeURIComponent(here()) + (why ? '&why=' + why : ''));
  }

  var Auth = {
    has: has,

    // Call first thing on a protected page. Sends the person to the password screen if they have not signed in.
    // The page's own level is remembered, so if the sign-in runs out later they are sent to the RIGHT password screen.
    require: function(tier){ pageTier = tier; if(!has(tier)) toLock(tier); },

    login: function(tier, password){
      return realFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ recordType: 'login', tier: tier, password: password })
      }).then(function(res){ return res.json(); }).then(function(data){
        if(data && data.status === 'ok' && data.token){
          var s = store();
          if(s) s.setItem(KEY[tier], data.token);
          return { ok: true };
        }
        return { ok: false, code: data && data.code, message: (data && data.message) || 'Could not sign in.' };
      }).catch(function(){
        return { ok: false, code: 'network', message: "Couldn't reach the server \u2014 check your connection and try again." };
      });
    },

    // The server said the sign-in is missing or ran out.
    // (A Manage/Edit page can ask for something that only needs Head Pyro level, such as the crew list. When that is
    // refused it is still the Manage/Edit sign-in that has run out, so the page's own level decides which screen to show.)
    expired: function(needs){
      var tier = (pageTier === 'admin' || needs === 'admin') ? 'admin' : 'hp';
      clear('hp'); clear('admin');
      toLock(tier, 'expired');
    },

    // Forget this sign-in and the crew list cached on the phone (for a shared phone).
    lock: function(){
      clear('hp'); clear('admin');
      Directory.clear();
    },

    // Where to go after signing in, but only to a page in this app (never to another site).
    nextPage: function(){
      var next = new URLSearchParams(location.search).get('next');
      return next && /^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.-]*)?$/.test(next) ? next : null;
    },
    expiredNotice: function(){ return new URLSearchParams(location.search).get('why') === 'expired'; }
  };

  // Every request to the script carries the token, so individual pages do not each have to remember to.
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if(url.indexOf(API) !== 0) return realFetch(input, init);
    var token = bestToken();
    init = init ? Object.assign({}, init) : {};
    var method = String(init.method || 'GET').toUpperCase();
    if(token){
      if(method === 'GET'){
        if(!/[?&]token=/.test(url)) url += (url.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(token);
      } else if(typeof init.body === 'string'){
        try{
          var body = JSON.parse(init.body);
          if(body && typeof body === 'object' && !Array.isArray(body) && body.recordType !== 'login' && !body.token){
            body.token = token;
            init.body = JSON.stringify(body);
          }
        } catch(e){ /* not JSON: leave it alone */ }
      }
    }
    return realFetch(url, init).then(function(res){
      if(res && res.type !== 'opaque'){
        try{
          res.clone().json().then(function(j){ if(j && j.code === 'auth') Auth.expired(j.needs); }).catch(function(){});
        } catch(e){}
      }
      return res;
    });
  };

  // A copy of the crew directory kept on the phone so name and address autofill still work with no signal at a show.
  // It exists only on phones that have signed in, and Auth.lock() removes it.
  var Directory = {
    KEY: 'crewDirectory_v1',
    cached: function(){
      try{ var d = JSON.parse(localStorage.getItem(Directory.KEY) || '[]'); return Array.isArray(d) ? d : []; } catch(e){ return []; }
    },
    save: function(list){ try{ if(Array.isArray(list)) localStorage.setItem(Directory.KEY, JSON.stringify(list)); } catch(e){} },
    clear: function(){ try{ localStorage.removeItem(Directory.KEY); } catch(e){} }
  };

  window.Auth = Auth;
  window.Directory = Directory;
})();
