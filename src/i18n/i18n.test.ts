import { describe, expect, it, vi } from 'vitest';
import i18n, { setLanguage } from './index';
import { LANGUAGES, resolveLanguage, type Language } from './languages';
import en from './locales/en.json';

const locales = import.meta.glob<typeof en>('./locales/*.json', {
  eager: true,
  import: 'default',
});

function flatten(tree: object, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') acc[prefix + key] = value;
    else Object.assign(acc, flatten(value, `${prefix}${key}.`));
    return acc;
  }, {});
}

const placeholders = (text: string) => (text.match(/\{\{\w+\}\}|<\/?\w+>/g) ?? []).sort();
const reference = flatten(en);
const pluralOnly = new Set<Language>(['ja', 'zh']);

describe('locales', () => {
  it('ships one file per supported language', () => {
    expect(Object.keys(locales).sort()).toEqual(
      Object.keys(LANGUAGES)
        .sort()
        .map((code) => `./locales/${code}.json`),
    );
  });

  for (const code of Object.keys(LANGUAGES) as Language[]) {
    it(`${code} covers every English key with the same placeholders`, () => {
      const translated = flatten(locales[`./locales/${code}.json`]!);
      // Languages without a singular plural form only need `_other`.
      const expected = Object.keys(reference).filter(
        (key) => !(pluralOnly.has(code) && key.endsWith('_one')),
      );
      expect(Object.keys(translated).sort()).toEqual(expected.sort());
      for (const key of expected) {
        expect(placeholders(translated[key]!), key).toEqual(placeholders(reference[key]!));
      }
    });
  }
});

describe('resolveLanguage', () => {
  it('returns an explicit choice as is', () => {
    expect(resolveLanguage('de')).toBe('de');
  });

  it('follows the first supported browser language, falling back to English', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get');
    languages.mockReturnValue(['sv-SE', 'pt-BR', 'fr']);
    expect(resolveLanguage('auto')).toBe('pt');
    languages.mockReturnValue(['sv-SE']);
    expect(resolveLanguage('auto')).toBe('en');
    languages.mockRestore();
  });
});

describe('plurals', () => {
  it('picks the form of the active language', async () => {
    await setLanguage('fr');
    expect(i18n.t('count.tasks', { count: 1 })).toBe('1 tâche');
    expect(i18n.t('count.tasks', { count: 3 })).toBe('3 tâches');
    await setLanguage('ja');
    expect(i18n.t('count.tasks', { count: 1 })).toBe('1件のタスク');
    await setLanguage('en');
  });
});
