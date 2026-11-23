import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * The published site may only load its own files. The only connection it may open
 * is to the GitHub REST API, used by the optional GitHub section to download code;
 * every other destination is blocked by the browser, so local references cannot be
 * uploaded anywhere.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; connect-src https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'"

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
})

export default defineConfig({
  // Relative paths: the site works under any GitHub Pages sub-path without configuration.
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
})
