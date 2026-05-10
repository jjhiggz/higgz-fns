import { z } from "zod";
import { higgz } from "../../../src";
import { ErrorClassifications } from "../errors/classification";
import {
  DogsServiceUnavailable,
  UserNotFound,
  UsersServiceUnavailable
} from "../errors/find-dogs.errors";
import { retryTransient } from "../middleware/retry-transient.middleware";
import { withSpan } from "../middleware/with-span.middleware";
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

export const findDogsFull = higgz
  .resultFunction()
  .name("find-dogs-full")
  // Deps, validation, output shape, typed errors: all the earlier knobs are on.
  .deps({
    users: UsersService,
    dogs: DogsService
  })
  .input(FindDogsInput)
  .output(FindDogsOutput)
  // These errors are not just for callers now. Middleware can inspect them too.
  .errors([UserNotFound, UsersServiceUnavailable, DogsServiceUnavailable])
  // withSpan observes the whole run. It is the calm person taking notes.
  .use(withSpan())
  // retryTransient sees classified result errors and can call the handler again.
  // Comment this out and failures stop getting the second chance montage.
  .use(retryTransient(2))
  .fn(async ({ input, deps, attempt, fail, succeed }) => {
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
      return fail(
        UserNotFound.new({
          userId: input.userId,
          classification: ErrorClassifications.notFound
        })
      );
    }

    const dogs = await attempt(
      () =>
        deps.dogs.findByOwnerId(
          input.userId,
          forceFailure(input.forceDogsFailure)
        ),
      DogsServiceUnavailable.with({
        operation: "dogs.findByOwnerId",
        userId: input.userId,
        // Marking this transient is what makes retryTransient care.
        classification: ErrorClassifications.transient
      })
    );

    if (!dogs.ok) return fail(dogs.error);

    return succeed({
      user: user.data,
      dogs: dogs.data
    });
  });
