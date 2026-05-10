import { deps } from "./deps";
import { DogsServiceUnavailable } from "./errors/find-dogs.errors";
import { findDogsFull } from "./functions/find-dogs.function";

const found = await findDogsFull.run({ userId: "grace" }, { deps });
console.log("full result", found);

const dogsUnavailable = await findDogsFull.run(
  {
    userId: "ada",
    forceDogsFailure: true
  },
  { deps }
);

if (!dogsUnavailable.ok && DogsServiceUnavailable.is(dogsUnavailable.error)) {
  console.log("full typed retryable error", dogsUnavailable.error.data);
}
