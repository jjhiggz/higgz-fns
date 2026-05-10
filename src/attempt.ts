import type { MaybePromise } from "./schema";

/**
 * A promise-like value or a function that creates one.
 *
 * Passing a function is usually better because `attempt` can catch both
 * synchronous throws and async rejections.
 *
 * @example
 * ```ts
 * const result = await attempt(
 *   () => users.findById("ada"),
 *   UsersServiceUnavailable.with({ operation: "users.findById" })
 * );
 * ```
 */
export type AttemptOperation<T> = PromiseLike<T> | (() => MaybePromise<T>);

/**
 * A small discriminated union for safe async work.
 *
 * @example
 * ```ts
 * const result = await attempt(() => readFile("dogs.json"));
 *
 * if (result.ok) {
 *   result.data;
 * } else {
 *   result.error;
 * }
 * ```
 */
export type AttemptResult<T, ErrorShape> =
  | { readonly ok: true; readonly data: T; readonly error: null }
  | { readonly ok: false; readonly data: null; readonly error: ErrorShape };

/**
 * The awaitable returned by `attempt`.
 *
 * It intentionally omits `.catch()` from the public type because `attempt`
 * already converts thrown and rejected errors into `{ ok: false }` results.
 */
export type AttemptPromise<T, ErrorShape> = Omit<
  Promise<AttemptResult<T, ErrorShape>>,
  "catch"
> & {
  /**
   * Use `const result = await attempt(...)` and inspect `result.ok`.
   * Calling `.catch()` defeats the result-style API.
   */
  readonly catch?: never;
};

/**
 * The handler-local `attempt` helper.
 *
 * Inside a result function, `AllowedError` is the function's declared error
 * union. That means `mapError` must return one of the declared errors.
 *
 * @example
 * ```ts
 * const dogsResult = await attempt(
 *   () => deps.dogs.findByOwnerId(input.userId),
 *   DogsServiceUnavailable.with({
 *     operation: "dogs.findByOwnerId",
 *     userId: input.userId
 *   })
 * );
 *
 * if (!dogsResult.ok) {
 *   return fail(dogsResult.error);
 * }
 * ```
 */
export type Attempt<AllowedError> = <T, ErrorShape extends AllowedError>(
  operation: AttemptOperation<T>,
  mapError: (cause: unknown) => ErrorShape
) => AttemptPromise<T, ErrorShape>;

/**
 * Convert a throwing or rejecting operation into a safe result.
 *
 * `attempt` does not guess what a thrown error means. Provide a mapper to
 * translate the unknown `cause` into a domain error your function declares.
 *
 * @example
 * ```ts
 * const result = await attempt(
 *   () => fakeCall({ returnVal: ["Byron"] }),
 *   DogsServiceUnavailable.with({
 *     operation: "dogs.findByOwnerId",
 *     userId: "ada"
 *   })
 * );
 *
 * if (!result.ok) {
 *   console.log(result.error.cause);
 * }
 * ```
 */
export function attempt<T>(
  operation: AttemptOperation<T>
): AttemptPromise<T, unknown>;
export function attempt<T, ErrorShape>(
  operation: AttemptOperation<T>,
  mapError: (cause: unknown) => ErrorShape
): AttemptPromise<T, ErrorShape>;
export function attempt<T, ErrorShape = unknown>(
  operation: AttemptOperation<T>,
  mapError: (cause: unknown) => ErrorShape = (cause) => cause as ErrorShape
): AttemptPromise<T, ErrorShape> {
  return (async () => {
    try {
      const data =
        typeof operation === "function" ? await operation() : await operation;

      return {
        ok: true,
        data,
        error: null
      };
    } catch (cause) {
      return {
        ok: false,
        data: null,
        error: mapError(cause)
      };
    }
  })() as AttemptPromise<T, ErrorShape>;
}

/**
 * Alias for {@link attempt}.
 *
 * @example
 * ```ts
 * const result = await safePromise(
 *   () => users.findById("ada"),
 *   UsersServiceUnavailable.with({ operation: "users.findById" })
 * );
 * ```
 */
export const safePromise = attempt;
