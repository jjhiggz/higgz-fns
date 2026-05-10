# higgzfunctions

Transport-agnostic superfunctions for application logic. The API is shaped like a small function builder: validate inputs, run middleware, handle the function, optionally validate outputs, and choose between throwing or neverthrow-style `Result` returns.

## Services

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
const realUsers: Higgz.inferService<typeof UsersService> = {
  findById: async (id) => database.users.findById(id)
};

const stubUsers: Higgz.inferService<typeof UsersService> = {
  findById: async (id) => ({ id, name: "Stub Ada" })
};

const realResult = await findUser.run(
  { id: "user_123" },
  { deps: { users: UsersService.new(realUsers) } }
);

const testResult = await findUser.run(
  { id: "user_123" },
  { deps: { users: UsersService.new(stubUsers) } }
);
```

No module mocking required. The function asks for a `users` service, and the
caller decides which `users` service it gets.

## Higgz API

The newer Higgz-shaped API adds named functions, tagged errors, tagged services,
typed `fail` / `succeed` helpers, and a TanStack-style `attempt` helper for
working with promises without generator functions.

```ts
import {
  higgz,
  higgzError,
  higgzService
} from "higgzfunctions";
import { z } from "zod";

const FindUserInput = z.object({ id: z.string() });
const UserOutput = z.object({
  id: z.string(),
  name: z.string()
});

type User = z.infer<typeof UserOutput>;

const UserNotFound = higgzError(
  "UserNotFound",
  z.object({ id: z.string() })
);
const DatabaseError = higgzError(
  "DatabaseError",
  z.object({ operation: z.string() })
);

const UserService = higgzService<{
  find(id: string): Promise<User | null>;
}>("users");

const findUser = higgz
  .resultFunction()
  .name("findUser")
  .deps({ users: UserService })
  .input(FindUserInput)
  .output(UserOutput)
  .errors([UserNotFound, DatabaseError])
  .fn(async ({ input, deps, attempt, fail, succeed }) => {
    const found = await attempt(
      () => deps.users.find(input.id),
      DatabaseError.with({ operation: "users.find" })
    );

    if (!found.ok) {
      return fail(found.error);
    }

    if (!found.data) {
      return fail(UserNotFound.new({ id: input.id }));
    }

    return succeed(found.data);
  });

const result = await findUser.run(
  { id: "user_123" },
  {
    deps: {
      users: UserService.new(users)
    }
  }
);

if (result.ok) {
  console.log(result.value);
}
```

The `Higgz` type namespace includes helper aliases for pulling shapes back out
of factories:

```ts
import type { Higgz } from "higgzfunctions";

type UserServiceShape = Higgz.inferService<typeof UserService>;
type DatabaseErrorValue = Higgz.inferError<typeof DatabaseError>;
type DatabaseErrorData = Higgz.inferErrorData<typeof DatabaseError>;
```

`attempt` returns a discriminated result:

```ts
const result = await attempt(
  () => somePromise(),
  DatabaseError.with({ operation: "somePromise" })
);

// { ok: true, data: T, error: null }
// { ok: false, data: null, error: DatabaseError }
```

## Legacy Superfunction API

```ts
import { SuperFunctionError, err, superfunction } from "higgzfunctions";

const divide = superfunction
  .result()
  .input((value: { numerator: number; denominator: number }) => value)
  .handler(({ input }) => {
    if (input.denominator === 0) {
      return err(new SuperFunctionError("DIVIDE_BY_ZERO"));
    }

    return input.numerator / input.denominator;
  });

const result = await divide({ numerator: 10, denominator: 2 });

if (result.ok) {
  console.log(result.value);
}
```

## Core Superfunction API

- `superfunction.handler(fn)` creates a callable async function.
- `.input(schema)` parses input before the handler runs.
- `.output(schema)` parses output after the handler runs.
- `.use(middleware)` wraps execution with transport-free middleware.
- `.safe(input)` always returns `Result<Output, Error>`.
- `.result().handler(fn)` makes the callable itself return `Result`.
- `.throws()` switches a builder back to throwing call style.

Schemas can be Standard Schema-compatible objects, `parse`, `safeParse`, or a simple function.

```ts
const addOne = superfunction
  .input((value: unknown) => {
    if (typeof value !== "number") throw new Error("Expected number");
    return value;
  })
  .handler(({ input }) => input + 1);

await addOne(1); // 2
await addOne.safe("1"); // Err(ValidationError BAD_INPUT)
```

## Typed Context

```ts
import { createSuperFunction } from "higgzfunctions";

const authed = createSuperFunction<{ userId: string }>();

const whoami = authed.handler(({ context }) => context.userId);

await whoami(undefined, { context: { userId: "user_123" } });
```
