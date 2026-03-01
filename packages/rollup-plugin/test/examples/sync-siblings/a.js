trace("a before");

Promise.resolve().then(() => {
	trace("a after");
});
