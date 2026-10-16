/* Shared sign-in for the Head Pyro Tools and Manage/Edit pages.
   Include with <script src="auth.js"></script>, then call Auth.require('hp') or Auth.require('admin') at the top of a page.

   How it works: the lock screens call Auth.login(), which asks the server to check the password and hands back a signed
   token that lasts a day. The token is kept for this browser tab only. Every request this page sends to the Google Apps
   Script gets that token added automatically, and the SERVER decides what it may see or change. If the server says the
   sign-in is missing or has run out, the person is sent back to the right password screen and returns here afterwards.

   A person can also sign in with their own Google account (Auth.googleLogin), if an admin has added their email to the
   Manage Access list with one or more roles. That token is kept under its own key ('google') and can carry any mix of
   roles (hp, admin, payroll, photoMod), not just the one tier a password login grants. */
(function(){
  var API = 'https://script.google.com/macros/s/AKfycbxHGsAnuVvfdr5O0-lC7U01tCclhAVIrrGEwLfVoaa142YYGU0OyX1tBCiK1nGOqf_n8A/exec';
  var GOOGLE_CLIENT_ID = '691238707295-qa5ugobjgrkeou9ji46hdtp354n4dgv0.apps.googleusercontent.com';
  var KEY = { hp: 'authToken_hp', admin: 'authToken_admin', google: 'authToken_google' };
  var LOCK_PAGE = { hp: 'hp-tools.html', admin: 'manage.html' };
  var realFetch = window.fetch.bind(window);
  var pageTier = null;      // the level this page asked for with Auth.require()
  var googleRoles = [];     // roles on the current Google-sign-in token, if any (read from sessionStorage at load)

  function store(){ try{ return window.sessionStorage; } catch(e){ return null; } }
  function read(tier){ var s = store(); return s ? s.getItem(KEY[tier]) : null; }
  function clear(tier){ var s = store(); if(s) s.removeItem(KEY[tier]); }
  function loadGoogleRoles(){
    try{ var saved = JSON.parse(sessionStorage.getItem('authRoles_google') || '[]'); return Array.isArray(saved) ? saved : []; } catch(e){ return []; }
  }
  googleRoles = loadGoogleRoles();
  // A full Manage/Edit (admin) password sign-in satisfies any level, same as the server treats it.
  // A Google sign-in satisfies a level if that role (or 'admin') is in the list the server granted it.
  function has(tier){
    if(read('admin') || googleRoles.indexOf('admin') > -1) return true;
    if(tier === 'hp') return !!read('hp') || googleRoles.indexOf('hp') > -1;
    if(tier === 'admin') return false;
    return googleRoles.indexOf(tier) > -1;
  }
  function bestToken(){ return read('admin') || read('hp') || read('google') || ''; }
  function here(){ return (location.pathname.split('/').pop() || 'index.html') + location.search; }
  function toLock(tier, why){
    // payroll/photoMod have no password screen of their own (they're Google-only roles) — manage.html
    // is the fallback, since a full admin signing in there also satisfies those levels.
    var target = LOCK_PAGE[tier] || 'manage.html';
    // The lock screen for a tier can BE the protected page itself (manage.html is both the
    // Manage/Edit password screen and the Manage/Edit page). If something on that page tries
    // to call the server before sign-in and gets bounced here, sending it to "manage.html?next=
    // manage.html" is pointless (we're already here) — and every re-bounce re-encodes the last
    // next, so the query string doubles in length each time until the browser refuses the URL.
    // When the lock page is the current page, just reload it plain instead of chaining next=.
    if((location.pathname.split('/').pop() || 'index.html') === target){
      location.replace(target + (why ? '?why=' + why : ''));
      return;
    }
    location.replace(target + '?next=' + encodeURIComponent(here()) + (why ? '&why=' + why : ''));
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
          // Store under whichever tier the token actually carries (the master and tasks passwords
          // both always come back as 'admin', even when typed into the Head Pyro lock screen), so
          // Auth.has('admin') works right away no matter which screen was used to sign in.
          var actualTier = data.tier === 'admin' ? 'admin' : tier;
          if(s) s.setItem(KEY[actualTier], data.token);
          return { ok: true, goToTasks: !!data.goToTasks, tasks: data.tasks || null };
        }
        return { ok: false, code: data && data.code, message: (data && data.message) || 'Could not sign in.' };
      }).catch(function(){
        return { ok: false, code: 'network', message: "Couldn't reach the server \u2014 check your connection and try again." };
      });
    },

    // Sign in with a Google ID token (from Auth.renderGoogleButton's callback). The server checks the
    // token with Google itself and looks the email up in the Manage Access list; ok only if it's there.
    googleLogin: function(idToken){
      return realFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ recordType: 'googleLogin', idToken: idToken })
      }).then(function(res){ return res.json(); }).then(function(data){
        if(data && data.status === 'ok' && data.token){
          var s = store();
          if(s){
            s.setItem(KEY.google, data.token);
            s.setItem('authRoles_google', JSON.stringify(data.roles || []));
            s.setItem('authName_google', data.name || '');
            s.setItem('authEmail_google', data.email || '');
          }
          googleRoles = data.roles || [];
          return { ok: true, roles: googleRoles, name: data.name || '', email: data.email || '' };
        }
        return { ok: false, code: data && data.code, message: (data && data.message) || 'Could not sign in.' };
      }).catch(function(){
        return { ok: false, code: 'network', message: "Couldn't reach the server — check your connection and try again." };
      });
    },

    // Loads the Google Identity Services script (once) and draws its sign-in button into elementId.
    // onToken(idToken) is called when someone successfully signs in with Google on that button.
    renderGoogleButton: function(elementId, onToken){
      function draw(){
        try{
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: function(resp){ onToken(resp.credential); }
          });
          google.accounts.id.renderButton(document.getElementById(elementId), { theme: 'outline', size: 'large', width: 280 });
        } catch(e){ /* Google script failed to load or init — the page's own password screen still works */ }
      }
      if(window.google && window.google.accounts && window.google.accounts.id){ draw(); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = draw;
      document.head.appendChild(s);
    },

    // Name/email from the current Google sign-in, for a page that wants to greet the person or
    // pre-fill a field with their name. {name:'', email:''} if nobody is signed in with Google.
    googleInfo: function(){
      var s = store();
      return { name: (s && s.getItem('authName_google')) || '', email: (s && s.getItem('authEmail_google')) || '' };
    },

    // Signs out of Google only, for a page that lets someone browse signed out and sign in inline
    // to unlock one action (as opposed to lock()/lockThisPhone(), which also forgets the crew
    // directory and is meant for a shared phone leaving a password-protected page entirely).
    signOutGoogle: function(){
      clear('google');
      try{ sessionStorage.removeItem('authRoles_google'); sessionStorage.removeItem('authName_google'); sessionStorage.removeItem('authEmail_google'); } catch(e){}
      googleRoles = [];
    },

    // The server said the sign-in is missing or ran out.
    // (A Manage/Edit page can ask for something that only needs Head Pyro level, such as the crew list. When that is
    // refused it is still the Manage/Edit sign-in that has run out, so the page's own level decides which screen to show.)
    expired: function(needs){
      var tier = (pageTier === 'admin' || needs === 'admin') ? 'admin' : (pageTier === 'hp' || needs === 'hp') ? 'hp' : (pageTier || needs);
      clear('hp'); clear('admin'); clear('google');
      try{ sessionStorage.removeItem('authRoles_google'); sessionStorage.removeItem('authName_google'); sessionStorage.removeItem('authEmail_google'); } catch(e){}
      googleRoles = [];
      toLock(tier, 'expired');
    },

    // Forget this sign-in and the crew list cached on the phone (for a shared phone).
    lock: function(){
      clear('hp'); clear('admin'); clear('google');
      try{ sessionStorage.removeItem('authRoles_google'); sessionStorage.removeItem('authName_google'); sessionStorage.removeItem('authEmail_google'); } catch(e){}
      googleRoles = [];
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
      // Only bounce the page away if IT asked for a sign-in level with Auth.require() in the first
      // place. A page like Show Schedule or Photo Wall never calls require() — it's open to everyone
      // and makes its own best-effort or optional calls (an 'hp'-only phone lookup, a 'crew'-gated
      // sign-up) that are expected to come back denied for a signed-out visitor; sending that visitor
      // away to a password screen they were never asked to use would just kick them off the page.
      if(res && res.type !== 'opaque' && pageTier){
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

  // Shared by any lock screen that can get the goToTasks flag back from a login (currently
  // Head Pyro Tools and Manage/Edit), so the alert reads the same wherever it's typed.
  window.tasksAlertText = function(tasks){
    if(!tasks || !tasks.totalCount) return "Nice — nothing needs your attention right now.";
    var lines = [tasks.totalCount + ' task' + (tasks.totalCount === 1 ? '' : 's') + ' need your attention:'];
    if(tasks.venuesNeedHp && tasks.venuesNeedHp.length){
      lines.push('• ' + tasks.venuesNeedHp.length + ' upcoming show' + (tasks.venuesNeedHp.length === 1 ? '' : 's') + ' need' + (tasks.venuesNeedHp.length === 1 ? 's' : '') + ' a Head Pyro assigned');
    }
    if(tasks.payrollNeedsApproval && tasks.payrollNeedsApproval.length){
      lines.push('• ' + tasks.payrollNeedsApproval.length + ' show' + (tasks.payrollNeedsApproval.length === 1 ? '' : 's') + ' with payroll pending approval');
    }
    if(tasks.photoWallPending && tasks.photoWallPending.length){
      lines.push('• ' + tasks.photoWallPending.length + ' photo' + (tasks.photoWallPending.length === 1 ? '' : 's') + ' waiting on review');
    }
    return lines.join('\n');
  };
})();
