#!/usr/bin/env node
/**
 * Build-time sync from Joel's Google Drive publishing folder into MDX posts.
 *
 * Runs before every build (`prebuild`). When the Google environment variables
 * are absent it prints one line and exits 0 — the pipeline can be set up later
 * without every build in the meantime failing or warning noisily.
 *
 * Failures after that point (Drive unreachable, a doc that will not convert)
 * are reported and then swallowed too, so a transient Google problem cannot
 * block a deploy of content that is already in the repo. Set GDOCS_STRICT=true
 * to make those failures fail the build instead, which is what you want while
 * setting the pipeline up.
 *
 *   node scripts/sync-gdocs.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDriveClient } from './lib/google-drive.mjs';
import { convertDocToPost } from './lib/doc-to-mdx.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.env.GDOCS_STRICT === 'true';

const SETTINGS = {
  clientEmail: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  privateKey: 'GOOGLE_SERVICE_ACCOUNT_KEY',
  folderId: 'GDOCS_FOLDER_ID',
};

const config = Object.fromEntries(
  Object.entries(SETTINGS).map(([key, variable]) => [key, process.env[variable]]),
);

function log(message) {
  console.log(`sync-gdocs: ${message}`);
}

function bail(message) {
  if (strict) {
    console.error(`sync-gdocs: ${message}`);
    process.exit(1);
  }
  log(`${message} (continuing; set GDOCS_STRICT=true to treat this as fatal)`);
  process.exit(0);
}

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => SETTINGS[key]);

if (missing.length === Object.keys(SETTINGS).length) {
  log('not configured, skipping. See README "Publishing from Google Docs".');
  process.exit(0);
}

if (missing.length > 0) {
  bail(`partially configured — missing ${missing.join(', ')}. Nothing synced.`);
}

let drive;
try {
  drive = await createDriveClient(config);
} catch (error) {
  bail(`could not authenticate with Google: ${error.message}`);
}

let docs;
try {
  docs = await drive.listDocs(config.folderId);
} catch (error) {
  bail(error.message);
}

if (docs.length === 0) {
  log('publishing folder is empty, nothing to sync.');
  process.exit(0);
}

let synced = 0;
const failures = [];

for (const doc of docs) {
  try {
    const result = await convertDocToPost({
      markdown: await drive.exportMarkdown(doc.id),
      docName: doc.name,
      modifiedTime: doc.modifiedTime,
      repoRoot,
      fetchImpl: drive.fetchAsset,
    });
    synced += 1;
    log(`${result.file}${result.imageCount > 0 ? ` (+${result.imageCount} images)` : ''}`);
  } catch (error) {
    failures.push(`"${doc.name}": ${error.message}`);
  }
}

log(`synced ${synced} of ${docs.length} document(s).`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`sync-gdocs: ${failure}`);
  if (strict) process.exit(1);
}
