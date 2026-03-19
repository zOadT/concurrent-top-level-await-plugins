trace("a before");

await import("./b.js");

trace("a after");
