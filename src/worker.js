// Cloudflare Worker: handles POST /api/lead and forwards it to your automation webhook
// (n8n, Make, Zapier, GoHighLevel, a CRM webhook, etc.).
// All other requests are served from ./public by Workers static assets.
//
// Set the secret in Cloudflare: Workers & Pages > your project > Settings >
// Variables and Secrets > add a Secret named LEAD_WEBHOOK_URL.

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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead') return handleLead(request, env);
    return env.ASSETS.fetch(request);
  },
};
