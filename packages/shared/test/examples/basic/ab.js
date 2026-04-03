import "./a.js";
import "./b.js";

trace("ab before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("ab after");
