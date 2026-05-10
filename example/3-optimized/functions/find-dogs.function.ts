import { z } from "zod";
import { higgz } from "../../../src";
import { DogSchema } from "../schemas/dog.schema";
import { UserSchema } from "../schemas/user.schema";
import { DogsService } from "../services/dogs.service";
import { UsersService } from "../services/users.service";

const FindDogsInput = z.object({
  userId: z.string().min(1)
});

const FindDogsOutput = z.object({
  user: UserSchema,
  dogs: z.array(DogSchema)
});

export const findDogsStructured = higgz
  .function()
  .name("find-dogs-structured")
  // New cool thing: structured deps. The handler gets typed services instead
  // of reaching into random imports like it forgot where it put its keys.
  .deps({
    users: UsersService,
    dogs: DogsService
  })
  // Still the same validation story from earlier.
  .input(FindDogsInput)
  .output(FindDogsOutput)
  .fn(async ({ input, deps }) => {
    // `deps.users` is typed from UsersService. No guessing, no sticky notes.
    const user = await deps.users.findById(input.userId);

    if (!user) {
      throw new Error(`User ${input.userId} was not found`);
    }

    return {
      user,
      // And `deps.dogs` came along for the ride.
      dogs: await deps.dogs.findByOwnerId(input.userId)
    };
  });
