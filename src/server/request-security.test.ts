import { expect, test } from 'vitest';
import { loopbackHost, sameOrigin, validAccessCode } from './request-security';
test('checks the browser host, not the framework internal request URL', () => {
  expect(sameOrigin('http://127.0.0.1:3000', '127.0.0.1:3000')).toBe(true);
  expect(sameOrigin('https://evil.example', '127.0.0.1:3000')).toBe(false);
  expect(sameOrigin(null, 'localhost:3000')).toBe(false);
  expect(sameOrigin('http://localhost:4000', 'localhost:3000')).toBe(false);
  expect(
    sameOrigin('https://wardyn.vercel.app', 'wardyn.railway.app', 'https://wardyn.vercel.app'),
  ).toBe(true);
  expect(
    sameOrigin('https://evil.example', 'wardyn.railway.app', 'https://wardyn.vercel.app'),
  ).toBe(false);
  expect(loopbackHost('example.com')).toBe(false);
  expect(loopbackHost('localhost:3000')).toBe(true);
});

test('compares remote access codes without accepting missing or weak configuration', () => {
  expect(validAccessCode('correct-horse-battery', 'correct-horse-battery')).toBe(true);
  expect(validAccessCode('wrong-access-value', 'correct-horse-battery')).toBe(false);
  expect(validAccessCode(null, 'correct-horse-battery')).toBe(false);
  expect(validAccessCode('short', 'short')).toBe(false);
});
