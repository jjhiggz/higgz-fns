# 5. The Spreadsheet Has Become Sentient

This is the full-suite version: services, schemas, typed result errors,
classified failures, retry middleware, and tracing-style span middleware.

What is new here:

- `withSpan()` wraps the whole function run and logs start/end timing.
- `retryTransient(2)` retries when a typed error says it is retryable.
- Error classifications become useful behavior, not just decorative metadata.
- Middleware composes around the same handler, so the function body stays focused
  on business logic.

This is the "please make the system observable and policy-aware" version. It is
more code, but the extra code is mostly named pieces with jobs.

Run it:

```sh
bun example/5-the-spreadsheet-has-become-sentient/main.ts
```
