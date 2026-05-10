import { z } from "zod";
import{ higgz, higgzError } from "./src";
import type {Higgz} from "./src"

const fakeCall = <T>({
  mathGreaterThan = 5,
  returnVal,
  seedStr = "unspecified"
}: {
  mathGreaterThan?: number;
  seedStr?: string;
  returnVal: T;
}) => {
  if (Math.random() > mathGreaterThan) {
    throw new Error(seedStr);
  }

  return returnVal;
};

const GreetingInput = z.object({
  name: z.string().min(1),
  forceProviderError: z.boolean().optional()
});

const GreetingOutput = z.object({
  greeting: z.string(),
  luckyNumber: z.number().int()
});

const UnluckyNameError = higgzError(
  "UnluckyNameError",
  z.object({ name: z.string() })
);

const GreetingProviderError = higgzError(
  "GreetingProviderError",
  z.object({
    provider: z.string(),
    operation: z.string()
  })
);

const generateGreeting = higgz
  .resultFunction()
  .name("generateGreeting")
  .input(GreetingInput)
  .output(GreetingOutput)
  .errors([UnluckyNameError, GreetingProviderError])
  .fn(async ({ input, attempt, fail, succeed }) => {
    if (input.name.toLowerCase() === "voldemort") {
      return fail(UnluckyNameError.new({ name: input.name }));
    }

    const providerResult = await attempt(
      () =>
        fakeCall({
          mathGreaterThan: input.forceProviderError ? -1 : 5,
          seedStr: `Greeting provider failed for ${input.name}`,
          returnVal: {
            greeting: `Hello, ${input.name}. Higgz says hi.`,
            luckyNumber: input.name.length * 7
          }
        }),
      GreetingProviderError.with({
        provider: "fake-greetings",
        operation: "generateGreeting"
      })
    );

    if (!providerResult.ok) {
      return fail(providerResult.error);
    }

    return succeed(providerResult.data);
  });

const success = await generateGreeting.run({ name: "Ada" });
if (success.ok) {
  console.log("success", success.value);
}

const domainFailure = await generateGreeting.run({ name: "Voldemort" });
if (!domainFailure.ok && UnluckyNameError.is(domainFailure.error)) {
  console.log("domain failure", domainFailure.error.data);
}

const providerFailure = await generateGreeting.run({
  name: "Grace",
  forceProviderError: true
});
if (!providerFailure.ok && GreetingProviderError.is(providerFailure.error)) {
  console.log("provider failure", {
    data: providerFailure.error.data,
    cause: providerFailure.error.cause
  });
}
