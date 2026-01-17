// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit, timingSafeEqual } from "../_shared/rateLimit.ts";

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

function getPreferenceEventUpdates(value: unknown): boolean {
  // Default = true (DB default). Treat missing/invalid as true.
  if (!value || typeof value !== "object") return true;
  const v = value as Record<string, unknown>;
  return typeof v.event_updates === "boolean" ? v.event_updates : true;
}

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderEventUpdateEmail(opts: {
  appBaseUrl: string;
  eventTitle?: string | null;
  oldStart?: string | null;
  newStart?: string | null;
  oldEnd?: string | null;
  newEnd?: string | null;
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

  const titleLine = opts.eventTitle ? ` (${opts.eventTitle})` : "";
  const oldStart = opts.oldStart ? escapeHtml(opts.oldStart) : null;
  const newStart = opts.newStart ? escapeHtml(opts.newStart) : null;
  const oldEnd = opts.oldEnd ? escapeHtml(opts.oldEnd) : null;
  const newEnd = opts.newEnd ? escapeHtml(opts.newEnd) : null;

  const timeBlock =
    oldStart && newStart
      ? `<div style="margin-top:12px;color:rgba(255,255,255,0.80);font-size:13px;line-height:1.6;">
           <div><strong>Start:</strong> ${oldStart} → ${newStart}</div>
           ${
             oldEnd && newEnd
               ? `<div style="margin-top:4px;"><strong>End:</strong> ${oldEnd} → ${newEnd}</div>`
               : ""
           }
         </div>`
      : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Event time updated</title>
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
                <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;">Event time updated${escapeHtml(titleLine)}</h1>
                ${timeBlock}
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

Deno.serve(async (req) => {
  try {
    console.log("[notify-event-update] Start");
    if (req.method !== "POST") {
      console.log("[notify-event-update] Skip: method_not_allowed");
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Rate limiting: 20 requests per minute per IP
    const rateLimitResponse = rateLimit(req, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix: "notify-event-update",
    });
    if (rateLimitResponse) {
      console.log("[notify-event-update] Rate limited");
      return rateLimitResponse;
    }

    // --- Security header check with timing-safe comparison
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret) {
      const ok = Boolean(providedSecret && timingSafeEqual(providedSecret, webhookSecret));
      if (!ok) {
        console.error("[notify-event-update] Unauthorized: invalid WEBHOOK_SECRET header");
        return json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // --- Env sanity (do NOT log secret values)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

    if (!supabaseUrl || !serviceKey) {
      console.error("[notify-event-update] Misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    if (!resendApiKey || !resendFrom) {
      console.error("[notify-event-update] Misconfigured: missing RESEND_API_KEY or RESEND_FROM");
      return json({ error: "Missing RESEND_API_KEY or RESEND_FROM" }, { status: 500 });
    }

    // --- IMPORTANT: read JSON body ONCE (Body already consumed safety)
    let payload: WebhookPayload;
    try {
      payload = (await req.json()) as WebhookPayload;
    } catch (e) {
      console.error("[notify-event-update] Invalid JSON", e);
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Trigger only on UPDATE (time changes)
    const eventType = (payload.type ?? "").toUpperCase();
    if (eventType !== "UPDATE") {
      console.log(`[notify-event-update] Skip: not_update type=${eventType || "undefined"}`);
      return json({ ok: true, skipped: true, reason: "not_update" });
    }

    const record = payload.record ?? null;
    const oldRecord = payload.old_record ?? payload.oldRecord ?? null;

    if (!record || !oldRecord) {
      console.log("[notify-event-update] Skip: missing_record_or_old_record");
      return json({ ok: true, skipped: true, reason: "missing_record_or_old_record" });
    }

    // In this codebase "events" are stored in public.megaphones (Quest/Event).
    const eventId = typeof record.id === "string" ? (record.id as string) : null;
    if (!eventId) {
      console.log("[notify-event-update] Skip: missing_event_id");
      return json({ ok: true, skipped: true, reason: "missing_event_id" });
    }

    const newStartRaw = record.start_time;
    const oldStartRaw = oldRecord.start_time;
    const newEndRaw = (record as any).end_time;
    const oldEndRaw = (oldRecord as any).end_time;
    const newDurationRaw = record.duration_minutes;
    const oldDurationRaw = oldRecord.duration_minutes;

    const startChanged = newStartRaw !== oldStartRaw;
    const endChanged = newEndRaw !== oldEndRaw;
    const durationChanged = newDurationRaw !== oldDurationRaw;

    // Treat duration change as "end_time change" for tables without end_time.
    if (!startChanged && !endChanged && !durationChanged) {
      console.log(`[notify-event-update] Skip: no_time_change eventId=${eventId}`);
      return json({ ok: true, skipped: true, reason: "no_time_change" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Participants of the event
    const { data: participants, error: partErr } = await supabase
      .from("event_participants")
      .select("user_id, status")
      .eq("event_id", eventId)
      .eq("status", "joined");

    if (partErr) {
      console.error("[notify-event-update] Failed to fetch participants", { eventId, error: partErr });
      return json({ error: "Failed to fetch participants" }, { status: 500 });
    }

    const participantIds = (participants ?? [])
      .map((p: any) => p.user_id as string)
      .filter((id: unknown): id is string => typeof id === "string");

    if (participantIds.length === 0) {
      console.log(`[notify-event-update] Skip: no_participants eventId=${eventId}`);
      return json({ ok: true, skipped: true, reason: "no_participants" });
    }

    // Consent filtering (event_updates)
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, notification_preferences")
      .in("id", participantIds);

    if (profErr) {
      console.error("[notify-event-update] Failed to fetch profiles", { eventId, error: profErr });
      return json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    const allowedIds = (profiles ?? [])
      .filter((p: any) => getPreferenceEventUpdates(p.notification_preferences))
      .map((p: any) => p.id as string);

    if (allowedIds.length === 0) {
      console.log(`[notify-event-update] Skip: no_consented_recipients eventId=${eventId} participants=${participantIds.length}`);
      return json({ ok: true, skipped: true, reason: "no_consented_recipients" });
    }

    const cleanBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl.slice(0, -1) : appBaseUrl;
    const eventUrl = `${cleanBaseUrl}/?eventId=${encodeURIComponent(eventId)}`;

    // Compute old/new time strings for email
    const oldStart = parseIsoDate(oldStartRaw)?.toISOString() ??
      (typeof oldStartRaw === "string" ? oldStartRaw : null);
    const newStart = parseIsoDate(newStartRaw)?.toISOString() ??
      (typeof newStartRaw === "string" ? newStartRaw : null);

    // If end_time exists in payload, show it; otherwise derive from start_time + duration_minutes if possible.
    const deriveEnd = (startRaw: unknown, durationRaw: unknown): string | null => {
      const start = parseIsoDate(startRaw);
      const duration = typeof durationRaw === "number" ? durationRaw : null;
      if (!start || duration === null) return null;
      return new Date(start.getTime() + duration * 60 * 1000).toISOString();
    };

    const oldEnd =
      typeof oldEndRaw === "string"
        ? oldEndRaw
        : deriveEnd(oldStartRaw, oldDurationRaw);
    const newEnd =
      typeof newEndRaw === "string"
        ? newEndRaw
        : deriveEnd(newStartRaw, newDurationRaw);

    const eventTitle = typeof record.title === "string" ? (record.title as string) : null;

    let sentCount = 0;
    for (const userId of allowedIds) {
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
      if (userErr) {
        console.error("[notify-event-update] getUserById failed", { userId, error: userErr });
        continue;
      }

      const to = userData.user?.email ?? null;
      if (!to) continue;

      const html = renderEventUpdateEmail({
        appBaseUrl: cleanBaseUrl,
        eventTitle,
        oldStart,
        newStart,
        oldEnd: durationChanged || endChanged ? oldEnd : null,
        newEnd: durationChanged || endChanged ? newEnd : null,
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
        subject: "Mapka • Event time updated",
          html,
        }),
      });

      if (!sendRes.ok) {
        const body = await sendRes.text();
        console.error("[notify-event-update] Resend error", {
          eventId,
          status: sendRes.status,
          body,
        });
        continue;
      }

      sentCount += 1;
    }

    console.log(`[notify-event-update] Done eventId=${eventId} sent=${sentCount}/${allowedIds.length}`);
    return json({ ok: true, sentCount, eventId, recipients: allowedIds.length });
  } catch (err) {
    console.error("[notify-event-update] FATAL Uncaught error", err);
    return json({ ok: false, error: "Unhandled exception", details: String(err) }, { status: 500 });
  }
});


