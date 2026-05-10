# 2. Structured

This keeps everything in one file, but adds explicit input and output shapes.

What is new here:

- `UserSchema`, `DogSchema`, and `FindDogsOutput` describe the data that should
  come back.
- `.output(...)` validates the handler result at runtime.
- The output schema also gives callers a precise return type.

You can comment out `.output(...)` while experimenting. The function still runs,
but you lose runtime output validation and the public output type falls back to
`unknown`.

Run it:

```sh
bun example/2-structured/main.ts
```
