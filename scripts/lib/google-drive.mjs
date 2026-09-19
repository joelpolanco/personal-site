/**
 * The smallest possible Google Drive client: a service-account JWT signed with
 * node:crypto, exchanged for an access token, then two REST calls. A full SDK
 * would be a large dependency for listing one folder and exporting its files.
 */
import { createSign } from 'node:crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DOC_MIME = 'application/vnd.google-apps.document';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Service account keys arrive from env vars with literal `\n` sequences where
 * the PEM needs real newlines, and sometimes base64-encoded whole.
 */
export function normalizePrivateKey(key) {
  const trimmed = key.trim();
  if (trimmed.includes('BEGIN PRIVATE KEY')) return trimmed.replace(/\\n/g, '\n');
  return Buffer.from(trimmed, 'base64').toString('utf8').replace(/\\n/g, '\n');
}

async function accessToken({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(normalizePrivateKey(privateKey), 'base64url');

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google rejected the service account credentials (${response.status}). ${detail}`);
  }
  return (await response.json()).access_token;
}

export async function createDriveClient({ clientEmail, privateKey }) {
  const token = await accessToken({ clientEmail, privateKey });
  const authorized = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  return {
    /** Google Docs directly inside `folderId`, newest edit first. */
    async listDocs(folderId) {
      const query = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType='${DOC_MIME}' and trashed=false`,
        fields: 'files(id,name,modifiedTime,createdTime)',
        orderBy: 'modifiedTime desc',
        pageSize: '100',
      });
      const response = await authorized(`${DRIVE_API}/files?${query}`);
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Could not list folder ${folderId} (HTTP ${response.status}). ` +
            'Check the folder ID, and that the folder is shared with the service account. ' +
            detail,
        );
      }
      return (await response.json()).files ?? [];
    },

    /** Google's own Docs-to-Markdown conversion, same as "Download as Markdown". */
    async exportMarkdown(fileId) {
      const response = await authorized(
        `${DRIVE_API}/files/${fileId}/export?mimeType=text%2Fmarkdown`,
      );
      if (!response.ok) {
        throw new Error(`Could not export document ${fileId} (HTTP ${response.status}).`);
      }
      return response.text();
    },

    /**
     * Image URLs in an exported doc are usually pre-signed and public, but
     * some come back needing the same token, so try both.
     */
    async fetchAsset(url) {
      const response = await fetch(url);
      if (response.status !== 401 && response.status !== 403) return response;
      return authorized(url);
    },
  };
}
