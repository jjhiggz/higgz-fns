# 4. Fully Systematized

This version buys into the safe result-style API.

What is new here:

- `higgz.resultFunction()` returns `Ok`/`Err` for expected failures.
- `higgzError(...)` creates typed, schema-backed errors.
- `.errors(...)` declares which domain and integration errors the function can
  return.
- `attempt(...)` maps thrown service failures into those typed errors.
- `fail(...)` and `succeed(...)` make the unhappy and happy paths explicit.

This is the version you reach for when callers should handle expected failures
without a pile of `try/catch` blocks.

Run it:

```sh
bun example/4-fully-systematized/main.ts
```
