/**
 * The 23 migrated posts are indexed by Google at `joelpolanco.me/post/<slug>`.
 * Those slugs are the filenames in `src/content/posts/`, so any rename — a
 * tidy-up, a "fix" to an apostrophe-derived slug, a re-import — silently 404s
 * a live URL and drops the ranking with it.
 *
 * This asserts the filenames still match the Wix blog sitemap captured at
 * extraction time (`tests/fixtures/legacy-blog-posts-sitemap.xml`), byte for
 * byte. It runs on `npm test` and again via `prebuild`, so a production build
 * cannot ship a broken slug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(repoRoot, 'src/content/posts');
const sitemapFile = path.join(repoRoot, 'tests/fixtures/legacy-blog-posts-sitemap.xml');

const LEGACY_POST_COUNT = 23;

/** Slugs Google knows about, straight out of the Wix sitemap. */
function legacySlugs() {
  const xml = readFileSync(sitemapFile, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs
    .filter((url) => url.includes('/post/'))
    .map((url) => url.slice(url.lastIndexOf('/post/') + '/post/'.length));
}

function postFiles() {
  return readdirSync(postsDir).filter((file) => /\.mdx?$/.test(file));
}

function frontmatter(file) {
  const raw = readFileSync(path.join(postsDir, file), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, `${file} has no frontmatter block`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    fields[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return fields;
}

test('the legacy sitemap fixture still lists all 23 posts', () => {
  assert.equal(legacySlugs().length, LEGACY_POST_COUNT);
});

test('every indexed /post/<slug> URL still has a post file with that exact name', () => {
  const onDisk = new Set(postFiles().map((file) => file.replace(/\.mdx?$/, '')));
  const missing = legacySlugs().filter((slug) => !onDisk.has(slug));
  assert.deepEqual(
    missing,
    [],
    `renaming these files breaks live URLs — restore the exact names: ${missing.join(', ')}`,
  );
});

test('each post frontmatter slug matches its filename', () => {
  const mismatched = postFiles()
    .map((file) => ({ file, slug: frontmatter(file).slug }))
    .filter(({ file, slug }) => slug !== file.replace(/\.mdx?$/, ''));
  assert.deepEqual(
    mismatched,
    [],
    'frontmatter slug and filename must agree; the filename is what serves the URL',
  );
});

test('migrated posts still point their canonical URL at the same slug', () => {
  const wrong = postFiles()
    .map((file) => ({ file, ...frontmatter(file) }))
    .filter((post) => post.source === 'wix')
    .filter((post) => post.canonicalUrl !== `https://www.joelpolanco.me/post/${post.slug}`);
  assert.deepEqual(wrong, [], 'a migrated post canonical URL drifted from its slug');
});
