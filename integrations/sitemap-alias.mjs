import { copyFile } from 'node:fs/promises';

/**
 * `@astrojs/sitemap` writes `sitemap-index.xml`. Search Console and every
 * inbound reference we publish point at `/sitemap.xml`, so mirror the index
 * there too. Both paths stay valid, and the index keeps working if the site
 * ever grows past one sitemap file.
 */
export default function sitemapAlias() {
  return {
    name: 'joelpolanco:sitemap-alias',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        try {
          await copyFile(new URL('./sitemap-index.xml', dir), new URL('./sitemap.xml', dir));
          logger.info('`sitemap.xml` mirrored from `sitemap-index.xml`');
        } catch (error) {
          logger.warn(`Could not mirror sitemap.xml: ${error.message}`);
        }
      },
    },
  };
}
