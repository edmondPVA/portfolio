/* Shares the light/dark choice with the public portfolio (same "ep-theme" key). */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'ep-theme';

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function isDark(theme) {
    return theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function apply(theme, label) {
    if (theme === 'dark' || theme === 'light') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    if (label) label.textContent = isDark(theme) ? 'Light' : 'Dark';
  }

  apply(saved(), null); // before first paint, so there is no flash

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeBtn');
    var label = document.getElementById('themeLabel');
    if (!btn || !label) return;
    apply(saved(), label);
    btn.addEventListener('click', function () {
      var next = isDark(root.getAttribute('data-theme')) ? 'light' : 'dark';
      apply(next, label);
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    });
  });
})();
