// App theme: 'dark', 'light' or 'blue' (light with a blue accent). Applied to <html> and remembered in this browser.
export const THEMES = [['dark', 'Dark'], ['light', 'Light'], ['blue', 'Light with blue']];

export function currentTheme() {
  const root = document.documentElement;
  return root.dataset.theme === 'light' ? (root.dataset.accent === 'blue' ? 'blue' : 'light') : 'dark';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  if (theme === 'blue') root.dataset.accent = 'blue'; else delete root.dataset.accent;
  try { localStorage.setItem('rms.theme', theme); } catch { /* storage unavailable */ }
}
