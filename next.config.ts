import "./load-envs";
import type { NextConfig } from "next";

const rawBasePath = process.env.BASE_PATH || "";
// Exclude the Docker build placeholder — it would be replaced with "" at runtime
// causing Next.js to generate invalid regex patterns for _next/data routes
const basePath = rawBasePath && !rawBasePath.includes("PLACEHOLDER") ? rawBasePath : "";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
