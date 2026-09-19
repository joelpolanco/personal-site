/**
 * Guards the counts and asset references the extraction established, so a
 * later refactor cannot quietly drop content. The counts here are the ones
 * `REPORT.md` verified against the live Wix site — notably ten portfolio
 * projects (not the nine in the plan) and three homepage testimonials (not the
 * one Wix server-renders).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(repoRoot, 'src/content/posts');
const pagesDir = path.join(repoRoot, 'src/content/pages');

const page = (name) => JSON.parse(readFileSync(path.join(pagesDir, `${name}.json`), 'utf8'));

/** Every `![](...)` and `heroImage:` path in a post, resolved against the file. */
function postImageRefs(file) {
  const raw = readFileSync(path.join(postsDir, file), 'utf8');
  const refs = [...raw.matchAll(/]\((\.\.[^)\s]+)\)/g)].map((m) => m[1]);
  const hero = raw.match(/^heroImage:\s*"([^"]+)"/m);
  if (hero) refs.push(hero[1]);
  return refs.map((ref) => path.resolve(postsDir, ref));
}

/** Every `"local"` asset path in a page dataset, resolved against the file. */
function pageImageRefs(name) {
  const raw = readFileSync(path.join(pagesDir, `${name}.json`), 'utf8');
  return [...raw.matchAll(/"local":\s*"([^"]+)"/g)].map((m) => path.resolve(pagesDir, m[1]));
}

test('all 23 migrated posts are present', () => {
  // Posts published from Google Docs add to this directory, so count only the
  // ones that came from Wix.
  const migrated = readdirSync(postsDir)
    .filter((file) => /\.mdx?$/.test(file))
    .filter((file) => /^source:\s*"wix"/m.test(readFileSync(path.join(postsDir, file), 'utf8')));
  assert.equal(migrated.length, 23);
});

test('every image a post references exists in src/assets', () => {
  const broken = readdirSync(postsDir)
    .filter((f) => /\.mdx?$/.test(f))
    .flatMap((file) => postImageRefs(file).filter((ref) => !existsSync(ref)).map((ref) => `${file} -> ${ref}`));
  assert.deepEqual(broken, []);
});

test('every image a page dataset references exists in src/assets', () => {
  const names = ['home', 'portfolio', 'media', 'resources', 'contact'];
  const broken = names.flatMap((name) =>
    pageImageRefs(name).filter((ref) => !existsSync(ref)).map((ref) => `${name} -> ${ref}`),
  );
  assert.deepEqual(broken, []);
});

test('the homepage carries all three testimonials', () => {
  // Wix server-rendered one carousel slide; the other two were only found by
  // driving a browser, so losing them again would be easy and invisible.
  assert.deepEqual(
    page('home').testimonials.items.map((t) => t.name),
    ['Marie Eric', 'Keith Gregorzyk Ph.D.', 'Mike Ducker'],
  );
});

test('the portfolio carries all ten projects', () => {
  const { groups } = page('portfolio');
  assert.equal(
    groups.reduce((total, group) => total + group.items.length, 0),
    10,
  );
  for (const group of groups) {
    assert.equal(group.items.length, group.count, `${group.group} count disagrees with its items`);
  }
});

test('resources keeps all 22 entries and the homepage keeps four numbered skills', () => {
  assert.equal(
    page('resources').groups.reduce((total, group) => total + group.items.length, 0),
    22,
  );
  assert.deepEqual(
    page('home').skills.items.map((item) => item.number),
    ['01', '02', '03', '04'],
  );
});

test('media keeps five appearances and three talk clips', () => {
  const media = page('media');
  assert.equal(media.appearances.length, 5);
  assert.equal(media.talkClips.length, 3);
});

test('the Intel RSP case study is served from our own origin, not Wix', () => {
  const links = page('portfolio').groups.flatMap((group) => group.items.map((item) => item.link));
  assert.ok(
    links.includes('/files/intel-rfid-sensor-platform.pdf'),
    'the re-hosted PDF link was reverted to the Wix URL, which dies at cutover',
  );
});

test('nothing links to a Wix-hosted file or a known-dead URL', () => {
  // Wix `_files/ugd` assets stop resolving the moment the plan is cancelled,
  // and these five URLs were already 404 at extraction time.
  const DEAD = [
    'joelpolanco.me/_files/',
    'marketscale.com/shows/to-the-edge-and-beyond',
    'marketscale.com/shows/health-and-life-sciences-at-the-edge',
  ];
  const offenders = readdirSync(pagesDir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const raw = readFileSync(path.join(pagesDir, file), 'utf8');
      return DEAD.filter((dead) => raw.includes(dead)).map((dead) => `${file}: ${dead}`);
    });
  assert.deepEqual(offenders, []);
});

test('every post has one of the six categories, and none of them is empty', () => {
  const source = readFileSync(path.join(repoRoot, 'src/config/categories.ts'), 'utf8');
  const known = [...source.matchAll(/^\s*id: '([a-z0-9-]+)',$/gm)].map((match) => match[1]);
  assert.equal(known.length, 6);

  const used = readdirSync(postsDir)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const raw = readFileSync(path.join(postsDir, file), 'utf8');
      const match = raw.match(/^category:\s*"([^"]+)"/m);
      assert.ok(match, `${file} has no category`);
      return match[1];
    });

  assert.deepEqual(
    used.filter((category) => !known.includes(category)),
    [],
    'a post uses a category that is not in src/config/categories.ts',
  );
  assert.deepEqual(
    known.filter((category) => !used.includes(category)),
    [],
    'a category has no posts — remove it or file something under it',
  );
});
