import "./a.js";

trace("c before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("c after");
