#!/usr/bin/env node
// Runs the TypeScript sources directly (no build step, assumption A13) through tsx.
import { register } from 'tsx/esm/api';

register();
await import('../src/bin.ts');
