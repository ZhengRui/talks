import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Suppress "Critical dependency" warning from nunjucks' dynamic require.resolve
      config.module.exprContextCritical = false;
    }
    return config;
  },
};

export default nextConfig;
