export type ErrorCode = string;

/**
 * Options for {@link SuperFunctionError}.
 *
 * @example
 * ```ts
 * new SuperFunctionError("INTERNAL", "Unexpected failure", {
 *   data: { operation: "users.findById" },
 *   cause
 * });
 * ```
 */
export interface SuperFunctionErrorOptions<Data = unknown> {
  /** Structured error metadata. */
  data?: Data;
  /** Underlying thrown or rejected value. */
  cause?: unknown;
}

/**
 * Framework-level error used for validation, middleware, dependency, and
 * unexpected failures.
 *
 * Domain failures should usually be modeled with `higgzError(...)`; this class
 * is for the function system itself.
 *
 * @example
 * ```ts
 * throw new SuperFunctionError("MISSING_DEPENDENCY", "Missing users service", {
 *   data: { key: "users" }
 * });
 * ```
 */
export class SuperFunctionError<
  Code extends ErrorCode = ErrorCode,
  Data = unknown
> extends Error {
  /** Stable machine-readable error code. */
  readonly code: Code;
  /** Optional structured metadata. */
  readonly data: Data | undefined;
  /** Underlying thrown or rejected value. */
  override readonly cause: unknown;

  /**
   * Create a framework-level error.
   *
   * @example
   * ```ts
   * const error = new SuperFunctionError("INTERNAL", "Unexpected failure", {
   *   cause
   * });
   * ```
   */
  constructor(
    code: Code,
    message: string = code,
    options: SuperFunctionErrorOptions<Data> = {}
  ) {
    super(message);
    this.name = "SuperFunctionError";
    this.code = code;
    this.data = options.data;
    this.cause = options.cause;
  }
}

/**
 * Validation failure for input, output, or schema-backed error data.
 *
 * @example
 * ```ts
 * throw new ValidationError("BAD_INPUT", zodError);
 * ```
 */
export class ValidationError extends SuperFunctionError<
  "BAD_INPUT" | "BAD_OUTPUT" | "BAD_ERROR_DATA",
  { readonly issues: unknown }
> {
  /**
   * Create a validation error.
   *
   * @example
   * ```ts
   * const error = new ValidationError("BAD_OUTPUT", issues);
   * ```
   */
  constructor(
    code: "BAD_INPUT" | "BAD_OUTPUT" | "BAD_ERROR_DATA",
    issues: unknown,
    options: { cause?: unknown } = {}
  ) {
    const message =
      code === "BAD_INPUT"
        ? "Invalid input"
        : code === "BAD_OUTPUT"
          ? "Invalid output"
          : "Invalid error data";

    super(code, message, {
      data: { issues },
      cause: options.cause
    });
    this.name = "ValidationError";
  }
}

/**
 * Check whether a value is a {@link SuperFunctionError}.
 *
 * @example
 * ```ts
 * if (isSuperFunctionError(error)) {
 *   console.log(error.code);
 * }
 * ```
 */
export function isSuperFunctionError(value: unknown): value is SuperFunctionError {
  return value instanceof SuperFunctionError;
}

/**
 * Normalize an unknown thrown value into a {@link SuperFunctionError}.
 *
 * @example
 * ```ts
 * const error = toSuperFunctionError(cause);
 * ```
 */
export function toSuperFunctionError(value: unknown): SuperFunctionError {
  if (isSuperFunctionError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return new SuperFunctionError("INTERNAL", value.message, { cause: value });
  }

  return new SuperFunctionError("INTERNAL", "Unknown error", { cause: value });
}
