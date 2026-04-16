import * as Sentry from "@sentry/nextjs";

/**
 * Report Convex action failures to Sentry (client-side). Never log secrets.
 */
export function reportConvexActionFailed(
  actionName: string,
  error: unknown
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, {
    tags: { convex_action: actionName },
  });
}
