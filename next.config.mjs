/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // X-Frame-Options: DENY を削除 → LIFFがiframe内でページをロードできない問題を修正
          // 代わりにCSPのframe-ancestorsでLINEのドメインのみ許可
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://liff.line.me https://*.line.me",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig;
