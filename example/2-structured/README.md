# 2. Structured

This keeps everything in one file, but adds explicit input/output shapes and a
tiny middleware wrapper.

What is new here:

- `UserSchema`, `DogSchema`, and `FindDogsOutput` describe the data that should
  come back.
- `.output(...)` validates the handler result at runtime.
- The output schema also gives callers a precise return type.
- `.use(...)` wraps a plain `higgz.function()` call. You do not need
  `resultFunction()`, typed errors, or classified failures to use middleware.

You can comment out `.output(...)` while experimenting. The function still runs,
but you lose runtime output validation and the public output type falls back to
`unknown`.

You can also comment out `.use(withTiming())`. The function still runs; it just
stops logging how long it took. Very brave of it.

Run it:

```sh
bun example/2-structured/main.ts
```
