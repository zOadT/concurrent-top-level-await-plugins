import "./b.js";

trace("a before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("a after");
