import { expect, test } from 'vitest';
import { loopbackHost, sameOrigin } from './request-security';
test('checks the browser host, not the framework internal request URL', () => {
  expect(sameOrigin('http://127.0.0.1:3000', '127.0.0.1:3000')).toBe(true);
  expect(sameOrigin('https://evil.example', '127.0.0.1:3000')).toBe(false);
  expect(sameOrigin(null, 'localhost:3000')).toBe(false);
  expect(sameOrigin('http://localhost:4000', 'localhost:3000')).toBe(false);
  expect(loopbackHost('example.com')).toBe(false);
  expect(loopbackHost('localhost:3000')).toBe(true);
});
