trace("index before");

Promise.resolve().then(() => {
	trace("index after");
});

import "./a.js";
import "./b.js";
import "./c.js";
