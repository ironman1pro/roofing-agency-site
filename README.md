# Adaptify — agency site

Static site (no build step) hosted on **Cloudflare Workers (static assets)**, source on **GitHub**.
The lead form runs on a small **Cloudflare Worker** that forwards to your automation webhook.

```
public/                     ← everything published (Cloudflare "build output directory")
  index.html                ← agency landing page
  ai-receptionist/ estimate-follow-up/ storm-alerts/ reviews-and-updates/ invoice-follow-up/ roofing-crm/ roofing-websites/   ← service pages
  assets/agents.css + agents.js   ← shared styles/script for the AI agent pages
  assets/main.js            ← landing form logic (external so the CSP can block inline scripts)
  portfolio/
    summitridge/ redwood/ northline/ brightpeak/ heritage/ fairwind/   ← 6 concept sites, 4 pages each (home, services/, estimate/, contact/)
    img/                    ← photos used by the photo-led concept sites (Summit Ridge, Redwood)
    thumbs/                 ← portfolio screenshots
    assets/demo.js          ← demo-form behaviour
    assets/estimate.js      ← estimate-calculator logic (shared by all 6 sites)
  _headers                  ← security headers + caching (Cloudflare reads this file)
  404.html  robots.txt  sitemap.xml  llms.txt  favicon.svg
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
git remote add origin git@github.com:YOUR-USER/roofing-agency-site.git
git push -u origin main
```

## 3. Deploy on Cloudflare (Workers + static assets)

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Import a repository** → pick the repo.
2. Leave **Build command empty** and **Deploy command** as `npx wrangler deploy`. Deploy.
3. Open the new Worker → **Settings → Variables and Secrets** → add a **secret** named `LEAD_WEBHOOK_URL` (your Formspree form endpoint, e.g. `https://formspree.io/f/xxxxxxxx`; any n8n / Make / Zapier webhook works the same way).
4. **Settings → Domains & Routes** → add your custom domain. If the domain's DNS is on Cloudflare this is one click.

Every push to `main` redeploys automatically, and other branches get preview URLs.

The form posts JSON like this to your webhook:

```json
{ "name": "...", "company": "...", "email": "...", "site": "...", "source": "agency-landing-page", "submitted_at": "2026-..." }
```

## 4. Go-live checklist

- [x] Domain, canonical, Open Graph, sitemap, robots and structured data (Organization, WebSite, ProfessionalService, FAQPage) point to `adaptify.tech`. If you use a different domain, run `./scripts/set-domain.sh yourdomain.com` after replacing `adaptify.tech` with `example.com` in those files.
- [ ] Connect `adaptify.tech` in Cloudflare (Worker > Settings > Domains & Routes) so the canonical URL resolves.
- [ ] Create a form at formspree.io, copy its endpoint URL, add it as the `LEAD_WEBHOOK_URL` secret (Worker > Settings > Variables and Secrets), then submit a test lead. Formspree emails each submission to you; confirm the form's email address in their dashboard.
- [ ] Run PageSpeed Insights on the live URL, and only keep the "under 1 second" / "90+ Lighthouse" wording if it holds.
- [ ] Add the domain to Google Search Console and Bing Webmaster Tools, and submit `sitemap.xml`.
- [ ] Optional: Cloudflare **Turnstile** on the form (the Worker already has a honeypot and same-origin check).
- [ ] Add Playground Medic and Altrady testimonials once you have exact quotes and permission.

## Notes

- **Concept sites** in `public/portfolio/` use fictional company names, sample reviews (labelled as samples) and carry `noindex` so they don't compete with your real site in search. Swap in real client sites as you win them.
- **Caching**: `/assets/*` and `/portfolio/thumbs/*` are cached for a year (see `public/_headers`). Pages link them with a `?v=` number, so **whenever you edit a CSS/JS/image file there, bump its `?v=` in every page that links it** (e.g. `site.css?v=9` → `?v=10`), or visitors keep the old copy. All global styles live in one file, `public/assets/site.css`.
- **SEO**: every page has a unique title/description, canonical, Open Graph tags and JSON-LD (Organization, BreadcrumbList, Service, FAQPage). When you add a page, copy an existing page's `<head>` and header, then add the URL to `sitemap.xml` and `llms.txt`.
- **Security headers** are in `public/_headers`. The CSP allows only your own scripts (no inline JS). If you add analytics or a chat widget later, add its domain to `script-src` / `connect-src`.
- **Costs**: Workers static-asset hosting (static files are free and unlimited) and Worker requests on the free plan are enough to start; check Cloudflare's current limits before scaling.

## Own Your Website: crypto delivery

Crypto buyers pay through a NOWPayments invoice, whose success URL is a private download page served by the Worker at `/own-your-website/access/<token>`. The token and the kit's download link are Cloudflare secrets, never committed (this repo is public):

```
npx wrangler secret put KIT_ACCESS_TOKEN
npx wrangler secret put KIT_DOWNLOAD_URL
```

Without both secrets, or with a wrong token, the path returns the normal 404 page. To revoke a leaked link, set a new `KIT_ACCESS_TOKEN` and update the success URL in NOWPayments.
