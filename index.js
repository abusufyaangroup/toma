const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-paystack-signature",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function makeId() {
  return crypto.randomUUID();
}

async function sha512Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return Boolean(env.ADMIN_API_TOKEN && token && token === env.ADMIN_API_TOKEN);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true, app: "TOMA", message: "API is running" });
      }

      if (path === "/api/titles" && request.method === "GET") {
        const type = url.searchParams.get("type");
        let query = "SELECT id,title,slug,synopsis,type,genre,release_year,maturity_rating,poster_url,backdrop_url,is_premium FROM titles WHERE is_published=1";
        const values = [];
        if (type === "movie" || type === "series") {
          query += " AND type=?";
          values.push(type);
        }
        query += " ORDER BY created_at DESC LIMIT 100";
        const result = await env.DB.prepare(query).bind(...values).all();
        return json({ titles: result.results || [] });
      }

      if (path === "/api/admin/titles" && request.method === "POST") {
        if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized" }, 401);
        const body = await request.json();
        const required = ["title", "slug", "type"];
        if (required.some(k => !body[k]) || !["movie", "series"].includes(body.type)) {
          return json({ error: "title, slug and valid type (movie or series) are required" }, 400);
        }
        const id = makeId();
        await env.DB.prepare(`
          INSERT INTO titles
          (id,title,slug,synopsis,type,genre,release_year,maturity_rating,poster_url,backdrop_url,stream_uid,is_premium,is_published)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          id, body.title, body.slug, body.synopsis || "", body.type,
          body.genre || "", Number(body.release_year) || null,
          body.maturity_rating || "NR", body.poster_url || "",
          body.backdrop_url || "", body.stream_uid || "",
          body.is_premium ? 1 : 0, body.is_published ? 1 : 0
        ).run();
        return json({ ok: true, id }, 201);
      }

      if (path === "/api/paystack/initialize" && request.method === "POST") {
        if (!env.PAYSTACK_SECRET_KEY || !env.PAYSTACK_PLAN_CODE) {
          return json({ error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY and PAYSTACK_PLAN_CODE." }, 503);
        }
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid email is required" }, 400);

        const response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            plan: env.PAYSTACK_PLAN_CODE,
            callback_url: body.callback_url || `${url.origin}/payment-return`,
            metadata: { product: "TOMA Premium", email },
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.status) return json({ error: data.message || "Paystack initialization failed" }, 502);
        return json({ authorization_url: data.data.authorization_url, reference: data.data.reference });
      }

      if (path === "/paystack/webhook" && request.method === "POST") {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");
        const valid = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
        if (!valid) return json({ error: "Invalid webhook signature" }, 401);

        const event = JSON.parse(rawBody);
        const data = event.data || {};
        const email = String(data.customer?.email || data.email || "").toLowerCase();
        const customerCode = data.customer?.customer_code || null;
        const subscriptionCode = data.subscription_code || data.subscription?.subscription_code || null;
        const status = event.event;

        if (email && ["subscription.create", "invoice.payment_success"].includes(status)) {
          await env.DB.prepare(`
            INSERT INTO subscriptions
            (id,email,paystack_customer_code,paystack_subscription_code,status,plan_code,updated_at)
            VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
          `).bind(makeId(), email, customerCode, subscriptionCode, "active", data.plan?.plan_code || env.PAYSTACK_PLAN_CODE).run();
        } else if (email && ["subscription.disable", "subscription.not_renew"].includes(status)) {
          await env.DB.prepare(`
            UPDATE subscriptions SET status='inactive', updated_at=CURRENT_TIMESTAMP
            WHERE email=? AND status='active'
          `).bind(email).run();
        }
        return json({ received: true });
      }

      if (path === "/api/admin/stream-upload" && request.method === "POST") {
        if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized" }, 401);
        return json({
          error: "Cloudflare Stream direct-upload is not enabled in this starter.",
          next_step: "Add STREAM_ACCOUNT_ID and STREAM_API_TOKEN secrets, then implement signed direct-upload URL creation and playback authorization.",
        }, 501);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Server error", detail: error?.message || "Unknown error" }, 500);
    }
  },
};
