/**
 * Request timeout configuration.
 * These prevent requests from hanging indefinitely in half-open connection states.
 *
 * Tunable via environment variables in production without code changes.
 */
export const TIMEOUTS = {
  /** Health check timeouts (fast failure for status indicators) */
  health: Number(process.env.NEXT_PUBLIC_TIMEOUT_HEALTH) || 2000,

  /** Worker status check timeout */
  worker: Number(process.env.NEXT_PUBLIC_TIMEOUT_WORKER) || 5000,

  /** Main runs list fetch timeout */
  runs: Number(process.env.NEXT_PUBLIC_TIMEOUT_RUNS) || 10000,

  /** Individual run detail fetch timeout */
  run: Number(process.env.NEXT_PUBLIC_TIMEOUT_RUN) || 10000,

  /** Events fetch timeout (higher due to potentially large payloads) */
  events: Number(process.env.NEXT_PUBLIC_TIMEOUT_EVENTS) || 15000,
} as const;
