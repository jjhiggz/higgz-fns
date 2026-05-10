export interface Ok<T> {
  /** Always `true` for successful results. */
  readonly ok: true;
  /** The successful value. */
  readonly value: T;
  /**
   * Narrow this result to `Ok`.
   *
   * @example
   * ```ts
   * if (result.isOk()) {
   *   result.value;
   * }
   * ```
   */
  isOk(): this is Ok<T>;
  /**
   * Always false for `Ok`.
   *
   * @example
   * ```ts
   * if (result.isErr()) {
   *   result.error;
   * }
   * ```
   */
  isErr(): this is never;
  /**
   * Transform a successful value.
   *
   * @example
   * ```ts
   * const length = ok("Ada").map((name) => name.length);
   * ```
   */
  map<U>(fn: (value: T) => U): Ok<U>;
  /**
   * Leave an `Ok` unchanged while preserving chain symmetry with `Err`.
   *
   * @example
   * ```ts
   * const result = ok("Ada").mapErr(String);
   * ```
   */
  mapErr<F>(fn: (error: never) => F): Ok<T>;
  /**
   * Chain another result-producing operation.
   *
   * @example
   * ```ts
   * const result = ok("ada").andThen((id) => findUser(id));
   * ```
   */
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, F>;
  /**
   * Return the successful value.
   *
   * @example
   * ```ts
   * const value = ok(42).unwrap();
   * ```
   */
  unwrap(): T;
  /**
   * Throw because `Ok` has no error.
   *
   * @example
   * ```ts
   * ok(42).unwrapErr(); // throws
   * ```
   */
  unwrapErr(): never;
}

export interface Err<E> {
  /** Always `false` for failed results. */
  readonly ok: false;
  /** The failed error value. */
  readonly error: E;
  /**
   * Always false for `Err`.
   *
   * @example
   * ```ts
   * if (result.isOk()) {
   *   result.value;
   * }
   * ```
   */
  isOk(): this is never;
  /**
   * Narrow this result to `Err`.
   *
   * @example
   * ```ts
   * if (result.isErr()) {
   *   result.error;
   * }
   * ```
   */
  isErr(): this is Err<E>;
  /**
   * Leave an `Err` unchanged while preserving chain symmetry with `Ok`.
   *
   * @example
   * ```ts
   * const result = err("nope").map((value) => value.length);
   * ```
   */
  map<U>(fn: (value: never) => U): Err<E>;
  /**
   * Transform the error value.
   *
   * @example
   * ```ts
   * const result = err("nope").mapErr((message) => new Error(message));
   * ```
   */
  mapErr<F>(fn: (error: E) => F): Err<F>;
  /**
   * Leave an `Err` unchanged while preserving chain symmetry with `Ok`.
   *
   * @example
   * ```ts
   * const result = err("missing").andThen((value) => ok(value));
   * ```
   */
  andThen<U, F>(fn: (value: never) => Result<U, F>): Err<E>;
  /**
   * Throw the error value.
   *
   * @example
   * ```ts
   * err(new Error("nope")).unwrap(); // throws
   * ```
   */
  unwrap(): never;
  /**
   * Return the error value.
   *
   * @example
   * ```ts
   * const error = err("missing").unwrapErr();
   * ```
   */
  unwrapErr(): E;
}

/**
 * A success-or-failure value.
 *
 * @example
 * ```ts
 * const result: Result<number, string> = ok(42);
 *
 * if (result.ok) {
 *   result.value;
 * } else {
 *   result.error;
 * }
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>;

class OkImpl<T> implements Ok<T> {
  readonly ok = true;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T> {
    return true;
  }

  isErr(): this is never {
    return false;
  }

  map<U>(fn: (value: T) => U): Ok<U> {
    return ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: never) => F): Ok<T> {
    return this;
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapErr(): never {
    throw new Error("Tried to unwrapErr() an Ok result");
  }
}

class ErrImpl<E> implements Err<E> {
  readonly ok = false;

  constructor(readonly error: E) {}

  isOk(): this is never {
    return false;
  }

  isErr(): this is Err<E> {
    return true;
  }

  map<U>(_fn: (value: never) => U): Err<E> {
    return this;
  }

  mapErr<F>(fn: (error: E) => F): Err<F> {
    return err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: never) => Result<U, F>): Err<E> {
    return this;
  }

  unwrap(): never {
    throw this.error instanceof Error
      ? this.error
      : new Error("Tried to unwrap() an Err result");
  }

  unwrapErr(): E {
    return this.error;
  }
}

/**
 * Create a successful result.
 *
 * @example
 * ```ts
 * const result = ok({ id: "ada" });
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return new OkImpl(value);
}

/**
 * Create a failed result.
 *
 * @example
 * ```ts
 * const result = err(UserNotFound.new({ userId: "ada" }));
 * ```
 */
export function err<E>(error: E): Err<E> {
  return new ErrImpl(error);
}

/**
 * Check whether a result is successful.
 *
 * @example
 * ```ts
 * if (isOk(result)) {
 *   result.value;
 * }
 * ```
 */
export function isOk<T>(value: Result<T, unknown>): value is Ok<T> {
  return value.ok;
}

/**
 * Check whether a result is failed.
 *
 * @example
 * ```ts
 * if (isErr(result)) {
 *   result.error;
 * }
 * ```
 */
export function isErr<E>(value: Result<unknown, E>): value is Err<E> {
  return !value.ok;
}

/**
 * Check whether an unknown value looks like a Higgz result.
 *
 * @example
 * ```ts
 * if (isResult(value)) {
 *   value.ok;
 * }
 * ```
 */
export function isResult(value: unknown): value is Result<unknown, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean" &&
    (("value" in value && (value as { ok: boolean }).ok) ||
      ("error" in value && !(value as { ok: boolean }).ok))
  );
}
