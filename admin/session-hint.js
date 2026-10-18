/* Runs before the sign-in page is drawn. If this browser already holds a saved session, it hides the
   form while login.js checks it, so a signed-in admin is not shown a flash of the form before the redirect. */
(function () {
  'use strict';
  try {
    if (localStorage.getItem('ep-admin-session')) document.documentElement.classList.add('has-session');
  } catch (e) { /* storage unavailable: just show the form */ }
})();
