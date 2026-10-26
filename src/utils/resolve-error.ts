import en from '@/locales/en.json';
import vi from '@/locales/vi.json';

type ErrorLang = 'vi' | 'en';
type ErrorParams = Record<string, string | number>;

const errorLocales: Record<ErrorLang, Record<string, string>> = {
  vi: (vi as Record<string, unknown>).errors as Record<string, string>,
  en: (en as Record<string, unknown>).errors as Record<string, string>,
};

const DOT_CODE_RE = /^\w+\.\w+$/;

let currentLang: ErrorLang = 'vi';

export function setErrorLanguage(lang: ErrorLang): void {
  currentLang = lang;
}

export function resolveErrorCode(code: string, params?: ErrorParams): string | undefined {
  if (!DOT_CODE_RE.test(code)) return undefined;
  const messages = errorLocales[currentLang] || errorLocales.vi;
  const msg = messages[code] || errorLocales.vi[code];
  if (!msg) return undefined;
  if (!params) return msg;
  return msg.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const value = params[name];
    return value !== undefined ? String(value) : `{{${name}}}`;
  });
}
