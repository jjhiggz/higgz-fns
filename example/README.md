# HiggzFunctions Buy-In Examples

These folders show the same `find dogs for a user` use case with increasing
levels of HiggzFunctions buy-in:

- `fake-db.ts`: shared fake data and query helpers used by every demo, kept out
  of the individual folders so the examples can focus on HiggzFunctions code.
- `1-neat/`: one file, multiple functions, input validation, and a tiny local
  retry helper.
- `2-structured/`: adds output validation, a precise return type, and plain
  function middleware.
- `3-optimized/`: adds app-style folders, service contracts, and injected
  dependencies, but still uses the plain throwing API.
- `4-fully-systematized/`: adds `resultFunction`, typed domain/integration
  errors, `attempt(...)`, `fail(...)`, and `succeed(...)`.
- `5-the-spreadsheet-has-become-sentient/`: combines retryable classified errors
  with middleware around the full result-function flow.

The intent is that each folder can be read as a small standalone demo project.
Each folder also has its own README and code comments pointing out the new
thing it adds. You can stop at the level of structure you want, or keep adding
layers when the extra explicitness is worth it.
