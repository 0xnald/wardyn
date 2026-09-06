import { expect, test } from 'vitest';
import { readConfig } from './config';

test('starts without credentials and strips unrelated environment values', () => {
  expect(readConfig({ UNRELATED: 'private' })).toEqual({});
});
