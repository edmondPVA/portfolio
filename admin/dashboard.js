(function () {
  'use strict';

  var API = window.AdminAPI;
  var LOGIN = 'login/';

  var state = { messages: [], loaded: false, loading: false, loadError: '', selectedId: null, view: 'overview' };
  var bound = false;

  var SOON = {
    skills:     ['Skills', 'Skills manager', 'Add, edit, reorder, and show or hide your skills. The public portfolio will update automatically, with no HTML editing.'],
    experience: ['Work Experience', 'Work experience manager', 'Edit your roles, dates, responsibilities and achievements, and choose what shows publicly.'],
    projects:   ['Projects', 'Projects manager', 'Add projects with links and screenshots, and control their order and visibility.'],
    profile:    ['Profile / About Me', 'Profile editor', 'Update your name, headline, About Me text, profile photo and public contact links.'],
    media:      ['Photo / Media Manager', 'Proof-of-work photos', 'Upload and organize proof-of-work photos. Blur or crop any confidential client or employer details before uploading.'],
    settings:   ['Settings', 'Settings', 'Account and site settings will live here.']
  };
  var VIEWS = ['overview', 'messages'].concat(Object.keys(SOON));

  /* Only simple, safe-looking addresses become mailto: links. */
  var SAFE_EMAIL = /^[^\s@<>?&,;:"'%]+@[^\s@<>?&,;:"'%]+\.[^\s@<>?&,;:"'%]+$/;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text; // textContent only: message data is untrusted
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

  /* ---------- formatting ---------- */
  function fmtFull(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  function fmtShort(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    var o = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString(undefined, o);
  }
  function preview(t) {
    t = String(t).replace(/\s+/g, ' ').trim();
    return t.length > 120 ? t.slice(0, 120) + '…' : t;
  }

  /* ---------- toasts ---------- */
  function toast(text, kind) {
    var t = el('div', 'toast' + (kind ? ' ' + kind : ''), text);
    t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    $('toasts').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === 'err' ? 7000 : 3500);
  }

  /* ---------- data helpers ---------- */
  function current() {
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i].id === state.selectedId) return state.messages[i];
    }
    return null;
  }
  function unreadCount() {
    return state.messages.filter(function (m) { return !m.is_read; }).length;
  }
  function filtered() {
    var q = $('search').value.trim().toLowerCase();
    var f = $('filter').value;
    return state.messages.filter(function (m) {
      if (f === 'unread' && m.is_read) return false;
      if (f === 'read' && !m.is_read) return false;
      if (!q) return true;
      return [m.name, m.email, m.subject, m.message].join('\n').toLowerCase().indexOf(q) !== -1;
    });
  }

  /* ---------- rendering ---------- */
  function rowFor(m) {
    var b = el('button', 'mrow' + (m.is_read ? '' : ' unread'));
    b.type = 'button';
    b.setAttribute('data-id', m.id);
    if (m.id === state.selectedId) b.setAttribute('aria-current', 'true');
    b.appendChild(el('span', 'dot'));
    var col = el('span', 'col');
    var top = el('span', 'top');
    if (!m.is_read) top.appendChild(el('span', 'sr', 'Unread. '));
    top.appendChild(el('span', 'who', m.name));
    top.appendChild(el('span', 'when', fmtShort(m.created_at)));
    col.appendChild(top);
    col.appendChild(el('span', 'subj', m.subject));
    col.appendChild(el('span', 'prev', preview(m.message)));
    b.appendChild(col);
    return b;
  }

  function stateBox(list, text, retry) {
    var box = el('div', 'empty', text);
    if (retry) {
      var b = el('button', 'pill small', 'Try again');
      b.type = 'button';
      b.addEventListener('click', loadMessages);
      box.appendChild(document.createElement('br'));
      box.appendChild(b);
    }
    list.appendChild(box);
  }

  function renderList() {
    var list = $('mlist');
    clear(list);
    if (state.loading && !state.loaded) { stateBox(list, 'Loading messages…'); return; }
    if (state.loadError) { stateBox(list, state.loadError, true); return; }
    if (!state.messages.length) {
      stateBox(list, 'No messages yet. When someone uses the Email me form on your portfolio, it will show up here.');
      return;
    }
    var rows = filtered();
    if (!rows.length) { stateBox(list, 'No messages match your search.'); return; }
    rows.forEach(function (m) { list.appendChild(rowFor(m)); });
  }

  function renderRecent() {
    var box = $('recent');
    clear(box);
    if (state.loading && !state.loaded) { stateBox(box, 'Loading…'); return; }
    if (state.loadError) { stateBox(box, state.loadError, true); return; }
    if (!state.messages.length) { stateBox(box, 'No messages yet.'); return; }
    state.messages.slice(0, 5).forEach(function (m) { box.appendChild(rowFor(m)); });
  }

  function renderStats() {
    var ok = state.loaded && !state.loadError;
    var weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    $('statTotal').textContent = ok ? String(state.messages.length) : '–';
    $('statUnread').textContent = ok ? String(unreadCount()) : '–';
    $('statWeek').textContent = ok
      ? String(state.messages.filter(function (m) { return new Date(m.created_at).getTime() >= weekAgo; }).length)
      : '–';
    $('statLatest').textContent = ok ? (state.messages.length ? fmtShort(state.messages[0].created_at) : 'None yet') : '–';

    var n = ok ? unreadCount() : 0;
    ['unreadBadge', 'topBadge'].forEach(function (id) {
      $(id).textContent = String(n);
      $(id).hidden = n === 0;
    });
  }

  function renderDetail() {
    var box = $('mdetail');
    clear(box);
    var m = current();
    if (!m) {
      box.appendChild(el('div', 'empty',
        state.messages.length ? 'Select a message to read it.' : 'Messages from your portfolio contact form will appear here.'));
      return;
    }

    var back = el('button', 'pill ghost small back-list', '← All messages');
    back.type = 'button';
    back.addEventListener('click', function () { $('inbox').classList.remove('detail-open'); });
    box.appendChild(back);

    var h = el('h2', null, m.subject);
    h.id = 'detailTitle';
    h.tabIndex = -1;
    box.appendChild(h);

    var meta = el('div', 'meta');
    var from = el('div');
    from.appendChild(document.createTextNode('From: ' + m.name + ' ('));
    if (SAFE_EMAIL.test(m.email)) {
      var a = el('a', null, m.email);
      a.href = 'mailto:' + m.email;
      from.appendChild(a);
    } else {
      from.appendChild(document.createTextNode(m.email));
    }
    from.appendChild(document.createTextNode(')'));
    meta.appendChild(from);
    meta.appendChild(el('div', null, 'Received: ' + fmtFull(m.created_at)));
    box.appendChild(meta);

    box.appendChild(el('div', 'body', m.message));

    var acts = el('div', 'acts');
    if (SAFE_EMAIL.test(m.email)) {
      var subj = 'Re: ' + String(m.subject).replace(/[\r\n]+/g, ' ');
      var reply = el('a', 'pill small', 'Reply by email');
      reply.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent(subj);
      acts.appendChild(reply);
    }
    var toggle = el('button', 'pill ghost small', m.is_read ? 'Mark as unread' : 'Mark as read');
    toggle.type = 'button';
    toggle.addEventListener('click', function () { toggle.disabled = true; setRead(m, !m.is_read); });
    acts.appendChild(toggle);
    var del = el('button', 'pill danger small', 'Delete');
    del.type = 'button';
    del.addEventListener('click', function () { removeMessage(m); });
    acts.appendChild(del);
    box.appendChild(acts);

    box.appendChild(el('p', 'note',
      'Replying from this dashboard is coming in a later step. For now, “Reply by email” opens your email app.'));
  }

  function renderAll() {
    renderStats();
    renderRecent();
    renderList();
    renderDetail();
  }

  /* ---------- actions ---------- */
  function loadMessages() {
    state.loading = true;
    state.loadError = '';
    renderAll();
    return API.listMessages().then(function (rows) {
      state.messages = rows;
      state.loaded = true;
      if (state.selectedId && !current()) state.selectedId = null;
    }).catch(function (err) {
      if (err && err.kind === 'auth') return;
      state.loadError = (err && err.message) || 'Could not load messages.';
    }).then(function () {
      state.loading = false;
      renderAll();
    });
  }

  function setRead(m, value, quiet) {
    return API.setRead(m.id, value).then(function () {
      m.is_read = value;
      renderAll();
      if (!quiet) toast(value ? 'Marked as read' : 'Marked as unread', 'ok');
    }).catch(function (err) {
      if (err && err.kind === 'auth') return;
      renderAll();
      toast((err && err.message) || 'Could not update the message.', 'err');
    });
  }

  function askDelete(m) {
    var dlg = $('confirmDlg');
    $('dlgText').textContent = 'This permanently deletes the message from ' + m.name +
      ' (“' + m.subject + '”). This cannot be undone.';
    return new Promise(function (resolve) {
      var result = false;
      function done() { dlg.removeEventListener('close', done); resolve(result); }
      dlg.addEventListener('close', done);
      $('dlgOk').onclick = function () { result = true; dlg.close(); };
      $('dlgCancel').onclick = function () { dlg.close(); };
      dlg.showModal();
    });
  }

  function removeMessage(m) {
    askDelete(m).then(function (yes) {
      if (!yes) return;
      return API.deleteMessage(m.id).then(function () {
        state.messages = state.messages.filter(function (x) { return x.id !== m.id; });
        state.selectedId = null;
        $('inbox').classList.remove('detail-open');
        renderAll();
        toast('Message deleted', 'ok');
      }).catch(function (err) {
        if (err && err.kind === 'auth') return;
        toast((err && err.message) || 'Could not delete the message.', 'err');
      });
    });
  }

  function selectMessage(id) {
    state.selectedId = id;
    show('messages');
    $('inbox').classList.add('detail-open');
    renderList();
    renderDetail();
    if (isMobile()) { var h = $('detailTitle'); if (h) h.focus(); }
    var m = current();
    if (m && !m.is_read) setRead(m, true, true);
  }

  /* ---------- navigation ---------- */
  function closeMenu() {
    $('side').classList.remove('open');
    $('scrim').classList.remove('show');
    $('menuBtn').setAttribute('aria-expanded', 'false');
  }
  function openMenu() {
    $('side').classList.add('open');
    $('scrim').classList.add('show');
    $('menuBtn').setAttribute('aria-expanded', 'true');
  }

  function show(view) {
    if (VIEWS.indexOf(view) === -1) view = 'overview';
    state.view = view;
    $('view-overview').hidden = view !== 'overview';
    $('view-messages').hidden = view !== 'messages';
    $('view-soon').hidden = !SOON[view];
    if (SOON[view]) {
      $('soonTitle').textContent = SOON[view][0];
      $('soonHead').textContent = SOON[view][1];
      $('soonText').textContent = SOON[view][2];
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      if (b.getAttribute('data-view') === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    closeMenu();
  }

  /* ---------- start-up ---------- */
  function bind() {
    if (bound) return;
    bound = true;

    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
    });
    window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });

    $('menuBtn').addEventListener('click', function () {
      if ($('side').classList.contains('open')) closeMenu(); else openMenu();
    });
    $('scrim').addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

    function onPick(e) {
      var row = e.target.closest ? e.target.closest('.mrow') : null;
      if (row) selectMessage(row.getAttribute('data-id'));
    }
    $('mlist').addEventListener('click', onPick);
    $('recent').addEventListener('click', onPick);

    $('search').addEventListener('input', renderList);
    $('filter').addEventListener('change', renderList);
    $('refreshBtn').addEventListener('click', function () {
      loadMessages().then(function () { if (!state.loadError) toast('Messages refreshed', 'ok'); });
    });

    $('logoutBtn').addEventListener('click', function () {
      $('logoutBtn').disabled = true;
      API.signOut().then(function () { location.replace(LOGIN); });
    });

    // A page restored from the back/forward cache must not show the dashboard after logout.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) API.getSession().then(function (s) { if (!s) location.replace(LOGIN); }, function () {});
    });
  }

  function gateLoading() {
    var gate = $('gate');
    clear(gate);
    var sp = el('span', 'spinner');
    sp.setAttribute('aria-hidden', 'true');
    gate.appendChild(sp);
    gate.appendChild(el('span', null, 'Loading…'));
  }

  function gateError(text, retry) {
    var gate = $('gate');
    clear(gate);
    gate.appendChild(el('span', null, text));
    var b = el('button', 'pill small', 'Try again');
    b.type = 'button';
    b.addEventListener('click', function () { gateLoading(); retry(); });
    gate.appendChild(b);
  }

  function start(session) {
    $('who').textContent = (session.user && session.user.email) || '';
    $('gate').hidden = true;
    $('app').hidden = false;
    bind();
    show(location.hash.replace('#', '') || 'overview');
    loadMessages();
  }

  function init() {
    API.getSession().then(function (s) {
      if (!s) { location.replace(LOGIN); return; }
      return API.isAdmin().then(function (ok) {
        if (!ok) return API.signOut().then(function () { location.replace(LOGIN + '?denied=1'); });
        start(s);
      });
    }).catch(function (err) {
      if (err && err.kind === 'auth') return; // already redirecting
      gateError((err && err.message) || 'Something went wrong.', init);
    });
  }

  API.onSignedOut(function () { location.replace(LOGIN + '?expired=1'); });
  init();
})();
