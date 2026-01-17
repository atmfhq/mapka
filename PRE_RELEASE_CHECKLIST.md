# SquadMap Pre-Release Checklist

Use this checklist before deploying to production.

---

## 1. Security ✅

### Code Security
- [x] Rate limiting added to all Edge Functions
- [x] Timing-safe string comparison for auth tokens
- [x] RLS enabled on all tables (verified 23+ tables)
- [x] Input sanitization via `sanitize_text_input()` in database
- [x] HTML escaping in email templates
- [x] `.env` file in `.gitignore`

### Manual Security Tests
- [ ] **Auth bypass test**: Try accessing protected routes without login
- [ ] **RLS bypass test**: Try accessing other users' data via SQL Editor
- [ ] **XSS test**: Try posting `<script>alert('xss')</script>` in shouts/comments
- [ ] **CSRF test**: Verify forms have proper protection

### Recommended: Security Scan
```bash
# Run OWASP ZAP scan against staging environment
# Download: https://www.zaproxy.org/download/
```

---

## 2. Database ✅

### Migrations
- [x] Performance indexes migration created (`20260117100000_add_performance_indexes.sql`)

### Deploy Migration
```bash
# Apply migration to production
supabase db push
# Or via Supabase Dashboard > Database > Migrations
```

### Verify Indexes
```sql
-- Run in SQL Editor to verify indexes exist
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 3. Edge Functions ✅

### Deploy Functions
```bash
# Deploy all edge functions
supabase functions deploy send-welcome-email
supabase functions deploy notify-new-comment
supabase functions deploy notify-event-update
supabase functions deploy event-reminder
```

### Verify Environment Variables
Ensure these are set in Supabase Dashboard > Edge Functions > Secrets:
- [ ] `WEBHOOK_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM`
- [ ] `APP_BASE_URL`

---

## 4. Performance ✅

### Build Optimization
- [x] Lazy loading for modals
- [x] Manual chunking for vendor libraries
- [x] `loading="lazy"` on images
- [x] React Query cache configured (5 min staleTime)
- [x] Console logs stripped in production build

### Bundle Analysis
```bash
# Run to view bundle composition
npm run analyze
# Opens dist/stats.html in browser
```

### Current Bundle Sizes (gzipped)
- Main app: ~100 KB
- Mapbox: ~462 KB (cached separately)
- React: ~52 KB
- Supabase: ~43 KB
- UI components: ~39 KB

---

## 5. Error Handling ✅

- [x] Error Boundary wrapping App
- [x] Unhandled promises fixed
- [x] Error tracking utility ready (`src/lib/errorTracking.ts`)

### Enable Sentry (Optional)
```bash
# Install Sentry
npm install @sentry/react

# Add to .env
VITE_SENTRY_DSN=your-sentry-dsn

# Uncomment code in src/lib/errorTracking.ts
```

---

## 6. Functional Testing

### Authentication
- [ ] Magic link login works
- [ ] Google OAuth login works
- [ ] Logout works
- [ ] Session persists after refresh

### Onboarding
- [ ] Profile form submits correctly
- [ ] Avatar upload works
- [ ] 18+ confirmation works
- [ ] Welcome email is sent

### Events/Quests
- [ ] Create public event
- [ ] Create private event
- [ ] Join event
- [ ] Event chat works
- [ ] Edit event (change time)
- [ ] Delete event
- [ ] Email sent on time change

### Shouts
- [ ] Create shout
- [ ] Comment on shout
- [ ] Like shout
- [ ] Delete shout
- [ ] Shout expires after 24h

### Notifications
- [ ] In-app notifications appear
- [ ] Email on new comment works
- [ ] Email reminder 1h before event

### Social
- [ ] Follow/Unfollow user
- [ ] Direct messages work
- [ ] Block user works

### Map
- [ ] Shouts display nearby
- [ ] Events display nearby
- [ ] Activity filters work
- [ ] Deep links work (`/?eventId=xxx`, `/?shoutId=xxx`)

### PWA
- [ ] Installable on mobile
- [ ] Basic offline mode works

---

## 7. Monitoring Setup

### Before Launch
- [ ] **Error Tracking**: Set up Sentry or LogRocket
- [ ] **Analytics**: Set up Plausible or PostHog (GDPR-friendly)
- [ ] **Uptime**: Set up UptimeRobot or Better Uptime
- [ ] **Database**: Review Supabase Dashboard metrics

### Recommended Alerts
- [ ] Error rate > 1%
- [ ] Response time > 3s
- [ ] Database connection errors
- [ ] Edge Function failures

---

## 8. Final Steps

### Pre-Deploy
```bash
# Verify build succeeds
npm run build

# Run lint (warnings are OK, errors are not)
npm run lint

# Test locally
npm run preview
```

### Deploy
```bash
# Deploy database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy --all

# Deploy frontend (depends on hosting)
# Vercel: git push
# Netlify: git push
# Manual: upload dist/ folder
```

### Post-Deploy Verification
- [ ] Production site loads
- [ ] Login works
- [ ] Map displays
- [ ] Can create a test event
- [ ] Can send a test shout
- [ ] Emails are delivered

---

## Quick Reference

### Environment Variables Required
```env
# .env (local) / Vercel/Netlify settings (production)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_MAPBOX_TOKEN=pk.xxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx (optional)
```

### Useful Commands
```bash
npm run dev       # Local development
npm run build     # Production build
npm run preview   # Preview production build
npm run analyze   # Bundle analysis
npm run lint      # ESLint check
```

---

**Last Updated:** 2026-01-17
