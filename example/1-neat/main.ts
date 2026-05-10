import { z } from "zod";
import { higgz } from "../../src";
import {
  fakeDBQueryForDogsByOwnerId,
  fakeDBQueryForUserById
} from "../fake-db";

// Tiny local retry. No Higgz magic here, just a little "try again, champ."
const retry = async <T>(times: number, work: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= times; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      console.log(`basic retry attempt ${attempt + 1}`);
    }
  }

  throw lastError;
};

const FindDogsInput = z.object({
  userId: z.string().min(1),
  forceFailure: z.boolean().optional()
});

const findUser = higgz
  .function()
  // Names are nice for logs and debugging. You can comment this out btw; the
  // function will still run, it will just have the default name.
  .name("find-user")
  // See, it's basically just a function with validation. A bouncer, but polite.
  .input(z.object({ userId: z.string().min(1) }))
  .fn(({ input }) => fakeDBQueryForUserById(input.userId));

const findDogsByOwner = higgz
  .function()
  .name("find-dogs-by-owner")
  .input(FindDogsInput)
  .fn(({ input }) =>
    retry(2, async () =>
      fakeDBQueryForDogsByOwnerId(input.userId, {
        forceFailure: input.forceFailure
      })
    )
  );

export const findDogsBasic = higgz
  .function()
  .name("find-dogs-basic")
  // This first demo buys into input validation only. Low ceremony, good shoes.
  .input(FindDogsInput)
  // The handler is ordinary TypeScript. Higgz is not hiding a quest in here.
  .fn(async ({ input }) => {
    const user = await findUser.run({ userId: input.userId });

    if (!user) {
      throw new Error(`User ${input.userId} was not found`);
    }

    const dogs = await findDogsByOwner.run(input);
    return { user, dogs };
  });

console.log(await findDogsBasic.run({ userId: "ada" }));
