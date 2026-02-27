trace("b before");
await 0;
trace("b in between");

Promise.resolve().then(() => {
	trace("b after");
});
