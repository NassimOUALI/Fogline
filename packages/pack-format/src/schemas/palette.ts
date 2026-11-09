import { z } from 'zod';
import { hexColorSchema } from './common';

/** The five tokens a pack may supply. Only `accent` is required. */
export const paletteSchema = z
  .object({
    accent: hexColorSchema,
    background: hexColorSchema.optional(),
    surface: hexColorSchema.optional(),
    text: hexColorSchema.optional(),
    mapBackdrop: hexColorSchema.optional(),
  })
  .describe('Per-game color palette');
export type Palette = z.infer<typeof paletteSchema>;

export const PALETTE_TOKENS = ['accent', 'background', 'surface', 'text', 'mapBackdrop'] as const;
export type PaletteToken = (typeof PALETTE_TOKENS)[number];

/** A palette with every token present (after defaults are applied). */
export type ResolvedPalette = Record<PaletteToken, string>;
