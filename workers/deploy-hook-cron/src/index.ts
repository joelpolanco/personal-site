/**
 * Hourly rebuild trigger for joelpolanco.me.
 *
 * Publishing from Google Docs has no git step: Joel moves a doc into the
 * publishing folder and the next build picks it up. Something has to start
 * that build, so this worker pings the site's deploy hook once an hour.
 *
 * At 24 builds a day this stays well inside Cloudflare's free 500 builds a
 * month, with room for pushes on top.
 */
export interface Env {
  /** Deploy hook URL from the Pages project. Set as a secret — it is a
   *  capability: anyone holding it can trigger builds. */
  DEPLOY_HOOK_URL?: string;
}

async function triggerDeploy(env: Env): Promise<Response> {
  if (!env.DEPLOY_HOOK_URL) {
    const message = 'DEPLOY_HOOK_URL is not set; nothing to trigger.';
    console.warn(message);
    return new Response(message, { status: 503 });
  }

  const response = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Logged rather than thrown: a failed hourly ping is not worth retrying,
    // the next run is an hour away and a push triggers a build regardless.
    console.error(`Deploy hook returned ${response.status}. ${detail}`.trim());
    return new Response(`Deploy hook failed: ${response.status}`, { status: 502 });
  }

  console.log('Deploy hook triggered.');
  return new Response('Deploy hook triggered.', { status: 200 });
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(triggerDeploy(env));
  },

  /**
   * Hitting the worker URL runs the same thing, so the setup can be verified
   * without waiting for the top of the hour.
   */
  async fetch(request: Request, env: Env) {
    if (request.method !== 'POST') {
      return new Response('POST to this URL to trigger a deploy now.', {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }
    return triggerDeploy(env);
  },
};
