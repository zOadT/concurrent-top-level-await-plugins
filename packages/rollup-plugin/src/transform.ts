import MagicString from "magic-string";
import { RollupAstNode } from "rollup";
import type {
	Program,
	ImportDeclaration,
	Pattern,
	VariableDeclaration,
	MaybeNamedClassDeclaration,
} from "estree";
import { visitScope } from "./ast.js";

export default function transform(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: ImportDeclaration[],
	hasAwait: boolean,
	variablePrefix: string,
) {
	const declarationsEnd = transformAndMoveDeclarationsToModuleScope(
		s,
		ast,
		asyncImports,
		variablePrefix,
	);

	s.appendRight(
		declarationsEnd,
		`async function ${variablePrefix}_initModuleExports() {\n`,
	);
	s.append("\n}\n");

	// TODO check empty case
	const asyncDeps = `[${asyncImports.map((_, i) => `${variablePrefix}${i}`).join()}].flatMap(a => {
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
	const initModuleExportsAfterDeps =
		asyncImports.length === 0
			? `${variablePrefix}_initModuleExports()`
			: `Promise.all(${asyncDeps}.map(e => e())).then(() => ${variablePrefix}_initModuleExports())`;
	if (hasAwait) {
		s.append(
			`const ${variablePrefix} = ${initModuleExportsAfterDeps};\nconst ${variablePrefix}_initPromise = ${variablePrefix};\n`,
		);
	} else {
		s.append(
			`const ${variablePrefix} = ${asyncDeps};\nconst ${variablePrefix}_initPromise = ${initModuleExportsAfterDeps};\n`,
		);
	}

	s.append(`if (import.meta.useTla) await ${variablePrefix}_initPromise;\n`);
	s.append(
		`export function ${variablePrefix}_access() { return ${variablePrefix}; };\n`,
	);
}

function transformAndMoveDeclarationsToModuleScope(
	s: MagicString,
	ast: RollupAstNode<Program>,
	asyncImports: (ImportDeclaration | null)[],
	variablePrefix: string,
) {
	let moduleScopeEnd = 0;
	let i = 0;
	for (const node of ast.body) {
		// add __tla import
		if (asyncImports.includes(node as ImportDeclaration)) {
			const tlaImport = `\nimport { ${variablePrefix}_access as ${variablePrefix}${i}} from '${(node as ImportDeclaration).source.value}';`;
			s.appendLeft(node.end, tlaImport);
			i++;
		}

		if (node.type === "ClassDeclaration") {
			s.appendLeft(moduleScopeEnd, `let ${node.id.name};\n`);
			s.appendRight(node.start, `${node.id.name} = `);
		}

		// move variable declarations to module scope
		if (node.type === "ExportNamedDeclaration") {
			if (node.declaration?.type === "VariableDeclaration") {
				// export const/let/var ...
				s.appendLeft(moduleScopeEnd, "export ");
				s.remove(node.start, node.declaration.start);
				moveVariableDeclarationToModuleScope(
					s,
					node.declaration,
					moduleScopeEnd,
				);
			} else if (node.declaration?.type === "ClassDeclaration") {
				// export class ...
				s.appendLeft(
					moduleScopeEnd,
					`export let ${node.declaration.id.name};\n`,
				);
				const declarationStart = getClassDeclarationStart(node.declaration);
				s.remove(node.start, declarationStart);
				s.appendRight(declarationStart, `${node.declaration.id.name} = `);
			}
		} else if (node.type === "VariableDeclaration") {
			if (node.kind.endsWith("using")) {
				moveVariableDeclarationWithUsingToModuleScope(
					s,
					node,
					moduleScopeEnd,
					variablePrefix,
				);
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

		// replace `export default expression` with `export { ${variablePrefix}_default as default }`
		// statement to ensure the default export is a live binding
		if (
			node.type === "ExportDefaultDeclaration" &&
			!isFunctionDeclaration(node.declaration.type)
		) {
			const variableName =
				node.declaration.type === "ClassDeclaration"
					? (node.declaration.id?.name ?? `${variablePrefix}_default`)
					: `${variablePrefix}_default`;

			s.appendLeft(
				moduleScopeEnd,
				`let ${variableName};\nexport { ${variableName} as default };\n`,
			);

			const declarationStart =
				node.declaration.type === "ClassDeclaration"
					? getClassDeclarationStart(node.declaration)
					: node.declaration.start;

			// Remove 'export default '
			s.remove(node.start, declarationStart);

			s.appendRight(declarationStart, `${variableName} = (`);
			s.appendLeft(node.declaration.end, ");");
		}

		if (
			isFunctionDeclaration(node.type) ||
			node.type === "ImportDeclaration" ||
			(node.type === "ExportDefaultDeclaration" &&
				isFunctionDeclaration(node.declaration.type)) ||
			(node.type === "ExportNamedDeclaration" &&
				isFunctionDeclaration(node.declaration?.type)) ||
			// export { ... };
			(node.type === "ExportNamedDeclaration" && node.declaration == null) ||
			node.type === "ExportAllDeclaration"
		) {
			if (node.start > moduleScopeEnd) {
				s.appendLeft(node.end, "\n");
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

function isFunctionDeclaration(type?: string): type is "FunctionDeclaration" {
	return type === "FunctionDeclaration";
}

function getClassDeclarationStart(node: MaybeNamedClassDeclaration) {
	return node.decorators[0]?.start ?? node.start;
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

	s.appendLeft(declarationsEnd, `${kind} ${names};\n`);
	s.remove(node.start, node.declarations[0]!.start);
	return s;
}

function moveVariableDeclarationWithUsingToModuleScope(
	s: MagicString,
	node: VariableDeclaration,
	declarationsEnd: number,
	variablePrefix: string,
) {
	node.declarations.forEach((declaration) => {
		const id = declaration.id;
		if (id.type !== "Identifier") {
			throw new Error("'using' declarations may not have binding patterns.");
		}
		const name = id.name;
		s.appendRight(id.start, `${variablePrefix}_using_`);
		s.appendLeft(node.end, `\n${name} = ${variablePrefix}_using_${name};`);

		s.appendLeft(declarationsEnd, `let ${name};\n`);
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
