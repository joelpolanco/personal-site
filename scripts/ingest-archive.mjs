#!/usr/bin/env node
/**
 * One-shot import of the host-agnostic Wix archive into the Astro project.
 *
 * Kept in the repo so the import is reproducible rather than a pile of manual
 * moves: point it at a regenerated archive and it produces byte-identical
 * output. Post filenames are never transformed — they are the live
 * `/post/<slug>` URLs and `tests/slug-parity.test.mjs` enforces that.
 *
 *   node scripts/ingest-archive.mjs [archiveDir]
 */
import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveDir = path.resolve(process.argv[2] ?? '/home/ubuntu/wix-extract/archive');

const postsOut = path.join(repoRoot, 'src/content/posts');
const pagesOut = path.join(repoRoot, 'src/content/pages');
const imagesOut = path.join(repoRoot, 'src/assets/images');

/** Where content files sit relative to `src/assets/images`. */
const IMAGE_PREFIX = '../../assets/images';

/** `/contact-6` is redirected to `/contact`, so the dataset is filed under the new name. */
const PAGE_RENAMES = { 'contact-6': 'contact' };

/**
 * The Wix-hosted PDF behind the Intel RSP portfolio entry dies when the Wix
 * plan is cancelled, so it is served from our own origin instead.
 */
const REHOSTED_FILES = {
  'https://www.joelpolanco.me/_files/ugd/c0cb3a_78f9c270e0bc408cb4d4f7e2b226d21f.pdf?index=true':
    '/files/intel-rfid-sensor-platform.pdf',
};

async function ingestImages() {
  await mkdir(imagesOut, { recursive: true });
  const files = await readdir(path.join(archiveDir, 'images'));
  for (const file of files) {
    await cp(path.join(archiveDir, 'images', file), path.join(imagesOut, file));
  }
  return files.length;
}

async function ingestPosts() {
  await rm(postsOut, { recursive: true, force: true });
  await mkdir(postsOut, { recursive: true });
  const files = (await readdir(path.join(archiveDir, 'posts'))).filter((f) => f.endsWith('.mdx'));
  for (const file of files) {
    const source = await readFile(path.join(archiveDir, 'posts', file), 'utf8');
    // Archive images live one level up from `posts/`; ours live in src/assets.
    const rewritten = source.replaceAll('../images/', `${IMAGE_PREFIX}/`);
    await writeFile(path.join(postsOut, file), rewritten);
  }
  return files.length;
}

/**
 * Split "Marie Eric, Co-Founder, Tastee Tape" into its parts so a template can
 * set them separately. The raw string stays as the source of truth.
 */
function splitAttribution(attribution) {
  if (typeof attribution !== 'string') return {};
  const parts = attribution.split(',').map((part) => part.trim());
  if (parts.length < 3) return {};
  return { name: parts[0], role: parts[1], company: parts.slice(2).join(', ') };
}

/** Recursively rewrite archive-relative asset paths inside a page dataset. */
function rewritePageValue(value, missingImages) {
  if (Array.isArray(value)) return value.map((item) => rewritePageValue(item, missingImages));
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  if (typeof value.quote === 'string' && typeof value.attribution === 'string') {
    Object.assign(out, splitAttribution(value.attribution));
  }
  for (const [key, val] of Object.entries(value)) {
    if (key === 'local' && typeof val === 'string' && val.startsWith('images/')) {
      const onDisk = path.join(archiveDir, val);
      if (!existsSync(onDisk)) {
        // The archive records references it could not download (one deleted
        // YouTube thumbnail). Null is honest; the schema allows it.
        missingImages.push(val);
        out[key] = null;
        continue;
      }
      out[key] = val.replace(/^images\//, `${IMAGE_PREFIX}/`);
      continue;
    }
    if (key === 'link' && typeof val === 'string' && REHOSTED_FILES[val]) {
      out[key] = REHOSTED_FILES[val];
      continue;
    }
    out[key] = rewritePageValue(val, missingImages);
  }
  return out;
}

async function ingestPages() {
  await rm(pagesOut, { recursive: true, force: true });
  await mkdir(pagesOut, { recursive: true });
  const files = (await readdir(path.join(archiveDir, 'pages'))).filter((f) => f.endsWith('.json'));
  const missingImages = [];
  for (const file of files) {
    const name = path.basename(file, '.json');
    const data = JSON.parse(await readFile(path.join(archiveDir, 'pages', file), 'utf8'));
    const rewritten = rewritePageValue(data, missingImages);
    const outName = `${PAGE_RENAMES[name] ?? name}.json`;
    await writeFile(path.join(pagesOut, outName), `${JSON.stringify(rewritten, null, 2)}\n`);
  }
  return { count: files.length, missingImages };
}

const images = await ingestImages();
const posts = await ingestPosts();
const pages = await ingestPages();

console.log(`ingest-archive: ${posts} posts, ${pages.count} page datasets, ${images} images`);
if (pages.missingImages.length > 0) {
  console.log(`ingest-archive: nulled ${pages.missingImages.length} undownloadable image reference(s):`);
  for (const ref of pages.missingImages) console.log(`  - ${ref}`);
}
