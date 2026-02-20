import "./index";

trace("b before");

await new Promise((resolve) => setTimeout(resolve, 5));

trace("b after");
