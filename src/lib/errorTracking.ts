/**
 * Error tracking utility for production monitoring.
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Add VITE_SENTRY_DSN to your .env file
 * 3. Uncomment the Sentry imports and initialization below
 *
 * Alternative services:
 * - LogRocket: npm install logrocket
 * - Bugsnag: npm install @bugsnag/js @bugsnag/plugin-react
 */

// Uncomment when Sentry is installed:
// import * as Sentry from '@sentry/react';

interface ErrorContext {
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}

/**
 * Initialize error tracking service.
 * Call this once in main.tsx before rendering.
 */
export function initErrorTracking(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE;

  if (!dsn) {
    if (environment === 'production') {
      console.warn('[ErrorTracking] VITE_SENTRY_DSN not configured. Error tracking disabled.');
    }
    return;
  }

  // Uncomment when Sentry is installed:
  // Sentry.init({
  //   dsn,
  //   environment,
  //   integrations: [
  //     Sentry.browserTracingIntegration(),
  //     Sentry.replayIntegration({
  //       maskAllText: false,
  //       blockAllMedia: false,
  //     }),
  //   ],
  //   // Performance monitoring
  //   tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  //   // Session replay for debugging
  //   replaysSessionSampleRate: 0.1,
  //   replaysOnErrorSampleRate: 1.0,
  //   // Filter out sensitive data
  //   beforeSend(event) {
  //     // Remove email addresses from breadcrumbs
  //     if (event.breadcrumbs) {
  //       event.breadcrumbs = event.breadcrumbs.map(bc => ({
  //         ...bc,
  //         message: bc.message?.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]'),
  //       }));
  //     }
  //     return event;
  //   },
  // });

  console.info('[ErrorTracking] Initialized');
}

/**
 * Capture an exception and send to error tracking service.
 */
export function captureException(error: Error, context?: ErrorContext): void {
  // Always log to console in development
  console.error('[ErrorTracking] Exception:', error, context);

  // Uncomment when Sentry is installed:
  // Sentry.captureException(error, {
  //   tags: context?.tags,
  //   extra: context?.extra,
  //   user: context?.user,
  // });
}

/**
 * Capture a message (non-error event).
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (level === 'error') {
    console.error('[ErrorTracking]', message);
  } else if (level === 'warning') {
    console.warn('[ErrorTracking]', message);
  } else {
    console.info('[ErrorTracking]', message);
  }

  // Uncomment when Sentry is installed:
  // Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking.
 * Call this after user login.
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  // Uncomment when Sentry is installed:
  // if (user) {
  //   Sentry.setUser({
  //     id: user.id,
  //     email: user.email,
  //     username: user.username,
  //   });
  // } else {
  //   Sentry.setUser(null);
  // }
}

/**
 * Add a breadcrumb for debugging context.
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
  // Uncomment when Sentry is installed:
  // Sentry.addBreadcrumb({
  //   message,
  //   category,
  //   data,
  //   level: 'info',
  // });
}
