/**
 * Delivery for contact submissions: Resend when it is configured, a console
 * log when it is not.
 *
 * The log fallback exists so the endpoint is testable with no credentials at
 * all. It is deliberately restricted to `astro dev` (or an explicit
 * `CONTACT_LOG_ONLY=true`) — a production deploy that quietly logged real
 * enquiries into a worker tail instead of emailing them would lose Joel
 * business without ever looking broken.
 */
import { displayName, type ContactSubmission } from './validate';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type ContactEnv = {
  /** Resend API key. Secret — never commit it. */
  RESEND_API_KEY?: string;
  /** Where enquiries land. */
  CONTACT_TO_EMAIL?: string;
  /** Sender address on a domain verified in Resend. */
  CONTACT_FROM_EMAIL?: string;
  /** Optional subject prefix, defaults to "[joelpolanco.me]". */
  CONTACT_SUBJECT_PREFIX?: string;
  /** Set to "true" to force the log fallback outside dev. */
  CONTACT_LOG_ONLY?: string;
};

export type DeliveryResult =
  | { status: 'sent'; id: string | null }
  | { status: 'logged' }
  | { status: 'unconfigured'; reason: string }
  | { status: 'failed'; reason: string };

function isConfigured(env: ContactEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.CONTACT_TO_EMAIL && env.CONTACT_FROM_EMAIL);
}

function missingSettings(env: ContactEnv): string[] {
  return (['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL'] as const).filter(
    (name) => !env[name],
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

function buildEmail(data: ContactSubmission, env: ContactEnv) {
  const name = displayName(data);
  const prefix = env.CONTACT_SUBJECT_PREFIX ?? '[joelpolanco.me]';
  const lines = [
    name ? `Name: ${name}` : null,
    `Email: ${data.email}`,
    '',
    data.message,
  ].filter((line) => line !== null);

  return {
    from: env.CONTACT_FROM_EMAIL as string,
    to: [env.CONTACT_TO_EMAIL as string],
    // So hitting reply in the inbox answers the sender, not the form.
    reply_to: data.email,
    subject: `${prefix} ${name ?? data.email}`,
    text: lines.join('\n'),
    html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(
      lines.join('\n'),
    )}</pre>`,
  };
}

export async function deliverSubmission(
  data: ContactSubmission,
  env: ContactEnv,
  options: { allowLogFallback: boolean },
): Promise<DeliveryResult> {
  const logOnly = env.CONTACT_LOG_ONLY === 'true';

  if (logOnly || !isConfigured(env)) {
    if (!options.allowLogFallback && !logOnly) {
      return { status: 'unconfigured', reason: `missing ${missingSettings(env).join(', ')}` };
    }
    console.info(
      '[contact] not sending — logging instead.',
      JSON.stringify(
        { name: displayName(data), email: data.email, message: data.message },
        null,
        2,
      ),
    );
    return { status: 'logged' };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEmail(data, env)),
    });
  } catch (error) {
    return { status: 'failed', reason: `Resend unreachable: ${(error as Error).message}` };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { status: 'failed', reason: `Resend returned ${response.status} ${detail}`.trim() };
  }

  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return { status: 'sent', id: body?.id ?? null };
}
