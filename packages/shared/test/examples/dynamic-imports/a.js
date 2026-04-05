trace("a before");

const b = (await import("./b.js")).default;

export { b };

export default "a";

trace("a after");
