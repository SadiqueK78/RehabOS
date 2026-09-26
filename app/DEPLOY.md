# Deploying RehabOS on Vercel

The React app and the API deploy together: the CRA build is served as static files, and
everything under `api/` becomes a serverless function. `server/` holds the logic; `api/` is a thin
layer over it, so `npm run dev` locally and Vercel in production behave the same.

| Path | Served by |
| --- | --- |
| `/`, `/dashboard`, … | the CRA build (`build/`) |
| `/api/health` | `api/health.js` |
| `/api/billing/checkout` | `api/billing/checkout.js` |
| `/api/billing/subscription` | `api/billing/subscription.js` |
| `/api/billing/portal` | `api/billing/portal.js` |
| `/api/billing/webhook` | `api/billing/webhook.mjs` |

## Project settings

Set the Vercel project's **Root Directory** to `app`. The rest comes from `vercel.json`
(build command, output directory, and the rewrite that lets React Router handle deep links
without swallowing `/api`).

## Environment variables

Add these in Vercel → Settings → Environment Variables, for Production and Preview.

| Variable | What it is |
| --- | --- |
| `STRIPE_SECRET_KEY` | `rk_test_…` (a restricted key) or `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the webhook endpoint you add in Stripe |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON, on one line |
| `PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` |
| `STRIPE_PRICE_RECOVER` etc. | optional; Price ids if you create Products in Stripe |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | only if you want the session emails to send |
| `OPENROUTER_API_KEY` | only if you want the in-app assistant to answer |

### Why the service account is not optional here

Entitlements — who paid for which plan — must survive between requests. A serverless function
gets a fresh, read-only filesystem, so the local JSON file the dev server uses cannot work in
production: a patient would pay and lose their plan on the next page load. With
`FIREBASE_SERVICE_ACCOUNT` set, the same records are written to Firestore under `billing/{email}`
instead. Get the JSON from Firebase Console → Project settings → Service accounts → Generate new
private key, and paste the whole file as the value.

Check which one is live at any time: `GET /api/health` reports
`"entitlementStore": "firestore"` or `"local file"`.

## The Stripe webhook

1. Deploy once, so the URL exists.
2. Stripe Dashboard → Developers → Webhooks → Add endpoint →
   `https://<your-project>.vercel.app/api/billing/webhook`
3. Send these events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

Without this endpoint, payments succeed and nobody is granted anything: the webhook is what
writes the entitlement, and it is also the only way a renewal, a failed payment or a cancellation
made on Stripe's side ever reaches the app.

## Local development

`npm run dev` runs the Express server on port 5000 and CRA on 3000, with the CRA proxy
forwarding `/api`. Forward webhooks to it with:

```
stripe listen --forward-to localhost:5000/api/billing/webhook
```

Without `FIREBASE_SERVICE_ACCOUNT`, entitlements go to `server/.billing-store.json`, which is
gitignored. Without `STRIPE_SECRET_KEY`, the billing endpoints answer 503 and the app falls back
to a clearly labelled test mode that grants plans without payment.

## Checks after deploying

```
curl https://<your-project>.vercel.app/api/health
# { "status": "ok", "stripe": "configured", "entitlementStore": "firestore" }
```

Then buy a plan in Stripe test mode and confirm it sticks:

```
curl "https://<your-project>.vercel.app/api/billing/subscription?email=you@example.com"
# { "planId": "recover", "status": "active", ... }
```
