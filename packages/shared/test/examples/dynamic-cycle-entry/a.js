import "./b.js";

trace("a before");
await new Promise((resolve) => setTimeout(resolve, 5));
trace("a in between");

Promise.resolve().then(() => {
	trace("a after");
});
