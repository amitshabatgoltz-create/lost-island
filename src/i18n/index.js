// Language: English (default, used on Poki / CrazyGames) or Hebrew. The choice is stored per browser;
// switching reloads the page, so every text in the game is picked once, when the modules load.
//   T('Some text')          -> the text in the current language
//   T`Picked up: ${name}`   -> same, for text with values (the Hebrew uses {0}, {1}... for them)
import { HE, HE_PA, HE_HTML } from './he.js';

const KEY = 'lost_lang';
export const LANGS = { en: 'English', he: 'עברית' };

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    if (v && LANGS[v]) return v;
  } catch (e) { /* no storage: default language */ }
  return 'en';
}

export const LANG = stored();
export const RTL = LANG === 'he';

export function setLang(lang) {
  if (!LANGS[lang] || lang === LANG) return;
  try { localStorage.setItem(KEY, lang); } catch (e) { /* the choice lasts this page only */ }
  location.reload();
}

export function T(s, ...vals) {
  if (Array.isArray(s) && s.raw) {
    let key = '';
    s.forEach((part, i) => { key += part; if (i < vals.length) key += `{${i}}`; });
    const tpl = (RTL && HE[key]) || key;
    return tpl.replace(/\{(\d+)\}/g, (m, i) => (+i < vals.length ? vals[+i] : m));
  }
  return (RTL && HE[s]) || s;
}

// Hebrew line under an English radio / PA subtitle (empty in English)
export const paTranslation = (text) => (RTL && HE_PA[text]) || '';

export const locale = () => (RTL ? 'he-IL' : 'en-US');

// translate the fixed text of index.html and set the page direction
export function applyToPage() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = RTL ? 'rtl' : 'ltr';
  if (!RTL) return;
  const tr = (t) => {
    const k = t.trim();
    return k && HE_HTML[k] ? t.replace(k, HE_HTML[k]) : t;
  };
  document.title = tr(document.title);
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) n.nodeValue = tr(n.nodeValue);
  for (const el of document.querySelectorAll('[aria-label]')) el.setAttribute('aria-label', tr(el.getAttribute('aria-label')));
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = tr(meta.content);
  // in right-to-left the "previous" arrow points right
  const prev = document.querySelector('#sel-prev span'), next = document.querySelector('#sel-next span');
  if (prev && next) { prev.textContent = '›'; next.textContent = '‹'; }
}
