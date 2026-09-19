# joelpolanco.me

The Astro rebuild of [joelpolanco.me](https://www.joelpolanco.me), migrating off Wix onto
Cloudflare Pages. Minimalist, fast, content-first, and cheap to run.

Current state: all the content is in the repo and everything that does not depend on a visual
design — content collections, SEO, the contact form backend, the Google Docs publishing pipeline —
is built. **Three homepage design directions** are ready to pick between at `/design`. The pages
themselves (home, portfolio, media, resources, blog index, the 23 posts, contact) get built once a
direction is chosen.

## Stack

| Piece       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Framework   | [Astro](https://astro.build) 7, TypeScript (strict)         |
| Styling     | Tailwind CSS 4 plus per-direction scoped CSS custom properties |
| Content     | Typed content collections, MDX via `@astrojs/mdx`           |
| SEO         | `@astrojs/sitemap`, `@astrojs/rss`, satori + resvg for OG cards |
| Hosting     | Cloudflare Pages via `@astrojs/cloudflare`                  |
| Email       | [Resend](https://resend.com) from a Cloudflare function     |
| Fonts       | Self-hosted variable fonts (Fraunces, Source Serif 4, Inter, JetBrains Mono) |

## Run it locally

Requires Node 22.12 or newer.

```bash
npm install
npm run dev
```

The dev server binds to `0.0.0.0:43217`, so open <http://127.0.0.1:43217>.

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Dev server on `0.0.0.0:43217`                                   |
| `npm run build`        | Syncs Google Docs, runs the tests, then builds into `dist/`      |
| `npm run preview`      | Serve the production build on `0.0.0.0:43217`                   |
| `npm run check`        | `astro check` — TypeScript and template diagnostics             |
| `npm test`             | Content integrity and blog URL parity checks                    |
| `npm run import:doc`   | Import one Google Doc downloaded as Markdown                    |
| `npm run sync:gdocs`   | Pull posts from the Google Drive publishing folder              |
| `npm run generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc`   |

Nothing above needs credentials. Without them the Google Docs sync skips itself and the contact
form logs submissions instead of emailing them.

## Content

Everything from the Wix site lives in typed collections, defined with zod schemas in
`src/content.config.ts`.

```
src/content/posts/<slug>.mdx   23 blog posts
src/content/pages/*.json       home, portfolio, media, resources, contact, project-1
src/assets/images/             67 images, optimized by Astro at build time
```

Page datasets get a schema each rather than one loose shape, so templates get real types: the
homepage's sections and testimonials, the grouped portfolio and resources repeaters, the media
appearances, and the contact form field definitions.

### Blog URLs are load-bearing

The 23 posts are indexed by Google at `joelpolanco.me/post/<slug>`, and those slugs are the
filenames in `src/content/posts/`. Renaming one — tidying an apostrophe, re-importing, a refactor —
silently 404s a live URL and drops the ranking with it.

`tests/slug-parity.test.mjs` asserts the filenames still match the Wix blog sitemap captured at
extraction time, byte for byte. It runs on `npm test` and again automatically before every
production build, so a broken slug cannot ship.

`tests/content-integrity.test.mjs` guards the counts the extraction verified against the live site:
ten portfolio projects, three homepage testimonials, 22 resources, five media appearances, three
talk clips, and every image reference resolving to a file on disk.

### Re-importing the archive

`scripts/ingest-archive.mjs` rebuilds `src/content` and `src/assets/images` from the extraction
archive. It is here so the import is reproducible, not because it needs running again.

## SEO

| Concern             | Where                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Legacy redirects    | `legacyRedirects` in `src/config/site.ts`, read by `astro.config.mjs`     |
| Feed                | `src/pages/blog-feed.xml.ts`                                             |
| Sitemap             | `@astrojs/sitemap` plus `integrations/sitemap-alias.mjs`                  |
| Structured data     | `src/components/seo/{Article,Person}JsonLd.astro`                        |
| OG images           | `src/pages/og/[slug].png.ts` and `src/lib/og-image.ts`                    |

- `/contact-6` and `/project-1` 301 to `/contact` and `/portfolio`. The Cloudflare adapter writes
  these into `_redirects`, so they are real edge 301s rather than meta-refresh pages. `/project-1`
  goes to `/portfolio` because the extraction found it is an unfinished Wix template with no
  portfolio entry behind it.
- `/blog-feed.xml` keeps the exact path Wix served, because existing subscribers have no way to
  learn a new one.
- `sitemap.xml` mirrors `sitemap-index.xml`, so both paths work. `/design/*` and generated assets
  are excluded, and `robots.txt` points at it.
- Structured data components take the post entry itself, so they cannot drift from frontmatter.

### Open graph images

One 1200×630 card per post, rendered at build time by satori and resvg and written as a static PNG.
The card is deliberately plain — black type on warm white — because it should not pre-empt the
design pick. It is a single small file (`src/lib/og-image.ts`) to restyle later.

Two subset Inter TTFs in `src/assets/fonts/` back it; satori cannot read the WOFF2 files the rest of
the site uses. Rasterizing needs a native addon, which is why `astro.config.mjs` prerenders in Node
rather than workerd and forces resvg out of the worker bundle.

## Contact form

`POST /api/contact`, implemented in `src/pages/api/contact.ts`. Backend only — no markup and no
styling, so whoever builds the form owns the whole visual side. The Cloudflare adapter compiles it
into the site worker, which is what serves Pages Functions for this project; there is no separate
`functions/` directory to keep in sync.

The contract:

| Field        | Required | Notes                                                       |
| ------------ | -------- | ----------------------------------------------------------- |
| `first-name` | no       | Name from the original Wix form                              |
| `last-name`  | no       | Name from the original Wix form                              |
| `email`      | yes      |                                                              |
| `message`    | yes      | At least 10 characters                                       |
| `website`    | —        | Honeypot. Render it visually hidden and leave it empty       |

Accepts form-encoded, multipart or JSON. A request that asks for JSON gets JSON back; a plain form
post gets a 303 to `/contact?status=…`, so the form works before any client-side code exists.

A filled honeypot gets the success response verbatim and sends nothing, so a bot cannot tell the
difference. Submissions are limited to five per IP per hour, backed by a KV namespace when the
`CONTACT_RATE_LIMIT` binding exists and an in-isolate map when it does not, so the endpoint works
on a fresh deploy with no setup.

### Testing it without credentials

With no Resend key set, `astro dev` logs the submission to the terminal instead of sending it:

```bash
curl -X POST http://127.0.0.1:43217/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","message":"Testing the contact form backend."}'
```

That fallback is restricted to `astro dev` on purpose. A production deploy missing its credentials
returns 503 and logs an error rather than quietly dropping real enquiries into a worker tail. Set
`CONTACT_LOG_ONLY=true` if you ever want the logging behaviour somewhere else.

## Environment variables

Nothing here is required to run or build the site. Each one turns on a feature.

### Contact form — set on the Pages project

Cloudflare dashboard → the Pages project → **Settings → Variables and Secrets**.

| Name                     | Kind     | Purpose                                                        |
| ------------------------ | -------- | -------------------------------------------------------------- |
| `RESEND_API_KEY`         | Secret   | Resend API key. Create at <https://resend.com/api-keys>         |
| `CONTACT_TO_EMAIL`       | Variable | Where enquiries are delivered                                   |
| `CONTACT_FROM_EMAIL`     | Variable | Sender address, on a domain verified in Resend                  |
| `CONTACT_SUBJECT_PREFIX` | Variable | Optional. Defaults to `[joelpolanco.me]`                        |
| `CONTACT_LOG_ONLY`       | Variable | Optional. `true` logs submissions instead of emailing them      |
| `CONTACT_RATE_LIMIT`     | Binding  | Optional KV namespace for rate limiting across isolates         |

Resend will not send from an address on a domain it has not verified, so `CONTACT_FROM_EMAIL` has
to be something like `form@joelpolanco.me` with the DNS records Resend asks for added in Cloudflare.

Locally, put the same names in a `.dev.vars` file in the project root (gitignored).

### Google Docs publishing — set as build variables

Cloudflare dashboard → the Pages project → **Settings → Environment variables**, added to both
Production and Preview. These are read by the build, not by the running site.

| Name                            | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`  | `client_email` from the service account key file            |
| `GOOGLE_SERVICE_ACCOUNT_KEY`    | `private_key` from the same file                            |
| `GDOCS_FOLDER_ID`               | ID of the Drive folder that publishes                       |
| `GDOCS_STRICT`                  | Optional. `true` makes sync problems fail the build         |

### Deploy hook cron worker

`DEPLOY_HOOK_URL`, set as a secret on that worker. See
[`workers/deploy-hook-cron/README.md`](workers/deploy-hook-cron/README.md).

## Publishing from Google Docs

Write a post in Google Docs, move it into a folder, and it is live within the hour. No git, no
Markdown, no terminal.

### How publishing works day to day

1. Write in **Website posts → Drafts**. Edit it as long as you like; nothing in `Drafts` is
   published.
2. When it is ready, drag the doc up one level into **Website posts**.
3. Within the hour the site rebuilds and the post appears at
   `joelpolanco.me/post/<title-as-a-slug>`.
4. To unpublish, move the doc back into `Drafts` and delete the matching file from
   `src/content/posts/`.

Optionally, the first lines of the doc — before the title — can set fields. Type them as plain
lines, one per line, then leave a blank line:

```
Slug: a-shorter-url-than-the-title
Description: The one or two sentences Google and Twitter show under the link.
Published: 2026-10-02
Tags: pricing, strategy
```

Then the title as **Heading 1**, then the post. All four are optional: without them the title
becomes the slug, the first real paragraph becomes the description, and today becomes the date.

Images pasted into the doc are copied into the repo during the sync, because Google's image links
expire.

### One-time setup

This is the part that needs doing once, and it involves two websites.

#### Part 1 — create the service account in Google Cloud

A "service account" is a robot Google account that is allowed to read one folder. It is how the
site reads the docs without anyone logging in.

1. Go to <https://console.cloud.google.com> and sign in with the Google account that owns the Drive
   folder.
2. At the top of the page, click the **project dropdown** (next to the Google Cloud logo), then
   **New Project**. Name it `joelpolanco-site` and click **Create**. Wait for the notification,
   then make sure that project is the one selected in the dropdown.
3. In the left menu choose **APIs & Services → Library**. Search for `Google Drive API`, click it,
   and click **Enable**.
4. Go to **APIs & Services → Credentials**. Click **+ Create credentials** at the top, then
   **Service account**.
   - Service account name: `site-publisher`
   - Click **Create and continue**, then **Continue**, then **Done**. The two optional steps in the
     middle can be skipped.
5. Back on the Credentials page, click the new `site-publisher` account, then the **Keys** tab.
   Click **Add key → Create new key**, choose **JSON**, and click **Create**. A `.json` file
   downloads. Keep it somewhere safe — it is a password and Google will not show it again.
6. Open that file in a text editor. Two values matter:
   - `"client_email"` — something like
     `site-publisher@joelpolanco-site.iam.gserviceaccount.com`. This is
     `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
   - `"private_key"` — a long block starting `-----BEGIN PRIVATE KEY-----`. Copy everything
     between the quotes, including the `\n` sequences, exactly as it appears. This is
     `GOOGLE_SERVICE_ACCOUNT_KEY`.

#### Part 2 — set up the Drive folder

1. In Google Drive, create a folder called **Website posts**.
2. Open it and create a folder inside it called **Drafts**.
3. Right-click **Website posts** and choose **Share**. Paste the `client_email` from step 6 above
   into the people box, set the role to **Viewer**, turn **off** "Notify people" (it is a robot),
   and click **Share** (or **Send**).
4. Open **Website posts** and look at the browser address bar. It reads
   `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i`. The part after `folders/` is
   `GDOCS_FOLDER_ID`.

Only documents sitting directly in **Website posts** are published. Anything in **Drafts** is
ignored, which is what makes dragging a doc between them the publish action.

#### Part 3 — tell Cloudflare

Add the three values as build environment variables on the Pages project (see the table above),
then set up the hourly rebuild by following
[`workers/deploy-hook-cron/README.md`](workers/deploy-hook-cron/README.md).

To check it works before waiting an hour, trigger a deploy manually from the Pages dashboard and
read the build log. The sync prints one line per document it imported, or one line explaining what
is missing.

### If the service account turns out to be a hassle

There is a manual path that needs no Google Cloud setup at all. In Google Docs choose
**File → Download → Markdown (.md)**, then:

```bash
npm run import:doc -- ~/Downloads/My\ new\ post.md
git add -A && git commit -m "Add post" && git push
```

It produces exactly what the automated sync produces — both call the same converter — and the push
triggers a deploy.

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
integrations/
  sitemap-alias.mjs        Mirrors sitemap-index.xml to sitemap.xml
scripts/
  ingest-archive.mjs       One-shot import of the Wix extraction archive
  sync-gdocs.mjs           Build-time Google Drive to MDX sync
  import-doc.mjs           Manual "Download as Markdown" import
  lib/                     Shared converter and the minimal Drive client
src/
  config/site.ts           Canonical site identity, redirects, feed path
  content.config.ts        Collection schemas
  content/posts/           23 migrated posts
  content/pages/           Page datasets as JSON
  content/home.ts          Homepage copy for the three design directions
  assets/images/           Migrated imagery
  assets/fonts/            Inter subsets for OG card rendering
  components/seo/          JSON-LD components
  lib/contact/             Validation, rate limiting, Resend delivery
  lib/og-image.ts          OG card rendering
  pages/
    api/contact.ts         Contact form backend
    blog-feed.xml.ts       RSS at the path Wix used
    og/[slug].png.ts       Per-post OG cards
    index.astro            Placeholder pointing at the design review
    design/                The three directions and the comparison page
  styles/                  Tailwind plus per-direction tokens
tests/                     Slug parity and content integrity
workers/deploy-hook-cron/  Hourly rebuild trigger
```

## Deployment

Configured for Cloudflare through the Cloudflare adapter, with `wrangler.jsonc` holding the worker
settings. `npm run build` produces the static site in `dist/client`, the worker in `dist/server`,
and a deploy-ready `dist/server/wrangler.json` that points at both.

Nothing is deployed yet — that happens at cutover, after a design direction is picked. The
redirects, feed and sitemap above are all in the build output already and can be verified with
`npm run preview` before any DNS moves.
