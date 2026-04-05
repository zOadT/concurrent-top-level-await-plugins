import "./c.js";
import "./d.js";

trace("cd before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("cd after");
