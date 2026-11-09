/* Runs before the app renders so the page never flashes the wrong theme. Kept as a file (not inline) for the CSP. */
(function () {
  var theme;
  try {
    theme = localStorage.getItem('wishful.pref.theme');
  } catch (e) {
    theme = null;
  }
  // Light until the visitor picks a theme with the toggle.
  if (theme !== 'dark') theme = 'light';
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1129' : '#f3f3f2');
})();
