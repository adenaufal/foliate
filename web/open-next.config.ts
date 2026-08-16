import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config: no R2/KV incremental cache wired up, so the deploy needs no
// extra Cloudflare resources. This app is mostly client-driven (IndexedDB) with
// a dynamic API proxy — there is little ISR surface to cache. Add an
// incrementalCache override here later if that changes.
export default defineCloudflareConfig({});
