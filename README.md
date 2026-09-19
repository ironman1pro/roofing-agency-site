# Adaptify — agency site

Static site (no build step) hosted on **Cloudflare Workers (static assets)**, source on **GitHub**.
The lead form runs on a small **Cloudflare Worker** that forwards to your automation webhook.

```
public/                     ← everything published (Cloudflare "build output directory")
  index.html                ← agency landing page
  assets/main.js            ← landing form logic (external so the CSP can block inline scripts)
  portfolio/
    summitridge/ redwood/ northline/ brightpeak/ heritage/ fairwind/   ← 6 concept sites, 4 pages each (home, services/, estimate/, contact/)
    img/                    ← photos used by the photo-led concept sites (Summit Ridge, Redwood)
    thumbs/                 ← portfolio screenshots
    assets/demo.js          ← demo-form behaviour
    assets/estimate.js      ← estimate-calculator logic (shared by all 6 sites)
  _headers                  ← security headers + caching (Cloudflare reads this file)
  404.html  robots.txt  sitemap.xml  favicon.svg
src/worker.js               ← POST /api/lead → forwards to LEAD_WEBHOOK_URL
scripts/set-domain.sh       ← swaps example.com for your real domain
brand/                      ← Adaptify logo files (SVG + PNG); not published
wrangler.toml               ← Worker + static-assets config (used by `npx wrangler deploy`)
```

## 1. Preview locally

```bash
cd public && python3 -m http.server 8080
# open http://localhost:8080
```

To also test the form Worker locally: `npx wrangler dev` (put `LEAD_WEBHOOK_URL=...` in a `.dev.vars` file, which is git-ignored).

## 2. Put it on GitHub

```bash
cd roofing-agency-site
git init -b main
git add .
git commit -m "Initial site"
# create an empty PRIVATE repo on github.com first, then:
git remote add origin git@github.com:YOUR-USER/ridgeline-web.git
git push -u origin main
```

## 3. Deploy on Cloudflare (Workers + static assets)

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Import a repository** → pick the repo.
2. Leave **Build command empty** and **Deploy command** as `npx wrangler deploy`. Deploy.
3. Open the new Worker → **Settings → Variables and Secrets** → add a **secret** named `LEAD_WEBHOOK_URL` (your n8n / Make / Zapier / CRM webhook URL).
4. **Settings → Domains & Routes** → add your custom domain. If the domain's DNS is on Cloudflare this is one click.

Every push to `main` redeploys automatically, and other branches get preview URLs.

The form posts JSON like this to your webhook:

```json
{ "name": "...", "company": "...", "email": "...", "site": "...", "source": "agency-landing-page", "submitted_at": "2026-..." }
```

## 4. Before you go live

- [ ] Run `./scripts/set-domain.sh yourdomain.com` (updates canonical tag, robots.txt, sitemap) and change nothing else (email is already support@adaptify.com; in `public/index.html` (the form error message and footer).
- [ ] Replace the 3 placeholder testimonials in `public/index.html` (search `TODO: swap`) with real ones, then add `class="hide-placeholder-flags"` to the `<body>` tag.
- [ ] Confirm the agency name (`Adaptify` is a placeholder) and the pricing/founding-client offer.
- [ ] Submit a test lead and confirm it reaches your webhook.
- [ ] Run PageSpeed Insights on the live URL, and only then keep the "under 1 second" / "90+ Lighthouse" wording.
- [ ] Add the domain to Google Search Console and submit `sitemap.xml`.
- [ ] Optional: enable Cloudflare **Turnstile** on the form for stronger spam protection (the function already has a honeypot and same-origin check).

## Notes

- **Concept sites** in `public/portfolio/` use fictional company names, sample reviews (labelled as samples) and carry `noindex` so they don't compete with your real site in search. Swap in real client sites as you win them.
- **Security headers** are in `public/_headers`. The CSP allows only your own scripts (no inline JS). If you add analytics or a chat widget later, add its domain to `script-src` / `connect-src`.
- **Costs**: Workers static-asset hosting (static files are free and unlimited) and Worker requests on the free plan are enough to start; check Cloudflare's current limits before scaling.
