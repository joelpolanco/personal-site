/**
 * Parsing and validation for contact submissions, kept separate from the route
 * so the rules are readable on their own and the endpoint stays thin.
 *
 * The field names come straight from the archived Wix form
 * (`src/content/pages/contact.json`), so whoever writes the form markup can
 * copy them and nothing has to be renamed.
 */
import * as z from 'astro/zod';

/** Must stay empty. Bots fill every field they find; people never see it. */
export const HONEYPOT_FIELD = 'website';

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * Wix only required an email address, but a submission with no message is not
 * something Joel can act on, so the message is required here too.
 */
export const contactSchema = z.object({
  'first-name': trimmed(80).default(''),
  'last-name': trimmed(80).default(''),
  email: z.email({ error: 'Enter an email address so Joel can reply.' }).max(254),
  message: trimmed(5000).min(10, { error: 'Add a little more detail — at least 10 characters.' }),
});

export type ContactSubmission = z.infer<typeof contactSchema>;

export type ParseResult =
  | { ok: true; data: ContactSubmission }
  /** `honeypot` means a bot filled the trap: accept quietly, send nothing. */
  | { ok: false; honeypot: true }
  | { ok: false; honeypot?: false; errors: Record<string, string> };

/** Read a request body as a flat string map, whether form-encoded or JSON. */
export async function readSubmissionBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsed: unknown = await request.json();
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  }
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
}

export function parseSubmission(body: Record<string, unknown>): ParseResult {
  const honeypot = body[HONEYPOT_FIELD];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: false, honeypot: true };
  }

  const result = contactSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}

/** "Ada Lovelace" from the two name fields, or null if neither was filled. */
export function displayName(data: ContactSubmission): string | null {
  const name = `${data['first-name']} ${data['last-name']}`.trim();
  return name === '' ? null : name;
}
