import "./a.js";

trace("d before");
await new Promise((resolve) => setTimeout(resolve, 5));
trace("d in between");

Promise.resolve().then(() => {
	trace("d after");
});
