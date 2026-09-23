import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

const environment =
  process.env.EXPO_PUBLIC_APP_ENV?.trim() ||
  (__DEV__ ? "development" : "production");

const scrubString = (value: string): string =>
  value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(access_token|refresh_token|token|authorization|apikey|api_key|invite_token|inviteToken)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, "$1?[REDACTED]");

const scrubValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return "[REDACTED_DEPTH]";

  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => scrubValue(item, depth + 1));
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(input)) {
    if (
      /^(authorization|access[_-]?token|refresh[_-]?token|apikey|api[_-]?key|password|secret|signed[_-]?url|invite[_-]?token|session[_-]?token)$/i.test(
        key,
      )
    ) {
      output[key] = "[REDACTED]";
      continue;
    }

    output[key] = scrubValue(item, depth + 1);
  }

  return output;
};

export const SENTRY_ENABLED = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    enableLogs: false,
    beforeSend(event) {
      return scrubValue(event) as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubValue(breadcrumb) as typeof breadcrumb;
    },
  });
} else if (__DEV__) {
  console.info(
    "[Mefie] Sentry is disabled because EXPO_PUBLIC_SENTRY_DSN is not configured.",
  );
}

export const captureException = (
  error: unknown,
  context?: Record<string, unknown>,
) => {
  if (!SENTRY_ENABLED) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("mefie", scrubValue(context) as Record<string, unknown>);
    }
    Sentry.captureException(error);
  });
};

export const captureMessage = (message: string) => {
  if (!SENTRY_ENABLED) return;
  Sentry.captureMessage(scrubString(message));
};

export default Sentry;
