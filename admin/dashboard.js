(function () {
  'use strict';

  var API = window.AdminAPI;
  var HOME = '../';                 // the portfolio, where the sign-in modal lives
  var LOGIN = HOME + '?signin=1';

  var state = { skills: [], skillsLoaded: false, exp: [], expLoaded: false, messages: [], loaded: false, loading: false, loadError: '', selectedId: null, view: 'overview' };
  var bound = false;

  var SOON = {
    projects:   ['Projects', 'Projects manager', 'Add projects with links and screenshots, and control their order and visibility.'],
    profile:    ['Profile / About Me', 'Profile editor', 'Update your name, headline, About Me text, profile photo and public contact links.'],
    media:      ['Photo / Media Manager', 'Proof-of-work photos', 'Upload and organize proof-of-work photos. Blur or crop any confidential client or employer details before uploading.'],
    settings:   ['Settings', 'Settings', 'Account and site settings will live here.']
  };
  var VIEWS = ['overview', 'messages', 'skills', 'experience'].concat(Object.keys(SOON));

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


  /* ---------- generic confirm ---------- */
  function confirmBox(title, text, okLabel) {
    var dlg = $('confirmDlg');
    $('dlgTitle').textContent = title;
    $('dlgText').textContent = text;
    $('dlgOk').textContent = okLabel || 'Delete';
    return new Promise(function (resolve) {
      var result = false;
      function done() { dlg.removeEventListener('close', done); resolve(result); }
      dlg.addEventListener('close', done);
      $('dlgOk').onclick = function () { result = true; dlg.close(); };
      $('dlgCancel').onclick = function () { dlg.close(); };
      dlg.showModal();
    });
  }
  function fail(err, fallback) {
    if (err && err.kind === 'auth') return;
    toast((err && err.message) || fallback, 'err');
  }

  /* ---------- skills ---------- */
  function groupNames() {
    var seen = [];
    state.skills.forEach(function (r) { if (seen.indexOf(r.group_name) === -1) seen.push(r.group_name); });
    return seen;
  }
  function renderSkills() {
    var box = $('skillGroups');
    clear(box);
    if (state.skillsError) {
      var e = el('div', 't empty', state.skillsError);
      box.appendChild(e);
      return;
    }
    if (!state.skillsLoaded) { box.appendChild(el('div', 't empty', 'Loading skills…')); return; }
    if (!state.skills.length) box.appendChild(el('div', 't empty', 'No skills yet. Add your first one below.'));
    groupNames().forEach(function (g) {
      var card = el('div', 't sk-group');
      var head = el('div', 'sk-head');
      head.appendChild(el('h2', null, g));
      var rg = el('button', 'pill ghost small', 'Remove group');
      rg.type = 'button';
      rg.setAttribute('aria-label', 'Remove the group ' + g + ' and all its skills');
      rg.addEventListener('click', function () { removeGroup(g); });
      head.appendChild(rg);
      card.appendChild(head);
      var chips = el('div', 'sk-chips');
      state.skills.filter(function (r) { return r.group_name === g; }).forEach(function (r) {
        var c = el('span', 'sk-chip', r.name);
        var x = el('button', null, '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Remove ' + r.name);
        x.addEventListener('click', function () { removeSkill(r); });
        c.appendChild(x);
        chips.appendChild(c);
      });
      card.appendChild(chips);
      box.appendChild(card);
    });
    var dl = $('skGroupList');
    clear(dl);
    groupNames().forEach(function (g) { var o = document.createElement('option'); o.value = g; dl.appendChild(o); });
  }
  function loadSkills() {
    state.skillsError = '';
    renderSkills();
    return API.listRows('skills').then(function (rows) {
      state.skills = rows; state.skillsLoaded = true;
    }).catch(function (err) {
      if (err && err.kind === 'auth') return;
      state.skillsError = (err && err.message) || 'Could not load skills.';
    }).then(renderSkills);
  }
  function removeSkill(r) {
    confirmBox('Remove this skill?', '“' + r.name + '” will disappear from your portfolio.', 'Remove').then(function (yes) {
      if (!yes) return;
      API.deleteRow('skills', r.id).then(function () {
        state.skills = state.skills.filter(function (x) { return x.id !== r.id; });
        renderSkills();
        toast('Skill removed', 'ok');
      }).catch(function (err) { fail(err, 'Could not remove the skill.'); });
    });
  }
  function removeGroup(g) {
    var rows = state.skills.filter(function (r) { return r.group_name === g; });
    if (!rows.length) return;
    var n = rows.length;
    confirmBox('Remove the group “' + g + '”?', 'This removes the group and its ' + n + (n === 1 ? ' skill' : ' skills') + ' from your portfolio. This cannot be undone.', 'Remove group').then(function (yes) {
      if (!yes) return;
      Promise.all(rows.map(function (r) { return API.deleteRow('skills', r.id).then(function () { return r.id; }, function () { return null; }); })).then(function (ids) {
        var gone = ids.filter(Boolean);
        state.skills = state.skills.filter(function (x) { return gone.indexOf(x.id) === -1; });
        renderSkills();
        if (gone.length === rows.length) toast('Group removed', 'ok');
        else fail(null, 'Some skills in this group could not be removed. Try again.');
      });
    });
  }
  function addSkill(ev) {
    ev.preventDefault();
    var name = $('skName').value.trim(), group = $('skGroup').value.trim();
    if (!name || !group) return;
    var max = state.skills.reduce(function (m, r) { return Math.max(m, r.sort_order); }, 0);
    var btn = $('skAdd');
    btn.disabled = true;
    API.saveRow('skills', null, { name: name, group_name: group, sort_order: max + 1, visible: true }).then(function (row) {
      state.skills.push(row);
      $('skName').value = '';
      renderSkills();
      toast('Skill added', 'ok');
    }).catch(function (err) { fail(err, 'Could not add the skill.'); }).then(function () { btn.disabled = false; });
  }

  /* ---------- work experience ---------- */
  function loadExp() {
    state.expError = '';
    renderExp();
    return API.listRows('experience').then(function (rows) {
      state.exp = rows; state.expLoaded = true;
    }).catch(function (err) {
      if (err && err.kind === 'auth') return;
      state.expError = (err && err.message) || 'Could not load work experience.';
    }).then(renderExp);
  }
  function field(label, id, value, opts) {
    var f = el('div', 'field');
    var l = el('label', null, label);
    l.setAttribute('for', id);
    f.appendChild(l);
    var i = document.createElement(opts && opts.area ? 'textarea' : 'input');
    i.id = id; i.className = 'inp'; i.value = value || '';
    if (opts && opts.max) i.maxLength = opts.max;
    if (opts && opts.ph) i.placeholder = opts.ph;
    if (opts && opts.rows) i.rows = opts.rows;
    f.appendChild(i);
    return { wrap: f, input: i };
  }
  function check(label, checked) {
    var w = el('label', 'sw');
    var c = document.createElement('input');
    c.type = 'checkbox'; c.checked = !!checked;
    w.appendChild(c);
    w.appendChild(document.createTextNode(label));
    return { wrap: w, input: c };
  }
  function roleCard(r, idx, total) {
    var key = r.id || 'new';
    var card = el('div', 't exp-card' + (r.visible === false ? ' hidden-role' : ''));
    var head = el('div', 'head-row');
    head.appendChild(el('b', null, r.role || 'New role'));
    card.appendChild(head);

    var role = field('Role', 'r-role-' + key, r.role, { max: 150 });
    var co = field('Company', 'r-co-' + key, r.company, { max: 150 });
    var two0 = el('div', 'two'); two0.appendChild(role.wrap); two0.appendChild(co.wrap);
    card.appendChild(two0);

    var st = field('Start (optional)', 'r-st-' + key, r.start_label, { max: 30, ph: 'For example, Sept 2024' });
    var en = field('End (optional)', 'r-en-' + key, r.end_label, { max: 30, ph: 'Leave blank if you do not want an end date' });
    var two1 = el('div', 'two'); two1.appendChild(st.wrap); two1.appendChild(en.wrap);
    card.appendChild(two1);
    var cur = check('Currently working here (shows “Present”)', r.is_current);
    card.appendChild(cur.wrap);

    var bl = field('What I did (one point per line)', 'r-bl-' + key, r.bullets, { area: true, max: 4000, rows: 6 });
    card.appendChild(bl.wrap);

    var vis = check('Show on portfolio', r.visible !== false);
    card.appendChild(vis.wrap);

    var acts = el('div', 'acts');
    var save = el('button', 'pill small', r.id ? 'Save changes' : 'Add role');
    save.type = 'button';
    save.addEventListener('click', function () {
      var role = $('r-role-' + key).value.trim();
      if (!role) { toast('Add a role title first.', 'err'); $('r-role-' + key).focus(); return; }
      var fields = {
        role: role,
        company: $('r-co-' + key).value.trim(),
        start_label: $('r-st-' + key).value.trim(),
        end_label: $('r-en-' + key).value.trim(),
        is_current: cur.input.checked,
        bullets: $('r-bl-' + key).value.replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).join('\n'),
        visible: vis.input.checked
      };
      saveRole(r, fields, save);
    });
    acts.appendChild(save);
    if (r.id) {
      var up = el('button', 'pill ghost small', 'Move up');
      up.type = 'button'; up.disabled = idx === 0;
      up.addEventListener('click', function () { moveRole(idx, -1); });
      var dn = el('button', 'pill ghost small', 'Move down');
      dn.type = 'button'; dn.disabled = idx === total - 1;
      dn.addEventListener('click', function () { moveRole(idx, 1); });
      acts.appendChild(up); acts.appendChild(dn);
      acts.appendChild(el('span', 'grow'));
      var del = el('button', 'pill danger small', 'Delete');
      del.type = 'button';
      del.addEventListener('click', function () { removeRole(r); });
      acts.appendChild(del);
    } else {
      var cancel = el('button', 'pill ghost small', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { state.draft = null; renderExp(); });
      acts.appendChild(cancel);
    }
    card.appendChild(acts);
    return card;
  }
  function renderExp() {
    var box = $('expList');
    clear(box);
    if (state.expError) { box.appendChild(el('div', 't empty', state.expError)); return; }
    if (!state.expLoaded) { box.appendChild(el('div', 't empty', 'Loading work experience…')); return; }
    if (state.draft) box.appendChild(roleCard(state.draft, -1, 0));
    if (!state.exp.length && !state.draft) box.appendChild(el('div', 't empty', 'No roles yet. Use “Add role” to create the first one.'));
    state.exp.forEach(function (r, i) { box.appendChild(roleCard(r, i, state.exp.length)); });
  }
  function saveRole(r, fields, btn) {
    btn.disabled = true;
    if (!r.id) {
      var min = state.exp.reduce(function (m, x) { return Math.min(m, x.sort_order); }, 1);
      fields.sort_order = min - 1;
    }
    API.saveRow('experience', r.id || null, fields).then(function (row) {
      if (r.id) {
        state.exp = state.exp.map(function (x) { return x.id === row.id ? row : x; });
      } else {
        state.exp.unshift(row); state.draft = null;
      }
      renderExp();
      toast('Saved. Your portfolio will show the change.', 'ok');
    }).catch(function (err) { btn.disabled = false; fail(err, 'Could not save the role.'); });
  }
  function moveRole(i, dir) {
    var a = state.exp[i], b = state.exp[i + dir];
    if (!a || !b) return;
    var ao = a.sort_order, bo = b.sort_order;
    if (ao === bo) { bo = ao + dir; }
    Promise.all([API.saveRow('experience', a.id, { sort_order: bo }), API.saveRow('experience', b.id, { sort_order: ao })]).then(function (rows) {
      state.exp[i] = rows[0]; state.exp[i + dir] = rows[1];
      state.exp.sort(function (x, y) { return x.sort_order - y.sort_order; });
      renderExp();
      toast('Order updated', 'ok');
    }).catch(function (err) { fail(err, 'Could not change the order.'); loadExp(); });
  }
  function removeRole(r) {
    confirmBox('Delete this role?', '“' + r.role + '” will be removed from your portfolio. This cannot be undone.', 'Delete').then(function (yes) {
      if (!yes) return;
      API.deleteRow('experience', r.id).then(function () {
        state.exp = state.exp.filter(function (x) { return x.id !== r.id; });
        renderExp();
        toast('Role deleted', 'ok');
      }).catch(function (err) { fail(err, 'Could not delete the role.'); });
    });
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
    $('view-skills').hidden = view !== 'skills';
    $('view-experience').hidden = view !== 'experience';
    $('view-soon').hidden = !SOON[view];
    if (view === 'skills' && !state.skillsLoaded) loadSkills();
    if (view === 'experience' && !state.expLoaded) loadExp();
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

    $('skillForm').addEventListener('submit', addSkill);
    $('expAdd').addEventListener('click', function () {
      if (!state.expLoaded) { toast('Still loading. Try again in a moment.', 'err'); return; }
      state.draft = { role: '', company: '', start_label: '', end_label: '', is_current: false, bullets: '', visible: true };
      renderExp();
      var f = $('r-role-new'); if (f) f.focus();
    });

    $('search').addEventListener('input', renderList);
    $('filter').addEventListener('change', renderList);
    $('refreshBtn').addEventListener('click', function () {
      loadMessages().then(function () { if (!state.loadError) toast('Messages refreshed', 'ok'); });
    });

    $('logoutBtn').addEventListener('click', function () {
      $('logoutBtn').disabled = true;
      API.signOut().then(function () { location.replace(HOME); });
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
        if (!ok) return API.signOut().then(function () { location.replace(HOME + '?signin=denied'); });
        start(s);
      });
    }).catch(function (err) {
      if (err && err.kind === 'auth') return; // already redirecting
      gateError((err && err.message) || 'Something went wrong.', init);
    });
  }

  API.onSignedOut(function () { location.replace(HOME + '?signin=expired'); });
  init();
})();
