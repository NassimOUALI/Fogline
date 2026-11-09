import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// UI tests opt into jsdom; React Testing Library needs cleanup between them.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
