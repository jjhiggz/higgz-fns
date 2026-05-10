import { ValidationError } from "./errors";

/**
 * A value or a promise of that value.
 *
 * @example
 * ```ts
 * const loadUser = (): MaybePromise<User> => ({ id: "ada" });
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;

type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly unknown[]; readonly value?: undefined };

/**
 * Minimal Standard Schema support used by Higgz input and output validation.
 *
 * Zod, Valibot, and other schema libraries can expose compatible validation
 * through the Standard Schema interface.
 *
 * @example
 * ```ts
 * const input = z.object({ userId: z.string() });
 * ```
 */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: Input
    ) => MaybePromise<StandardSchemaResult<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

/**
 * Schema-like values Higgz can use for runtime validation.
 *
 * Supports Standard Schema, `parse`, `safeParse`, and validation functions.
 *
 * @example
 * ```ts
 * higgz.resultFunction().input(z.object({ userId: z.string() }));
 * higgz.resultFunction().input((value: { userId: string }) => value);
 * ```
 */
export type AnySchema =
  | StandardSchema<unknown, unknown>
  | { parse(value: unknown): unknown }
  | {
      safeParse(value: unknown):
        | { success: true; data: unknown }
        | { success: false; error: unknown };
    }
  | ((value: any) => unknown);

/**
 * Infer the accepted input type from a schema-like value.
 *
 * @example
 * ```ts
 * type Input = InferSchemaInput<typeof FindUsersDogsInput>;
 * ```
 */
export type InferSchemaInput<Schema> =
  Schema extends StandardSchema<infer Input, unknown>
    ? Input
    : Schema extends { parse(value: infer Input): unknown }
      ? Input
      : Schema extends (value: infer Input) => unknown
        ? Input
        : unknown;

/**
 * Infer the parsed output type from a schema-like value.
 *
 * @example
 * ```ts
 * type Output = InferSchemaOutput<typeof FindUsersDogsOutput>;
 * ```
 */
export type InferSchemaOutput<Schema> =
  Schema extends StandardSchema<unknown, infer Output>
    ? Output
    : Schema extends { parse(value: unknown): infer Output }
      ? Output
      : Schema extends (value: any) => infer Output
        ? Awaited<Output>
        : Schema extends {
              safeParse(value: unknown):
                | { success: true; data: infer Output }
                | { success: false; error: unknown };
            }
          ? Output
          : unknown;

/**
 * Validation stage used to select the right framework error code.
 *
 * @example
 * ```ts
 * const stage: SchemaStage = "input";
 * ```
 */
export type SchemaStage = "input" | "output" | "error";

/**
 * Parse and validate a value with a schema-like object.
 *
 * This is used internally by Higgz builders, but is exported through the public
 * schema types for advanced integrations.
 *
 * @example
 * ```ts
 * const parsed = await parseSchema(UserSchema, value, "input");
 * ```
 */
export async function parseSchema(
  schema: AnySchema | undefined,
  value: unknown,
  stage: SchemaStage
): Promise<unknown> {
  if (!schema) {
    return value;
  }

  try {
    if (typeof schema === "function") {
      return await schema(value);
    }

    if ("~standard" in schema) {
      const result = await schema["~standard"].validate(value);
      if ("issues" in result && result.issues) {
        throw new ValidationError(validationCode(stage), result.issues);
      }

      return result.value;
    }

    if ("safeParse" in schema) {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new ValidationError(validationCode(stage), result.error);
      }

      return result.data;
    }

    return schema.parse(value);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(validationCode(stage), error, {
      cause: error
    });
  }
}

/**
 * Synchronously parse and validate a value with a schema-like object.
 *
 * Used for Higgz error data because `.new(...)` and `.with(...)` are
 * synchronous helpers. Async schemas throw `BAD_ERROR_DATA` here.
 *
 * @example
 * ```ts
 * const data = parseSchemaSync(ErrorDataSchema, value, "error");
 * ```
 */
export function parseSchemaSync(
  schema: AnySchema | undefined,
  value: unknown,
  stage: SchemaStage
): unknown {
  if (!schema) {
    return value;
  }

  try {
    if (typeof schema === "function") {
      return assertNotPromise(schema(value), stage);
    }

    if ("~standard" in schema) {
      const result = assertNotPromise(
        schema["~standard"].validate(value),
        stage
      );
      if ("issues" in result && result.issues) {
        throw new ValidationError(validationCode(stage), result.issues);
      }

      return result.value;
    }

    if ("safeParse" in schema) {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new ValidationError(validationCode(stage), result.error);
      }

      return result.data;
    }

    return schema.parse(value);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(validationCode(stage), error, {
      cause: error
    });
  }
}

function assertNotPromise<T>(value: MaybePromise<T>, stage: SchemaStage): T {
  if (isPromiseLike(value)) {
    throw new ValidationError(validationCode(stage), {
      message: "Schema validation must be synchronous here"
    });
  }

  return value;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then: unknown }).then === "function"
  );
}

function validationCode(
  stage: SchemaStage
): "BAD_INPUT" | "BAD_OUTPUT" | "BAD_ERROR_DATA" {
  if (stage === "input") {
    return "BAD_INPUT";
  }

  if (stage === "output") {
    return "BAD_OUTPUT";
  }

  return "BAD_ERROR_DATA";
}
