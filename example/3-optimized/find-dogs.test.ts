import { describe, expect, it } from "vitest";
import { DogsService } from "./services/dogs.service";
import { UsersService } from "./services/users.service";
import { findDogsStructured } from "./functions/find-dogs.function";

describe("3-optimized service stubbing", () => {
  it("can swap in stub services at the call boundary", async () => {
    const stubUsers = UsersService.new({
      async findById(userId) {
        return {
          id: userId,
          name: "Stub Coach",
          email: "stub@example.com"
        };
      }
    });

    const stubDogs = DogsService.new({
      async findByOwnerId(userId) {
        return [
          {
            id: "stub_dog",
            ownerId: userId,
            name: "Test Dog",
            favoriteSnack: "assertions"
          }
        ];
      }
    });

    const result = await findDogsStructured.run(
      { userId: "any-user-id" },
      {
        deps: {
          users: stubUsers,
          dogs: stubDogs
        }
      }
    );

    expect(result).toEqual({
      user: {
        id: "any-user-id",
        name: "Stub Coach",
        email: "stub@example.com"
      },
      dogs: [
        {
          id: "stub_dog",
          ownerId: "any-user-id",
          name: "Test Dog",
          favoriteSnack: "assertions"
        }
      ]
    });
  });
});
