/**
 * Wraps an AbortSignal with a timeout.
 * Useful for preventing long-hanging requests to services that may be half-open.
 *
 * @param parent - The parent AbortSignal (from the hook)
 * @param ms - Timeout in milliseconds
 * @returns Object with combined signal and cleanup function
 */
export function withTimeout(parent: AbortSignal, ms: number) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();

  const t = setTimeout(() => controller.abort(), ms);
  parent.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(t);
      parent.removeEventListener('abort', onAbort);
    },
  };
}
