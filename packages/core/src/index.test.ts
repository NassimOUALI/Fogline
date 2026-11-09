import { describe, expect, it } from 'vitest';
import { PACK_FORMAT_VERSION } from '@fogline/pack-format';
import { CORE_PACKAGE_NAME } from './index';

describe('core scaffold', () => {
  it('exports its package name', () => {
    expect(CORE_PACKAGE_NAME).toBe('@fogline/core');
  });

  it('can import pack-format through the workspace alias', () => {
    expect(PACK_FORMAT_VERSION).toBe(1);
  });
});
