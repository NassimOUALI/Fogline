import { describe, expect, it } from 'vitest';
import { PACK_FORMAT_VERSION } from './index';

describe('pack-format scaffold', () => {
  it('declares format version 1', () => {
    expect(PACK_FORMAT_VERSION).toBe(1);
  });
});
