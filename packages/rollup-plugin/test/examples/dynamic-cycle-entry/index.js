trace("index before");

if (globalThis.path === 1) {
	await import("./a.js");
} else {
	await import("./c.js");
}

trace("index after");
