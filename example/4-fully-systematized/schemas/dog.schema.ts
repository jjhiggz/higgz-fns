import { z } from "zod";

export const DogSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  favoriteSnack: z.string()
});

export type Dog = z.infer<typeof DogSchema>;
