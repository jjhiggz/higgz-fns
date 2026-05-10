import { SuperFunctionError, toSuperFunctionError } from "./errors";
import {
  type HiggzErrorFactory,
  type HiggzTaggedError
} from "./higgz-error";
import {
  resolveHiggzDeps,
  type HiggzDepsDeclaration,
  type HiggzDepsInput,
  type ResolveHiggzDeps
} from "./higgz-service";
import { attempt as baseAttempt, type Attempt } from "./attempt";
import { err, isResult, ok, type Result } from "./result";
import {
  parseSchema,
  type AnySchema,
  type InferSchemaOutput,
  type MaybePromise
} from "./schema";

type AnyErrorFactory = HiggzErrorFactory<string, any>;
type EmptyDeps = Record<string, never>;
type EmptyErrors = readonly [];

/**
 * Infer the concrete tagged error value created by a Higgz error factory.
 *
 * @example
 * ```ts
 * type UserNotFoundValue = HiggzErrorFromFactory<typeof UserNotFound>;
 * ```
 */
export type HiggzErrorFromFactory<Factory> =
  Factory extends HiggzErrorFactory<infer Tag, infer Data>
    ? HiggzTaggedError<Tag, Data>
    : never;

/**
 * Infer the union of tagged error values created by a tuple of error factories.
 *
 * @example
 * ```ts
 * type FindUsersDogsErrors = HiggzErrorUnion<
 *   [typeof UserNotFound, typeof DogsServiceUnavailable]
 * >;
 * ```
 */
export type HiggzErrorUnion<
  Factories extends readonly AnyErrorFactory[]
> = HiggzErrorFromFactory<Factories[number]>;

/**
 * Options accepted by `.run(...)`, `.safe(...)`, and `.unsafe(...)`.
 *
 * When a function declares dependencies with `.deps(...)`, `deps` is required
 * and may contain either raw service implementations or tagged service
 * instances.
 *
 * @example
 * ```ts
 * await findUsersDogs.run(
 *   { userId: "ada" },
 *   {
 *     deps: {
 *       users: UsersService.new(usersService),
 *       dogs: DogsService.new(dogsService)
 *     }
 *   }
 * );
 * ```
 */
export type HiggzRunOptions<
  Deps extends HiggzDepsDeclaration,
  Context
> = {
  readonly context?: Context;
  readonly signal?: AbortSignal;
} & (keyof Deps extends never
  ? { readonly deps?: HiggzDepsInput<Deps> }
  : { readonly deps: HiggzDepsInput<Deps> });

export interface HiggzBaseContext<
  Name extends string,
  Input,
  Deps,
  Context
> {
  /**
   * The function name configured with `.name(...)`.
   *
   * @example
   * ```ts
   * .use(async ({ name }, next) => {
   *   console.log(`running ${name}`);
   *   return next();
   * })
   * ```
   */
  readonly name: Name;
  /**
   * The parsed input value.
   *
   * This type comes from the schema passed to `.input(...)`.
   *
   * @example
   * ```ts
   * .input(z.object({ userId: z.string() }))
   * .fn(({ input }) => {
   *   input.userId;
   * })
   * ```
   */
  readonly input: Input;
  /**
   * Resolved dependency implementations.
   *
   * This type comes from the service factories passed to `.deps(...)`.
   *
   * @example
   * ```ts
   * .deps({ users: UsersService })
   * .fn(({ deps }) => deps.users.findById("ada"))
   * ```
   */
  readonly deps: Deps;
  /**
   * Optional user context passed through `.run(input, { context })`.
   *
   * @example
   * ```ts
   * const authed = createHiggzResultFunction<{ requestId: string }>();
   *
   * authed.fn(({ context }) => {
   *   context.requestId;
   * });
   * ```
   */
  readonly context: Context;
  /**
   * Optional abort signal passed through `.run(input, { signal })`.
   *
   * @example
   * ```ts
   * .fn(({ signal }) => fetch(url, { signal }))
   * ```
   */
  readonly signal?: AbortSignal;
}

/**
 * Context passed to result-function handlers.
 *
 * `fail` and `succeed` are typed from the builder's declared errors and output
 * schema. `attempt` maps thrown or rejected work into one of the declared
 * errors.
 *
 * @example
 * ```ts
 * .fn(async ({ input, deps, attempt, fail, succeed }) => {
 *   const user = await attempt(
 *     () => deps.users.findById(input.userId),
 *     UsersServiceUnavailable.with({ operation: "users.findById" })
 *   );
 *
 *   if (!user.ok) return fail(user.error);
 *   if (!user.data) return fail(UserNotFound.new({ userId: input.userId }));
 *
 *   return succeed(user.data);
 * })
 * ```
 */
export interface HiggzResultHandlerContext<
  Name extends string,
  Input,
  Output,
  Deps,
  ErrorShape,
  Context
> extends HiggzBaseContext<Name, Input, Deps, Context> {
  /**
   * Run a throwing or rejecting operation and map failures into declared errors.
   *
   * Prefer passing a function so `attempt` can catch both synchronous throws and
   * promise rejections. The mapper must return one of the errors declared with
   * `.errors(...)`.
   *
   * @example
   * ```ts
   * const userResult = await attempt(
   *   () => deps.users.findById(input.userId),
   *   UsersServiceUnavailable.with({
   *     operation: "users.findById"
   *   })
   * );
   *
   * if (!userResult.ok) {
   *   return fail(userResult.error);
   * }
   * ```
   */
  readonly attempt: Attempt<ErrorShape>;
  /**
   * Return a declared domain error from the function.
   *
   * `fail` only accepts errors declared earlier with `.errors(...)`.
   *
   * @example
   * ```ts
   * if (!user) {
   *   return fail(UserNotFound.new({ userId: input.userId }));
   * }
   * ```
   */
  readonly fail: <ErrorValue extends ErrorShape>(
    error: ErrorValue
  ) => Result<Output, ErrorValue>;
  /**
   * Return a successful output from the function.
   *
   * `succeed` only accepts the type produced by the schema passed to
   * `.output(...)`.
   *
   * @example
   * ```ts
   * return succeed({
   *   user,
   *   dogs
   * });
   * ```
   */
  readonly succeed: (value: Output) => Result<Output, never>;
}

export interface HiggzHandlerContext<
  Name extends string,
  Input,
  Deps,
  Context
> extends HiggzBaseContext<Name, Input, Deps, Context> {
  /**
   * Run a throwing or rejecting operation and turn it into an `AttemptResult`.
   *
   * In throwing functions this helper is not narrowed to declared errors,
   * because throwing functions do not declare a domain error vocabulary.
   *
   * @example
   * ```ts
   * const result = await attempt(
   *   () => deps.users.findById(input.userId),
   *   (cause) => new Error("User lookup failed", { cause })
   * );
   * ```
   */
  readonly attempt: typeof baseAttempt;
}

/**
 * Handler for result-returning Higgz functions.
 *
 * @example
 * ```ts
 * const handler: HiggzResultHandler<
 *   "findUser",
 *   { userId: string },
 *   User,
 *   { users: UsersServiceShape },
 *   Higgz.inferError<typeof UserNotFound>,
 *   undefined
 * > = async ({ fail }) => fail(UserNotFound.new({ userId: "ada" }));
 * ```
 */
export type HiggzResultHandler<
  Name extends string,
  Input,
  Output,
  Deps,
  ErrorShape,
  Context
> = (
  ctx: HiggzResultHandlerContext<
    Name,
    Input,
    Output,
    Deps,
    ErrorShape,
    Context
  >
) => MaybePromise<Result<Output, ErrorShape>>;

/**
 * Handler for throwing Higgz functions.
 *
 * @example
 * ```ts
 * const handler: HiggzHandler<"double", number, number, {}, undefined> =
 *   ({ input }) => input * 2;
 * ```
 */
export type HiggzHandler<
  Name extends string,
  Input,
  Output,
  Deps,
  Context
> = (
  ctx: HiggzHandlerContext<Name, Input, Deps, Context>
) => MaybePromise<Output>;

/**
 * Middleware for result-returning Higgz functions.
 *
 * @example
 * ```ts
 * const logTiming: HiggzResultMiddleware<any, any, any, any, any, any> =
 *   async ({ name }, next) => {
 *     console.time(name);
 *     const result = await next();
 *     console.timeEnd(name);
 *     return result;
 *   };
 * ```
 */
export type HiggzResultMiddleware<
  Name extends string,
  Input,
  Output,
  Deps,
  ErrorShape,
  Context
> = (
  ctx: HiggzResultHandlerContext<
    Name,
    Input,
    Output,
    Deps,
    ErrorShape,
    Context
  >,
  next: () => Promise<Result<Output, ErrorShape | SuperFunctionError>>
) => MaybePromise<Result<Output, ErrorShape | SuperFunctionError>>;

/**
 * Middleware for throwing Higgz functions.
 *
 * @example
 * ```ts
 * const logTiming: HiggzMiddleware<any, any, any, any, any> =
 *   async ({ name }, next) => {
 *     console.time(name);
 *     const output = await next();
 *     console.timeEnd(name);
 *     return output;
 *   };
 * ```
 */
export type HiggzMiddleware<
  Name extends string,
  Input,
  Output,
  Deps,
  Context
> = (
  ctx: HiggzHandlerContext<Name, Input, Deps, Context>,
  next: () => Promise<Output>
) => MaybePromise<Output>;

/**
 * A result-returning Higgz function.
 *
 * `run` and `safe` return `Result<Output, DeclaredErrors | SuperFunctionError>`.
 * `unsafe` unwraps successful values and throws failed values.
 *
 * @example
 * ```ts
 * const result = await findUsersDogs.run({ userId: "ada" }, { deps });
 *
 * if (result.ok) {
 *   result.value.dogs;
 * } else if (UserNotFound.is(result.error)) {
 *   result.error.data.userId;
 * }
 * ```
 */
export interface HiggzResultFunction<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  ErrorShape,
  Context
> {
  readonly name: Name;
  /**
   * Execute the function and return a typed result.
   *
   * @example
   * ```ts
   * const result = await findUsersDogs.run({ userId: "ada" }, { deps });
   *
   * if (result.ok) {
   *   console.log(result.value.dogs);
   * }
   * ```
   */
  readonly run: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Result<Output, ErrorShape | SuperFunctionError>>;
  /**
   * Alias for {@link HiggzResultFunction.run}.
   *
   * @example
   * ```ts
   * const result = await findUsersDogs.safe({ userId: "ada" }, { deps });
   * ```
   */
  readonly safe: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Result<Output, ErrorShape | SuperFunctionError>>;
  /**
   * Execute the function and unwrap the output.
   *
   * Failed results are thrown. Prefer `.run(...)` or `.safe(...)` when you want
   * to handle declared domain errors as values.
   *
   * @example
   * ```ts
   * const value = await findUsersDogs.unsafe({ userId: "ada" }, { deps });
   * ```
   */
  readonly unsafe: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Output>;
}

/**
 * A throwing Higgz function.
 *
 * Use this flavor when failures should throw rather than become declared
 * domain errors.
 *
 * @example
 * ```ts
 * const double = higgz
 *   .function()
 *   .input(z.number())
 *   .output(z.number())
 *   .fn(({ input }) => input * 2);
 *
 * await double.run(21); // 42
 * ```
 */
export interface HiggzFunction<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  Context
> {
  readonly name: Name;
  /**
   * Execute the function and return the output.
   *
   * Validation failures and thrown handler errors reject the promise.
   *
   * @example
   * ```ts
   * const value = await double.run(21);
   * ```
   */
  readonly run: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Output>;
  /**
   * Execute the function and capture thrown framework errors as a result.
   *
   * @example
   * ```ts
   * const result = await double.safe(21);
   * ```
   */
  readonly safe: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Result<Output, SuperFunctionError>>;
  /**
   * Alias for {@link HiggzFunction.run}.
   *
   * @example
   * ```ts
   * const value = await double.unsafe(21);
   * ```
   */
  readonly unsafe: (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ) => Promise<Output>;
}

/**
 * Builder for schema-backed, dependency-aware result functions.
 *
 * The builder accumulates input, output, dependencies, and declared errors.
 * The final `.fn(...)` handler receives narrowed helpers for `attempt`, `fail`,
 * and `succeed`.
 *
 * @example
 * ```ts
 * const findUsersDogs = higgz
 *   .resultFunction()
 *   .name("findUsersDogs")
 *   .deps({ users: UsersService, dogs: DogsService })
 *   .input(FindUsersDogsInput)
 *   .output(FindUsersDogsOutput)
 *   .errors([UserNotFound, DogsServiceUnavailable])
 *   .fn(async ({ input, deps, attempt, fail, succeed }) => {
 *     // ...
 *   });
 * ```
 */
export interface HiggzResultFunctionBuilder<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  ErrorFactories extends readonly AnyErrorFactory[],
  Context
> {
  /**
   * Set the function name used in metadata and middleware context.
   *
   * @example
   * ```ts
   * higgz.resultFunction().name("findUsersDogs");
   * ```
   */
  name<NextName extends string>(
    name: NextName
  ): HiggzResultFunctionBuilder<
    NextName,
    Input,
    Output,
    Deps,
    ErrorFactories,
    Context
  >;
  /**
   * Set and validate the input schema.
   *
   * @example
   * ```ts
   * .input(z.object({ userId: z.string() }))
   * ```
   */
  input<Schema extends AnySchema>(
    schema: Schema
  ): HiggzResultFunctionBuilder<
    Name,
    InferSchemaOutput<Schema>,
    Output,
    Deps,
    ErrorFactories,
    Context
  >;
  /**
   * Set and validate the output schema.
   *
   * @example
   * ```ts
   * .output(z.object({ dogs: z.array(DogSchema) }))
   * ```
   */
  output<Schema extends AnySchema>(
    schema: Schema
  ): HiggzResultFunctionBuilder<
    Name,
    Input,
    InferSchemaOutput<Schema>,
    Deps,
    ErrorFactories,
    Context
  >;
  /**
   * Declare services the handler receives as `ctx.deps`.
   *
   * @example
   * ```ts
   * .deps({ users: UsersService, dogs: DogsService })
   * ```
   */
  deps<NextDeps extends HiggzDepsDeclaration>(
    deps: NextDeps
  ): HiggzResultFunctionBuilder<
    Name,
    Input,
    Output,
    Deps & NextDeps,
    ErrorFactories,
    Context
  >;
  /**
   * Declare every domain error the function may return.
   *
   * `fail(...)` and handler-local `attempt(...)` are narrowed to this union.
   *
   * @example
   * ```ts
   * .errors([UserNotFound, DogsServiceUnavailable])
   * ```
   */
  errors<const NextErrors extends readonly AnyErrorFactory[]>(
    errors: NextErrors
  ): HiggzResultFunctionBuilder<
    Name,
    Input,
    Output,
    Deps,
    readonly [...ErrorFactories, ...NextErrors],
    Context
  >;
  /**
   * Add result middleware around the handler.
   *
   * Middleware may call `next()` more than once, which enables retry-style
   * middleware.
   *
   * @example
   * ```ts
   * .use(retryTransient(2))
   * ```
   */
  use(
    middleware: HiggzResultMiddleware<
      Name,
      Input,
      Output,
      ResolveHiggzDeps<Deps>,
      HiggzErrorUnion<ErrorFactories>,
      Context
    >
  ): HiggzResultFunctionBuilder<
    Name,
    Input,
    Output,
    Deps,
    ErrorFactories,
    Context
  >;
  /**
   * Finish the builder with the implementation.
   *
   * @example
   * ```ts
   * .fn(async ({ input, deps, attempt, fail, succeed }) => {
   *   const dogs = await attempt(
   *     () => deps.dogs.findByOwnerId(input.userId),
   *     DogsServiceUnavailable.with({
   *       operation: "dogs.findByOwnerId",
   *       userId: input.userId
   *     })
   *   );
   *
   *   if (!dogs.ok) return fail(dogs.error);
   *   return succeed({ dogs: dogs.data });
   * })
   * ```
   */
  fn(
    handler: HiggzResultHandler<
      Name,
      Input,
      Output,
      ResolveHiggzDeps<Deps>,
      HiggzErrorUnion<ErrorFactories>,
      Context
    >
  ): HiggzResultFunction<
    Name,
    Input,
    Output,
    Deps,
    HiggzErrorUnion<ErrorFactories>,
    Context
  >;
}

/**
 * Builder for throwing Higgz functions.
 *
 * This has the same schema, dependency, and middleware shape as result
 * functions, but the handler returns an output value directly and `.run(...)`
 * rejects on validation or thrown errors.
 *
 * @example
 * ```ts
 * const greet = higgz
 *   .function()
 *   .input(z.object({ name: z.string() }))
 *   .output(z.string())
 *   .fn(({ input }) => `Hello, ${input.name}`);
 * ```
 */
export interface HiggzFunctionBuilder<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  Context
> {
  /**
   * Set the function name used in metadata and middleware context.
   *
   * @example
   * ```ts
   * higgz.function().name("double");
   * ```
   */
  name<NextName extends string>(
    name: NextName
  ): HiggzFunctionBuilder<NextName, Input, Output, Deps, Context>;
  /**
   * Set and validate the input schema.
   *
   * @example
   * ```ts
   * .input(z.number())
   * ```
   */
  input<Schema extends AnySchema>(
    schema: Schema
  ): HiggzFunctionBuilder<
    Name,
    InferSchemaOutput<Schema>,
    Output,
    Deps,
    Context
  >;
  /**
   * Set and validate the output schema.
   *
   * @example
   * ```ts
   * .output(z.number())
   * ```
   */
  output<Schema extends AnySchema>(
    schema: Schema
  ): HiggzFunctionBuilder<
    Name,
    Input,
    InferSchemaOutput<Schema>,
    Deps,
    Context
  >;
  /**
   * Declare services the handler receives as `ctx.deps`.
   *
   * @example
   * ```ts
   * .deps({ users: UsersService })
   * ```
   */
  deps<NextDeps extends HiggzDepsDeclaration>(
    deps: NextDeps
  ): HiggzFunctionBuilder<Name, Input, Output, Deps & NextDeps, Context>;
  /**
   * Add middleware around execution.
   *
   * @example
   * ```ts
   * .use(async (ctx, next) => next())
   * ```
   */
  use(
    middleware: HiggzMiddleware<
      Name,
      Input,
      Output,
      ResolveHiggzDeps<Deps>,
      Context
    >
  ): HiggzFunctionBuilder<Name, Input, Output, Deps, Context>;
  /**
   * Finish the builder with the implementation.
   *
   * @example
   * ```ts
   * .fn(({ input }) => input * 2)
   * ```
   */
  fn(
    handler: HiggzHandler<Name, Input, Output, ResolveHiggzDeps<Deps>, Context>
  ): HiggzFunction<Name, Input, Output, Deps, Context>;
}

interface ResultBuilderState<
  Name extends string,
  Deps extends HiggzDepsDeclaration,
  ErrorFactories extends readonly AnyErrorFactory[],
  Context
> {
  readonly name: Name;
  readonly inputSchema?: AnySchema;
  readonly outputSchema?: AnySchema;
  readonly deps: Deps;
  readonly errors: ErrorFactories;
  readonly middlewares: HiggzResultMiddleware<
    Name,
    any,
    any,
    any,
    any,
    Context
  >[];
  readonly mapUnknownError: (error: unknown) => SuperFunctionError;
}

interface FunctionBuilderState<
  Name extends string,
  Deps extends HiggzDepsDeclaration,
  Context
> {
  readonly name: Name;
  readonly inputSchema?: AnySchema;
  readonly outputSchema?: AnySchema;
  readonly deps: Deps;
  readonly middlewares: HiggzMiddleware<Name, any, any, any, Context>[];
  readonly mapUnknownError: (error: unknown) => SuperFunctionError;
}

export interface CreateHiggzFunctionOptions {
  /**
   * Convert unknown thrown values into framework errors.
   *
   * @example
   * ```ts
   * createHiggzFunction({
   *   mapUnknownError: (cause) => new SuperFunctionError("INTERNAL", "Oops", { cause })
   * });
   * ```
   */
  readonly mapUnknownError?: (error: unknown) => SuperFunctionError;
}

/**
 * Create a fresh result-function builder.
 *
 * Use this when you need a custom context type or unknown-error mapper. Most
 * callers can use `higgz.resultFunction()` instead.
 *
 * @example
 * ```ts
 * const authed = createHiggzResultFunction<{ requestId: string }>();
 *
 * const fn = authed
 *   .input(z.object({ userId: z.string() }))
 *   .output(z.object({ ok: z.boolean() }))
 *   .errors([])
 *   .fn(({ context, succeed }) => succeed({ ok: Boolean(context.requestId) }));
 * ```
 */
export function createHiggzResultFunction<Context = undefined>(
  options: CreateHiggzFunctionOptions = {}
): HiggzResultFunctionBuilder<
  "anonymous",
  unknown,
  unknown,
  EmptyDeps,
  EmptyErrors,
  Context
> {
  return createResultBuilder({
    name: "anonymous",
    deps: {},
    errors: [],
    middlewares: [],
    mapUnknownError: options.mapUnknownError ?? toSuperFunctionError
  });
}

/**
 * Create a fresh throwing-function builder.
 *
 * Use this when you need a custom context type or unknown-error mapper. Most
 * callers can use `higgz.function()` instead.
 *
 * @example
 * ```ts
 * const authed = createHiggzFunction<{ requestId: string }>();
 *
 * const fn = authed
 *   .input(z.string())
 *   .output(z.string())
 *   .fn(({ input, context }) => `${context.requestId}:${input}`);
 * ```
 */
export function createHiggzFunction<Context = undefined>(
  options: CreateHiggzFunctionOptions = {}
): HiggzFunctionBuilder<"anonymous", unknown, unknown, EmptyDeps, Context> {
  return createFunctionBuilder({
    name: "anonymous",
    deps: {},
    middlewares: [],
    mapUnknownError: options.mapUnknownError ?? toSuperFunctionError
  });
}

/**
 * Ready-to-use result-function builder.
 *
 * @example
 * ```ts
 * const fn = higgzResultFunction
 *   .name("findUser")
 *   .input(FindUserInput)
 *   .output(UserOutput)
 *   .errors([UserNotFound])
 *   .fn(async ({ fail, succeed }) => succeed(user));
 * ```
 */
export const higgzResultFunction = createHiggzResultFunction();
/**
 * Alias for {@link higgzResultFunction}.
 *
 * @example
 * ```ts
 * const fn = higgzAsyncResultFunction.fn(({ succeed }) => succeed("ok"));
 * ```
 */
export const higgzAsyncResultFunction = higgzResultFunction;
/**
 * Alias for {@link higgzResultFunction}.
 *
 * @example
 * ```ts
 * const fn = higgzResultAsyncFunction.fn(({ succeed }) => succeed("ok"));
 * ```
 */
export const higgzResultAsyncFunction = higgzResultFunction;
/**
 * Ready-to-use throwing-function builder.
 *
 * @example
 * ```ts
 * const fn = higgzFunction
 *   .input(z.number())
 *   .output(z.number())
 *   .fn(({ input }) => input + 1);
 * ```
 */
export const higgzFunction = createHiggzFunction();

/**
 * Main Higgz builder entry point.
 *
 * @example
 * ```ts
 * const findUsersDogs = higgz
 *   .resultFunction()
 *   .name("findUsersDogs")
 *   .deps({ users: UsersService, dogs: DogsService })
 *   .input(FindUsersDogsInput)
 *   .output(FindUsersDogsOutput)
 *   .errors([UserNotFound, DogsServiceUnavailable])
 *   .fn(async ({ input, deps, attempt, fail, succeed }) => {
 *     const dogs = await attempt(
 *       () => deps.dogs.findByOwnerId(input.userId),
 *       DogsServiceUnavailable.with({
 *         operation: "dogs.findByOwnerId",
 *         userId: input.userId
 *       })
 *     );
 *
 *     if (!dogs.ok) return fail(dogs.error);
 *     return succeed({ dogs: dogs.data });
 *   });
 * ```
 */
export const higgz = {
  function: createHiggzFunction,
  resultFunction: createHiggzResultFunction,
  asyncResultFunction: createHiggzResultFunction,
  resultAsyncFunction: createHiggzResultFunction
};

function createResultBuilder<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  ErrorFactories extends readonly AnyErrorFactory[],
  Context
>(
  state: ResultBuilderState<Name, Deps, ErrorFactories, Context>
): HiggzResultFunctionBuilder<
  Name,
  Input,
  Output,
  Deps,
  ErrorFactories,
  Context
> {
  return {
    name<NextName extends string>(name: NextName) {
      return createResultBuilder<
        NextName,
        Input,
        Output,
        Deps,
        ErrorFactories,
        Context
      >({
        ...state,
        name
      } as unknown as ResultBuilderState<
        NextName,
        Deps,
        ErrorFactories,
        Context
      >);
    },
    input(schema) {
      return createResultBuilder<
        Name,
        InferSchemaOutput<typeof schema>,
        Output,
        Deps,
        ErrorFactories,
        Context
      >({
        ...state,
        inputSchema: schema
      } as ResultBuilderState<Name, Deps, ErrorFactories, Context>);
    },
    output(schema) {
      return createResultBuilder<
        Name,
        Input,
        InferSchemaOutput<typeof schema>,
        Deps,
        ErrorFactories,
        Context
      >({
        ...state,
        outputSchema: schema
      } as ResultBuilderState<Name, Deps, ErrorFactories, Context>);
    },
    deps(deps) {
      return createResultBuilder<
        Name,
        Input,
        Output,
        Deps & typeof deps,
        ErrorFactories,
        Context
      >({
        ...state,
        deps: {
          ...state.deps,
          ...deps
        }
      } as ResultBuilderState<Name, Deps & typeof deps, ErrorFactories, Context>);
    },
    errors(errors) {
      return createResultBuilder<
        Name,
        Input,
        Output,
        Deps,
        readonly [...ErrorFactories, ...typeof errors],
        Context
      >({
        ...state,
        errors: [...state.errors, ...errors]
      } as ResultBuilderState<
        Name,
        Deps,
        readonly [...ErrorFactories, ...typeof errors],
        Context
      >);
    },
    use(middleware) {
      return createResultBuilder<Name, Input, Output, Deps, ErrorFactories, Context>({
        ...state,
        middlewares: [...state.middlewares, middleware]
      } as ResultBuilderState<Name, Deps, ErrorFactories, Context>);
    },
    fn(handler) {
      return createResultFunction(state, handler);
    }
  };
}

function createFunctionBuilder<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  Context
>(
  state: FunctionBuilderState<Name, Deps, Context>
): HiggzFunctionBuilder<Name, Input, Output, Deps, Context> {
  return {
    name<NextName extends string>(name: NextName) {
      return createFunctionBuilder<NextName, Input, Output, Deps, Context>({
        ...state,
        name
      } as unknown as FunctionBuilderState<NextName, Deps, Context>);
    },
    input(schema) {
      return createFunctionBuilder<
        Name,
        InferSchemaOutput<typeof schema>,
        Output,
        Deps,
        Context
      >({
        ...state,
        inputSchema: schema
      } as FunctionBuilderState<Name, Deps, Context>);
    },
    output(schema) {
      return createFunctionBuilder<
        Name,
        Input,
        InferSchemaOutput<typeof schema>,
        Deps,
        Context
      >({
        ...state,
        outputSchema: schema
      } as FunctionBuilderState<Name, Deps, Context>);
    },
    deps(deps) {
      return createFunctionBuilder<Name, Input, Output, Deps & typeof deps, Context>({
        ...state,
        deps: {
          ...state.deps,
          ...deps
        }
      } as FunctionBuilderState<Name, Deps & typeof deps, Context>);
    },
    use(middleware) {
      return createFunctionBuilder<Name, Input, Output, Deps, Context>({
        ...state,
        middlewares: [...state.middlewares, middleware]
      } as FunctionBuilderState<Name, Deps, Context>);
    },
    fn(handler) {
      return createPlainFunction(state, handler);
    }
  };
}

function createResultFunction<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  ErrorFactories extends readonly AnyErrorFactory[],
  Context
>(
  state: ResultBuilderState<Name, Deps, ErrorFactories, Context>,
  handler: HiggzResultHandler<
    Name,
    Input,
    Output,
    ResolveHiggzDeps<Deps>,
    HiggzErrorUnion<ErrorFactories>,
    Context
  >
): HiggzResultFunction<
  Name,
  Input,
  Output,
  Deps,
  HiggzErrorUnion<ErrorFactories>,
  Context
> {
  type ErrorShape = HiggzErrorUnion<ErrorFactories>;

  const safe = async (
    rawInput: Input,
    options?: HiggzRunOptions<Deps, Context>
  ): Promise<Result<Output, ErrorShape | SuperFunctionError>> => {
    try {
      const input = (await parseSchema(
        state.inputSchema,
        rawInput,
        "input"
      )) as Input;
      const deps = resolveHiggzDeps(state.deps, options?.deps);
      const ctx = createResultContext<Name, Input, Output, Deps, ErrorShape, Context>(
        state.name,
        input,
        deps,
        options
      );

      const runHandler = async () => {
        const handled = await handler(ctx);
        if (isResult(handled)) {
          return handled;
        }

        return ok(handled as Output);
      };

      const outputResult = await composeResultMiddlewares(
        state.middlewares,
        ctx,
        runHandler
      );

      if (!outputResult.ok) {
        return outputResult;
      }

      const output = (await parseSchema(
        state.outputSchema,
        outputResult.value,
        "output"
      )) as Output;

      return ok(output);
    } catch (error) {
      return err(state.mapUnknownError(error));
    }
  };

  const unsafe = async (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ): Promise<Output> => {
    const result = await safe(input, options);
    if (result.ok) {
      return result.value;
    }

    throw normalizeError(result.error);
  };

  return {
    name: state.name,
    run: safe,
    safe,
    unsafe
  };
}

function createPlainFunction<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  Context
>(
  state: FunctionBuilderState<Name, Deps, Context>,
  handler: HiggzHandler<Name, Input, Output, ResolveHiggzDeps<Deps>, Context>
): HiggzFunction<Name, Input, Output, Deps, Context> {
  const safe = async (
    rawInput: Input,
    options?: HiggzRunOptions<Deps, Context>
  ): Promise<Result<Output, SuperFunctionError>> => {
    try {
      const input = (await parseSchema(
        state.inputSchema,
        rawInput,
        "input"
      )) as Input;
      const deps = resolveHiggzDeps(state.deps, options?.deps);
      const ctx = createPlainContext<Name, Input, Deps, Context>(
        state.name,
        input,
        deps,
        options
      );

      const output = await composePlainMiddlewares(
        state.middlewares,
        ctx,
        () => handler(ctx)
      );
      const parsedOutput = (await parseSchema(
        state.outputSchema,
        output,
        "output"
      )) as Output;

      return ok(parsedOutput);
    } catch (error) {
      return err(state.mapUnknownError(error));
    }
  };

  const unsafe = async (
    input: Input,
    options?: HiggzRunOptions<Deps, Context>
  ): Promise<Output> => {
    const result = await safe(input, options);
    if (result.ok) {
      return result.value;
    }

    throw result.error;
  };

  return {
    name: state.name,
    run: unsafe,
    safe,
    unsafe
  };
}

function createResultContext<
  Name extends string,
  Input,
  Output,
  Deps extends HiggzDepsDeclaration,
  ErrorShape,
  Context
>(
  name: Name,
  input: Input,
  deps: ResolveHiggzDeps<Deps>,
  options: HiggzRunOptions<Deps, Context> | undefined
): HiggzResultHandlerContext<
  Name,
  Input,
  Output,
  ResolveHiggzDeps<Deps>,
  ErrorShape,
  Context
> {
  return {
    name,
    input,
    deps,
    context: options?.context as Context,
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
    attempt: baseAttempt as Attempt<ErrorShape>,
    fail: (error) => err(error),
    succeed: (value) => ok(value)
  };
}

function createPlainContext<
  Name extends string,
  Input,
  Deps extends HiggzDepsDeclaration,
  Context
>(
  name: Name,
  input: Input,
  deps: ResolveHiggzDeps<Deps>,
  options: HiggzRunOptions<Deps, Context> | undefined
): HiggzHandlerContext<Name, Input, ResolveHiggzDeps<Deps>, Context> {
  return {
    name,
    input,
    deps,
    context: options?.context as Context,
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
    attempt: baseAttempt
  };
}

async function composeResultMiddlewares<
  Name extends string,
  Input,
  Output,
  Deps,
  ErrorShape,
  Context
>(
  middlewares: HiggzResultMiddleware<
    Name,
    Input,
    Output,
    Deps,
    ErrorShape,
    Context
  >[],
  ctx: HiggzResultHandlerContext<
    Name,
    Input,
    Output,
    Deps,
    ErrorShape,
    Context
  >,
  last: () => Promise<Result<Output, ErrorShape | SuperFunctionError>>
): Promise<Result<Output, ErrorShape | SuperFunctionError>> {
  const dispatch = async (
    position: number
  ): Promise<Result<Output, ErrorShape | SuperFunctionError>> => {
    const middleware = middlewares[position];

    if (!middleware) {
      return last();
    }

    return middleware(ctx, () => dispatch(position + 1));
  };

  return dispatch(0);
}

async function composePlainMiddlewares<
  Name extends string,
  Input,
  Output,
  Deps,
  Context
>(
  middlewares: HiggzMiddleware<Name, Input, Output, Deps, Context>[],
  ctx: HiggzHandlerContext<Name, Input, Deps, Context>,
  last: () => MaybePromise<Output>
): Promise<Output> {
  let index = -1;

  const dispatch = async (position: number): Promise<Output> => {
    if (position <= index) {
      throw new SuperFunctionError(
        "MIDDLEWARE_REENTRY",
        "next() called multiple times"
      );
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

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new SuperFunctionError("ERR", "Higgz function returned an Err result", {
    data: error
  });
}
