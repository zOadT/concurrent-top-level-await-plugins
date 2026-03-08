trace("delayedThrow");

await new Promise((resolve) => setTimeout(resolve, 100));

throw "delayed error";
