#!/usr/bin/env node
/**
 * The manual publishing path, for when the service account is more trouble
 * than it is worth: in Google Docs choose File -> Download -> Markdown (.md),
 * then run this on the file it saves.
 *
 *   npm run import:doc -- ~/Downloads/My\ new\ post.md
 *
 * Produces exactly what the automated sync produces, because both call the
 * same converter. Images embedded in the download are saved into the repo;
 * images that are still Google-hosted links are fetched.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertDocToPost } from './lib/doc-to-mdx.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run import:doc -- <file.md | folder>');
  console.error('Export from Google Docs with File -> Download -> Markdown (.md).');
  process.exit(1);
}

/**
 * Docs with images download as a folder (or an unzipped archive) holding the
 * .md file and an images/ directory beside it.
 */
async function resolveMarkdownFile(target) {
  const info = await stat(target).catch(() => null);
  if (!info) {
    console.error(`No such file or folder: ${target}`);
    process.exit(1);
  }
  if (info.isFile()) return target;

  const markdown = (await readdir(target)).filter((file) => file.endsWith('.md'));
  if (markdown.length !== 1) {
    console.error(
      `Expected exactly one .md file in ${target}, found ${markdown.length}. ` +
        'Pass the .md file directly.',
    );
    process.exit(1);
  }
  return path.join(target, markdown[0]);
}

const markdownFile = await resolveMarkdownFile(input);
const markdown = await readFile(markdownFile, 'utf8');
const docName = path.basename(markdownFile, '.md');

/** Resolve the download's own `images/…` paths as well as remote URLs. */
const fetchImpl = async (url) => {
  if (/^https?:/.test(url)) return fetch(url);
  const local = path.resolve(path.dirname(markdownFile), decodeURIComponent(url));
  const bytes = await readFile(local);
  return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } });
};

try {
  const result = await convertDocToPost({
    markdown,
    docName,
    modifiedTime: (await stat(markdownFile)).mtime.toISOString(),
    repoRoot,
    fetchImpl,
  });
  console.log(`Imported "${result.title}"`);
  console.log(`  ${result.file}`);
  if (result.imageCount > 0) console.log(`  ${result.imageCount} image(s) saved`);
  console.log('\nReview it, then commit and push to publish.');
} catch (error) {
  console.error(`Import failed: ${error.message}`);
  process.exit(1);
}
