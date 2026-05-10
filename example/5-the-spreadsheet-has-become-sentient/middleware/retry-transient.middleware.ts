import { isRetryableError } from "../errors/classification";

export function retryTransient(maxAttempts = 3) {
  return async ({ name }: { name: string }, next: () => Promise<any>) => {
    // Middleware can look at result errors and decide what to do. In this case:
    // "try again, but with dignity."
    let lastResult = await next();

    for (let attempt = 2; attempt <= maxAttempts; attempt += 1) {
      if (lastResult.ok || !isRetryableError(lastResult.error)) {
        return lastResult;
      }

      console.log(`[${name}] retrying retryable error, attempt ${attempt}`);
      lastResult = await next();
    }

    return lastResult;
  };
}
