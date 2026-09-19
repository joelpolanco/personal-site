/**
 * Bindings and variables this site adds on top of what `wrangler types`
 * generates into `worker-configuration.d.ts`. Declared here because they are
 * optional (secrets set in the Cloudflare dashboard, a KV namespace that may
 * not exist yet) and so would not appear in the generated config types.
 */
declare namespace Cloudflare {
  interface Env {
    /** Resend API key. Set as a secret, never committed. */
    RESEND_API_KEY?: string;
    /** Inbox that contact form submissions are delivered to. */
    CONTACT_TO_EMAIL?: string;
    /** Sender address, on a domain verified in Resend. */
    CONTACT_FROM_EMAIL?: string;
    /** Optional subject prefix for contact emails. */
    CONTACT_SUBJECT_PREFIX?: string;
    /** Set to "true" to log submissions instead of emailing them. */
    CONTACT_LOG_ONLY?: string;
    /** Optional KV namespace for contact form rate limiting. */
    CONTACT_RATE_LIMIT?: KVNamespace;
  }
}
