import type { NextConfig } from "next";

const backendInternalUrl = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8001";
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "X-Accel-Buffering", value: "no" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // checkout.razorpay.com is only loaded when online payment is configured.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} blob: https://checkout.razorpay.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' blob: data: https://storage.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Cache Components (PPR) is deliberately disabled: this app is almost entirely
  // per-user dynamic data behind auth cookies. The conventional dynamic rendering
  // model keeps the mental model simple and avoids prerender bail-out failures.
  cacheComponents: false,
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  serverExternalPackages: [],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      ...(isDev
        ? [
            { protocol: "http" as const, hostname: "127.0.0.1" },
            { protocol: "http" as const, hostname: "localhost" },
          ]
        : []),
    ],
    dangerouslyAllowLocalIP: isDev,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/v1/:path*", destination: `${backendInternalUrl}/api/v1/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
