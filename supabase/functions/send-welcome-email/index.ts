// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit, timingSafeEqual } from "../_shared/rateLimit.ts";

type WebhookPayload = {
  type?: string; // "INSERT" | "UPDATE" | "DELETE"
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  oldRecord?: Record<string, unknown> | null; // tolerate camelCase
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function getBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function renderWelcomeHtml(appBaseUrl: string) {
  const safeBase = appBaseUrl.replace(/\/$/, "");
  const logoUrl = `${safeBase}/favicon.ico`;
  const ctaBg = "#22c35d"; // matches UI success/primary action
  const ctaShadow = "#267342"; // matches UI button shadow
  const text = "#111827";
  const muted = "#6b7280";
  const border = "#e5e7eb";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Welcome to Mapka</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:${text};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${border};">
            <tr>
              <td style="padding:24px 24px 0 24px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <img src="${logoUrl}" width="32" height="32" alt="Mapka" style="display:block;border-radius:8px;" />
                  <div style="color:${text};font-weight:800;font-size:16px;line-height:1.2;">Mapka</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px 24px;color:${text};">
                <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;">Welcome to Mapka!</h1>
                <p style="margin:0;color:${muted};font-size:14px;line-height:1.6;">
                  Open the map and see what’s happening nearby.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;">
                <a href="${safeBase}/" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:20px;border:2px solid ${ctaShadow};box-shadow:0 4px 0 0 ${ctaShadow};">
                  Open Map
                </a>
                <div style="margin-top:14px;color:${muted};font-size:12px;line-height:1.5;">
                  This is a one-time transactional email sent after you complete onboarding.
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:560px;margin:14px auto 0 auto;color:${muted};font-size:11px;line-height:1.6;text-align:center;">
            If this wasn’t you, you can safely ignore this email.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate limiting: 20 requests per minute per IP
  const rateLimitResponse = rateLimit(req, {
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyPrefix: "send-welcome-email",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Auth check with timing-safe comparison
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (!provided || !timingSafeEqual(provided, webhookSecret)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

  if (!resendApiKey || !resendFrom) {
    return json(
      { error: "Missing RESEND_API_KEY or RESEND_FROM in function secrets" },
      { status: 500 },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = payload.record ?? null;
  const oldRecord = payload.old_record ?? payload.oldRecord ?? null;

  const newOnboarded = getBool(record?.["is_onboarded"]);
  const oldOnboarded = getBool(oldRecord?.["is_onboarded"]);

  // Fire only when onboarding flips to true.
  if (newOnboarded !== true || oldOnboarded === true) {
    return json({ ok: true, skipped: true });
  }

  const userId = typeof record?.["id"] === "string" ? (record["id"] as string) : null;
  if (!userId) {
    return json({ ok: false, error: "Missing user id in record" }, { status: 400 });
  }

  // Lookup user email (profiles table intentionally doesn't store email).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function secrets" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error("[send-welcome-email] auth.admin.getUserById failed:", error);
    return json({ error: "Failed to lookup user email" }, { status: 500 });
  }

  const to = data.user?.email ?? null;
  if (!to) {
    return json({ ok: true, skipped: true, reason: "User has no email" });
  }

  const html = renderWelcomeHtml(appBaseUrl);

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to,
      subject: "Mapka • Welcome",
      html,
    }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text();
    console.error("[send-welcome-email] Resend error:", sendRes.status, body);
    return json({ error: "Resend request failed", status: sendRes.status }, { status: 502 });
  }

  const result = await sendRes.json().catch(() => ({}));
  return json({ ok: true, sent: true, to, resend: result });
});


