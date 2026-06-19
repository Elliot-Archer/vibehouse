import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // web-push uses dynamic requires that break when Next.js bundles it into
  // server actions/route handlers. Keep it external so it loads at runtime.
  serverExternalPackages: ['web-push'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
