import type {
  HiggzDepsDeclaration,
  HiggzDepsInput,
  HiggzServiceFactory,
  HiggzServiceInstance,
  ResolveHiggzDeps
} from "./higgz-service";
import type {
  HiggzErrorFactory,
  HiggzTaggedError
} from "./higgz-error";
import type { HiggzErrorUnion } from "./higgz-function";

/**
 * Type-only helpers for extracting shapes from Higgz factories and values.
 *
 * Import with `import type` so nothing is emitted at runtime.
 *
 * @example
 * ```ts
 * import type { Higgz } from "higgzfunctions";
 *
 * type Users = Higgz.inferService<typeof UsersService>;
 * type UserError = Higgz.inferError<typeof UserNotFound>;
 * ```
 */
export namespace Higgz {
  /**
   * Infer the raw implementation shape from a service factory.
   *
   * @example
   * ```ts
   * const UsersService = higgzService<{
   *   findById(id: string): Promise<User | null>;
   * }>("users");
   *
   * type UsersServiceShape = Higgz.inferService<typeof UsersService>;
   * ```
   */
  export type inferService<Service> =
    Service extends HiggzServiceFactory<string, infer Shape> ? Shape : never;

  /**
   * Infer the raw implementation shape from a tagged service instance.
   *
   * @example
   * ```ts
   * const users = UsersService.new(usersService);
   *
   * type UsersServiceShape = Higgz.inferServiceInstance<typeof users>;
   * ```
   */
  export type inferServiceInstance<Instance> =
    Instance extends HiggzServiceInstance<string, infer Shape> ? Shape : never;

  /**
   * Infer the concrete tagged error value from an error factory.
   *
   * @example
   * ```ts
   * type UserNotFoundError = Higgz.inferError<typeof UserNotFound>;
   * ```
   */
  export type inferError<ErrorFactory> =
    ErrorFactory extends HiggzErrorFactory<infer Tag, infer Data>
      ? HiggzTaggedError<Tag, Data>
      : never;

  /**
   * Infer the schema-validated payload data from an error factory.
   *
   * @example
   * ```ts
   * type UserNotFoundData = Higgz.inferErrorData<typeof UserNotFound>;
   * ```
   */
  export type inferErrorData<ErrorFactory> =
    ErrorFactory extends HiggzErrorFactory<string, infer Data> ? Data : never;

  /**
   * Infer a union of concrete tagged error values from an error factory tuple.
   *
   * @example
   * ```ts
   * type FindUserErrors = Higgz.inferErrorUnion<
   *   [typeof UserNotFound, typeof UsersServiceUnavailable]
   * >;
   * ```
   */
  export type inferErrorUnion<
    ErrorFactories extends readonly HiggzErrorFactory<string, any>[]
  > = HiggzErrorUnion<ErrorFactories>;

  /**
   * Infer payload data from an already-created tagged error value.
   *
   * @example
   * ```ts
   * const error = UserNotFound.new({ userId: "ada" });
   *
   * type Data = Higgz.inferTaggedErrorData<typeof error>;
   * ```
   */
  export type inferTaggedErrorData<ErrorValue> =
    ErrorValue extends HiggzTaggedError<string, infer Data> ? Data : never;

  /**
   * Infer the raw dependency object handlers receive from a dependency
   * declaration map.
   *
   * @example
   * ```ts
   * const contracts = { users: UsersService, dogs: DogsService };
   *
   * type Deps = Higgz.inferDeps<typeof contracts>;
   * ```
   */
  export type inferDeps<Deps extends HiggzDepsDeclaration> =
    ResolveHiggzDeps<Deps>;

  /**
   * Infer the accepted dependency input for `.run(..., { deps })`.
   *
   * The input allows raw service shapes or tagged service instances.
   *
   * @example
   * ```ts
   * const contracts = { users: UsersService };
   *
   * type DepsInput = Higgz.inferDepsInput<typeof contracts>;
   * ```
   */
  export type inferDepsInput<Deps extends HiggzDepsDeclaration> =
    HiggzDepsInput<Deps>;
}
