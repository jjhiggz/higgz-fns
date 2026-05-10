import type { Higgz } from "../../src";
import { DogsService, dogsService } from "./services/dogs.service";
import { UsersService, usersService } from "./services/users.service";

// This little bundle is the menu of services the function can ask for.
export const serviceContracts = {
  users: UsersService,
  dogs: DogsService
};

// Callers now get a typed deps object. Very official. Clipboard optional.
export type AppDepsInput = Higgz.inferDepsInput<typeof serviceContracts>;

export const deps: AppDepsInput = {
  users: UsersService.new(usersService),
  dogs: DogsService.new(dogsService)
};
