import "./subtreeGrandchildren.js";

trace("before subtree child");

await new Promise((resolve) => setTimeout(resolve, 60));

trace("after subtree child");
