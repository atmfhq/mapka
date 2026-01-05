// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WebhookPayload = {
  type?: string; // "INSERT" | "UPDATE" | "DELETE"
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  oldRecord?: Record<string, unknown> | null;
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

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNewCommentEmail(opts: {
  appBaseUrl: string;
  threadLabel: string;
  replyUrl: string;
  commentPreview: string;
}) {
  const safeBase = opts.appBaseUrl.replace(/\/$/, "");
  const settingsUrl = `${safeBase}/profile?tab=settings`;
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
    <title>New comment</title>
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
                <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;">New comment</h1>
                <p style="margin:0;color:${muted};font-size:14px;line-height:1.6;">
                  Someone commented on your ${escapeHtml(opts.threadLabel)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 0 24px;">
                <div style="background:#f9fafb;border:1px solid ${border};border-radius:12px;padding:12px;color:${text};font-size:13px;line-height:1.6;">
                  “${escapeHtml(opts.commentPreview)}”
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;">
                <a href="${escapeHtml(opts.replyUrl)}" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:20px;border:2px solid ${ctaShadow};box-shadow:0 4px 0 0 ${ctaShadow};">
                  Reply
                </a>
                <div style="margin-top:14px;color:${muted};font-size:12px;line-height:1.5;">
                  <a href="${escapeHtml(settingsUrl)}" style="color:${muted};text-decoration:underline;">Notification settings</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getPreferenceNewComments(value: unknown): boolean {
  // Default = true (DB default). Treat missing/invalid as true.
  if (!value || typeof value !== "object") return true;
  const v = value as Record<string, unknown>;
  return typeof v.new_comments === "boolean" ? v.new_comments : true;
}

function oneHourAgoIso(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (!provided || provided !== webhookSecret) return json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  if (!resendApiKey || !resendFrom) {
    return json({ error: "Missing RESEND_API_KEY or RESEND_FROM" }, { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // We trigger only on INSERT for the comment tables we use.
  if ((payload.type ?? "").toUpperCase() !== "INSERT") {
    return json({ ok: true, skipped: true, reason: "not_insert" });
  }

  const table = payload.table;
  const record = payload.record ?? null;
  if (!table || !record) return json({ ok: true, skipped: true, reason: "missing_table_or_record" });

  const commentAuthorId = typeof record.user_id === "string" ? (record.user_id as string) : null;
  const content = typeof record.content === "string" ? (record.content as string) : "";

  // Resolve thread type/id + thread author (recipient)
  let threadType: "shout" | "spot" | null = null;
  let threadId: string | null = null;

  if (table === "shout_comments") {
    threadType = "shout";
    threadId = typeof record.shout_id === "string" ? (record.shout_id as string) : null;
  } else if (table === "spot_comments") {
    threadType = "spot";
    threadId = typeof record.spot_id === "string" ? (record.spot_id as string) : null;
  } else {
    return json({ ok: true, skipped: true, reason: "unsupported_table", table });
  }

  if (!threadId) return json({ ok: true, skipped: true, reason: "missing_thread_id" });

  const supabase = createClient(supabaseUrl, serviceKey);

  let recipientId: string | null = null;
  if (threadType === "shout") {
    const { data, error } = await supabase.from("shouts").select("user_id").eq("id", threadId).maybeSingle();
    if (error || !data) return json({ ok: true, skipped: true, reason: "thread_not_found" });
    recipientId = data.user_id as string;
  } else {
    const { data, error } = await supabase.from("megaphones").select("host_id, title").eq("id", threadId).maybeSingle();
    if (error || !data) return json({ ok: true, skipped: true, reason: "thread_not_found" });
    recipientId = data.host_id as string;
  }

  if (!recipientId) return json({ ok: true, skipped: true, reason: "missing_recipient" });
  if (commentAuthorId && commentAuthorId === recipientId) {
    return json({ ok: true, skipped: true, reason: "self_comment" });
  }

  // Consent check: profiles.notification_preferences.new_comments
  const { data: profile, error: prefErr } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", recipientId)
    .maybeSingle();

  if (prefErr || !profile) {
    // If profile missing, skip (conservative).
    return json({ ok: true, skipped: true, reason: "profile_not_found" });
  }

  if (!getPreferenceNewComments(profile.notification_preferences)) {
    return json({ ok: true, skipped: true, reason: "preference_disabled" });
  }

  // Cooldown: max 1 mail / hour for (recipient, thread)
  const { data: logRow, error: logErr } = await supabase
    .from("notification_logs")
    .select("last_sent_at")
    .eq("recipient_id", recipientId)
    .eq("thread_type", threadType)
    .eq("thread_id", threadId)
    .maybeSingle();

  if (logErr) {
    console.error("[notify-new-comment] notification_logs read failed:", logErr);
    return json({ error: "Failed to check cooldown" }, { status: 500 });
  }

  if (logRow?.last_sent_at && new Date(logRow.last_sent_at as string).getTime() > Date.now() - 60 * 60 * 1000) {
    return json({ ok: true, skipped: true, reason: "cooldown" });
  }

  // Email recipient address
  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(recipientId);
  if (userErr) {
    console.error("[notify-new-comment] getUserById failed:", userErr);
    return json({ error: "Failed to lookup recipient email" }, { status: 500 });
  }
  const to = userData.user?.email ?? null;
  if (!to) return json({ ok: true, skipped: true, reason: "no_email" });

  // --- POPRAWKA: Bezpieczne usuwanie slashy i budowanie URL ---
  // Usuwamy '/' z końca, jeśli istnieje, żeby nie mieć podwójnego // przed znakiem zapytania
  const cleanBaseUrl = appBaseUrl.endsWith('/') 
    ? appBaseUrl.slice(0, -1) 
    : appBaseUrl;

  const replyUrl =
    threadType === "shout"
      ? `${cleanBaseUrl}/?shoutId=${encodeURIComponent(threadId)}`
      : `${cleanBaseUrl}/?eventId=${encodeURIComponent(threadId)}`;
  // ------------------------------------------------------------

  const threadLabel = threadType === "shout" ? "shout" : "event";
  const preview = content.trim().slice(0, 240) || "New comment";

  const html = renderNewCommentEmail({
    appBaseUrl,
    threadLabel,
    replyUrl,
    commentPreview: preview,
  });

  // Send email
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to,
      subject: "Mapka • New comment",
      html,
    }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text();
    console.error("[notify-new-comment] Resend error:", sendRes.status, body);
    return json({ error: "Resend request failed", status: sendRes.status }, { status: 502 });
  }

  // Update cooldown log after a successful send
  const { error: upsertErr } = await supabase
    .from("notification_logs")
    .upsert(
      {
        recipient_id: recipientId,
        thread_type: threadType,
        thread_id: threadId,
        last_sent_at: new Date().toISOString(),
      },
      { onConflict: "recipient_id,thread_type,thread_id" },
    );

  if (upsertErr) {
    console.error("[notify-new-comment] notification_logs upsert failed:", upsertErr);
    // Don't fail the webhook if the email already went out.
  }

  return json({ ok: true, sent: true, to, threadType, threadId });
});


