import "./a.js";
import "./b.js";

trace("index before");
await Promise.resolve();
trace("index after");
