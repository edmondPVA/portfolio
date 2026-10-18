(function () {
  'use strict';

  var API = window.AdminAPI;
  var DASHBOARD = '../';

  var form = document.getElementById('loginForm');
  var btn = document.getElementById('loginBtn');
  var msg = document.getElementById('msg');
  var emailEl = document.getElementById('email');
  var passEl = document.getElementById('password');

  function show(text, info) {
    msg.textContent = text;
    msg.classList.toggle('info', !!info);
    msg.hidden = false;
  }
  function hide() { msg.hidden = true; msg.textContent = ''; }
  function busy(on) {
    btn.disabled = on;
    btn.textContent = on ? 'Signing in…' : 'Sign in';
  }

  var params = new URLSearchParams(location.search);
  if (params.get('expired')) show('Your session expired. Please sign in again.', true);
  if (params.get('denied')) show('That account is not authorized to use the admin area.');

  // Already signed in as an admin? Go straight to the dashboard (the form stays hidden meanwhile).
  function showForm() { document.documentElement.classList.remove('has-session'); }
  API.getSession().then(function (s) {
    if (!s) { showForm(); return null; }
    return API.isAdmin().then(function (ok) { if (ok) location.replace(DASHBOARD); else showForm(); });
  }).catch(showForm); // on any problem, fall back to the sign-in form

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hide();
    var email = emailEl.value.trim();
    var pw = passEl.value;
    if (!email || !pw) { show('Enter your email and password.'); return; }

    busy(true);
    var signedIn = false;
    API.signIn(email, pw)
      .then(function () { signedIn = true; return API.isAdmin(); })
      .then(function (ok) {
        if (ok) { location.replace(DASHBOARD); return; }
        return API.signOut().then(function () {
          passEl.value = '';
          show('This account is not authorized to use the admin area.');
          busy(false);
        });
      })
      .catch(function (err) {
        var after = signedIn ? API.signOut() : Promise.resolve();
        after.then(function () {
          if (err && err.kind === 'credentials') passEl.value = '';
          show(err && err.message ? err.message : 'Something went wrong. Please try again.');
          busy(false);
        });
      });
  });
})();
