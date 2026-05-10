export type FakeUser = {
  id: string;
  name: string;
  email: string;
};

export type FakeDog = {
  id: string;
  ownerId: string;
  name: string;
  favoriteSnack: string;
};

export type FakeDBQueryOptions = {
  forceFailure?: boolean;
};

// Shared fake setup. The demos import this so readers can focus on the
// HiggzFunctions choices instead of squinting at pretend database furniture.
const usersById: Record<string, FakeUser> = {
  ada: {
    id: "ada",
    name: "Ada Lovelace",
    email: "ada@example.com"
  },
  grace: {
    id: "grace",
    name: "Grace Hopper",
    email: "grace@example.com"
  }
};

const dogsByOwnerId: Record<string, FakeDog[]> = {
  ada: [
    {
      id: "dog_1",
      ownerId: "ada",
      name: "Byron",
      favoriteSnack: "peanut butter"
    },
    {
      id: "dog_2",
      ownerId: "ada",
      name: "Pixel",
      favoriteSnack: "apple slices"
    }
  ],
  grace: [
    {
      id: "dog_3",
      ownerId: "grace",
      name: "Bug",
      favoriteSnack: "cheese"
    }
  ]
};

export async function fakeDBQueryForUserById(
  userId: string,
  options: FakeDBQueryOptions = {}
) {
  if (options.forceFailure) {
    throw new Error(`Fake DB failed while finding user ${userId}`);
  }

  return usersById[userId] ?? null;
}

export async function fakeDBQueryForDogsByOwnerId(
  userId: string,
  options: FakeDBQueryOptions = {}
) {
  if (options.forceFailure) {
    throw new Error(`Fake DB failed while finding dogs for ${userId}`);
  }

  return dogsByOwnerId[userId] ?? [];
}
