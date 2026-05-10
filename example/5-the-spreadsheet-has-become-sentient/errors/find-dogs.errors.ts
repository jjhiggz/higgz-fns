import { z } from "zod";
import { higgzError } from "../../../src";
import { ErrorClassificationSchema } from "./classification";

// Same typed-error trick as the previous demo, now with classifications that
// middleware can read. The errors have metadata and they know how to use it.
export const UserNotFound = higgzError(
  "UserNotFound",
  z.object({
    userId: z.string(),
    classification: ErrorClassificationSchema
  })
);

export const UsersServiceUnavailable = higgzError(
  "UsersServiceUnavailable",
  z.object({
    operation: z.string(),
    classification: ErrorClassificationSchema
  })
);

export const DogsServiceUnavailable = higgzError(
  "DogsServiceUnavailable",
  z.object({
    operation: z.string(),
    userId: z.string(),
    classification: ErrorClassificationSchema
  })
);
