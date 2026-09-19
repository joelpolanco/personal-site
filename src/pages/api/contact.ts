/**
 * Contact form backend. Deployed by the Cloudflare adapter as part of the
 * site's worker, which is what serves Pages Functions for this project — there
 * is no separate `functions/` directory to keep in sync.
 *
 * Backend only: no markup and no styling live here. The contract for whoever
 * builds the form is:
 *
 *   POST /api/contact
 *   fields: first-name, last-name, email (required), message (required),
 *           website (honeypot — render it visually hidden and leave it empty)
 *   accepts application/x-www-form-urlencoded, multipart/form-data or JSON
 *
 * A request that asks for JSON gets JSON back. A plain form post with no
 * JavaScript gets a 303 to `/contact?status=…`, so the form works before any
 * client-side code is written.
 */
import type { APIRoute } from 'astro';
import { env as workerEnv } from 'cloudflare:workers';
import {
  parseSubmission,
  readSubmissionBody,
  type ContactSubmission,
} from '../../lib/contact/validate';
import { checkRateLimit, clientIdentifier, type RateLimitStore } from '../../lib/contact/rate-limit';
import { deliverSubmission, type ContactEnv } from '../../lib/contact/deliver';

export const prerender = false;

type ContactBindings = ContactEnv & {
  /** Optional KV namespace; rate limiting falls back to memory without it. */
  CONTACT_RATE_LIMIT?: RateLimitStore;
};

/**
 * Settings come from Cloudflare vars, secrets and bindings in production, and
 * from `.dev.vars` or `.env` locally. Worker values win where both are set;
 * keys present but undefined are skipped so they do not blank out a local one.
 */
function readEnv(): ContactBindings {
  const local = import.meta.env as unknown as ContactBindings;
  return {
    RESEND_API_KEY: workerEnv.RESEND_API_KEY ?? local.RESEND_API_KEY,
    CONTACT_TO_EMAIL: workerEnv.CONTACT_TO_EMAIL ?? local.CONTACT_TO_EMAIL,
    CONTACT_FROM_EMAIL: workerEnv.CONTACT_FROM_EMAIL ?? local.CONTACT_FROM_EMAIL,
    CONTACT_SUBJECT_PREFIX: workerEnv.CONTACT_SUBJECT_PREFIX ?? local.CONTACT_SUBJECT_PREFIX,
    CONTACT_LOG_ONLY: workerEnv.CONTACT_LOG_ONLY ?? local.CONTACT_LOG_ONLY,
    CONTACT_RATE_LIMIT: workerEnv.CONTACT_RATE_LIMIT,
  };
}

type Outcome = {
  status: number;
  /** Machine-readable, also used as `?status=` for the no-JavaScript path. */
  code: string;
  message: string;
  errors?: Record<string, string>;
  headers?: Record<string, string>;
};

function respond(request: Request, outcome: Outcome): Response {
  const wantsJson =
    request.headers.get('accept')?.includes('application/json') ||
    request.headers.get('content-type')?.includes('application/json');

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        ok: outcome.status < 400,
        code: outcome.code,
        message: outcome.message,
        ...(outcome.errors ? { errors: outcome.errors } : {}),
      }),
      {
        status: outcome.status,
        headers: { 'Content-Type': 'application/json', ...outcome.headers },
      },
    );
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/contact?status=${outcome.code}`, ...outcome.headers },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const env = readEnv();

  let body: Record<string, unknown>;
  try {
    body = await readSubmissionBody(request);
  } catch {
    return respond(request, {
      status: 400,
      code: 'malformed',
      message: 'That submission could not be read. Please try again.',
    });
  }

  const parsed = parseSubmission(body);

  // A filled honeypot is a bot. Answer exactly like a success so it learns
  // nothing, and send no email.
  if (!parsed.ok && parsed.honeypot) {
    return respond(request, { status: 200, code: 'ok', message: SUCCESS_MESSAGE });
  }

  if (!parsed.ok) {
    return respond(request, {
      status: 422,
      code: 'invalid',
      message: 'Please check the highlighted fields.',
      errors: parsed.errors,
    });
  }

  const limit = await checkRateLimit(clientIdentifier(request), env.CONTACT_RATE_LIMIT);
  if (!limit.allowed) {
    return respond(request, {
      status: 429,
      code: 'rate-limited',
      message: 'That is a few too many messages in a row. Please try again in an hour.',
      headers: { 'Retry-After': String(limit.retryAfter) },
    });
  }

  const result = await deliverSubmission(parsed.data as ContactSubmission, env, {
    allowLogFallback: import.meta.env.DEV,
  });

  if (result.status === 'unconfigured') {
    console.error(`[contact] delivery not configured: ${result.reason}`);
    return respond(request, {
      status: 503,
      code: 'unavailable',
      message: 'The contact form is temporarily unavailable. Please reach out on LinkedIn.',
    });
  }

  if (result.status === 'failed') {
    console.error(`[contact] delivery failed: ${result.reason}`);
    return respond(request, {
      status: 502,
      code: 'send-failed',
      message: 'That message could not be sent just now. Please try again in a moment.',
    });
  }

  return respond(request, { status: 200, code: 'ok', message: SUCCESS_MESSAGE });
};

/** Joel's wording from the Wix form, preserved. */
const SUCCESS_MESSAGE = 'Thanks for submitting! I will get back to you in 24-48 hours.';

/** A bare GET is someone poking the URL, not a browser looking for a page. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, code: 'method-not-allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
