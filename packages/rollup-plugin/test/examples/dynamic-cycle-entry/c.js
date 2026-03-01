import "./d.js";

trace("c before");
await new Promise((resolve) => setTimeout(resolve, 5));
trace("c in between");

Promise.resolve().then(() => {
	trace("c after");
});
