import type { NextConfig } from 'next';

const backend = process.env.WARDYN_BACKEND_URL?.replace(/\/+$/, '');
if (backend) {
  const parsed = new URL(backend);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('WARDYN_BACKEND_URL must be an HTTP(S) origin without credentials.');
}

const config: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      beforeFiles: backend ? [{ source: '/api/wardyn', destination: `${backend}/api/wardyn` }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default config;
