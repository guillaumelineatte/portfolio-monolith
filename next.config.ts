import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.glsl": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.glsl$/,
      use: "raw-loader",
    });
    return config;
  },
};

export default nextConfig;
