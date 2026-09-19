/**
 * Converts one Google Doc, exported as Markdown, into an MDX file matching the
 * `posts` collection schema.
 *
 * Shared by both publishing paths so they cannot drift: the automated Drive
 * sync (`scripts/sync-gdocs.mjs`) and the manual "Download as Markdown" import
 * (`scripts/import-doc.mjs`) both end up here with the same markdown text.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const POSTS_DIR = 'src/content/posts';
export const IMAGES_DIR = 'src/assets/images/gdocs';
/** Where post files sit relative to `src/assets/images/gdocs`. */
const IMAGE_PREFIX = '../../assets/images/gdocs';

const WORDS_PER_MINUTE = 220;

/**
 * Keys Joel can set by typing `Key: value` on the first lines of the doc,
 * before the title. Anything else in that block is left in the body.
 */
const PREAMBLE_KEYS = new Set(['slug', 'description', 'published', 'updated', 'tags', 'category']);

/**
 * Read the blog category ids out of the site config rather than repeating them
 * here, so the two can never disagree. A post with no valid category would
 * fail content validation at build time with a much less helpful message.
 */
async function categoryIds(repoRoot) {
  const source = await readFile(path.join(repoRoot, 'src/config/categories.ts'), 'utf8');
  const ids = [...source.matchAll(/^\s*id: '([a-z0-9-]+)',$/gm)].map((match) => match[1]);
  if (ids.length === 0) throw new Error('could not read categories from src/config/categories.ts');
  return ids;
}

/** `Charting the PM's career path` -> `charting-the-pm-s-career-path`. */
export function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function readingTime(markdown) {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;
}

/** YYYY-MM-DD in UTC. */
function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 10);
}

function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * MDX treats `<` and `{` as syntax. The Wix import escaped them the same way,
 * so posts from either source behave identically in the compiler.
 */
function escapeMdx(markdown) {
  const lines = markdown.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/[<{]/g, (char) => `\\${char}`);
    })
    .join('\n');
}

/** Pull `Key: value` lines off the top of the doc. */
function splitPreamble(markdown) {
  const lines = markdown.split('\n');
  const meta = {};
  let index = 0;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') {
      if (Object.keys(meta).length > 0) continue;
      break;
    }
    const match = line.match(/^\*{0,2}([A-Za-z]+)\*{0,2}:\s*(.*)$/);
    if (!match || !PREAMBLE_KEYS.has(match[1].toLowerCase())) break;
    meta[match[1].toLowerCase()] = match[2].trim();
  }
  return { meta, body: lines.slice(index).join('\n').trim() };
}

/**
 * Google exports images either inline or as reference definitions collected at
 * the end of the file. Both forms appear depending on the document, so both
 * are handled.
 */
function collectImages(markdown) {
  const references = new Map();
  const body = markdown.replace(/^\[([^\]]+)]:\s*<?(\S+?)>?\s*$/gm, (_match, id, url) => {
    references.set(id, url);
    return '';
  });

  const found = [];
  const rewritten = body
    // Any src: remote for the Drive sync, a sibling `images/…` path for a
    // "Download as Markdown" folder.
    .replace(/!\[([^\]]*)]\(<?([^)>\s]+)>?\)/g, (_match, alt, url) => {
      const token = `__IMAGE_${found.length}__`;
      found.push({ url, alt });
      return `![${alt}](${token})`;
    })
    .replace(/!\[([^\]]*)]\[([^\]]+)]/g, (match, alt, id) => {
      const url = references.get(id);
      if (!url) return match;
      const token = `__IMAGE_${found.length}__`;
      found.push({ url, alt });
      return `![${alt}](${token})`;
    });

  return { body: rewritten, images: found };
}

function extensionFor(url, contentType) {
  const fromType = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[
    (contentType ?? '').split(';')[0]
  ];
  if (fromType) return fromType;
  const pathname = url.split(/[?#]/)[0];
  const fromUrl = pathname.match(/\.(png|jpe?g|gif|webp)$/i);
  return fromUrl ? fromUrl[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * Pull every referenced image into the repo. Google's image URLs are
 * short-lived, so a post that still pointed at them would lose its images.
 */
async function downloadImages(images, slug, repoRoot, fetchImpl) {
  if (images.length === 0) return [];
  await mkdir(path.join(repoRoot, IMAGES_DIR), { recursive: true });

  const saved = [];
  for (const [index, image] of images.entries()) {
    const response = await fetchImpl(image.url);
    if (!response.ok) {
      throw new Error(`image ${index + 1} of "${slug}" returned HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const file = `${slug}-${String(index + 1).padStart(2, '0')}.${extensionFor(
      image.url,
      response.headers.get('content-type'),
    )}`;
    await writeFile(path.join(repoRoot, IMAGES_DIR, file), buffer);
    saved.push({ ...image, file });
  }
  return saved;
}

/**
 * @param {object} input
 * @param {string} input.markdown      Markdown exported from the Google Doc.
 * @param {string} input.docName       Doc title, used when the body has no H1.
 * @param {string} [input.modifiedTime] Drive's last-modified timestamp.
 * @param {string} input.repoRoot
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<{slug: string, file: string, title: string, imageCount: number}>}
 */
export async function convertDocToPost({
  markdown,
  docName,
  modifiedTime,
  repoRoot,
  fetchImpl = fetch,
}) {
  const { meta, body: withoutPreamble } = splitPreamble(markdown);

  // A leading H1 is the title; Docs repeats it in the body, so lift it out.
  const headingMatch = withoutPreamble.match(/^#\s+(.+?)\s*$/m);
  const title = headingMatch ? headingMatch[1].trim() : docName.trim();
  const withoutTitle = headingMatch
    ? withoutPreamble.replace(headingMatch[0], '').trim()
    : withoutPreamble;

  const slug = meta.slug ? slugify(meta.slug) : slugify(title);
  if (!slug) throw new Error(`could not derive a slug for "${docName}"`);
  await assertNotMigratedPost(slug, repoRoot);

  const validCategories = await categoryIds(repoRoot);
  const category = (meta.category ?? '').trim();
  if (!validCategories.includes(category)) {
    throw new Error(
      `needs a "Category:" line at the top of the document. One of: ${validCategories.join(', ')}`,
    );
  }

  const { body: tokenized, images } = collectImages(withoutTitle);
  const saved = await downloadImages(images, slug, repoRoot, fetchImpl);

  let body = tokenized;
  saved.forEach((image, index) => {
    body = body.replace(`__IMAGE_${index}__`, `${IMAGE_PREFIX}/${image.file}`);
  });
  // Any image that was not saved loses its reference rather than pointing at a
  // Google URL that will expire.
  body = body.replace(/!\[[^\]]*]\(__IMAGE_\d+__\)\n?/g, '');

  const description =
    meta.description ??
    (body
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/[#>*_`[\]]/g, '')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 40) ?? title);

  const tags = meta.tags
    ? meta.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const frontmatter = [
    '---',
    `title: ${quote(title)}`,
    `slug: ${quote(slug)}`,
    `description: ${quote(description.slice(0, 300))}`,
    `pubDate: ${quote(isoDate(meta.published))}`,
    `updatedDate: ${quote(isoDate(meta.updated ?? modifiedTime))}`,
    'heroImage: null',
    'heroImageAlt: null',
    `category: ${quote(category)}`,
    `tags: [${tags.map(quote).join(', ')}]`,
    'author: "Joel Polanco"',
    `readingTime: ${quote(readingTime(body))}`,
    `canonicalUrl: "https://joelpolanco.me/post/${slug}"`,
    'originalUrl: null',
    'source: "gdocs"',
    'firstAppearedIn: null',
    '---',
    '',
    '',
  ].join('\n');

  const file = path.join(POSTS_DIR, `${slug}.mdx`);
  await mkdir(path.join(repoRoot, POSTS_DIR), { recursive: true });
  await writeFile(path.join(repoRoot, file), `${frontmatter}${escapeMdx(body)}\n`);

  return { slug, file, title, imageCount: saved.length };
}

/**
 * Refuse to overwrite a migrated post. Those slugs are live, indexed URLs, and
 * a doc that happens to resolve to one must not clobber it.
 */
async function assertNotMigratedPost(slug, repoRoot) {
  const file = path.join(repoRoot, POSTS_DIR, `${slug}.mdx`);
  let existing;
  try {
    existing = await readFile(file, 'utf8');
  } catch {
    return;
  }
  if (/^source:\s*"wix"/m.test(existing)) {
    throw new Error(
      `"${slug}" is a migrated Wix post at a live URL. Give the Google Doc a different ` +
        'title, or set a "Slug:" line at the top of it.',
    );
  }
}
