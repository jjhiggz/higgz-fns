import { z } from "zod";
import { higgz } from "../../../src";
import { ErrorClassifications } from "../errors/classification";
import {
  DogsServiceUnavailable,
  UserNotFound,
  UsersServiceUnavailable
} from "../errors/find-dogs.errors";
import { DogSchema } from "../schemas/dog.schema";
import { UserSchema } from "../schemas/user.schema";
import { DogsService } from "../services/dogs.service";
import { UsersService } from "../services/users.service";

const forceFailure = (enabled: boolean | undefined) =>
  enabled === undefined ? {} : { forceFailure: enabled };

const FindDogsInput = z.object({
  userId: z.string().min(1),
  forceUsersFailure: z.boolean().optional(),
  forceDogsFailure: z.boolean().optional()
});

const FindDogsOutput = z.object({
  user: UserSchema,
  dogs: z.array(DogSchema)
});

export const findDogsSafe = higgz
  // Result functions return Ok/Err instead of throwing expected failures.
  // This is where the spreadsheet starts asking for a chair at the meeting.
  .resultFunction()
  .name("find-dogs-safe")
  .deps({
    users: UsersService,
    dogs: DogsService
  })
  .input(FindDogsInput)
  .output(FindDogsOutput)
  // Declare the expected errors up front. Now `fail(...)` and `attempt(...)`
  // know the allowed error union, because they studied before class.
  .errors([UserNotFound, UsersServiceUnavailable, DogsServiceUnavailable])
  .fn(async ({ input, deps, attempt, fail, succeed }) => {
    // `attempt` turns thrown service failures into typed result errors.
    // No catch block calisthenics required.
    const user = await attempt(
      () =>
        deps.users.findById(input.userId, forceFailure(input.forceUsersFailure)),
      UsersServiceUnavailable.with({
        operation: "users.findById",
        classification: ErrorClassifications.unavailable
      })
    );

    if (!user.ok) return fail(user.error);

    if (!user.data) {
      // Domain miss, not an exception. We return a typed error on purpose.
      return fail(
        UserNotFound.new({
          userId: input.userId,
          classification: ErrorClassifications.notFound
        })
      );
    }

    // Same pattern for dogs: call the service, map failures, keep the handler
    // shaped like a readable story instead of a try/catch obstacle course.
    const dogs = await attempt(
      () =>
        deps.dogs.findByOwnerId(
          input.userId,
          forceFailure(input.forceDogsFailure)
        ),
      DogsServiceUnavailable.with({
        operation: "dogs.findByOwnerId",
        userId: input.userId,
        classification: ErrorClassifications.unavailable
      })
    );

    if (!dogs.ok) return fail(dogs.error);

    // `succeed` validates the happy path against FindDogsOutput.
    return succeed({
      user: user.data,
      dogs: dogs.data
    });
  });
