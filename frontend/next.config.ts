import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: {root: process.cwd()},
  async rewrites() {
    const origin = (process.env.API_ORIGIN || "http://127.0.0.1:8086").replace(/\/$/, "");
    return [
      { source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` },
      { source: "/media/:path*", destination: `${origin}/media/:path*` },
    ];
  },
};
export default config;
