/**
 * POST /api/billing/webhook — what Stripe tells us happened.
 *
 * This one endpoint is written against the Web Request API rather than the Node request object,
 * because Stripe signs the exact bytes it sent and `request.text()` is the way to read them
 * unmodified on Vercel. Anything that parses the body first breaks signature verification.
 *
 * Add the endpoint in the Stripe Dashboard as https://<your-site>/api/billing/webhook and put
 * its signing secret in the STRIPE_WEBHOOK_SECRET environment variable.
 */
import core from "../../server/billing-core.js";

export async function POST(request) {
  if (!core.isConfigured()) {
    return new Response(JSON.stringify({ error: "Stripe is not configured" }), { status: 503 });
  }

  const raw = await request.text();
  let event;
  try {
    event = await core.constructEvent(raw, request.headers.get("stripe-signature"));
  } catch (err) {
    console.error("Stripe webhook rejected:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    await core.handleEvent(event);
  } catch (err) {
    // Answer with an error so Stripe retries. Saying 200 when the entitlement was not stored
    // loses the payment silently, which is exactly what went wrong the first time this shipped.
    console.error("Stripe webhook handling failed:", event.type, err.message);
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }
  return Response.json({ received: true });
}
