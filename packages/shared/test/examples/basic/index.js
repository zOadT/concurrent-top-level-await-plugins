import "./ab.js";
import "./cd.js";

trace("index before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("index after");
