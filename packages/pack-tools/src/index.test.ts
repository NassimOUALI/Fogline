import { describe, expect, it } from 'vitest';
import { CLI_NAME } from './index';

describe('pack-tools scaffold', () => {
  it('names the CLI', () => {
    expect(CLI_NAME).toBe('fogline-pack');
  });
});
