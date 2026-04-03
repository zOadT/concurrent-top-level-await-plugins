trace("index before");

const imports = await import("./a.js");

trace(imports.default);
trace(imports.b);

trace("index after");
