import { SuperFunctionError } from "./errors";

export const higgzServiceType: unique symbol = Symbol("higgz.service");

/**
 * A tagged runtime wrapper around a concrete service implementation.
 *
 * Functions receive the unwrapped service shape in `ctx.deps`; callers may pass
 * either the raw service shape or this tagged instance in `run(..., { deps })`.
 *
 * @example
 * ```ts
 * const users = UsersService.new({
 *   findById: async (id) => ({ id, name: "Ada" })
 * });
 * ```
 */
export type HiggzServiceInstance<
  Tag extends string = string,
  Shape = unknown
> = Readonly<{
  tag: Tag;
  value: Shape;
  [higgzServiceType]: HiggzServiceFactory<Tag, Shape>;
}>;

/**
 * A tagged service contract.
 *
 * The factory is the source of truth for a dependency's shape. Use
 * `Higgz.inferService<typeof UsersService>` to implement the service without
 * repeating the type.
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
export interface HiggzServiceFactory<
  Tag extends string = string,
  Shape = unknown
> {
  /**
   * Stable service tag.
   *
   * @example
   * ```ts
   * UsersService.tag; // "users"
   * ```
   */
  readonly tag: Tag;
  /**
   * Wrap a concrete implementation as a tagged service instance.
   *
   * @example
   * ```ts
   * const deps = {
   *   users: UsersService.new(usersService)
   * };
   * ```
   */
  readonly new: (value: Shape) => HiggzServiceInstance<Tag, Shape>;
  /**
   * Narrow an unknown value to this service's tagged instance.
   *
   * @example
   * ```ts
   * if (UsersService.is(value)) {
   *   value.value.findById("ada");
   * }
   * ```
   */
  readonly is: (value: unknown) => value is HiggzServiceInstance<Tag, Shape>;
}

export type HiggzDepsDeclaration = Record<
  string,
  HiggzServiceFactory<string, any>
>;

export type ResolveHiggzDeps<Deps extends HiggzDepsDeclaration> = {
  readonly [Key in keyof Deps]: Deps[Key] extends HiggzServiceFactory<
    string,
    infer Shape
  >
    ? Shape
    : never;
};

export type HiggzDepsInput<Deps extends HiggzDepsDeclaration> = {
  readonly [Key in keyof Deps]:
    | ResolveHiggzDeps<Deps>[Key]
    | (Deps[Key] extends HiggzServiceFactory<infer Tag, infer Shape>
        ? HiggzServiceInstance<Tag, Shape>
        : never);
};

export function higgzService<const Tag extends string>(
  tag: Tag
): HiggzServiceFactory<Tag, unknown>;
export function higgzService<Shape>(
  tag: string
): HiggzServiceFactory<string, Shape>;
/**
 * Create a tagged service contract.
 *
 * The returned factory can create tagged service instances with `.new(...)`,
 * check instances with `.is(...)`, and feed dependency declarations via
 * `.deps({ users: UsersService })`.
 *
 * @example
 * ```ts
 * const DogsService = higgzService<{
 *   findByOwnerId(userId: string): Promise<Dog[]>;
 * }>("dogs");
 *
 * const dogsService: Higgz.inferService<typeof DogsService> = {
 *   async findByOwnerId(userId) {
 *     return [];
 *   }
 * };
 * ```
 */
export function higgzService(tag: string): HiggzServiceFactory<string, unknown> {
  const factory: HiggzServiceFactory<string, unknown> = {
    tag,
    new: (value: unknown) => {
      const service = {
        tag,
        value
      };

      Object.defineProperty(service, higgzServiceType, {
        enumerable: false,
        value: factory
      });

      return Object.freeze(service) as HiggzServiceInstance<string, unknown>;
    },
    is: (value: unknown): value is HiggzServiceInstance<string, unknown> => {
      return (
        typeof value === "object" &&
        value !== null &&
        (value as { readonly [higgzServiceType]?: unknown })[
          higgzServiceType
        ] === factory
      );
    }
  };

  return factory;
}

/**
 * Resolve tagged or raw dependency inputs into the raw dependency shapes passed
 * to handlers.
 *
 * This is used internally by Higgz functions. Most users should pass
 * dependencies through `.run(input, { deps })` instead of calling this directly.
 *
 * @example
 * ```ts
 * const deps = resolveHiggzDeps(
 *   { users: UsersService },
 *   { users: UsersService.new(usersService) }
 * );
 *
 * deps.users.findById("ada");
 * ```
 */
export function resolveHiggzDeps<Deps extends HiggzDepsDeclaration>(
  declarations: Deps,
  provided: HiggzDepsInput<Deps> | undefined
): ResolveHiggzDeps<Deps> {
  const resolved: Partial<Record<keyof Deps, unknown>> = {};

  for (const key of Object.keys(declarations) as (keyof Deps)[]) {
    if (!provided || !(key in provided)) {
      throw new SuperFunctionError(
        "MISSING_DEPENDENCY",
        `Missing dependency: ${String(key)}`,
        {
          data: { key: String(key) }
        }
      );
    }

    const declaration = declarations[key];
    if (!declaration) {
      throw new SuperFunctionError(
        "MISSING_DEPENDENCY",
        `Missing dependency declaration: ${String(key)}`,
        {
          data: { key: String(key) }
        }
      );
    }

    const value = provided[key];
    resolved[key] = declaration.is(value) ? value.value : value;
  }

  return resolved as ResolveHiggzDeps<Deps>;
}

/**
 * Check whether a value is a tagged Higgz service instance.
 *
 * @example
 * ```ts
 * if (isHiggzServiceInstance(value)) {
 *   console.log(value.tag, value.value);
 * }
 * ```
 */
export function isHiggzServiceInstance(
  value: unknown
): value is HiggzServiceInstance {
  return (
    typeof value === "object" &&
    value !== null &&
    higgzServiceType in value
  );
}
