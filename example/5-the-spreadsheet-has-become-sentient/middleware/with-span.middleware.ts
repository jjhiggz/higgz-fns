export function withSpan() {
  return async (
    { name, input }: { name: string; input: unknown },
    next: () => Promise<any>
  ) => {
    // This is intentionally tiny, but it has the shape of real tracing:
    // start, run the next layer, record what happened. Clipboards everywhere.
    const startedAt = performance.now();
    console.log(`[span:start] ${name}`, { input });

    const result = await next();
    const durationMs = Math.round(performance.now() - startedAt);

    console.log(`[span:end] ${name}`, {
      durationMs,
      ok: result.ok
    });

    return result;
  };
}
