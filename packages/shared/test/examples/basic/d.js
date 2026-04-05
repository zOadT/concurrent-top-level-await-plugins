trace("d before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("d after");
