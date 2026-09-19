// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

import sitemapAlias from './integrations/sitemap-alias.mjs';
import { legacyRedirects } from './src/config/site.ts';

/**
 * The Cloudflare adapter builds for a worker target, which bundles everything.
 * resvg is a native addon that only runs in Node while prerendering the OG
 * cards, and its `.node` binary is not valid UTF-8, so bundling fails outright.
 * Forcing it external keeps it a plain Node import at prerender time and keeps
 * it out of the worker.
 */
function externalizeNativeAddons() {
  return {
    name: 'joelpolanco:externalize-native-addons',
    enforce: 'pre',
    /** @param {string} id */
    resolveId(id) {
      return id === '@resvg/resvg-js' ? { id, external: true } : null;
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://joelpolanco.me',

  /**
   * Legacy Wix URLs. The Cloudflare adapter turns these into real 301s in
   * `_redirects`, served at the edge before the worker runs.
   */
  redirects: Object.fromEntries(
    Object.entries(legacyRedirects).map(([from, to]) => [from, { status: 301, destination: to }]),
  ),

  image: {
    /**
     * Applies to images inside MDX too, which is where it matters: post bodies
     * carry 34 images straight off Wix, some of them several megapixels, and
     * without this each one ships at full size to a phone.
     */
    layout: 'constrained',
    responsiveStyles: true,
    breakpoints: [360, 640, 828, 1080, 1400],
  },

  vite: {
    plugins: [tailwindcss(), externalizeNativeAddons()],
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        // The design comparison routes are internal review tooling, not public pages.
        if (pathname.startsWith('/design')) return false;
        // Feeds and generated OG cards are assets, not pages to index.
        if (/\.(xml|png|json|txt)$/.test(pathname)) return false;
        return true;
      },
    }),
    sitemapAlias(),
  ],

  adapter: cloudflare({
    imageService: 'compile',
    /**
     * Prerender in Node rather than workerd. The OG cards are rasterized at
     * build time by a native addon, which workerd cannot load; nothing
     * prerendered here needs Cloudflare bindings.
     */
    prerenderEnvironment: 'node',
  }),
});
