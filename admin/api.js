/*
  Small Supabase client for the admin area.

  It talks to the documented Supabase Auth and REST endpoints directly, so no third-party
  script runs on the page that handles your password. It only uses the PUBLIC publishable key
  from config.js. What a signed-in user may actually do is decided by Row Level Security in
  supabase/schema.sql, not by this file.
*/
(function () {
  'use strict';

  var cfg = window.PORTFOLIO_SUPABASE || {};
  var STORE = 'ep-admin-session';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var memory = null;          // fallback when localStorage is unavailable
  var refreshing = null;      // one refresh at a time (refresh tokens rotate)
  var signedOutHandlers = [];

  function fail(kind, message, status) {
    var e = new Error(message);
    e.kind = kind;
    e.status = status || 0;
    return e;
  }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  /* ---------- session storage ---------- */
  function readSession() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return memory; }
  }
  function saveSession(s) {
    try {
      if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE);
      memory = null;
    } catch (e) { memory = s; }
  }
  function normalize(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (nowSec() + (data.expires_in || 3600)),
      user: data.user ? { id: data.user.id, email: data.user.email } : null
    };
  }

  /* ---------- low-level fetch ---------- */
  function rawFetch(path, opts) {
    opts = opts || {};
    var headers = { 'apikey': cfg.key, 'Accept': 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    return fetch(cfg.url + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    }).catch(function () {
      throw fail('network', 'Could not reach the server. Check your connection and try again.');
    });
  }
  function parse(res) {
    return res.text().then(function (t) {
      if (!t) return null;
      try { return JSON.parse(t); } catch (e) { return null; }
    });
  }
  function httpError(res) {
    if (res.status === 404) {
      return fail('setup', 'The database is not set up yet. Run supabase/schema.sql in the Supabase SQL editor.', 404);
    }
    if (res.status === 401 || res.status === 403) {
      return fail('forbidden', 'Not allowed. This account may not be authorized.', res.status);
    }
    return fail('http', 'Something went wrong (error ' + res.status + '). Please try again.', res.status);
  }

  /* ---------- auth ---------- */
  function signIn(email, password) {
    return rawFetch('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: email, password: password }
    }).then(function (res) {
      return parse(res).then(function (data) {
        if (!res.ok) {
          var code = data && (data.error_code || data.error || data.code);
          var text = String((data && (data.msg || data.message || data.error_description)) || '');
          if (res.status === 429 || code === 'over_request_rate_limit') {
            throw fail('rate', 'Too many attempts. Please wait a minute and try again.', 429);
          }
          if (code === 'email_not_confirmed') {
            throw fail('setup', 'This account’s email is not confirmed yet. Confirm it in Supabase (Authentication → Users).', res.status);
          }
          if (code === 'email_provider_disabled') {
            throw fail('setup', 'Email sign-in is turned off in Supabase. Turn it on under Authentication → Sign In / Providers → Email.', res.status);
          }
          if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
            throw fail('credentials', 'Incorrect email or password.', res.status);
          }
          if (res.status === 401 || res.status === 403 || /api key/i.test(text)) {
            throw fail('setup', 'Supabase rejected the site’s key (error ' + res.status + '). The key in admin/config.js may be wrong.', res.status);
          }
          throw fail('http', 'Sign-in was refused (error ' + res.status + (code ? ': ' + code : '') + '). Please check your Supabase settings.', res.status);
        }
        var s = normalize(data);
        saveSession(s);
        return s;
      });
    });
  }

  function refresh() {
    if (refreshing) return refreshing;
    var s = readSession();
    if (!s || !s.refresh_token) return Promise.resolve(null);
    refreshing = rawFetch('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: s.refresh_token }
    }).then(function (res) {
      return parse(res).then(function (data) {
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500) { saveSession(null); return null; }
          throw fail('http', 'Could not refresh your session (error ' + res.status + ').', res.status);
        }
        var n = normalize(data);
        saveSession(n);
        return n;
      });
    }).then(function (r) { refreshing = null; return r; },
            function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  function getSession() {
    var s = readSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.expires_at - nowSec() > 60) return Promise.resolve(s);
    return refresh();
  }

  function fireSignedOut() {
    signedOutHandlers.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
  }
  function onSignedOut(fn) { signedOutHandlers.push(fn); }

  function signOut() {
    var s = readSession();
    saveSession(null);
    if (!s || !s.access_token) return Promise.resolve();
    return rawFetch('/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token })
      .then(function () {}, function () {});
  }

  /* Authenticated request: refreshes an expiring token, retries once on 401. */
  function authed(path, opts, retried) {
    return getSession().then(function (s) {
      if (!s) { fireSignedOut(); throw fail('auth', 'Your session has ended. Please sign in again.', 401); }
      var o = {};
      Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
      o.token = s.access_token;
      return rawFetch(path, o).then(function (res) {
        if (res.status === 401) {
          if (!retried) {
            var cur = readSession();
            if (cur) { cur.expires_at = 0; saveSession(cur); }
            return authed(path, opts, true);
          }
          saveSession(null);
          fireSignedOut();
          throw fail('auth', 'Your session has ended. Please sign in again.', 401);
        }
        return res;
      });
    });
  }

  /* ---------- data ---------- */
  function isAdmin() {
    return authed('/rest/v1/rpc/is_admin', { method: 'POST', body: {} }).then(function (res) {
      return parse(res).then(function (d) {
        if (!res.ok) throw httpError(res);
        return d === true;
      });
    });
  }

  function listMessages() {
    var q = '/rest/v1/messages?select=id,name,email,subject,message,is_read,created_at&order=created_at.desc&limit=1000';
    return authed(q).then(function (res) {
      return parse(res).then(function (d) {
        if (!res.ok) throw httpError(res);
        return Array.isArray(d) ? d : [];
      });
    });
  }

  /* Changes or deletes ONE message and checks that a row was really affected,
     so the dashboard never claims success when the database refused. */
  function mutate(method, id, body) {
    if (!UUID.test(String(id))) return Promise.reject(fail('http', 'Invalid message id.'));
    return authed('/rest/v1/messages?id=eq.' + id + '&select=id', {
      method: method, body: body, prefer: 'return=representation'
    }).then(function (res) {
      return parse(res).then(function (d) {
        if (!res.ok) throw httpError(res);
        if (!Array.isArray(d) || d.length === 0) {
          throw fail('notfound', 'Nothing was changed. The message may already be gone, or this account is not authorized.');
        }
        return true;
      });
    });
  }
  function setRead(id, isRead) { return mutate('PATCH', id, { is_read: !!isRead }); }
  function deleteMessage(id) { return mutate('DELETE', id); }

  window.AdminAPI = {
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    isAdmin: isAdmin,
    onSignedOut: onSignedOut,
    listMessages: listMessages,
    setRead: setRead,
    deleteMessage: deleteMessage
  };
})();
