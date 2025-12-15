import MagicString from "magic-string";
import { RollupAstNode } from "rollup";
import type { Program, ImportDeclaration } from "estree";

export default function transform(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
	hasAwait: boolean,
) {
	let declarationsEnd;
	[s, declarationsEnd] = tansformAndMoveDeclarationsToTop(s, ast, asyncImports);

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

function tansformAndMoveDeclarationsToTop(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
) {
	let declarationsEnd = 0;
	let i = 0;
	for (const node of ast.body) {
		// add __tla import
		if (asyncImports.includes(node)) {
			const tlaImport = `;import { __tla_access as __tla${i}} from '${node.source.value}';`;
			s = s.appendLeft(node.end, tlaImport);
			i++;
		}
		if (
			node.type === "ClassDeclaration" ||
			node.type === "FunctionDeclaration" ||
			node.type === "ImportDeclaration"
		) {
			if (node.start > declarationsEnd) {
				s = s.appendRight(node.start, ";\n");
				s = s.move(node.start, node.end, declarationsEnd);
			} else {
				declarationsEnd = node.end;
			}
		}
	}
	return [s, declarationsEnd] as const;
}
