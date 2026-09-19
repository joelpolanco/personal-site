import { defineCollection, type SchemaContext } from 'astro:content';
import * as z from 'astro/zod';
import { glob } from 'astro/loaders';
import { categoryIds } from './config/categories';

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
      /**
       * Unused today — post covers are set typographically from the title
       * rather than photographed. Kept so a post can carry real artwork later
       * without a schema change.
       */
      heroImage: image().nullable().default(null),
      heroImageAlt: z.string().nullable().default(null),
      /**
       * The Wix hero, recorded as a plain path rather than an `image()` so it
       * stays provenance and never enters the build. Sixteen of the
       * twenty-three were upscaled thumbnails; if Joel re-supplies artwork,
       * this says which image each post used to have.
       */
      legacyHeroImage: z.string().nullable().default(null),
      /**
       * Wix exposed no taxonomy at all. These six categories were invented
       * from the posts themselves and every post is in exactly one, so `/blog`
       * can never have an unfiled post. A typo fails the build.
       */
      category: z.enum(categoryIds),
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

const cta = z.object({ label: z.string(), href: z.string() });

/**
 * The homepage is the one page that is authored rather than migrated — it
 * carries Joel's current facts, not the Wix copy — so it gets a shape built
 * for the template instead of the scraped section-and-repeater shape.
 */
const home = defineCollection({
  loader: glob({ pattern: 'home.json', base: PAGES_BASE }),
  schema: (ctx) =>
    pageMeta.extend({
      hero: z.object({
        greeting: z.string(),
        name: z.string(),
        /** Markdown paragraphs; `**bold**` gets the accent treatment. */
        body: z.array(z.string()).min(1),
        cta,
        image: archivedImage(ctx),
        /** The spec table beside the hero. */
        facts: z.array(z.object({ key: z.string(), value: z.string() })),
      }),
      /** Logo strip. None of these were links on Wix and none are here. */
      partners: z.object({
        heading: z.string(),
        items: z.array(z.object({ title: z.string(), image: archivedImage(ctx) })),
      }),
      sections: z.array(
        z.object({
          id: z.string(),
          number: z.string(),
          heading: z.string(),
          kicker: z.string(),
          body: z.array(z.string()),
          image: archivedImage(ctx).optional(),
          roleTitle: z.string().optional(),
          roleTag: z.string().optional(),
          cta: cta.optional(),
        }),
      ),
      skills: z.object({
        number: z.string(),
        heading: z.string(),
        items: z.array(
          z.object({
            number: z.string(),
            title: z.string(),
            /** Split so the first phrase can carry the accent weight. */
            lead: z.string(),
            rest: z.string(),
          }),
        ),
      }),
      /**
       * Three, not one: Wix server-rendered a single carousel slide and the
       * other two were recovered from a browser render during extraction.
       */
      testimonials: z.object({
        number: z.string(),
        heading: z.string(),
        items: z
          .array(
            z.object({
              quote: z.string(),
              name: z.string(),
              role: z.string(),
              company: z.string(),
            }),
          )
          .length(3),
      }),
      writing: z.object({
        number: z.string(),
        heading: z.string(),
        kicker: z.string(),
        cta,
      }),
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
