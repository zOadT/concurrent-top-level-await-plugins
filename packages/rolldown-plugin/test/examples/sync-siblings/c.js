trace("c before");

Promise.resolve().then(() => {
	trace("c after");
});
