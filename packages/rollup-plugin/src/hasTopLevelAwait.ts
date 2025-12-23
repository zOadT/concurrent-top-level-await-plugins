import { Node } from "estree";

function isFunctionNode(node: Node) {
	return (
		node.type === "FunctionDeclaration" ||
		node.type === "FunctionExpression" ||
		node.type === "ArrowFunctionExpression" ||
		node.type === "MethodDefinition" ||
		(node.type === "Property" && node.value.type === "FunctionExpression")
	);
}

function isAwaitNode(node: Node) {
	return (
		node.type === "AwaitExpression" ||
		(node.type === "ForOfStatement" && node.await) ||
		(node.type === "VariableDeclaration" && node.kind === "await using")
	);
}

export default function hasTopLevelAwait(ast: Node): boolean {
	// function gets called with primitive values in the recursion
	if (ast?.type == null) {
		return false;
	}

	if (isAwaitNode(ast)) {
		return true;
	}

	if (isFunctionNode(ast)) {
		return false;
	}

	return Object.values(ast).flat().some(hasTopLevelAwait);
}
