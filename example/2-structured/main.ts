import { z } from "zod";
import { higgz } from "../../src";
import {
  fakeDBQueryForDogsByOwnerId,
  fakeDBQueryForUserById
} from "../fake-db";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

// These schemas are reusable little contracts. They are not glamorous, but
// neither is flossing, and yet here we are.
const DogSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  favoriteSnack: z.string()
});

const FindDogsInput = z.object({
  userId: z.string().min(1)
});

const FindDogsOutput = z.object({
  user: UserSchema,
  dogs: z.array(DogSchema)
});

export const findDogsShaped = higgz
  .function()
  .name("find-dogs-shaped")
  // Input validation: still our friendly front-door checker.
  .input(FindDogsInput)
  // Adds runtime output validation and a precise public return type.
  // Commenting it out removes output validation; it does not infer the return
  // type from the handler body today. Useful, not mandatory. Like a helmet.
  .output(FindDogsOutput)
  .fn(async ({ input }) => {
    const user = await fakeDBQueryForUserById(input.userId);

    if (!user) {
      throw new Error(`User ${input.userId} was not found`);
    }

    return {
      user,
      dogs: await fakeDBQueryForDogsByOwnerId(input.userId)
    };
  });

console.log(await findDogsShaped.run({ userId: "grace" }));
