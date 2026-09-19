/**
 * One 1200×630 OG card per post, plus a site-wide `default.png` for pages that
 * have no card of their own. Prerendered, so the PNGs are static files on the
 * CDN and the worker never rasterizes anything at request time.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgImage, type OgImageInput } from '../../lib/og-image';
import { site } from '../../config/site';

export const prerender = true;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return [
    {
      params: { slug: 'default' },
      props: { title: site.name, eyebrow: 'Product management, customer discovery' } as OgImageInput,
    },
    ...posts.map((post) => ({
      params: { slug: post.id },
      props: {
        title: post.data.title,
        eyebrow: dateFormat.format(post.data.pubDate),
      } as OgImageInput,
    })),
  ];
};

export const GET: APIRoute<OgImageInput> = async ({ props }) => {
  const png = await renderOgImage(props);
  return new Response(png as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
