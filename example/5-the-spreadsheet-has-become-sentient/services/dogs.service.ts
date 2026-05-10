import { higgzService } from "../../../src";
import type { Higgz } from "../../../src";
import { fakeDBQueryForDogsByOwnerId } from "../../fake-db";
import type { Dog } from "../schemas/dog.schema";

export const DogsService = higgzService<{
  findByOwnerId(
    userId: string,
    options?: { forceFailure?: boolean }
  ): Promise<Dog[]>;
}>("dogs");

export type DogsServiceShape = Higgz.inferService<typeof DogsService>;

export const dogsService: DogsServiceShape = {
  async findByOwnerId(userId, options = {}) {
    return fakeDBQueryForDogsByOwnerId(userId, options);
  }
};
