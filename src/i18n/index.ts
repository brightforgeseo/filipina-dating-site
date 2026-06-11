// Site-wide i18n. English is the default and lives at the root URL;
// Tagalog and Cebuano live under /tl/ and /ceb/.
import { en, type Dict } from './en';
import { tl } from './tl';
import { ceb } from './ceb';

export type Lang = 'en' | 'tl' | 'ceb';
export type { Dict };

export const LANGS: Record<Lang, string> = {
  en: 'English',
  tl: 'Tagalog',
  ceb: 'Cebuano',
};

const dicts: Record<Lang, Dict> = { en, tl, ceb };

export function t(lang: Lang): Dict {
  return dicts[lang] ?? en;
}

// Marketing pages that exist in all three languages. Legal pages (terms,
// privacy, community) are English-only — the English text is what's binding.
export const LOCALIZED_PATHS = ['/', '/pricing', '/safety', '/login', '/signup'];

export function isLang(x: string | undefined): x is Lang {
  return x === 'en' || x === 'tl' || x === 'ceb';
}

// '/tl/pricing' -> { lang: 'tl', base: '/pricing' }; '/pricing' -> { lang: 'en', base: '/pricing' }
export function parsePath(pathname: string): { lang: Lang; base: string } {
  let p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const m = p.match(/^\/(tl|ceb)(\/.*)?$/);
  if (m) return { lang: m[1] as Lang, base: m[2] || '/' };
  return { lang: 'en', base: p || '/' };
}

export function localizePath(base: string, lang: Lang): string {
  const [path, hash] = base.split('#');
  const prefixed = lang === 'en' ? path : `/${lang}${path === '/' ? '/' : path}`;
  return hash ? `${prefixed}#${hash}` : prefixed;
}

const STORAGE_KEY = 'filwest.lang';

export function getClientLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v ?? undefined) ? (v as Lang) : 'en';
  } catch {
    return 'en';
  }
}

export function setClientLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}
