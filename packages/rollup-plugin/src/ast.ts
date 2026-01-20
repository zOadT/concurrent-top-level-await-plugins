import type { Node } from "estree";

function isFunctionNode(node: Node) {
	return (
		node.type === "FunctionDeclaration" ||
		node.type === "FunctionExpression" ||
		node.type === "ArrowFunctionExpression" ||
		node.type === "MethodDefinition" ||
		(node.type === "Property" && node.value.type === "FunctionExpression")
	);
}

export function visitScope(node: Node, cb: (node: Node) => boolean): boolean {
	// function gets called with primitive values in the recursion
	if (node?.type == null) {
		return false;
	}

	if (cb(node)) {
		return true;
	}

	if (isFunctionNode(node)) {
		return false;
	}

	return Object.values(node)
		.flat()
		.some((n) => visitScope(n, cb));
}
