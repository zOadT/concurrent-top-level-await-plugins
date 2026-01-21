import { Node } from "estree";
import { visitScope } from "./ast.js";

function isAwaitNode(node: Node) {
	return (
		node.type === "AwaitExpression" ||
		(node.type === "ForOfStatement" && node.await) ||
		(node.type === "VariableDeclaration" && node.kind === "await using")
	);
}

export default function hasTopLevelAwait(node: Node) {
	return visitScope(node, isAwaitNode);
}
