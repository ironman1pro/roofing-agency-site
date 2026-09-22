// Adaptify CRM: password-protected lead CRM + outreach manager on Cloudflare Workers + D1.
// Lead sources: manual entry, CSV import, and the official Google Places API.
// Website enrichment reads public pages only and respects robots.txt.
// Messaging: WhatsApp/SMS are opened as prefilled click-to-send links (you press send); email goes through Resend.

const SESSION_HOURS = 24 * 7;
const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

// ---------------------------------------------------------------- auth
function b64url(buf) {
  let s = ''; new Uint8Array(buf).forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
async function sha(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function safeEqual(a, b) {
  const x = await sha(a), y = await sha(b); let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function makeSession(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  return `${exp}.${await hmac(env.SESSION_SECRET, String(exp))}`;
}
async function validSession(request, env) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(request.headers.get('Cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, exp));
}
const cookie = (v, maxAge) => `sid=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

async function login(request, env) {
  if (!env.APP_PASSWORD || !env.SESSION_SECRET) return json({ error: 'Server not configured: set APP_PASSWORD and SESSION_SECRET.' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT n, ts FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (row && row.n >= 5 && now - row.ts < 900) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const { password } = await request.json().catch(() => ({}));
  if (typeof password === 'string' && (await safeEqual(password, env.APP_PASSWORD))) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(await makeSession(env), SESSION_HOURS * 3600) });
  }
  const n = row && now - row.ts < 900 ? row.n + 1 : 1;
  await env.DB.prepare('INSERT INTO login_attempts (ip, n, ts) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET n = ?, ts = ?').bind(ip, n, now, n, now).run();
  return json({ error: 'Wrong password' }, 401);
}

// ---------------------------------------------------------------- helpers
const digits = s => String(s || '').replace(/\D/g, '');
const dedupeKey = (name, phone) => `${String(name || '').trim().toLowerCase()}|${digits(phone).slice(-10)}`;
const FIELDS = ['name', 'phone', 'email', 'website', 'address', 'city', 'tier', 'status', 'notes', 'next_followup', 'dnc'];
const STATUSES = ['new', 'contacted', 'replied', 'preview_sent', 'closed', 'not_fit'];

async function addLeads(env, rows, source) {
  let added = 0;
  for (const r of rows) {
    const name = String(r.name || '').trim();
    if (!name) continue;
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO leads (dedupe_key, name, phone, email, website, address, city, source, tier, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(dedupeKey(name, r.phone), name, r.phone || '', r.email || '', r.website || '', r.address || '', r.city || '',
      r.source || source, r.tier || '', r.notes || '').run();
    added += res.meta.changes || 0;
  }
  return added;
}

async function logActivity(env, leadId, channel, body) {
  await env.DB.prepare('INSERT INTO activities (lead_id, channel, body) VALUES (?, ?, ?)').bind(leadId, channel, body || '').run();
}

// ---------------------------------------------------------------- lead finder (official Google Places API)
async function findPlaces(env, { city, state, term }) {
  if (!env.GOOGLE_PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY secret is not set. Add it with: npx wrangler secret put GOOGLE_PLACES_KEY');
  const fields = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,nextPageToken';
  const out = [], seen = new Set();
  for (const q of [`${term} in ${city}, ${state}`, `${term} contractor near ${city}, ${state}`, `best ${term} ${city} ${state}`]) {
    let token = null;
    for (let page = 0; page < 3; page++) {
      const body = { textQuery: q, pageSize: 20 };
      if (token) body.pageToken = token;
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': fields }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Google Places error: ' + (await r.text()).slice(0, 200));
      const d = await r.json();
      for (const p of d.places || []) {
        if (seen.has(p.id) || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) continue;
        seen.add(p.id);
        out.push({ name: p.displayName?.text || '', address: p.formattedAddress || '', phone: p.nationalPhoneNumber || '', website: p.websiteUri || '', city, source: 'google_places' });
      }
      token = d.nextPageToken;
      if (!token) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- website enrichment (public pages, robots.txt respected)
const UA = 'AdaptifyCRM/1.0 (+https://adaptify.tech)';
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JUNK = ['sentry', 'wixpress', 'example.', 'domain.com', 'email.com', 'yourname', '.png', '.jpg', '.webp', '.svg', 'godaddy'];

async function getPage(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) return { err: 'HTTP ' + r.status };
    if (!(r.headers.get('content-type') || '').includes('text/html')) return { err: 'not a web page' };
    return { html: (await r.text()).slice(0, 600000), url: r.url };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : 'unreachable' }; } finally { clearTimeout(t); }
}
async function robotsAllows(url) {
  try {
    const u = new URL(url); const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return true;
    let applies = false, blocked = false;
    for (const line of (await r.text()).split('\n')) {
      const [k, ...v] = line.split('#')[0].split(':'); const key = (k || '').trim().toLowerCase(); const val = v.join(':').trim();
      if (key === 'user-agent') applies = val === '*';
      else if (applies && key === 'disallow' && (val === '/' || (val && u.pathname.startsWith(val)))) blocked = true;
    }
    return !blocked;
  } catch { return true; }
}
const emailsIn = html => [...new Set((html.match(EMAIL_RE) || []).map(e => e.toLowerCase()))].filter(e => !JUNK.some(j => e.includes(j)));

async function enrichOne(lead) {
  let url = (lead.website || '').trim();
  if (!url) return { site_score: 10, site_notes: 'No website' };
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  if (/(^|\.)(g\.co|google\.[a-z.]+|facebook\.com|instagram\.com|yelp\.com)\//i.test(new URL(url).hostname + '/')) return { site_score: 10, site_notes: 'No real website (social or Google page only)' };
  if (!(await robotsAllows(url))) return { site_score: null, site_notes: 'CHECK MANUALLY: robots.txt asks bots not to visit' };
  const p = await getPage(url);
  if (p.err) return { site_score: null, site_notes: `CHECK MANUALLY: could not read site (${p.err})` };
  const h = p.html; let score = 0; const notes = [];
  if (!p.url.startsWith('https')) { score += 2; notes.push('No HTTPS'); }
  if (!/<meta[^>]+name=["']viewport["']/i.test(h)) { score += 3; notes.push('Not mobile-ready'); }
  if (!/href=["']tel:/i.test(h)) { score += 1; notes.push('No tap-to-call'); }
  if (!/estimate|quote/i.test(h)) { score += 1; notes.push('No estimate CTA'); }
  if (!/application\/ld\+json/i.test(h)) { score += 1; notes.push('No structured data'); }
  const yrs = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:20\d\d\s*[-–]\s*)?(20\d\d|19\d\d)/gi)].map(m => +m[1]);
  if (yrs.length && Math.max(...yrs) <= 2021) { score += 2; notes.push('Copyright ' + Math.max(...yrs)); }
  if (/wix\.com|godaddy|weebly|squarespace/i.test(h)) notes.push('Template builder');
  let mails = emailsIn(h);
  if (!mails.length) {
    const m = h.match(/href=["']([^"']*(?:contact|about)[^"']*)["']/i);
    if (m) { try { const c = await getPage(new URL(m[1], p.url).href); if (c.html) mails = emailsIn(c.html); } catch {} }
  }
  const out = { site_score: score, site_notes: notes.join('; ') };
  if (mails.length && !lead.email) out.email = mails[0];
  return out;
}

// ---------------------------------------------------------------- email (Resend)
function renderFooter(env) {
  return `\n\n--\nAdaptify LLC · ${env.BUSINESS_ADDRESS}\nNot interested? Just reply "stop" and I won't email you again.`;
}
async function sendEmail(env, lead, subject, body) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY secret is not set.');
  if (!lead.email) throw new Error('This lead has no email address.');
  if (lead.dnc) throw new Error('This lead is marked Do Not Contact.');
  if (/REPLACE/i.test(env.BUSINESS_ADDRESS || '')) throw new Error('Set BUSINESS_ADDRESS in wrangler.toml first (a real mailing address is required for cold email).');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [lead.email], reply_to: env.REPLY_TO, subject, text: body + renderFooter(env),
      headers: { 'List-Unsubscribe': `<mailto:${env.REPLY_TO}?subject=stop>` } }),
  });
  if (!r.ok) throw new Error('Email provider error: ' + (await r.text()).slice(0, 200));
}

// ---------------------------------------------------------------- API
async function api(request, env, url) {
  const p = url.pathname, m = request.method;

  if (p === '/api/login' && m === 'POST') return login(request, env);
  if (p === '/api/logout' && m === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  if (!(await validSession(request, env))) return json({ error: 'Not logged in' }, 401);
  if (m !== 'GET' && !(request.headers.get('Content-Type') || '').includes('application/json')) return json({ error: 'JSON only' }, 415);

  const body = m === 'GET' || m === 'DELETE' ? {} : await request.json().catch(() => ({}));
  const idm = /^\/api\/leads\/(\d+)(?:\/(log|email|enrich))?$/.exec(p);

  if (p === '/api/me') return json({ ok: true });

  if (p === '/api/leads' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM leads ORDER BY (site_score IS NULL), site_score DESC, id DESC').all();
    return json(results);
  }
  if (p === '/api/leads' && m === 'POST') return json({ added: await addLeads(env, [body], 'manual') });
  if (p === '/api/leads/import' && m === 'POST') return json({ added: await addLeads(env, (body.rows || []).slice(0, 2000), 'import') });
  if (p === '/api/leads/find' && m === 'POST') {
    try {
      const found = await findPlaces(env, { city: String(body.city || ''), state: String(body.state || 'TX'), term: String(body.term || 'roofing contractor') });
      return json({ found: found.length, added: await addLeads(env, found, 'google_places') });
    } catch (e) { return json({ error: e.message }, 400); }
  }
  if (p === '/api/leads/enrich' && m === 'POST') {
    // Frontend calls this repeatedly with small batches to stay within Worker limits.
    const ids = (body.ids || []).slice(0, 5).map(Number).filter(Boolean);
    for (const id of ids) {
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
      if (!lead) continue;
      const r = await enrichOne(lead);
      await env.DB.prepare('UPDATE leads SET site_score = ?, site_notes = ?, email = COALESCE(NULLIF(?, \'\'), email), updated_at = datetime(\'now\') WHERE id = ?')
        .bind(r.site_score ?? null, r.site_notes || '', r.email || '', id).run();
    }
    return json({ ok: true });
  }
  if (p === '/api/export.csv' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT name, phone, email, website, address, site_score, site_notes, status, tier, notes, next_followup, dnc FROM leads').all();
    const cols = ['name', 'phone', 'email', 'website', 'address', 'site_score', 'site_notes', 'status', 'tier', 'notes', 'next_followup', 'dnc'];
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...results.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=leads.csv' } });
  }

  if (idm) {
    const id = Number(idm[1]), sub = idm[2];
    if (!sub && m === 'PATCH') {
      const sets = [], vals = [];
      for (const f of FIELDS) if (f in body) {
        if (f === 'status' && !STATUSES.includes(body.status)) return json({ error: 'bad status' }, 400);
        sets.push(`${f} = ?`); vals.push(f === 'dnc' ? (body[f] ? 1 : 0) : String(body[f] ?? ''));
      }
      if (sets.length) await env.DB.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, id).run();
      if (body.status) await logActivity(env, id, 'status', `Status → ${body.status}`);
      return json({ ok: true });
    }
    if (!sub && m === 'DELETE') {
      await env.DB.prepare('DELETE FROM activities WHERE lead_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (!sub && m === 'GET') {
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
      const { results } = await env.DB.prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 100').bind(id).all();
      return json({ lead, activities: results });
    }
    if (sub === 'log' && m === 'POST') {
      await logActivity(env, id, String(body.channel || 'note'), String(body.body || ''));
      if (body.mark_contacted) await env.DB.prepare("UPDATE leads SET status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, next_followup = ?, updated_at = datetime('now') WHERE id = ?").bind(String(body.next_followup || ''), id).run();
      return json({ ok: true });
    }
    if (sub === 'email' && m === 'POST') {
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
      if (!lead) return json({ error: 'not found' }, 404);
      try { await sendEmail(env, lead, String(body.subject || ''), String(body.body || '')); }
      catch (e) { return json({ error: e.message }, 400); }
      await logActivity(env, id, 'email', `Sent: ${body.subject}\n\n${body.body}`);
      await env.DB.prepare("UPDATE leads SET status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, next_followup = ?, updated_at = datetime('now') WHERE id = ?").bind(String(body.next_followup || ''), id).run();
      return json({ ok: true });
    }
  }

  if (p === '/api/templates' && m === 'GET') return json((await env.DB.prepare('SELECT * FROM templates ORDER BY id').all()).results);
  if (p === '/api/templates' && m === 'POST') {
    await env.DB.prepare('INSERT INTO templates (name, channel, subject, body) VALUES (?, ?, ?, ?)').bind(String(body.name || 'Untitled'), String(body.channel || 'whatsapp'), String(body.subject || ''), String(body.body || '')).run();
    return json({ ok: true });
  }
  const tm = /^\/api\/templates\/(\d+)$/.exec(p);
  if (tm && m === 'PATCH') {
    await env.DB.prepare('UPDATE templates SET name = ?, channel = ?, subject = ?, body = ? WHERE id = ?').bind(String(body.name || ''), String(body.channel || 'whatsapp'), String(body.subject || ''), String(body.body || ''), Number(tm[1])).run();
    return json({ ok: true });
  }
  if (tm && m === 'DELETE') { await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(Number(tm[1])).run(); return json({ ok: true }); }

  if (p === '/api/config' && m === 'GET') return json({ places: !!env.GOOGLE_PLACES_KEY, email: !!env.RESEND_API_KEY, addressSet: !/REPLACE/i.test(env.BUSINESS_ADDRESS || '') });
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(request, env, url); } catch (e) { return json({ error: 'Server error: ' + e.message }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
