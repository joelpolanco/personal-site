# Deploy hook cron worker

Pings the site's Cloudflare Pages deploy hook once an hour so posts written in
Google Docs go live without anyone touching git.

It is a separate worker from the site, with its own `wrangler.jsonc`, because
it has a completely different lifecycle: it is deployed once and then left
alone, while the site redeploys on every push.

## Deploying it

1. In the Cloudflare dashboard, open the Pages project for the site and go to
   **Settings → Builds & deployments → Deploy hooks**. Create a hook named
   `hourly-gdocs-sync` on the `main` branch and copy the URL it gives you.
2. From this directory, store that URL as a secret and deploy:

   ```bash
   cd workers/deploy-hook-cron
   npx wrangler secret put DEPLOY_HOOK_URL   # paste the URL when prompted
   npx wrangler deploy
   ```

3. Check it works without waiting for the hour:

   ```bash
   curl -X POST https://joelpolanco-deploy-hook-cron.<your-subdomain>.workers.dev
   ```

   A new build should appear in the Pages dashboard.

## Cost

24 invocations a day is inside the Workers free tier, and 24 builds a day is
well inside the 500 builds a month Pages allows on the free plan.

## Turning it off

`npx wrangler delete` from this directory, or remove the `crons` array and
redeploy to keep the manual trigger without the schedule.
