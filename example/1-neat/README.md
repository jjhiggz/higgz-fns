# 1. Neat

This is the smallest version: plain `higgz.function()`, input validation, and a
normal async handler.

What is new here:

- `.function()` gives you a callable function object.
- `.input(...)` validates before the handler runs.
- `.fn(...)` is just regular TypeScript with `input` already parsed.

Handlers can be sync or async. The call still returns a `Promise`, because Higgz
lets validation and middleware be async. Full synchronous integration is not in
the type system yet. Soon, my friend. Soon.

Run it:

```sh
bun example/1-neat/main.ts
```
