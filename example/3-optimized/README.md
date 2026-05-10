# 3. Optimized

This version starts looking like a small application slice: schemas, service
contracts, dependency wiring, and a function file.

What is new here:

- `higgzService<...>()` describes the dependency contract.
- `.deps(...)` injects typed services into the handler.
- The handler uses `deps.users` and `deps.dogs` instead of importing concrete
  implementations directly.

Because deps are provided when you call the function, tests can stub services
without module mocking:

```ts
const stubUsers = UsersService.new({
  async findById(userId) {
    return { id: userId, name: "Stub Coach", email: "stub@example.com" };
  }
});

await findDogsStructured.run(
  { userId: "any-user-id" },
  { deps: { users: stubUsers, dogs: stubDogs } }
);
```

See `find-dogs.test.ts` in this folder for the complete example.

It still uses the plain throwing function API. No typed result errors yet. We
are organizing the kitchen before installing the dashboard.

Run it:

```sh
bun example/3-optimized/main.ts
```
