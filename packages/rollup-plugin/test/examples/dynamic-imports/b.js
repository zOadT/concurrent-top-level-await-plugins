trace("b before");

await new Promise((resolve) => setTimeout(resolve, 5)).then(() => {
	trace("b in between");
});

trace("b after");
