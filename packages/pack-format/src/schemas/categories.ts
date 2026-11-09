import { z } from 'zod';
import { hexColorSchema, idSchema, localizedTextSchema, relativePathSchema } from './common';

/** Deepest allowed nesting (UI limit). The root level is depth 1. */
export const MAX_CATEGORY_DEPTH = 6;

/**
 * Ids starting with this prefix belong to app-provided nodes such as "My markers". The id
 * grammar (`idSchema`) rejects a leading underscore, so no pack can collide with them.
 */
export const RESERVED_ID_PREFIX = '_';

export interface CategoryNodeData {
  id: string;
  name: z.infer<typeof localizedTextSchema>;
  icon?: string | undefined;
  color?: string | undefined;
  children?: CategoryNodeData[] | undefined;
}

/**
 * One node of the category tree. A node with `children` is a group; without, a leaf.
 * Markers may reference leaves only.
 */
export const categoryNodeSchema: z.ZodType<CategoryNodeData> = z
  .object({
    id: idSchema,
    name: localizedTextSchema,
    icon: relativePathSchema.optional().describe('SVG icon path relative to the pack'),
    color: hexColorSchema.optional(),
    get children(): z.ZodOptional<z.ZodArray<z.ZodType<CategoryNodeData>>> {
      return z.array(categoryNodeSchema).optional();
    },
  })
  .describe('Category tree node');

export const categoriesFileSchema = z
  .array(categoryNodeSchema)
  .describe('Fogline category tree (data/categories.json)');
export type CategoriesFile = z.infer<typeof categoriesFileSchema>;

export function isGroupNode(node: CategoryNodeData): boolean {
  return node.children !== undefined;
}
