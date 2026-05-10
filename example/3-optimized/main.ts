import { deps } from "./deps";
import { findDogsStructured } from "./functions/find-dogs.function";

console.log(await findDogsStructured.run({ userId: "ada" }, { deps }));
