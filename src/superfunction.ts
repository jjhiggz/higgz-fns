import {
  SuperFunctionError,
  toSuperFunctionError
} from "./errors";
import { err, isResult, ok, type Err, type Result } from "./result";
import {
  parseSchema,
  type AnySchema,
  type InferSchemaOutput,
  type MaybePromise
} from "./schema";

export type { AnySchema, InferSchemaInput, InferSchemaOutput } from "./schema";

/**
 * Options accepted by legacy superfunction calls.
 *
 * @example
 * ```ts
 * await whoami(undefined, {
 *   context: { userId: "user_123" }
 * });
 * ```
 */
export interface SuperFunctionCallOptions<Context> {
  /** Optional context available as `ctx.context` in handlers. */
  readonly context?: Context;
  /** Optional abort signal available as `ctx.signal` in handlers. */
  readonly signal?: AbortSignal;
}

/**
 * Handler context for the legacy superfunction API.
 *
 * @example
 * ```ts
 * superfunction.handler(({ input, context }) => {
 *   return { input, context };
 * });
 * ```
 */
export interface HandlerContext<Input, Context> {
  /** Parsed input value. */
  readonly input: Input;
  /** Caller-supplied context. */
  readonly context: Context;
  /** Caller-supplied abort signal. */
  readonly signal?: AbortSignal;
}

/**
 * Middleware for the legacy superfunction API.
 *
 * @example
 * ```ts
 * superfunction
 *   .use(async (ctx, next) => {
 *     console.log("before");
 *     const result = await next();
 *     console.log("after");
 *     return result;
 *   })
 *   .handler(() => "done");
 * ```
 */
export type Middleware<Context, Input, Output> = (
  ctx: HandlerContext<Input, Context>,
  next: () => Promise<Output>
) => MaybePromise<Output>;

type Handler<Context, Input, Output, ErrorShape> = (
  ctx: HandlerContext<Input, Context>
) => MaybePromise<Output | Result<Output, ErrorShape>>;

export interface SuperFunction<Input, Output, Context, ErrorShape> {
  /**
   * Execute and throw on failure.
   *
   * @example
   * ```ts
   * const value = await addOne(1);
   * ```
   */
  (input: Input, options?: SuperFunctionCallOptions<Context>): Promise<Output>;
  /**
   * Execute and always return a `Result`.
   *
   * @example
   * ```ts
   * const result = await addOne.safe(1);
   * ```
   */
  readonly safe: (
    input: Input,
    options?: SuperFunctionCallOptions<Context>
  ) => Promise<Result<Output, ErrorShape | SuperFunctionError>>;
  /**
   * Execute and throw on failure.
   *
   * @example
   * ```ts
   * const value = await addOne.unsafe(1);
   * ```
   */
  readonly unsafe: (
    input: Input,
    options?: SuperFunctionCallOptions<Context>
  ) => Promise<Output>;
  /**
   * Return a callable result-mode view of this function.
   *
   * @example
   * ```ts
   * const resultFn = addOne.result();
   * const result = await resultFn(1);
   * ```
   */
  readonly result: () => ResultSuperFunction<Input, Output, Context, ErrorShape>;
}

export interface ResultSuperFunction<Input, Output, Context, ErrorShape> {
  /**
   * Execute and return a `Result`.
   *
   * @example
   * ```ts
   * const result = await divide({ numerator: 10, denominator: 2 });
   * ```
   */
  (
    input: Input,
    options?: SuperFunctionCallOptions<Context>
  ): Promise<Result<Output, ErrorShape | SuperFunctionError>>;
  /**
   * Execute and return a `Result`.
   *
   * @example
   * ```ts
   * const result = await divide.safe({ numerator: 10, denominator: 2 });
   * ```
   */
  readonly safe: (
    input: Input,
    options?: SuperFunctionCallOptions<Context>
  ) => Promise<Result<Output, ErrorShape | SuperFunctionError>>;
  /**
   * Execute and unwrap the output, throwing on failure.
   *
   * @example
   * ```ts
   * const value = await divide.unsafe({ numerator: 10, denominator: 2 });
   * ```
   */
  readonly unsafe: (
    input: Input,
    options?: SuperFunctionCallOptions<Context>
  ) => Promise<Output>;
}

export interface SuperFunctionBuilder<
  Context,
  Input,
  Output,
  ErrorShape,
  ResultMode extends boolean
> {
  /**
   * Set and validate the input schema.
   *
   * @example
   * ```ts
   * superfunction.input((value: number) => value);
   * ```
   */
  input<Schema extends AnySchema>(
    schema: Schema
  ): SuperFunctionBuilder<
    Context,
    InferSchemaOutput<Schema>,
    Output,
    ErrorShape,
    ResultMode
  >;
  /**
   * Set and validate the output schema.
   *
   * @example
   * ```ts
   * superfunction.output((value: string) => value);
   * ```
   */
  output<Schema extends AnySchema>(
    schema: Schema
  ): SuperFunctionBuilder<
    Context,
    Input,
    InferSchemaOutput<Schema>,
    ErrorShape,
    ResultMode
  >;
  /**
   * Add middleware around execution.
   *
   * @example
   * ```ts
   * superfunction.use(async (ctx, next) => next());
   * ```
   */
  use(
    middleware: Middleware<
      Context,
      Input,
      Result<Output, ErrorShape | SuperFunctionError>
    >
  ): SuperFunctionBuilder<Context, Input, Output, ErrorShape, ResultMode>;
  /**
   * Set the typed error shape for result-mode handlers.
   *
   * @example
   * ```ts
   * superfunction.result().errors<MyError>().handler(() => err(error));
   * ```
   */
  errors<NextErrorShape>(): SuperFunctionBuilder<
    Context,
    Input,
    Output,
    NextErrorShape,
    ResultMode
  >;
  /**
   * Switch the builder into result-call mode.
   *
   * @example
   * ```ts
   * const divide = superfunction.result().handler(() => ok(1));
   * ```
   */
  result(): SuperFunctionBuilder<Context, Input, Output, ErrorShape, true>;
  /**
   * Switch the builder into throwing-call mode.
   *
   * @example
   * ```ts
   * const addOne = superfunction.throws().handler(({ input }) => input + 1);
   * ```
   */
  throws(): SuperFunctionBuilder<Context, Input, Output, ErrorShape, false>;
  /**
   * Finish the builder with a handler implementation.
   *
   * @example
   * ```ts
   * const addOne = superfunction
   *   .input((value: number) => value)
   *   .handler(({ input }) => input + 1);
   * ```
   */
  handler<HandlerOutput>(
    handler: Handler<Context, Input, HandlerOutput, ErrorShape>
  ): ResultMode extends true
    ? ResultSuperFunction<Input, HandlerOutput, Context, ErrorShape>
    : SuperFunction<Input, HandlerOutput, Context, ErrorShape>;
}

interface BuilderState<Context, Input, Output, ErrorShape> {
  inputSchema?: AnySchema;
  outputSchema?: AnySchema;
  middlewares: Middleware<Context, any, any>[];
  resultMode: boolean;
  mapUnknownError: (error: unknown) => SuperFunctionError;
}

/**
 * Options for creating a legacy superfunction builder.
 *
 * @example
 * ```ts
 * const builder = createSuperFunction({
 *   mapUnknownError: toSuperFunctionError
 * });
 * ```
 */
export interface CreateSuperFunctionOptions {
  /** Whether returned callables should default to result mode. */
  readonly resultMode?: boolean;
  /** Convert unknown thrown values into framework errors. */
  readonly mapUnknownError?: (error: unknown) => SuperFunctionError;
}

/**
 * Create a legacy superfunction builder.
 *
 * The newer API is `higgz.resultFunction()` / `higgz.function()`, but this
 * builder remains available for the original transport-agnostic API.
 *
 * @example
 * ```ts
 * const authed = createSuperFunction<{ userId: string }>();
 *
 * const whoami = authed.handler(({ context }) => context.userId);
 * ```
 */
export function createSuperFunction<Context = undefined>(
  options: CreateSuperFunctionOptions = {}
): SuperFunctionBuilder<Context, unknown, unknown, SuperFunctionError, false> {
  return createBuilder({
    middlewares: [],
    resultMode: options.resultMode ?? false,
    mapUnknownError: options.mapUnknownError ?? toSuperFunctionError
  });
}

/**
 * Ready-to-use legacy superfunction builder.
 *
 * @example
 * ```ts
 * const addOne = superfunction
 *   .input((value: number) => value)
 *   .handler(({ input }) => input + 1);
 * ```
 */
export const superfunction = createSuperFunction();

function createBuilder<
  Context,
  Input,
  Output,
  ErrorShape,
  ResultMode extends boolean = false
>(
  state: BuilderState<Context, Input, Output, ErrorShape>
): SuperFunctionBuilder<Context, Input, Output, ErrorShape, ResultMode> {
  return {
    input(schema) {
      return createBuilder<
        Context,
        InferSchemaOutput<typeof schema>,
        Output,
        ErrorShape,
        ResultMode
      >(
        { ...state, inputSchema: schema } as BuilderState<
          Context,
          InferSchemaOutput<typeof schema>,
          Output,
          ErrorShape
        >
      );
    },
    output(schema) {
      return createBuilder<
        Context,
        Input,
        InferSchemaOutput<typeof schema>,
        ErrorShape,
        ResultMode
      >(
        { ...state, outputSchema: schema } as BuilderState<
          Context,
          Input,
          InferSchemaOutput<typeof schema>,
          ErrorShape
        >
      );
    },
    use(middleware) {
      return createBuilder<Context, Input, Output, ErrorShape, ResultMode>({
        ...state,
        middlewares: [...state.middlewares, middleware]
      });
    },
    errors<NextErrorShape>() {
      return createBuilder<Context, Input, Output, NextErrorShape, ResultMode>(
        state as unknown as BuilderState<Context, Input, Output, NextErrorShape>
      );
    },
    result() {
      return createBuilder<Context, Input, Output, ErrorShape, true>({
        ...state,
        resultMode: true
      });
    },
    throws() {
      return createBuilder<Context, Input, Output, ErrorShape, false>({
        ...state,
        resultMode: false
      });
    },
    handler<HandlerOutput>(handler: Handler<Context, Input, HandlerOutput, ErrorShape>) {
      const fn = createCallable(
        state as unknown as BuilderState<Context, Input, HandlerOutput, ErrorShape>,
        handler
      );
      return (state.resultMode ? fn.result() : fn) as never;
    }
  };
}

function createCallable<Context, Input, Output, ErrorShape>(
  state: BuilderState<Context, Input, Output, ErrorShape>,
  handler: Handler<Context, Input, Output, ErrorShape>
): SuperFunction<Input, Output, Context, ErrorShape> {
  const unsafe = async (
    input: Input,
    options: SuperFunctionCallOptions<Context> = {}
  ): Promise<Output> => {
    const result = await safe(input, options);
    if (result.ok) {
      return result.value;
    }

    throw normalizeErr(result);
  };

  const safe = async (
    rawInput: Input,
    options: SuperFunctionCallOptions<Context> = {}
  ): Promise<Result<Output, ErrorShape | SuperFunctionError>> => {
    try {
      const input = await parseSchema(state.inputSchema, rawInput, "input");
      const ctx = {
        input: input as Input,
        context: options.context as Context,
        ...(options.signal === undefined ? {} : { signal: options.signal })
      } satisfies HandlerContext<Input, Context>;

      const runHandler = async () => {
        const handled = await handler(ctx);
        if (isResult(handled)) {
          return handled;
        }

        return ok(handled);
      };

      const outputResult = await composeMiddlewares(
        state.middlewares,
        ctx,
        runHandler
      );

      if (!outputResult.ok) {
        return outputResult;
      }

      const output = await parseSchema(
        state.outputSchema,
        outputResult.value,
        "output"
      );
      return ok(output as Output);
    } catch (error) {
      return err(state.mapUnknownError(error));
    }
  };

  const result = () => {
    const resultFn = (async (input, options) =>
      safe(input, options)) as ResultSuperFunction<
      Input,
      Output,
      Context,
      ErrorShape
    >;
    Object.defineProperties(resultFn, {
      safe: { value: safe },
      unsafe: { value: unsafe }
    });
    return resultFn;
  };

  const fn = (async (input, options) => unsafe(input, options)) as SuperFunction<
    Input,
    Output,
    Context,
    ErrorShape
  >;
  Object.defineProperties(fn, {
    safe: { value: safe },
    unsafe: { value: unsafe },
    result: { value: result }
  });

  return fn;
}

async function composeMiddlewares<Context, Input, Output, ErrorShape>(
  middlewares: Middleware<
    Context,
    Input,
    Result<Output, ErrorShape | SuperFunctionError>
  >[],
  ctx: HandlerContext<Input, Context>,
  last: () => Promise<Result<Output, ErrorShape | SuperFunctionError>>
): Promise<Result<Output, ErrorShape | SuperFunctionError>> {
  let index = -1;

  const dispatch = async (position: number): Promise<Result<Output, ErrorShape | SuperFunctionError>> => {
    if (position <= index) {
      throw new SuperFunctionError("MIDDLEWARE_REENTRY", "next() called multiple times");
    }

    index = position;
    const middleware = middlewares[position];

    if (!middleware) {
      return last();
    }

    return middleware(ctx, () => dispatch(position + 1));
  };

  return dispatch(0);
}

function normalizeErr<ErrorShape>(
  result: Err<ErrorShape | SuperFunctionError>
): Error {
  const error = result.error;
  if (error instanceof Error) {
    return error;
  }

  return new SuperFunctionError("ERR", "Superfunction returned an Err result", {
    data: error
  });
}
