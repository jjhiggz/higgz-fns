import { higgzService } from "../../../src";
import type { Higgz } from "../../../src";
import { fakeDBQueryForUserById } from "../../fake-db";
import type { User } from "../schemas/user.schema";

// A service contract says "the handler gets something with this shape."
// It does not care whether the real thing is SQL, HTTP, or today's fake DB.
export const UsersService = higgzService<{
  findById(userId: string): Promise<User | null>;
}>("users");

// Tiny bonus: the implementation type is inferred from the contract. The coach
// appreciates not typing the same interface twice.
export type UsersServiceShape = Higgz.inferService<typeof UsersService>;

export const usersService: UsersServiceShape = {
  async findById(userId) {
    return fakeDBQueryForUserById(userId);
  }
};
