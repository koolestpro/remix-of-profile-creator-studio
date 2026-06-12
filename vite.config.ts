// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },

  // Deploy target. Inside Lovable's own build this is ignored (it forces the
  // Cloudflare preset); outside Lovable — i.e. on Vercel — this enables Nitro's
  // Vercel preset, which writes Vercel's Build Output API to `.vercel/output`.
  // Without an explicit `nitro` option, the plugin skips Nitro entirely on
  // Vercel and ships a static SPA with no SSR server → every route 404s.
  // `routeRules` is valid Nitro config and is forwarded straight to nitro() at
  // build time, but the wrapper's exposed type surface is intentionally narrow
  // (preset/output/cloudflare only), so we widen just this option.
  nitro: {
    preset: "vercel",

    // Baseline HTTP security headers applied to every response.
    routeRules: {
      "/**": {
        headers: {
          "X-Frame-Options": "SAMEORIGIN",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          // Content-Security-Policy. 'unsafe-inline' is required for the SSR
          // hydration script and inline style attributes; everything else is
          // locked to self, Supabase, and image hosts (QR codes / data URLs).
          "Content-Security-Policy": [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      },
    },
  } as { preset: string },
});
