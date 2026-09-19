import { defineCollection, type SchemaContext } from 'astro:content';
import * as z from 'astro/zod';
import { glob } from 'astro/loaders';

/** Every page dataset lives here; posts sit alongside in `posts/`. */
const PAGES_BASE = './src/content/pages';

/**
 * An image the extraction pulled off Wix. `local` runs through Astro's
 * `image()` so page templates get optimized, dimensioned assets — except for
 * the one reference the archive could not download, which is `null`.
 */
const archivedImage = ({ image }: SchemaContext) =>
  z.object({
    alt: z.string().nullable().default(null),
    local: image().nullable().default(null),
    renderedSrc: z.url().nullable().default(null),
  });

/** A repeater row: portfolio project, resource link, partner logo, talk clip. */
const linkedItem = (ctx: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string().nullable().default(null),
    link: z.string().nullable().default(null),
    image: archivedImage(ctx).nullable().default(null),
    extraText: z.string().nullable().default(null),
  });

/** Title, description and canonical URL carried over from the Wix page. */
const pageMeta = z.object({
  page: z.string(),
  path: z.string(),
  sourceUrl: z.url(),
  title: z.string(),
  description: z.string(),
  ogTitle: z.string(),
  ogDescription: z.string(),
  canonicalUrl: z.url(),
});

/**
 * The 23 migrated posts. Filenames are the live `/post/<slug>` URL segments
 * and must never change — see `tests/slug-parity.test.mjs`.
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Duplicated from the filename on purpose so drift is detectable. */
      slug: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().nullable().default(null),
      heroImage: image().nullable().default(null),
      heroImageAlt: z.string().nullable().default(null),
      /** Wix exposed no taxonomy; both are empty on every migrated post. */
      category: z.string().nullable().default(null),
      tags: z.array(z.string()).default([]),
      author: z.string().default('Joel Polanco'),
      readingTime: z.string().nullable().default(null),
      canonicalUrl: z.url().nullable().default(null),
      originalUrl: z.url().nullable().default(null),
      /** `wix` for migrated posts, `gdocs` for anything the sync pulls in. */
      source: z.enum(['wix', 'gdocs', 'manual']).default('manual'),
      /** The "first appeared in LogRocket" credit line, as markdown. */
      firstAppearedIn: z.string().nullable().default(null),
      draft: z.boolean().default(false),
    }),
});

const home = defineCollection({
  loader: glob({ pattern: 'home.json', base: PAGES_BASE }),
  schema: (ctx) =>
    pageMeta.extend({
      sections: z.array(
        z.object({
          id: z.string(),
          heading: z.string().nullable().default(null),
          /** Markdown paragraphs. */
          body: z.array(z.string()).default([]),
          items: z
            .array(
              linkedItem(ctx).partial({ title: true }).extend({
                /** The 01–04 skills carry a display number. */
                number: z.string().optional(),
              }),
            )
            .nullable()
            .default(null),
          images: z.array(archivedImage(ctx)).nullable().default(null),
          cta: z.object({ label: z.string(), href: z.string() }).nullable().default(null),
          /**
           * Three testimonials, not one: Wix server-rendered a single carousel
           * slide, and the rest were recovered from a browser render.
           */
          testimonials: z
            .array(
              z.object({
                quote: z.string(),
                /** The raw "Name, Role, Company" line, split out below. */
                attribution: z.string().nullable().default(null),
                name: z.string().nullable().default(null),
                role: z.string().nullable().default(null),
                company: z.string().nullable().default(null),
                /** Which carousel slide the extraction recovered this from. */
                seenVia: z.string().optional(),
              }),
            )
            .optional(),
          note: z.string().optional(),
        }),
      ),
    }),
});

/** Grouped repeaters: portfolio (10 projects) and resources (22 entries). */
const groupedPage = (file: string) =>
  defineCollection({
    loader: glob({ pattern: file, base: PAGES_BASE }),
    schema: (ctx) =>
      pageMeta.extend({
        groups: z.array(
          z.object({
            group: z.string(),
            repeaterId: z.string().nullable().default(null),
            count: z.number().int().nonnegative(),
            items: z.array(linkedItem(ctx)),
          }),
        ),
      }),
  });

const media = defineCollection({
  loader: glob({ pattern: 'media.json', base: PAGES_BASE }),
  schema: (ctx) =>
    pageMeta.extend({
      appearances: z.array(
        z.object({
          title: z.string(),
          youtubeId: z.string(),
          url: z.url(),
          thumbnail: z.object({
            original_url: z.url(),
            local: ctx.image().nullable().default(null),
          }),
          /** False for the Zeda.io episode, which YouTube no longer serves. */
          videoAvailable: z.boolean().default(true),
          note: z.string().optional(),
        }),
      ),
      talkClips: z.array(linkedItem(ctx)),
    }),
});

const contact = defineCollection({
  loader: glob({ pattern: 'contact.json', base: PAGES_BASE }),
  schema: pageMeta.extend({
    blocks: z.array(
      z.object({
        id: z.string(),
        heading: z.string().nullable().default(null),
        body: z.array(z.string()).default([]),
      }),
    ),
    form: z.object({
      fields: z.array(
        z.object({
          label: z.string(),
          name: z.string(),
          type: z.enum(['text', 'email', 'textarea']),
          required: z.boolean(),
        }),
      ),
      submitLabel: z.string(),
      successMessage: z.string(),
      /** Records what Wix did; the replacement is `src/pages/api/contact.ts`. */
      wixAction: z.string().optional(),
    }),
  }),
});

/**
 * Pages that exist only so the redirect story is documented. `/project-1` was
 * an unfinished Wix template with no body at all, but it is in the Wix sitemap
 * and may be indexed, so it 301s to `/portfolio`.
 */
const legacyPages = defineCollection({
  loader: glob({ pattern: 'project-1.json', base: PAGES_BASE }),
  schema: pageMeta.extend({
    sections: z.array(z.unknown()).default([]),
    isEmpty: z.boolean().default(false),
  }),
});

export const collections = {
  posts,
  home,
  portfolio: groupedPage('portfolio.json'),
  resources: groupedPage('resources.json'),
  media,
  contact,
  legacyPages,
};
