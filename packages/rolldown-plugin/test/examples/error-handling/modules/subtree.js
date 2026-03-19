import "./subtreeChild.js";

trace("before subtree");

await new Promise((resolve) => setTimeout(resolve, 60));

trace("after subtree");
