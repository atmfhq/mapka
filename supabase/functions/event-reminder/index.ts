// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit, timingSafeEqual } from "../_shared/rateLimit.ts";

type WebhookPayload = unknown;

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

function getPreferenceEventReminders(value: unknown): boolean {
  // Default = true (DB default). Treat missing/invalid as true.
  if (!value || typeof value !== "object") return true;
  const v = value as Record<string, unknown>;
  return typeof v.event_reminders === "boolean" ? v.event_reminders : true;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderReminderEmail(opts: {
  appBaseUrl: string;
  eventTitle: string;
  startTimeIso: string;
  eventUrl: string;
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
    <title>Starts in 1 hour</title>
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
                <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;">Starts in 1 hour</h1>
                <p style="margin:0;color:${muted};font-size:14px;line-height:1.6;">
                  <strong>${escapeHtml(opts.eventTitle)}</strong> starts at <strong>${escapeHtml(opts.startTimeIso)}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;">
                <a href="${escapeHtml(opts.eventUrl)}" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:20px;border:2px solid ${ctaShadow};box-shadow:0 4px 0 0 ${ctaShadow};">
                  Open event
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

/**
 * Scheduled Edge Function: event-reminder
 *
 * - Finds events starting ~1h from now (window: +55..+65 minutes)
 * - Recipients: joined participants
 * - Last-minute filter: skip participants who joined in the last 60 minutes
 * - Consent: skip if profiles.notification_preferences.event_reminders === false
 * - Idempotency: notification_logs with thread_type='event_reminder' and thread_id=<event_id>
 *
 * Security:
 * - Accepts either:
 *   - x-webhook-secret == WEBHOOK_SECRET
 *   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  (as requested for pg_cron)
 */
Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    console.log("[event-reminder] Start");

    if (req.method !== "POST") {
      console.log("[event-reminder] Skip: method_not_allowed");
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Rate limiting: 10 requests per minute per IP
    const rateLimitResponse = rateLimit(req, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "event-reminder",
    });
    if (rateLimitResponse) {
      console.log("[event-reminder] Rate limited");
      return rateLimitResponse;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

    if (!supabaseUrl || !serviceKey) {
      console.error("[event-reminder] Misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    if (!resendApiKey || !resendFrom) {
      console.error("[event-reminder] Misconfigured: missing RESEND_API_KEY or RESEND_FROM");
      return json({ error: "Missing RESEND_API_KEY or RESEND_FROM" }, { status: 500 });
    }

    // Auth check (either WEBHOOK_SECRET or Bearer SERVICE_ROLE_KEY)
    // Using timing-safe comparison to prevent timing attacks
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const expectedBearer = `Bearer ${serviceKey}`;
    const bearerOk = Boolean(authHeader && timingSafeEqual(authHeader, expectedBearer));
    const secretOk = Boolean(webhookSecret && providedSecret && timingSafeEqual(providedSecret, webhookSecret));
    if (!(bearerOk || secretOk)) {
      console.error("[event-reminder] Unauthorized");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Consume body ONCE (even if unused) to avoid surprises; tolerate empty body.
    try {
      await req.json().catch(() => ({} as WebhookPayload));
    } catch {
      // ignore
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000).toISOString();
    const lastMinuteCutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // 1) Find events starting in +55..+65 minutes window.
    const { data: events, error: eventsErr } = await supabase
      .from("megaphones")
      .select("id,title,start_time")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd);

    if (eventsErr) {
      console.error("[event-reminder] Failed to fetch events", eventsErr);
      return json({ error: "Failed to fetch events" }, { status: 500 });
    }

    const dueEvents = (events ?? []).filter((e: any) => typeof e.id === "string");
    console.log(`[event-reminder] Events in window: ${dueEvents.length} (${windowStart}..${windowEnd})`);
    if (dueEvents.length === 0) {
      return json({ ok: true, events: 0, sent: 0, skipped: "no_events" });
    }

    const cleanBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl.slice(0, -1) : appBaseUrl;

    let totalSent = 0;
    let totalEligible = 0;

    for (const event of dueEvents) {
      const eventId = event.id as string;
      const eventTitle = (typeof event.title === "string" && event.title.trim()) ? event.title : "Wydarzenie";
      const startTimeRaw = event.start_time;
      const startTimeIso = parseDate(startTimeRaw)?.toISOString() ?? (typeof startTimeRaw === "string" ? startTimeRaw : "");

      // 2) Fetch participants joined.
      const { data: participants, error: partErr } = await supabase
        .from("event_participants")
        .select("user_id, joined_at, status")
        .eq("event_id", eventId)
        .eq("status", "joined");

      if (partErr) {
        console.error("[event-reminder] Failed to fetch participants", { eventId, error: partErr });
        continue;
      }

      const rows = participants ?? [];
      if (rows.length === 0) continue;

      // 3) Last Minute filter (joined within last hour)
      const candidateIds = rows
        .filter((p: any) => typeof p.user_id === "string")
        .filter((p: any) => {
          const joinedAt = typeof p.joined_at === "string" ? p.joined_at : null;
          return !joinedAt || joinedAt <= lastMinuteCutoff; // keep if joined_at is older than cutoff
        })
        .map((p: any) => p.user_id as string);

      if (candidateIds.length === 0) continue;

      // 4) Consent filter (event_reminders)
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, notification_preferences")
        .in("id", candidateIds);

      if (profErr) {
        console.error("[event-reminder] Failed to fetch profiles", { eventId, error: profErr });
        continue;
      }

      const consentedIds = (profiles ?? [])
        .filter((p: any) => typeof p.id === "string")
        .filter((p: any) => getPreferenceEventReminders(p.notification_preferences))
        .map((p: any) => p.id as string);

      if (consentedIds.length === 0) continue;

      // 5) Idempotency (notification_logs)
      const { data: existingLogs, error: logsErr } = await supabase
        .from("notification_logs")
        .select("recipient_id")
        .eq("thread_type", "event_reminder")
        .eq("thread_id", eventId)
        .in("recipient_id", consentedIds);

      if (logsErr) {
        console.error("[event-reminder] Failed to check notification_logs", { eventId, error: logsErr });
        continue;
      }

      const alreadySent = new Set((existingLogs ?? []).map((r: any) => r.recipient_id as string));
      const finalIds = consentedIds.filter((id) => !alreadySent.has(id));

      if (finalIds.length === 0) continue;
      totalEligible += finalIds.length;

      const eventUrl = `${cleanBaseUrl}/?eventId=${encodeURIComponent(eventId)}`;

      for (const userId of finalIds) {
        // Email address (profiles table has no email)
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
        if (userErr) {
          console.error("[event-reminder] getUserById failed", { userId, error: userErr });
          continue;
        }

        const to = userData.user?.email ?? null;
        if (!to) continue;

        const html = renderReminderEmail({
          appBaseUrl: cleanBaseUrl,
          eventTitle,
          startTimeIso,
          eventUrl,
        });

        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFrom,
            to,
            subject: "Mapka • Starts in 1 hour",
            html,
          }),
        });

        if (!sendRes.ok) {
          const body = await sendRes.text();
          console.error("[event-reminder] Resend error", { eventId, status: sendRes.status, body });
          continue;
        }

        // 6) Write log (idempotency)
        const { error: insErr } = await supabase
          .from("notification_logs")
          .upsert(
            {
              recipient_id: userId,
              thread_type: "event_reminder",
              thread_id: eventId,
              last_sent_at: new Date().toISOString(),
            },
            { onConflict: "recipient_id,thread_type,thread_id" },
          );

        if (insErr) {
          console.error("[event-reminder] Failed to write notification_logs", { eventId, userId, error: insErr });
          // Email already sent; don't fail.
        }

        totalSent += 1;
      }
    }

    const ms = Date.now() - startedAt;
    console.log(`[event-reminder] Done sent=${totalSent} eligible=${totalEligible} durationMs=${ms}`);
    return json({ ok: true, sent: totalSent, eligible: totalEligible, durationMs: ms });
  } catch (err) {
    console.error("[event-reminder] FATAL", err);
    return json({ ok: false, error: "Unhandled exception", details: String(err) }, { status: 500 });
  }
});


