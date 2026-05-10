import type { Higgz } from "../../src";
import { DogsService, dogsService } from "./services/dogs.service";
import { UsersService, usersService } from "./services/users.service";

export const serviceContracts = {
  users: UsersService,
  dogs: DogsService
};

export type AppDepsInput = Higgz.inferDepsInput<typeof serviceContracts>;

export const deps: AppDepsInput = {
  users: UsersService.new(usersService),
  dogs: DogsService.new(dogsService)
};
