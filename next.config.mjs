/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "blog.mikancel.com" }],
        destination: "https://mikancel.com/blog",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "admin.mikancel.com" }],
          destination: "/admin",
        },
        {
          source: "/login",
          has: [{ type: "host", value: "admin.mikancel.com" }],
          destination: "/admin/login",
        },
        {
          source: "/blog",
          has: [{ type: "host", value: "admin.mikancel.com" }],
          destination: "/admin/blog",
        },
        {
          source: "/blog/:path*",
          has: [{ type: "host", value: "admin.mikancel.com" }],
          destination: "/admin/blog/:path*",
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.r2.cloudflarestorage.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;