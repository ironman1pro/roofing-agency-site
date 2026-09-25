// Cloudflare Worker: handles POST /api/lead and forwards it to your automation webhook
// (n8n, Make, Zapier, GoHighLevel, a CRM webhook, etc.).
// All other requests are served from ./public by Workers static assets, but pass
// through this Worker first (see run_worker_first in wrangler.toml) so that every
// HTML page — including any added later — automatically gets the scripts listed in
// src/global-scripts.js injected into <head>. To add a new global script (Google
// Ads, GA4, a pixel, etc.), edit that file only; nothing here needs to change.
//
// Set the secret in Cloudflare: Workers & Pages > your project > Settings >
// Variables and Secrets > add a Secret named LEAD_WEBHOOK_URL.

import { GLOBAL_SCRIPTS } from './global-scripts.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function handleLead(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  // Same-origin only
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  let data;
  try {
    data = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // Honeypot: bots fill the hidden "website" field, humans never see it
  if (String(data.get('website') || '').trim()) return json({ ok: true });

  const clean = (key, max) => String(data.get(key) || '').trim().slice(0, max);
  const service = clean('service', 40) || 'websites';
  const lead = {
    name: clean('name', 100),
    company: clean('company', 120),
    email: clean('email', 160),
    site: clean('site', 200),
    message: clean('message', 2000),
    source: `agency-landing-page:${service}`,
    submitted_at: new Date().toISOString(),
  };

  if (!lead.company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
    return json({ ok: false, error: 'invalid' }, 422);
  }
  if (!env.LEAD_WEBHOOK_URL) {
    return json({ ok: false, error: 'not_configured' }, 500);
  }

  try {
    const res = await fetch(env.LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (!res.ok) return json({ ok: false, error: 'upstream' }, 502);
  } catch {
    return json({ ok: false, error: 'upstream' }, 502);
  }
  return json({ ok: true });
}

// The site's public/_headers file sets a strict CSP (script-src 'self'), which
// blocks inline <script> tags by default. Rather than weakening that with
// 'unsafe-inline', each request gets a random nonce; every injected script is
// tagged with it, and the same nonce is added to the CSP header below, so
// only OUR injected scripts are allowed to run inline — nothing else is.
function addNonce(scriptHtml, nonce) {
  return scriptHtml.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
}

function addNonceToCsp(cspValue, nonce) {
  if (!cspValue || !/script-src/i.test(cspValue)) return cspValue;
  return cspValue.replace(/script-src([^;]*)/i, (_, rest) => `script-src${rest} 'nonce-${nonce}'`);
}

// Appends every entry in GLOBAL_SCRIPTS just before </head> on any HTML response.
class HeadInjector {
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(head) {
    for (const script of GLOBAL_SCRIPTS) {
      head.append(addNonce(script, this.nonce), { html: true });
    }
  }
}

async function serveAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') || GLOBAL_SCRIPTS.length === 0) {
    return res;
  }

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const rewritten = new HTMLRewriter().on('head', new HeadInjector(nonce)).transform(res);

  const headers = new Headers(rewritten.headers);
  const csp = headers.get('content-security-policy');
  if (csp) headers.set('content-security-policy', addNonceToCsp(csp, nonce));

  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  });
}

// Old page URLs, permanently redirected (301) to their keyword-rich replacements so
// existing links and search rankings carry over. Keep these entries indefinitely.
const REDIRECTS = {
  '/automations': '/ai-receptionist/',
  '/crm': '/roofing-crm/',
  '/websites': '/roofing-websites/',
  '/storm-reactivation': '/storm-alerts/',
  '/job-updates-and-reviews': '/reviews-and-updates/',
};

function legacyRedirect(url) {
  const path = url.pathname.replace(/\/(index\.html)?$/, '');
  const target = REDIRECTS[path];
  if (!target) return null;
  return Response.redirect(new URL(target + url.search, url.origin).toString(), 301);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api/lead') return handleLead(request, env);
    const redirect = legacyRedirect(url);
    if (redirect) return redirect;
    return serveAsset(request, env);
  },
};
