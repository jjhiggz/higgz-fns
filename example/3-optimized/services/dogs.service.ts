import { higgzService } from "../../../src";
import type { Higgz } from "../../../src";
import { fakeDBQueryForDogsByOwnerId } from "../../fake-db";
import type { Dog } from "../schemas/dog.schema";

// Same move as users: declare the dependency shape once, then let Higgz carry
// that type into the function handler.
export const DogsService = higgzService<{
  findByOwnerId(userId: string): Promise<Dog[]>;
}>("dogs");

export type DogsServiceShape = Higgz.inferService<typeof DogsService>;

export const dogsService: DogsServiceShape = {
  async findByOwnerId(userId) {
    return fakeDBQueryForDogsByOwnerId(userId);
  }
};
