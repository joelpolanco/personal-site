# joelpolanco.me

The Astro rebuild of [joelpolanco.me](https://www.joelpolanco.me), migrating off Wix onto
Cloudflare Pages. Minimalist, fast, content-first, and cheap to run.

Current state: the site is complete and building cleanly. Every page is built, all 23 posts are
migrated at their original URLs, and the SEO, contact and publishing plumbing is in place. What is
left is the cutover — moving the domain — which needs a Cloudflare account. See
[Cutover checklist](#cutover-checklist).

## Stack

| Piece       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Framework   | [Astro](https://astro.build) 7, TypeScript (strict)         |
| Design      | Swiss grid — see [Design system](#design-system)            |
| Styling     | Tailwind CSS 4 preflight plus CSS custom properties          |
| Content     | Typed content collections, MDX via `@astrojs/mdx`           |
| SEO         | `@astrojs/sitemap`, `@astrojs/rss`, satori + resvg for OG cards |
| Hosting     | Cloudflare Pages via `@astrojs/cloudflare`                  |
| Email       | [Resend](https://resend.com) from a Cloudflare function     |
| Fonts       | Self-hosted Inter Variable, no third-party CDN               |

## Pages

| Route              | What it is                                                  |
| ------------------ | ----------------------------------------------------------- |
| `/`                | Intro, background, current role, what Joel is hired for, testimonials, latest posts |
| `/portfolio`       | Ten projects in two groups                                   |
| `/media`           | Five appearances and three talk clips                        |
| `/resources`       | Twenty-two recommendations in three groups                   |
| `/blog`            | All 23 posts, filterable by category                         |
| `/blog/<category>` | One of the six categories                                    |
| `/post/<slug>`     | A post. **These URLs are load-bearing** — see below          |
| `/contact`         | The form, posting to `/api/contact`                          |
| `/404`             | Styled not-found page pointing at the blog                   |

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

`home.json` is the one dataset that is authored rather than migrated — it carries Joel's current
facts, not the Wix copy — so it has a shape built for its template.

### Categories

Wix exposed no categories or tags at all, so the taxonomy in `src/config/categories.ts` was
invented from the posts themselves. Six buckets, every post in exactly one, none with fewer than
three posts.

| Category                | Posts | Covers                                                       |
| ----------------------- | ----- | ------------------------------------------------------------ |
| Customer Discovery      | 4     | Talking to customers before you build                        |
| Growth & Revenue        | 5     | Acquisition, retention, pricing, how products make money      |
| Frameworks & Process    | 5     | Frameworks and rituals worth keeping                          |
| Communication & Craft   | 3     | Writing, listening, judgement                                 |
| The PM Career           | 3     | Career paths, lateral moves, where the role is going          |
| Industry & AI           | 3     | Launches, org shake-ups, hands-on AI experiments              |

The schema takes a zod enum, so a typo fails the build rather than quietly creating a seventh
category, and `npm test` fails if a category ends up with no posts. Renaming an `id` changes a
URL, so treat them as fixed now that they exist.

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
It is the same idea as the on-page post cover, in a format Twitter and LinkedIn can read: the
category as a red eyebrow, the title set tight, one rule.

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

Start the doc with a few plain lines setting its fields, then a blank line, then the title as
**Heading 1**, then the post:

```
Category: growth-and-revenue
Slug: a-shorter-url-than-the-title
Description: The one or two sentences Google and Twitter show under the link.
Published: 2026-10-02
Tags: pricing, strategy
```

**`Category` is the only required one.** It has to be one of the six ids from
[Categories](#categories): `customer-discovery`, `growth-and-revenue`, `frameworks-and-process`,
`communication-and-craft`, `the-pm-career`, `industry-and-ai`. A doc without one is skipped and
the build log says so, naming the valid ids.

The rest are optional: without them the title becomes the slug, the first real paragraph becomes
the description, and today becomes the date.

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

## Design system

Swiss grid: tight Inter, a visible twelve-column grid, hairline rules, numbered sections, and one
saturated red against monochrome. It was picked from three directions built on Joel's real
homepage copy; the other two are gone from the repo.

Tokens live at `:root` in `src/styles/global.css`, components in `src/styles/site.css`. Every class
is prefixed `sw-` because the obvious names — `.grid`, `.card`, `.label` — collide with Tailwind
utilities. Tailwind is here for its preflight reset and the occasional utility, not for composing
the design.

Post covers are typographic, generated from each title in one of four variants chosen from the
slug, so a post keeps the same cover across builds. There is no stock photography anywhere: the
Wix hero images were mostly upscaled thumbnails, and `src/components/PostCover.astro` and
`src/lib/og-image.ts` render the same idea for the page and for social cards.

## Layout

```
integrations/
  sitemap-alias.mjs        Mirrors sitemap-index.xml to sitemap.xml
scripts/
  ingest-archive.mjs       First import of the Wix extraction archive
  sync-gdocs.mjs           Build-time Google Drive to MDX sync
  import-doc.mjs           Manual "Download as Markdown" import
  lib/                     Shared converter and the minimal Drive client
src/
  config/
    site.ts                Site identity, nav, redirects, feed path
    categories.ts          The six blog categories
  content.config.ts        Collection schemas
  content/posts/           23 migrated posts
  content/pages/           Page datasets as JSON
  assets/images/           Migrated imagery
  assets/fonts/            Inter subsets for OG card rendering
  components/
    seo/                   JSON-LD components
    SiteHeader / SiteFooter / PageHead
    PostCover / PostCard / ItemCard / CategoryNav
    ContactForm.astro      Form markup and progressive enhancement
  layouts/BaseLayout.astro Head metadata, chrome, grid guides
  lib/
    contact/               Validation, rate limiting, Resend delivery
    inline-markdown.ts     Renders the short markdown strings in page JSON
    og-image.ts            OG card rendering
    posts.ts               Shared post queries
  pages/
    index / portfolio / media / resources / contact / 404
    blog/                  Index and one page per category
    post/[slug].astro      The 23 posts
    api/contact.ts         Contact form backend
    blog-feed.xml.ts       RSS at the path Wix used
    og/[slug].png.ts       Per-post OG cards
  styles/
    global.css             Tailwind, Inter, tokens, base layer
    site.css               The design system
tests/                     Slug parity and content integrity
workers/deploy-hook-cron/  Hourly rebuild trigger
```

## Deployment

Configured for Cloudflare through the Cloudflare adapter, with `wrangler.jsonc` holding the worker
settings. `npm run build` produces the static site in `dist/client`, the worker in `dist/server`,
and a deploy-ready `dist/server/wrangler.json` that points at both.

## Cutover checklist

Nothing below has been done — all of it needs a Cloudflare account, which only Joel can create.
**Wix stays live and paid until the last step.** Work top to bottom.

### 1. Get the site deploying

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages → Create → Pages → Connect to Git**, authorise GitHub, and pick this
   repository.
3. Build settings: framework preset **Astro**, build command `npm run build`, build output
   directory `dist`. Leave the root directory blank.
4. Deploy. Cloudflare gives the site a `*.pages.dev` address.
5. Open that address and click through every page. At this point it is a working copy of the new
   site on a temporary URL, with the real domain untouched.

### 2. Add the environment variables

Set the contact form and Google Docs variables from
[Environment variables](#environment-variables). Redeploy, then send yourself a test message
through the form to confirm delivery.

### 3. Decide how the domain moves

Two routes, and the right one depends on how recently `joelpolanco.me` was registered or
transferred:

- **Transfer to Cloudflare Registrar** — $16.56/yr at cost. Not possible if the domain was
  registered or last transferred within 60 days; ICANN locks it. Check the registration date in
  the Wix domain settings first.
- **Keep it registered at Wix and point the nameservers at Cloudflare** — works immediately, no
  lock, and can be converted to a full transfer later.

Either way the DNS lives at Cloudflare, which is what the rest of this needs.

**To transfer:** in Wix, unlock the domain and request the authorisation (EPP) code. In Cloudflare,
**Domain Registration → Transfer Domains**, paste the code, and pay. Transfers take up to seven
days and the site keeps resolving from Wix throughout.

**To point nameservers only:** in Cloudflare, **Add a site**, enter `joelpolanco.me`, take the
free plan, and let it scan the existing records. Copy the two nameservers it gives you into the
Wix domain settings. Propagation is usually under an hour.

### 4. Check the DNS records before switching

In the Cloudflare DNS list, confirm anything that is not the website still points where it did at
Wix — in particular any `MX` records, or email stops arriving. Add the site itself:

- In the Pages project, **Custom domains → Set up a custom domain**, add `joelpolanco.me` and then
  `www.joelpolanco.me`. Cloudflare creates the records and issues the certificate.
- Wix served the site from `www.joelpolanco.me`. Keep `www` working and redirect it to the apex
  (or the reverse — pick one and be consistent), so there is a single canonical hostname.

### 5. Verify every legacy URL before cancelling anything

With the domain live on Cloudflare, check each of these by hand. Every one of them was indexed by
Google on the Wix site:

- All 23 `https://joelpolanco.me/post/<slug>` URLs return **200**. The slugs are the filenames in
  `src/content/posts/`; `npm test` checks them against the captured Wix sitemap, but confirm a few
  in a browser.
- `/blog`, `/portfolio`, `/media`, `/resources` return 200.
- `/contact-6` returns a **301** to `/contact`, and `/project-1` a **301** to `/portfolio`.
- `/blog-feed.xml` returns the feed. Paste it into a reader and confirm it loads.
- `/sitemap.xml` and `/robots.txt` resolve.
- A made-up URL returns the styled 404.

A quick pass from a terminal:

```bash
for p in / /blog /portfolio /media /resources /contact /blog-feed.xml /sitemap.xml \
         /contact-6 /project-1 /post/what-is-customer-discovery; do
  printf '%-40s ' "$p"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://joelpolanco.me$p"
done
```

### 6. Tell Google

1. Add `joelpolanco.me` at <https://search.google.com/search-console> and verify it (the DNS TXT
   method is easiest now that DNS is at Cloudflare).
2. Submit `https://joelpolanco.me/sitemap.xml`.
3. Use **URL Inspection** on two or three post URLs to confirm Google sees the new pages.

### 7. Only then, cancel Wix

Wait until the new site has been live and correct for a week and Search Console shows no spike in
404s. Then cancel the Wix plan. If the domain is still registered at Wix, make sure cancelling the
*site* plan does not cancel the *domain* — they are billed separately, and losing the registration
is not recoverable.

### Running cost afterwards

| Item | Cost |
| --- | --- |
| Cloudflare Pages hosting | $0 |
| `joelpolanco.me` at Cloudflare Registrar | $16.56/yr |
| Contact form via Resend | $0 up to 3,000 emails/month |
| Deploy hook cron worker | $0 |
