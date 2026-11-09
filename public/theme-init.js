/* Runs before the app renders so the page never flashes the wrong theme. Kept as a file (not inline) for the CSP. */
(function () {
  var theme;
  try {
    theme = localStorage.getItem('wishful.pref.theme');
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1129' : '#f3f3f2');
})();
