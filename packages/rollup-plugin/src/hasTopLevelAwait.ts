import type { TransformPluginContext } from "rollup";

// TODO simplify
export default function hasTopLevelAwait(
	ast: ReturnType<TransformPluginContext["parse"]>,
): boolean {
	let found = false;

	function isFunctionNode(node: any) {
		if (!node || typeof node.type !== "string") return false;
		return (
			node.type === "FunctionDeclaration" ||
			node.type === "FunctionExpression" ||
			node.type === "ArrowFunctionExpression" ||
			node.type === "ClassPrivateMethod" ||
			node.type === "MethodDefinition"
		);
	}

	function walk(node: any, functionDepth = 0) {
		if (!node || found) return;

		if (node.type === "AwaitExpression" && functionDepth === 0) {
			found = true;
			return;
		}

		const nextDepth = functionDepth + (isFunctionNode(node) ? 1 : 0);

		for (const key of Object.keys(node)) {
			const child = node[key];
			if (Array.isArray(child)) {
				for (const c of child) walk(c, nextDepth);
			} else if (child && typeof child.type === "string") {
				walk(child, nextDepth);
			}
		}
	}

	walk(ast, 0);
	return found;
}
