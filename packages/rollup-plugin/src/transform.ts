import MagicString from "magic-string";
import { RollupAstNode } from "rollup";
import type {
	Program,
	ImportDeclaration,
	Pattern,
	VariableDeclaration,
} from "estree";
import { visitScope } from "./ast.js";

export default function transform(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
	hasAwait: boolean,
) {
	const declarationsEnd = tansformAndMoveDeclarationsToModuleScope(
		s,
		ast,
		asyncImports,
	);

	s.appendRight(declarationsEnd, ";\nasync function __exec() {\n");
	s.append("}\n");

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
		s.append(`const __tla = ${execWrapper}; const __todo = __tla;`);
	} else {
		s.append(`const __tla = ${tlas};
            const __todo = ${execWrapper};`);
	}

	s.append("if (import.meta.useTla) await __todo;");
	s.append("export function __tla_access() { return __tla; };");
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
		if (asyncImports.includes(node as ImportDeclaration)) {
			const tlaImport = `;import { __tla_access as __tla${i}} from '${(node as ImportDeclaration).source.value}';`;
			s.appendLeft(node.end, tlaImport);
			i++;
		}

		// move variable declarations to module scope
		if (node.type === "ExportNamedDeclaration") {
			if (node.declaration?.type === "VariableDeclaration") {
				// export const/let/var ...
				s.appendLeft(moduleScopeEnd, ";export ");
				s.remove(node.start, node.declaration.start);
				moveVariableDeclarationToModuleScope(
					s,
					node.declaration,
					moduleScopeEnd,
				);
			}
		} else if (node.type === "VariableDeclaration") {
			if (node.kind.endsWith("using")) {
				moveVariableDeclarationWithUsingToModuleScope(s, node, moduleScopeEnd);
			} else {
				moveVariableDeclarationToModuleScope(s, node, moduleScopeEnd);
			}
		} else {
			// search tree for var
			visitScope(node, (n) => {
				if (n.type === "VariableDeclaration" && n.kind === "var") {
					moveVariableDeclarationToModuleScope(s, n, moduleScopeEnd);
				}
				return false;
			});
		}

		// replace `export default expression` with `export { __tla_default as default }`
		// statement to ensure the default export is a live binding
		if (
			node.type === "ExportDefaultDeclaration" &&
			!isDeclaration(node.declaration.type)
		) {
			s.appendLeft(
				moduleScopeEnd,
				"let __tla_default;\nexport { __tla_default as default };\n",
			);
			// Remove 'export default '
			s.remove(node.start, node.declaration.start);

			s.appendRight(node.declaration.start, ";__tla_default = (");
			s.appendLeft(node.declaration.end, ");");
		}

		if (
			isDeclaration(node.type) ||
			node.type === "ImportDeclaration" ||
			(node.type === "ExportDefaultDeclaration" &&
				isDeclaration(node.declaration.type)) ||
			(node.type === "ExportNamedDeclaration" &&
				isDeclaration(node.declaration?.type)) ||
			// export { ... };
			(node.type === "ExportNamedDeclaration" && node.declaration == null) ||
			node.type === "ExportAllDeclaration"
		) {
			if (node.start > moduleScopeEnd) {
				s.appendRight(node.start, ";\n");
				s.move(node.start, node.end, moduleScopeEnd);
				// ensure statements surrounding declaration remain separated
				s.appendLeft(node.start, ";");
			} else {
				moduleScopeEnd = node.end;
			}
		}
	}
	return moduleScopeEnd;
}

function isDeclaration(
	type?: string,
): type is "ClassDeclaration" | "FunctionDeclaration" {
	return type === "ClassDeclaration" || type === "FunctionDeclaration";
}

function moveVariableDeclarationToModuleScope(
	s: MagicString,
	node: VariableDeclaration,
	declarationsEnd: number,
) {
	const kind = replaceConstWithLet(node.kind);
	const names = node.declarations
		.flatMap((decl) => getNames(decl.id))
		.join(", ");
	// surround with () for destructuring
	s.appendRight(node.declarations[0]!.start, ";(");
	s.appendLeft(node.declarations[node.declarations.length - 1]!.end, ")");

	s.appendLeft(declarationsEnd, `\n${kind} ${names};\n`);
	s.remove(node.start, node.declarations[0]!.start);
	return s;
}

function moveVariableDeclarationWithUsingToModuleScope(
	s: MagicString,
	node: VariableDeclaration,
	declarationsEnd: number,
) {
	node.declarations.forEach((declaration) => {
		const id = declaration.id;
		if (id.type !== "Identifier") {
			throw new Error("'using' declarations may not have binding patterns.");
		}
		const name = id.name;
		s.appendRight(id.start, `__tla_using_`);
		s.appendLeft(node.end, `;\n${name} = __tla_using_${name};`);

		s.appendLeft(declarationsEnd, `\nlet ${name};\n`);
	});

	return s;
}

function replaceConstWithLet<T extends string>(value: T): T | "let" {
	if (value === "const") {
		return "let";
	}
	return value;
}

function getNames(pattern: Pattern): string[] {
	switch (pattern.type) {
		case "Identifier":
			return [pattern.name];
		case "MemberExpression":
			throw new Error("Unexpected member expression in variable declaration");
		case "ObjectPattern":
			return pattern.properties.flatMap((p) => {
				switch (p.type) {
					case "Property":
						return getNames(p.value);
					case "RestElement":
						return getNames(p.argument);
				}
			});
		case "ArrayPattern":
			return pattern.elements.filter((e) => e != null).flatMap(getNames);
		case "RestElement":
			return getNames(pattern.argument);
		case "AssignmentPattern":
			return getNames(pattern.left);
	}
}
