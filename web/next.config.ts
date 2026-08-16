import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Makes Cloudflare bindings (env vars, ASSETS, service bindings) available in
// `next dev`. No-op for the production build; safe to keep on every path.
initOpenNextCloudflareForDev();
