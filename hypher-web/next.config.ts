import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
  serverExternalPackages: ["onnxruntime-node"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
});
