/// <reference types="@cloudflare/workers-types" />

declare global {
  // Bound by wrangler.jsonc (d1_databases). Populated on Cloudflare Workers,
  // undefined in the local Node.js runtime.
  // eslint-disable-next-line no-var
  var DB: D1Database | undefined;

  // Bindings reachable through `getCloudflareContext().env` on Workers.
  interface CloudflareEnv {
    DB?: D1Database;
  }
}

export {};