import type { LocalizedText } from '@fogline/pack-format';

export type { LocalizedText };

/**
 * Resolves localized text for display.
 *
 * Order: the requested language (`fr-CA`), its base language (`fr`), the pack's default
 * language, then any available language. A plain string is already in the default language.
 */
export function localize(
  text: LocalizedText | undefined,
  language: string,
  defaultLanguage: string,
): string {
  if (text === undefined) {
    return '';
  }
  if (typeof text === 'string') {
    return text;
  }
  const baseLanguage = language.split('-')[0] ?? language;
  return (
    text[language] ??
    text[baseLanguage] ??
    text[defaultLanguage] ??
    Object.values(text).find((value) => value.length > 0) ??
    ''
  );
}
