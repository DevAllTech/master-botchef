import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        process.env.WEB_URL?.replace(/^https?:\/\//, '') ?? '',
      ].filter(Boolean),
    },
  },
}

export default nextConfig
