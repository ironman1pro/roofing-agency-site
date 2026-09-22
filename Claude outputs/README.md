# Adaptify CRM

Password-protected lead CRM + outreach manager on Cloudflare Workers + D1.

## Deploy (run in the adaptify-crm folder)

```
npm install -g wrangler        (or just use npx)
npx wrangler login
npx wrangler d1 create adaptify-crm
```
Copy the `database_id` it prints into `wrangler.toml`. Then:

```
npx wrangler d1 execute adaptify-crm --remote --file=schema.sql
npx wrangler secret put APP_PASSWORD      (your login password, make it long)
npx wrangler secret put SESSION_SECRET    (any long random string)
npx wrangler deploy
```
Open the URL it prints and log in.

## Edit in wrangler.toml before emailing
`BUSINESS_ADDRESS` must be a real mailing address (CAN-SPAM). Email won't send until it's set.

## Optional
- Email: verify adaptify.tech in Resend, then `npx wrangler secret put RESEND_API_KEY`.
- Google Places search: enable Places API (New) + billing, then `npx wrangler secret put GOOGLE_PLACES_KEY`.
- Extra lock: Cloudflare Zero Trust > Access, add an application for the CRM URL so only your email gets in.

Never paste keys or passwords into chat. Enter them only at the wrangler prompt.

## How messaging works
- WhatsApp / SMS: the Outreach tab opens a pre-filled message; you press send, then click "I sent it - log it".
- Email: sent through Resend with your address footer, an opt-out line and a List-Unsubscribe header. Leads marked Do Not Contact are blocked.
- Leads come from manual entry, CSV import, or the official Google Places API. "Check websites" reads each lead's public homepage and respects robots.txt.
