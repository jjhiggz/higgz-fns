import { z } from "zod";
import { higgzError } from "../../../src";
import { ErrorClassificationSchema } from "./classification";

// Higgz errors are tagged, schema-backed domain values. More structured than
// throwing a string into the void and hoping it learns manners.
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
