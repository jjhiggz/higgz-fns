import {
  parseSchemaSync,
  type AnySchema,
  type InferSchemaOutput
} from "./schema";
import { ValidationError } from "./errors";

export const higgzErrorType: unique symbol = Symbol("higgz.error");

/**
 * Infer the runtime-validated error data shape from a schema.
 *
 * @example
 * ```ts
 * const DogLookupError = higgzError(
 *   "DogLookupError",
 *   z.object({ userId: z.string() })
 * );
 *
 * type Data = Higgz.inferErrorData<typeof DogLookupError>;
 * ```
 */
export type HiggzErrorSchemaData<Schema extends AnySchema> =
  InferSchemaOutput<Schema> extends object ? InferSchemaOutput<Schema> : never;

/**
 * Maps an unknown thrown cause into a typed Higgz error.
 *
 * @example
 * ```ts
 * const mapCause = DatabaseError.with({ entity: "User" });
 * const error = mapCause(new Error("connection refused"));
 * ```
 */
export type HiggzErrorCauseMapper<ErrorShape> = (
  cause: unknown
) => ErrorShape;

/**
 * A concrete tagged error value created by a Higgz error factory.
 *
 * `cause` is stored beside `data` so payload schemas stay focused on domain
 * data while still preserving the underlying thrown value.
 *
 * @example
 * ```ts
 * const error = UserNotFound.new({ userId: "ada" });
 *
 * error.tag; // "UserNotFound"
 * error.data.userId;
 * ```
 */
export type HiggzTaggedError<
  Tag extends string = string,
  Data extends object = {}
> = Readonly<{
  tag: Tag;
  data: Readonly<Data>;
  cause?: unknown;
  [higgzErrorType]: HiggzErrorFactory<Tag, Data>;
}>;

export type HiggzErrorNewArgs<Data extends object> =
  keyof Data extends never
    ? [init?: { readonly cause?: unknown }]
    : [init: Data & { readonly cause?: unknown }];

export type HiggzErrorWithArgs<Data extends object> =
  keyof Data extends never ? [data?: Data] : [data: Data];

/**
 * A tagged error factory created by {@link higgzError}.
 *
 * Use `.new(...)` when you already know you want to fail, `.with(...)` when
 * mapping an unknown thrown cause through `attempt`, and `.is(...)` when
 * narrowing a result error.
 *
 * @example
 * ```ts
 * const UserNotFound = higgzError(
 *   "UserNotFound",
 *   z.object({ userId: z.string() })
 * );
 *
 * const error = UserNotFound.new({ userId: "ada" });
 *
 * if (UserNotFound.is(error)) {
 *   error.data.userId;
 * }
 * ```
 */
export interface HiggzErrorFactory<
  Tag extends string = string,
  Data extends object = {}
> {
  /**
   * Stable error tag.
   *
   * @example
   * ```ts
   * UserNotFound.tag; // "UserNotFound"
   * ```
   */
  readonly tag: Tag;
  /**
   * Create a tagged error value.
   *
   * `cause` is optional and stored outside `data`.
   *
   * @example
   * ```ts
   * return fail(UserNotFound.new({ userId: input.userId }));
   * ```
   */
  readonly new: (
    ...args: HiggzErrorNewArgs<Data>
  ) => HiggzTaggedError<Tag, Data>;
  /**
   * Create a mapper for `attempt(...)`.
   *
   * The returned function receives the unknown thrown cause and creates this
   * tagged error with that cause attached.
   *
   * @example
   * ```ts
   * const result = await attempt(
   *   () => deps.users.findById(input.userId),
   *   UsersServiceUnavailable.with({ operation: "users.findById" })
   * );
   * ```
   */
  readonly with: (
    ...args: HiggzErrorWithArgs<Data>
  ) => HiggzErrorCauseMapper<HiggzTaggedError<Tag, Data>>;
  /**
   * Narrow an unknown error to this specific tagged error.
   *
   * @example
   * ```ts
   * if (UserNotFound.is(result.error)) {
   *   result.error.data.userId;
   * }
   * ```
   */
  readonly is: (value: unknown) => value is HiggzTaggedError<Tag, Data>;
}

export function higgzError<const Tag extends string>(
  tag: Tag
): HiggzErrorFactory<Tag, {}>;
export function higgzError<
  const Tag extends string,
  Schema extends AnySchema
>(
  tag: Tag,
  schema: Schema
): HiggzErrorFactory<Tag, HiggzErrorSchemaData<Schema>>;
export function higgzError<Data extends object>(
  tag: string
): HiggzErrorFactory<string, Data>;
/**
 * Create a schema-backed tagged error factory.
 *
 * The schema validates the error data at runtime and provides the TypeScript
 * data type. `cause` is always allowed, but it is stored beside `data` instead
 * of being validated as part of the payload.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const DatabaseError = higgzError(
 *   "DatabaseError",
 *   z.object({ entity: z.string() })
 * );
 *
 * const error = DatabaseError.new({
 *   entity: "User",
 *   cause: new Error("connection refused")
 * });
 * ```
 *
 * @example
 * ```ts
 * const result = await attempt(
 *   () => users.findById("ada"),
 *   DatabaseError.with({ entity: "User" })
 * );
 * ```
 */
export function higgzError(
  tag: string,
  schema?: AnySchema
): any {
  const factory: HiggzErrorFactory<string, any> = {
    tag,
    new: (init?: { readonly cause?: unknown }) => {
      const source = init ?? {};
      const { cause, ...rawData } = source as Record<string, unknown>;
      const data = parseErrorData(schema, rawData);
      const error =
        cause === undefined
          ? { tag, data }
          : {
              tag,
              data,
              cause
            };

      Object.defineProperty(error, higgzErrorType, {
        enumerable: false,
        value: factory
      });

      return Object.freeze(error) as HiggzTaggedError<string, object>;
    },
    with: (data?: object) => {
      return (cause: unknown) =>
        factory.new({
          ...parseErrorData(schema, data ?? {}),
          cause
        });
    },
    is: (value: unknown): value is HiggzTaggedError<string, object> => {
      return (
        typeof value === "object" &&
        value !== null &&
        (value as { readonly [higgzErrorType]?: unknown })[higgzErrorType] ===
          factory
      );
    }
  };

  return factory;
}

function parseErrorData(schema: AnySchema | undefined, data: unknown): object {
  const parsed = parseSchemaSync(schema, data, "error");

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("BAD_ERROR_DATA", {
      message: "Higgz error data must be an object"
    });
  }

  return Object.freeze(parsed);
}

/**
 * Check whether a value was created by any Higgz error factory.
 *
 * Prefer a specific factory's `.is(...)` method when you want to narrow to one
 * error type.
 *
 * @example
 * ```ts
 * if (isHiggzError(error)) {
 *   console.log(error.tag, error.data);
 * }
 * ```
 */
export function isHiggzError(value: unknown): value is HiggzTaggedError {
  return (
    typeof value === "object" &&
    value !== null &&
    higgzErrorType in value
  );
}
