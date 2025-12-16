import MagicString from "magic-string";
import { RollupAstNode } from "rollup";
import type {
	Program,
	ImportDeclaration,
	Pattern,
	VariableDeclaration,
} from "estree";

export default function transform(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
	hasAwait: boolean,
) {
	let declarationsEnd;
	[s, declarationsEnd] = tansformAndMoveDeclarationsToModuleScope(
		s,
		ast,
		asyncImports,
	);

	// TODO check if appendRight is correct
	s = s.appendRight(declarationsEnd, ";\nasync function __exec() {\n");
	s = s.append("}\n");

	// TODO check empty case
	const tlas = `[${asyncImports.map((_, i) => `__tla${i}`).join()}].flatMap(a => {
        try {
            const result = a();
            if (Array.isArray(result)) {
                return result
            }
            return [a];
        } catch {
            return []; // happens for cyclic dependencies
        }
    })`;
	// TODO check empty case
	const execWrapper =
		asyncImports.length === 0
			? "__exec();"
			: `Promise.all(${tlas}.map(e => e())).then(() => __exec());`;
	if (hasAwait) {
		s = s.append(`const __tla = ${execWrapper}; const __todo = __tla;`);
	} else {
		s = s.append(`const __tla = ${tlas};
            const __todo = ${execWrapper};`);
	}

	s = s.append("if (import.meta.useTla) await __todo;");
	s = s.append("export function __tla_access() { return __tla; };");
	return s;
}

function tansformAndMoveDeclarationsToModuleScope(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
) {
	let moduleScopeEnd = 0;
	let i = 0;
	for (const node of ast.body) {
		// add __tla import
		if (asyncImports.includes(node)) {
			const tlaImport = `;import { __tla_access as __tla${i}} from '${node.source.value}';`;
			s = s.appendLeft(node.end, tlaImport);
			i++;
		}

		if (node.type === "ExportNamedDeclaration") {
			if (node.declaration?.type === "VariableDeclaration") {
				// export const/let/var ...
				s = s.appendLeft(moduleScopeEnd, ";export ");
				s = s.remove(node.start, node.declaration.start);
				s = moveVarDeclarationToModuleScope(
					s,
					node.declaration,
					moduleScopeEnd,
				);
			}
		}

		if (node.type === "VariableDeclaration") {
			s = moveVarDeclarationToModuleScope(s, node, moduleScopeEnd);
		}

		if (
			isDeclaration(node.type) ||
			node.type === "ImportDeclaration" ||
			(node.type === "ExportNamedDeclaration" &&
				isDeclaration(node.declaration?.type)) ||
			// export { ... };
			(node.type === "ExportNamedDeclaration" && node.declaration == null) ||
			node.type === "ExportDefaultDeclaration" ||
			node.type === "ExportAllDeclaration"
		) {
			if (node.start > moduleScopeEnd) {
				s = s.appendRight(node.start, ";\n");
				s = s.move(node.start, node.end, moduleScopeEnd);
			} else {
				moduleScopeEnd = node.end;
			}
		}
	}
	return [s, moduleScopeEnd] as const;
}

function isDeclaration(
	type: string,
): type is "ClassDeclaration" | "FunctionDeclaration" {
	return type === "ClassDeclaration" || type === "FunctionDeclaration";
}

// TODO using/await using
function moveVarDeclarationToModuleScope(
	s: MagicString,
	node: VariableDeclaration,
	declarationsEnd: number,
) {
	const kind = replaceConstWithLet(node.kind);
	const names = node.declarations.map((decl) => getNames(decl.id)).join(", ");
	// TODO appendLeft/right?
	s = s.appendLeft(declarationsEnd, `\n${kind} ${names};\n`);
	s = s.remove(node.start, node.declarations[0].start);
	return s;
}

function replaceConstWithLet<T extends string>(value: T): T | "let" {
	if (value === "const") {
		return "let";
	}
	return value;
}

function getNames(pattern: Pattern) {
	if (pattern.type === "Identifier") {
		return pattern.name;
	}
	throw new Error("Destructuring not supported yet");
}
