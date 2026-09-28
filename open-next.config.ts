// open-next.config.ts for @opennextjs/cloudflare.
// Static pages are served from the asset store; the app has no R2-cacheable
// ISR surface, so the default (no incremental cache) keeps the worker simple.
//
// Build note: the Worker has to be built with `next build --turbopack` (see the
// `build` script in package.json). Turbopack is what turns Prisma's
// `import("./query_engine_bg.wasm?module")` into a chunk this adapter can hand
// over to wrangler; the webpack build rejects that import outright.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});