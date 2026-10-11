import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/chat": ["./content/*.md"],
    "/api/voice/socket": ["./content/*.md"],
  },
};
export default config;
