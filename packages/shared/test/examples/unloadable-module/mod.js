trace("mod before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("mod after");
