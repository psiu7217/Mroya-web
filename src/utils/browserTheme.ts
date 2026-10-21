/** Apply the resolved appearance, never the unresolved "system" preference.
 * Both media candidates are updated so an explicit app theme overrides the OS.
 * CSS owns color-scheme and page backgrounds through the same data-theme.
 */
export function applyBrowserTheme(appearance: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', appearance);
  const color = appearance === 'dark' ? '#171513' : '#FBF8F3';
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', color);
  }
}
