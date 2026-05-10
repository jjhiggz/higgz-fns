import { deps } from "./deps";
import { UserNotFound } from "./errors/find-dogs.errors";
import { findDogsSafe } from "./functions/find-dogs.function";

const found = await findDogsSafe.run({ userId: "ada" }, { deps });
console.log("safe result", found);

const missing = await findDogsSafe.run({ userId: "alan" }, { deps });
if (!missing.ok && UserNotFound.is(missing.error)) {
  console.log("typed missing user", missing.error.data);
}
