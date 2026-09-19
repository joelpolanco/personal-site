# joelpolanco.me

The Astro rebuild of [joelpolanco.me](https://www.joelpolanco.me), migrating off Wix onto
Cloudflare Pages. Minimalist, fast, content-first, and cheap to run.

Current state: the project is scaffolded and **three homepage design directions** are built on
Joel's real content, ready to pick between at `/design`. The rest of the site (portfolio, media,
resources, blog and its 23 posts, contact) gets built once a direction is chosen.

## Stack

| Piece       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Framework   | [Astro](https://astro.build) 7, TypeScript (strict)         |
| Styling     | Tailwind CSS 4 plus per-direction scoped CSS custom properties |
| Content     | MDX via `@astrojs/mdx` (for the blog)                       |
| SEO         | `@astrojs/sitemap`                                          |
| Hosting     | Cloudflare Pages via `@astrojs/cloudflare`                  |
| Fonts       | Self-hosted variable fonts (Fraunces, Source Serif 4, Inter, JetBrains Mono) |

## Run it locally

Requires Node 22.12 or newer.

```bash
npm install
npm run dev
```

The dev server binds to `0.0.0.0:43217`, so open <http://127.0.0.1:43217>.

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server on `0.0.0.0:43217`                          |
| `npm run build`     | Production build into `dist/`                          |
| `npm run preview`   | Serve the production build on `0.0.0.0:43217`          |
| `npm run check`     | `astro check` — TypeScript and template diagnostics    |

## Design directions

Three complete homepage designs, all rendering identical copy taken from the live Wix site, so the
comparison is purely about design.

| Route       | Direction     | Character                                                                        |
| ----------- | ------------- | -------------------------------------------------------------------------------- |
| `/design`   | Comparison    | Side-by-side live previews with desktop and mobile viewports                      |
| `/design/a` | Editorial     | Large serif display type, warm paper tone, one terracotta ink accent, wide measure |
| `/design/b` | Swiss grid    | Tight sans, visible 12-column grid, hairline rules, numbered sections, red accent  |
| `/design/c` | Technical     | Monospace accents, dark-first with a light toggle, dense information blocks        |

Each direction keeps its design tokens in its own scoped block
(`src/styles/direction-{a,b,c}.css`, scoped to `[data-direction='…']`). Promoting the winner to the
site design system means lifting one token block to `:root` and deleting the other two.

The `/design` routes are review-only: they are marked `noindex` and excluded from the sitemap.

## Layout

```
src/
  content/home.ts        Real homepage copy, the single source for all three directions
  layouts/BaseLayout.astro
  components/DirectionSwitcher.astro
  pages/
    index.astro          Placeholder pointing at the design review
    design/index.astro   Comparison page
    design/a.astro       Editorial
    design/b.astro       Swiss grid
    design/c.astro       Technical
  styles/
    global.css           Tailwind, fonts, shared focus and skip-link behaviour
    direction-a.css      Editorial tokens and components
    direction-b.css      Swiss grid tokens and components
    direction-c.css      Technical tokens and components (dark and light schemes)
```

## Deployment

Configured for Cloudflare Pages through the Cloudflare adapter, with `wrangler.jsonc` holding the
worker settings. Build command `npm run build`, output directory `dist`. Nothing is deployed yet —
that happens after a design direction is picked.
