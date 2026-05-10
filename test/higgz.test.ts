import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Higgz } from "../src";
import {
  attempt,
  higgzError,
  higgzFunction,
  higgzResultFunction,
  higgzService,
  safePromise
} from "../src";

type User = {
  id: string;
  name: string;
};

const UserNotFound = higgzError(
  "UserNotFound",
  z.object({ id: z.string() })
);
const DatabaseError = higgzError(
  "DatabaseError",
  z.object({ operation: z.string() })
);
const OtherError = higgzError(
  "OtherError",
  z.object({ code: z.string() })
);
const RetryableError = higgzError(
  "RetryableError",
  z.object({ retryable: z.literal(true) })
);

const UserService = higgzService<{
  find(id: string): Promise<User | null>;
}>("users");

const _attemptTypeChecks = async () => {
  const result = await attempt(() => Promise.resolve(1));

  result.ok;

  // @ts-expect-error use `await attempt(...)` and inspect `result.ok` instead
  attempt(() => Promise.resolve(1)).catch(() => undefined);

  // @ts-expect-error safePromise has the same result-style API as attempt
  safePromise(Promise.resolve(1)).catch(() => undefined);
};

const inputSchema = (value: { id: string }) => value;
const userSchema = (value: User) => value;

type UserServiceShape = Higgz.inferService<typeof UserService>;
type UserServiceInstanceShape = Higgz.inferServiceInstance<
  ReturnType<typeof UserService.new>
>;
type DatabaseErrorValue = Higgz.inferError<typeof DatabaseError>;
type DatabaseErrorData = Higgz.inferErrorData<typeof DatabaseError>;
type DeclaredErrors = Higgz.inferErrorUnion<
  [typeof UserNotFound, typeof DatabaseError]
>;
type ResolvedDeps = Higgz.inferDeps<{ users: typeof UserService }>;
type DepsInput = Higgz.inferDepsInput<{ users: typeof UserService }>;

if (false) {
  const serviceShape: UserServiceShape = {
    find: async (id: string) => ({ id, name: "Ada" })
  };
  const instanceShape: UserServiceInstanceShape = serviceShape;
  const errorData: DatabaseErrorData = { operation: "users.find" };
  const errorValue: DatabaseErrorValue = DatabaseError.new(errorData);
  const declaredError: DeclaredErrors = errorValue;
  const resolvedDeps: ResolvedDeps = { users: serviceShape };
  const depsInput: DepsInput = { users: UserService.new(serviceShape) };

  void instanceShape;
  void declaredError;
  void resolvedDeps;
  void depsInput;

  higgzResultFunction
    .output((value: string) => value)
    .errors([DatabaseError])
    .fn(({ fail }) => {
      // @ts-expect-error fail only accepts declared errors
      return fail(OtherError.new({ code: "wrong-vocabulary" }));
    });

  higgzResultFunction
    .output((value: string) => value)
    .errors([DatabaseError])
    .fn(({ succeed }) => {
      // @ts-expect-error succeed only accepts the declared output type
      return succeed(123);
    });

  // @ts-expect-error error data comes from the schema
  DatabaseError.new({ operation: 123 });
}

describe("higgz primitives", () => {
  it("creates tagged errors with data, cause, is, and with helpers", () => {
    const cause = new Error("connection refused");
    const error = DatabaseError.new({
      operation: "connect",
      cause
    });
    const mapped = DatabaseError.with({ operation: "query" })(cause);

    expect(error.tag).toBe("DatabaseError");
    expect(error.data).toEqual({ operation: "connect" });
    expect(error.cause).toBe(cause);
    expect(DatabaseError.is(error)).toBe(true);
    expect(DatabaseError.is(UserNotFound.new({ id: "user_1" }))).toBe(false);
    expect(mapped).toMatchObject({
      tag: "DatabaseError",
      data: { operation: "query" },
      cause
    });
  });

  it("validates tagged error data with the configured schema", () => {
    expect(() =>
      DatabaseError.new({ operation: 123 as never })
    ).toThrowError(
      expect.objectContaining({
        code: "BAD_ERROR_DATA"
      })
    );
  });

  it("wraps services as tagged instances", () => {
    const service = {
      find: async (id: string) => ({ id, name: "Ada" })
    };
    const instance = UserService.new(service);

    expect(instance.tag).toBe("users");
    expect(instance.value).toBe(service);
    expect(UserService.is(instance)).toBe(true);
    expect(UserService.is(service)).toBe(false);
  });

  it("turns promises into tanstack-style safe results", async () => {
    const cause = new Error("boom");
    const good = await safePromise(Promise.resolve(42));
    const bad = await safePromise(
      () => {
        throw cause;
      },
      DatabaseError.with({ operation: "sync" })
    );

    expect(good).toEqual({ ok: true, data: 42, error: null });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(DatabaseError.is(bad.error)).toBe(true);
      expect(bad.error.cause).toBe(cause);
    }
  });
});

describe("higgz result functions", () => {
  it("runs with typed deps, attempt, fail, succeed, and middleware context", async () => {
    const events: string[] = [];
    const users = UserService.new({
      find: async (id: string) =>
        id === "user_1" ? { id, name: "Ada" } : null
    });

    const findUser = higgzResultFunction
      .name("findUser")
      .deps({ users: UserService })
      .input(inputSchema)
      .output(userSchema)
      .errors([UserNotFound, DatabaseError])
      .use(async ({ name, input }, next) => {
        events.push(`${name}:${input.id}:before`);
        const result = await next();
        events.push(`${name}:${input.id}:after`);
        return result;
      })
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

    const good = await findUser.run({ id: "user_1" }, { deps: { users } });
    const missing = await findUser.run({ id: "missing" }, { deps: { users } });

    expect(findUser.name).toBe("findUser");
    expect(good.ok).toBe(true);
    expect(good.unwrap()).toEqual({ id: "user_1", name: "Ada" });
    expect(missing.ok).toBe(false);
    expect(UserNotFound.is(missing.unwrapErr())).toBe(true);
    expect(events).toEqual([
      "findUser:user_1:before",
      "findUser:user_1:after",
      "findUser:missing:before",
      "findUser:missing:after"
    ]);
  });

  it("maps rejected promise causes into declared errors", async () => {
    const cause = new Error("db offline");
    const users = {
      find: async () => {
        throw cause;
      }
    };

    const findUser = higgzResultFunction
      .deps({ users: UserService })
      .input(inputSchema)
      .output(userSchema)
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
      { id: "user_1" },
      { deps: { users: UserService.new(users) } }
    );

    expect(result.ok).toBe(false);
    const error = result.unwrapErr();
    expect(DatabaseError.is(error)).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it("allows result middleware to retry downstream execution", async () => {
    let calls = 0;
    const retryOnce = async (_ctx: unknown, next: () => Promise<any>) => {
      const first = await next();
      if (first.ok || !RetryableError.is(first.error)) {
        return first;
      }

      return next();
    };

    const flaky = higgzResultFunction
      .output((value: string) => value)
      .errors([RetryableError])
      .use(retryOnce)
      .fn(({ fail, succeed }) => {
        calls += 1;

        if (calls === 1) {
          return fail(RetryableError.new({ retryable: true }));
        }

        return succeed("recovered");
      });

    const result = await flaky.run(undefined);

    expect(result.unwrap()).toBe("recovered");
    expect(calls).toBe(2);
  });
});

describe("higgz throwing functions", () => {
  it("supports the same name/input/output/deps shape for plain functions", async () => {
    const double = higgzFunction
      .name("double")
      .input((value: number) => value)
      .output((value: number) => value)
      .fn(({ input }) => input * 2);

    await expect(double.run(21)).resolves.toBe(42);
    expect(double.name).toBe("double");
  });
});
