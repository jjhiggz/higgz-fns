# higgzfunctions

`higgzfunctions` is a tiny TypeScript toolkit for making regular application
functions a little more civilized.

You can use almost none of it:

```ts
const findDogs = higgz
  .function()
  .input(z.object({ userId: z.string() }))
  .fn(({ input }) => fakeDBQueryForDogsByOwnerId(input.userId));
```

Or you can turn on more system when the code deserves more system:

```ts
const findDogs = higgz
  .resultFunction()
  .name("find-dogs")
  .deps({ users: UsersService, dogs: DogsService })
  .input(FindDogsInput)
  .output(FindDogsOutput)
  .errors([UserNotFound, DogsServiceUnavailable])
  .use(withSpan())
  .use(retryTransient(2))
  .fn(async ({ input, deps, attempt, fail, succeed }) => {
    // still just your function body, now wearing a sensible jacket
  });
```

That is the whole idea: buy into the parts you want.

## Mental Models

Depending on which corner of TypeScript internet raised you, `higgzfunctions`
might feel like:

- Effect, but for people who open the Effect docs and immediately need a walk.
- oRPC minus the transport layer, plus neverthrow-ish results.
- tRPC/oRPC, but without the R: no remote layer, just the typed function
  boundary part.
- TanStack Query's result-object ergonomics, but for your own application
  functions instead of server-state fetching.
- A middleware framework for regular functions.
- A polite way to tell a function: "please validate your input, declare your
  dependencies, classify your failures, and stop surprising everyone."

oRPC, neverthrow, TanStack Query, and Effect were written by very smart
engineers.
`higgzfunctions` was written by a mid engineer with ChatGPT and a sincere desire
to make application logic less slippery. That is not a formal methods pedigree,
but it does mean the API tries very hard to be understandable by normal humans.

## Start With The Examples

The examples are the best way to learn the library. They all solve the same
"find a user's dogs" problem, adding one layer at a time:

| Folder | What It Shows | Coach Notes |
| --- | --- | --- |
| [`example/1-neat`](./example/1-neat) | One file, plain functions, input validation | "See? It is basically just a function with validation." |
| [`example/2-structured`](./example/2-structured) | Adds output validation and plain-function middleware | "Middleware does not require result functions. Use wrappers early. Be free." |
| [`example/3-optimized`](./example/3-optimized) | Adds service contracts and dependency injection | "Now tests can stub services without module mocking. Look at `find-dogs.test.ts`." |
| [`example/4-fully-systematized`](./example/4-fully-systematized) | Adds result functions, typed errors, `attempt`, `fail`, `succeed` | "Expected failures become data instead of surprise throws." |
| [`example/5-the-spreadsheet-has-become-sentient`](./example/5-the-spreadsheet-has-become-sentient) | Adds middleware, retry, and span-style observability | "The spreadsheet has become sentient, but at least it logs duration." |

The shared fake database lives in [`example/fake-db.ts`](./example/fake-db.ts)
so the demos can focus on `higgzfunctions` concepts instead of pretend storage
furniture.

Run any demo with Bun:

```sh
bun example/1-neat/main.ts
bun example/5-the-spreadsheet-has-become-sentient/main.ts
```

Run the tests, including the service-stubbing example:

```sh
npm test
```

## What It Can Do

`higgzfunctions` is transport-agnostic. It does not care whether you call a
function from an API route, a queue worker, a CLI command, a cron job, a test, or
some weird place in your app that everyone agrees not to discuss.

It gives you these building blocks:

| Feature | What It Does |
| --- | --- |
| `higgz.function()` | Builds a plain throwing function. Great when you want validation, middleware, deps, or output checks without result-style errors. |
| `higgz.resultFunction()` | Builds a function whose expected failures return `Result` values instead of throwing. |
| `.name(...)` | Gives the function a stable name for logs, middleware, and traces. Use it or don't; the function will live. |
| `.input(schema)` | Validates and parses input before the handler runs. Works with Zod, Standard Schema-compatible validators, `parse`, `safeParse`, or validation functions. |
| `.output(schema)` | Validates the handler output and gives callers a precise return type. |
| `.deps(...)` | Declares service dependencies the handler receives as `deps`. |
| `.errors(...)` | Declares the typed errors a result function can return. |
| `.use(middleware)` | Wraps execution with reusable middleware for tracing, retry, auth, logging, timing, etc. |
| `.fn(handler)` | Finishes the builder. The handler is still just TypeScript. Take a breath. |
| `.run(...)` | Executes the function. Plain functions throw; result functions return `Ok`/`Err`. |
| `.safe(...)` | Executes and returns a `Result` even for framework errors like bad input. |
| `.unsafe(...)` | Unwraps successful result functions and throws failures. Useful at boundaries where throws are preferred. |

## Sync Handlers Work, Full Sync Pipelines Do Not Yet

Your handler can be sync or async. Higgz normalizes the call boundary to a
`Promise` because schemas and middleware are allowed to be async, but the actual
function body can absolutely just return a value.

```ts
const double = higgz
  .function()
  .input(z.number())
  .output(z.number())
  .fn(({ input }) => input * 2);

const value = await double.run(21); // 42
```

What the type system does **not** support yet is a fully synchronous pipeline
where `.run(...)` returns the value directly:

```ts
const value = double.run(21); // not today
```

That needs a separate contract: sync-only schemas, sync-only middleware,
sync-only handlers, and sync-only service calls in the path. It is very doable,
but it deserves its own API instead of pretending `Promise` and non-`Promise`
execution are the same animal.

Soon, my friend. Soon.

## 1. Neat: Just A Function With Validation

The smallest useful version is `higgz.function()` plus `.input(...)`.

```ts
const FindDogsInput = z.object({
  userId: z.string().min(1)
});

const findDogs = higgz
  .function()
  .name("find-dogs")
  .input(FindDogsInput)
  .fn(({ input }) => fakeDBQueryForDogsByOwnerId(input.userId));

await findDogs.run({ userId: "ada" });
```

That is it. The input is validated, the handler receives the parsed input, and
you did not have to join a monastery.

## 2. Structured: Add Output Validation And Middleware

Output validation is optional, but useful when you want the function boundary to
prove what it returns. Middleware is also optional, and it works on plain
`higgz.function()` calls. You do not need result functions, typed errors, or
classified failures just to wrap execution.

```ts
const FindDogsOutput = z.object({
  dogs: z.array(DogSchema)
});

const withTiming = () => {
  return async ({ name }, next) => {
    const startedAt = performance.now();
    const output = await next();

    console.log(`[${name}] finished in ${Math.round(performance.now() - startedAt)}ms`);

    return output;
  };
};

const findDogs = higgz
  .function()
  .name("find-dogs")
  .input(FindDogsInput)
  .output(FindDogsOutput)
  .use(withTiming())
  .fn(async ({ input }) => ({
    dogs: await fakeDBQueryForDogsByOwnerId(input.userId)
  }));
```

You can comment out `.output(...)` and the function will still run. What you
lose is runtime output validation and the nice precise public output type.

You can also comment out `.use(withTiming())`. The function still runs; it just
stops logging timing. Middleware is a knob, not a lifestyle contract.

## 3. Optimized: Services And Dependency Injection

Services are a clean way to organize dependency shapes for injection. They are
nearly the same idea as regular parameters: "this function needs this thing to
do its job." They just live in a dedicated `deps` slot and usually correspond to
service-ey parts of an application.

Common examples:

- Database clients or ORMs.
- Model-specific service modules, such as `UsersService` or `DogsService`.
- External API clients, such as a `StripeService` that groups all Stripe calls.

At heart, a service is just a category of functions grouped around a common
purpose:

```ts
const StripeService = higgzService<{
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  refundPayment(paymentId: string): Promise<void>;
}>("stripe");
```

The helper adds a small runtime tag to the implementation when you wrap it with
`.new(...)`. That tag lets Higgz verify that a function relying on a service is
not called without explicitly providing that service.

```ts
const UsersService = higgzService<{
  findById(id: string): Promise<User | null>;
}>("users");

const findUser = higgz
  .function()
  .deps({ users: UsersService })
  .input(z.object({ id: z.string() }))
  .fn(({ input, deps }) => deps.users.findById(input.id));

await findUser.run(
  { id: "user_123" },
  {
    deps: {
      users: UsersService.new(usersService)
    }
  }
);
```

Inside the handler, `deps.users` is the plain service implementation. The tag is
for the boundary where dependencies are provided, so Higgz can fail fast with a
clear missing-dependency error instead of letting the handler discover it the
hard way.

Because dependencies are passed at the call boundary, stubbing a service in a
test is just passing a different implementation:

```ts
const stubUsers = UsersService.new({
  async findById(id) {
    return { id, name: "Stub Ada" };
  }
});

await findUser.run(
  { id: "user_123" },
  { deps: { users: stubUsers } }
);
```

No module mocking required. The function asks for a `users` service, and the
caller decides which `users` service it gets. Very adult. Very convenient.

## 4. Fully Systematized: Typed Result Errors

When failures are expected, `resultFunction()` lets you return them as typed
values instead of throwing.

```ts
const UserNotFound = higgzError(
  "UserNotFound",
  z.object({ id: z.string() })
);

const DatabaseError = higgzError(
  "DatabaseError",
  z.object({ operation: z.string() })
);

const findUser = higgz
  .resultFunction()
  .deps({ users: UsersService })
  .input(z.object({ id: z.string() }))
  .output(UserSchema)
  .errors([UserNotFound, DatabaseError])
  .fn(async ({ input, deps, attempt, fail, succeed }) => {
    const found = await attempt(
      () => deps.users.findById(input.id),
      DatabaseError.with({ operation: "users.findById" })
    );

    if (!found.ok) return fail(found.error);

    if (!found.data) {
      return fail(UserNotFound.new({ id: input.id }));
    }

    return succeed(found.data);
  });
```

The important parts:

- `higgzError(...)` creates schema-backed tagged errors.
- `.errors(...)` declares which errors the function can return.
- `attempt(...)` maps thrown or rejected service calls into typed errors. Its
  `{ ok, data, error }` shape is very much inspired by TanStack Query's
  "inspect the result object, then decide what to do" ergonomics.
- `fail(...)` only accepts declared errors.
- `succeed(...)` validates the happy path output.

Callers get a `Result`:

```ts
const result = await findUser.run({ id: "user_123" }, { deps });

if (result.ok) {
  console.log(result.value);
} else if (UserNotFound.is(result.error)) {
  console.log("that user has left the building");
}
```

## 5. The Spreadsheet Has Become Sentient: Middleware Plus Typed Results

By this point, middleware is not new. The final example shows middleware working
with result functions and classified errors, so wrappers can do more than log
timing: they can inspect typed failures and make policy decisions like retrying.

Use middleware for boring useful things: timing, tracing, auth, retry, logging,
transactions, request context, and other little systems that make production code
less haunted.

```ts
function withSpan() {
  return async ({ name, input }, next) => {
    const startedAt = performance.now();
    console.log(`[span:start] ${name}`, { input });

    const result = await next();

    console.log(`[span:end] ${name}`, {
      durationMs: Math.round(performance.now() - startedAt),
      ok: result.ok
    });

    return result;
  };
}

const findDogs = higgz
  .resultFunction()
  .name("find-dogs")
  .use(withSpan())
  .use(retryTransient(2))
  .fn(async ({ succeed }) => succeed({ dogs: [] }));
```

Middleware is intentionally plain: it receives the context and a `next()`
function. Call `next()`, inspect the result, return what should happen. No
wizard robe required, though the final example does have spreadsheet energy.

## Comparison Table

This is not trying to replace the big serious tools. It is trying to cover a
smaller, very common slice: application functions that want validation, deps,
typed failures, and middleware without becoming a whole runtime philosophy.

Legend: ✅ yes, ❌ no, 🟡 kind of / adjacent, 🎯 primary focus, 🧩 supported,
🚫 intentionally absent.

| Feature | `higgzfunctions` | (o/t)RPC | TanStack Query | neverthrow | Effect |
| --- | --- | --- | --- | --- | --- |
| Typed I/O | ✅ any fn | ✅ RPC | 🟡 | ❌ | ✅ |
| Remote/API | 🚫 BYO | 🎯 | 🟡 fetch | ❌ | ❌ |
| Result failures | ✅ | 🟡 | 🟡 state | 🎯 | ✅ |
| Inspectable async result | ✅ `attempt` | 🟡 | 🎯 | ✅ | ✅ |
| Deps/services | ✅ | 🟡 | ❌ | ❌ | 🎯 |
| Middleware | ✅ | ✅ | 🟡 | ❌ | ✅ |
| Works without HTTP | ✅ | ❌ | 🟡 | ✅ | ✅ |
| Runtime size/vibe | 🧩 tiny | 🧰 API | 🗄️ cache | 📦 result | 🏛️ system |

If you already love Effect, you probably do not need this. If you want 20% of
that shape without learning a new civilization, hello, welcome in.

## Type Helpers

The `Higgz` namespace can infer shapes back out of factories:

```ts
import type { Higgz } from "higgzfunctions";

type UserServiceShape = Higgz.inferService<typeof UsersService>;
type DatabaseErrorValue = Higgz.inferError<typeof DatabaseError>;
type DatabaseErrorData = Higgz.inferErrorData<typeof DatabaseError>;
type AppDeps = Higgz.inferDeps<{ users: typeof UsersService }>;
type AppDepsInput = Higgz.inferDepsInput<{ users: typeof UsersService }>;
```

This is mostly so you do not have to write the same types twice, which is one of
the top five ways software slowly turns into paperwork.

## API Cheat Sheet

```ts
import {
  higgz,
  higgzError,
  higgzService,
  attempt,
  type Higgz
} from "higgzfunctions";
```

- `higgz.function()` creates a plain throwing function builder.
- `higgz.resultFunction()` creates a result-returning function builder.
- `higgzService<Shape>("tag")` creates a tagged dependency contract.
- `higgzError("Tag", schema)` creates a schema-backed tagged error factory.
- `attempt(work, mapper)` catches throws/rejections and returns
  `{ ok, data, error }`.
- `Higgz.inferService`, `Higgz.inferError`, `Higgz.inferDeps`, and friends keep
  your types connected to the contracts.
