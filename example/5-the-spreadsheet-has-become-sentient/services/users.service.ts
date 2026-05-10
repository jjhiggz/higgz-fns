import { higgzService } from "../../../src";
import type { Higgz } from "../../../src";
import { fakeDBQueryForUserById } from "../../fake-db";
import type { User } from "../schemas/user.schema";

export const UsersService = higgzService<{
  findById(
    userId: string,
    options?: { forceFailure?: boolean }
  ): Promise<User | null>;
}>("users");

export type UsersServiceShape = Higgz.inferService<typeof UsersService>;

export const usersService: UsersServiceShape = {
  async findById(userId, options = {}) {
    return fakeDBQueryForUserById(userId, options);
  }
};
