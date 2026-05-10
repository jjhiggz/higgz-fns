import { describe, expect, it } from "vitest";
import {
  SuperFunctionError,
  createSuperFunction,
  err,
  ok,
  superfunction
} from "../src";

describe("superfunction", () => {
  it("creates callable functions with parsed input", async () => {
    const addOne = superfunction
      .input((value: unknown) => {
        if (typeof value !== "number") {
          throw new Error("Expected number");
        }
        return value;
      })
      .handler(({ input }) => input + 1);

    await expect(addOne(1)).resolves.toBe(2);
    await expect(addOne("1" as never)).rejects.toMatchObject({
      code: "BAD_INPUT"
    });
  });

  it("supports opt-in result mode", async () => {
    const divide = superfunction
      .result()
      .input((value: { numerator: number; denominator: number }) => value)
      .handler(({ input }) => {
        if (input.denominator === 0) {
          return err(new SuperFunctionError("DIVIDE_BY_ZERO"));
        }

        return ok(input.numerator / input.denominator);
      });

    const good = await divide({ numerator: 6, denominator: 2 });
    const bad = await divide({ numerator: 6, denominator: 0 });

    expect(good.ok).toBe(true);
    expect(good.unwrap()).toBe(3);
    expect(bad.ok).toBe(false);
    expect(bad.unwrapErr()).toMatchObject({ code: "DIVIDE_BY_ZERO" });
  });

  it("exposes safe mode on throwing functions", async () => {
    const fail = superfunction.handler(() => {
      throw new SuperFunctionError("NOPE", "Nope");
    });

    const result = await fail.safe(undefined);

    expect(result.ok).toBe(false);
    expect(result.unwrapErr()).toMatchObject({ code: "NOPE" });
  });

  it("runs middleware around the handler", async () => {
    const events: string[] = [];
    const fn = superfunction
      .use(async (_ctx, next) => {
        events.push("before");
        const result = await next();
        events.push("after");
        return result;
      })
      .handler(() => "done");

    await expect(fn(undefined)).resolves.toBe("done");
    expect(events).toEqual(["before", "after"]);
  });

  it("validates output when configured", async () => {
    const fn = superfunction
      .output((value: unknown) => {
        if (typeof value !== "string") {
          throw new Error("Expected string");
        }
        return value;
      })
      .handler(() => 123);

    await expect(fn(undefined)).rejects.toMatchObject({
      code: "BAD_OUTPUT"
    });
  });

  it("passes typed context to handlers", async () => {
    const authed = createSuperFunction<{ userId: string }>();
    const whoami = authed.handler(({ context }) => context.userId);

    await expect(
      whoami(undefined, { context: { userId: "user_123" } })
    ).resolves.toBe("user_123");
  });
});
