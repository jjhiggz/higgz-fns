# 1. Neat

This is the smallest version: plain `higgz.function()`, input validation, and a
normal async handler.

What is new here:

- `.function()` gives you a callable function object.
- `.input(...)` validates before the handler runs.
- `.fn(...)` is just regular TypeScript with `input` already parsed.

Run it:

```sh
bun example/1-neat/main.ts
```
