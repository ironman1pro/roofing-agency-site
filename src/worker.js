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

// Own Your Website: download page for crypto buyers (NOWPayments has no file delivery).
// NOWPayments' success URL points to /own-your-website/access/<KIT_ACCESS_TOKEN>. The token
// and the kit's download link (KIT_DOWNLOAD_URL) are Cloudflare secrets, never in this repo:
//   npx wrangler secret put KIT_ACCESS_TOKEN
//   npx wrangler secret put KIT_DOWNLOAD_URL
// Anything else under /own-your-website/access/ gets the normal 404 page.
const ACCESS_PREFIX = '/own-your-website/access/';

function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function kitAccess(request, env, url) {
  const token = url.pathname.slice(ACCESS_PREFIX.length).replace(/\/$/, '');
  const ok = env.KIT_ACCESS_TOKEN && env.KIT_DOWNLOAD_URL && sameString(token, env.KIT_ACCESS_TOKEN);
  if (!ok) {
    const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', url.origin)));
    return new Response(notFound.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' } });
  }
  const link = escapeHtml(env.KIT_DOWNLOAD_URL);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your kit | Own Your Website</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>*{box-sizing:border-box;margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#09090B;color:#fff;line-height:1.6;min-height:100vh;display:grid;place-items:center;padding:24px}
.c{max-width:560px;width:100%;background:#fff;color:#0A0A0B;border-radius:28px;padding:40px 32px;box-shadow:0 60px 120px -40px rgba(255,107,44,.45)}
h1{font-size:2rem;letter-spacing:-.035em;line-height:1.1}p{color:#52525B;margin-top:12px}
a.b{display:block;text-align:center;margin-top:26px;background:#FF6B2C;color:#0A0A0B;font-weight:700;text-decoration:none;padding:16px;border-radius:999px}
ol{margin:22px 0 0 20px;color:#27272A}li{margin:6px 0}small{display:block;margin-top:22px;color:#71717A;font-size:.85rem}</style></head>
<body><main class="c"><h1>Thank you! Your kit is ready 🎉</h1>
<p>Your crypto payment went through. Download your kit below. Bookmark this page in case you need the files again.</p>
<a class="b" href="${link}" rel="noopener noreferrer">Download your kit →</a>
<ol><li>Open <b>1-Start-Here.pdf</b> first. It takes you from zero to live in 3 steps.</li>
<li><b>own-your-website.zip</b> is your Claude Skill. Upload it to Claude as-is; don't unzip it.</li>
<li>Stuck? Type <b>help</b> in Claude, or email <b>info@adaptify.tech</b> with your payment ID.</li></ol>
<small>Please don't share this page. It's for your purchase only.</small></main></body></html>`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api/lead') return handleLead(request, env);
    if (pathname.startsWith(ACCESS_PREFIX)) return kitAccess(request, env, url);
    const redirect = legacyRedirect(url);
    if (redirect) return redirect;
    return serveAsset(request, env);
  },
};
