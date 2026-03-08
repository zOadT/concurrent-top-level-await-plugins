trace("directThrow");

throw "direct error";

await new Promise((resolve) => setTimeout(resolve, 100));
