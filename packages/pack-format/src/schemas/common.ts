import { z } from 'zod';

/** `#RRGGBB` color. Short `#RGB` forms are rejected to keep palette math simple. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a color in #RRGGBB form')
  .describe('Color in #RRGGBB form');
export type HexColor = z.infer<typeof hexColorSchema>;

/**
 * Identifier used for packs, maps, categories, markers and articles.
 * Starts with a letter or digit; may contain `. _ : -`.
 */
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Ids start with a letter or digit and use only . _ : -')
  .describe('Stable identifier');

/** Relative path inside the pack folder. Safety (no escapes) is checked by the validator. */
export const relativePathSchema = z
  .string()
  .min(1)
  .describe('Path relative to the pack folder, forward slashes');

/** BCP 47 language tag such as `en` or `pt-BR`. */
export const languageTagSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Expected a BCP 47 language tag such as "en"')
  .describe('BCP 47 language tag');

/** Semantic version `MAJOR.MINOR.PATCH` with optional pre-release and build metadata. */
export const semverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/,
    'Expected a semantic version such as 1.2.0',
  )
  .describe('Semantic version');

/** ISO 8601 timestamp with timezone, e.g. `2026-10-18T15:40:02Z`. */
export const timestampSchema = z.iso.datetime({ offset: true }).describe('ISO 8601 timestamp');

/**
 * Either a plain string in the pack's `defaultLanguage`, or a map of language tag to text.
 */
export const localizedTextSchema = z
  .union([
    z.string().min(1),
    z
      .record(languageTagSchema, z.string().min(1))
      .refine((record) => Object.keys(record).length > 0, 'At least one language is required'),
  ])
  .describe('Plain string or map of language tag to text');
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** Point in map pixel space (source image pixels, origin top-left, y down). */
export const positionSchema = z
  .object({ x: z.number(), y: z.number() })
  .describe('Position in map pixel space');
export type Position = z.infer<typeof positionSchema>;

/** Integer pixel size. */
export const sizeSchema = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .describe('Size in pixels');
export type Size = z.infer<typeof sizeSchema>;

/**
 * Resolves localized text: preferred language, then the fallback language, then any
 * available language. Returns an empty string for `undefined`.
 */
export function resolveLocalizedText(
  text: LocalizedText | undefined,
  preferredLanguage: string,
  fallbackLanguage: string,
): string {
  if (text === undefined) {
    return '';
  }
  if (typeof text === 'string') {
    return text;
  }
  const preferred = text[preferredLanguage];
  if (preferred !== undefined) {
    return preferred;
  }
  const fallback = text[fallbackLanguage];
  if (fallback !== undefined) {
    return fallback;
  }
  const first = Object.values(text)[0];
  return first ?? '';
}
