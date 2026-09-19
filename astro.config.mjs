// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://joelpolanco.me',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    mdx(),
    sitemap({
      // The design comparison routes are internal review tooling, not public pages.
      filter: (page) => !page.includes('/design'),
    }),
  ],

  adapter: cloudflare({
    imageService: 'compile',
  }),
});
