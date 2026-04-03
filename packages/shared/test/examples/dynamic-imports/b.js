trace("b before");

await new Promise((resolve) => setTimeout(resolve, 5)).then(() => {
	trace("b in between");
});

const b = "b";
export { b as default };

trace("b after");
