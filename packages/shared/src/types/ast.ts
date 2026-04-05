import * as estree from "estree";
// rollup 4.9.3 is the first version with proper node types
import * as estreeRollup4_9 from "estree_rollup4_9";
import * as oxc from "@oxc-project/types";
import { RollupAstNode } from "rollup";

export type Node = estree.Node | estreeRollup4_9.Node | oxc.Node;

export type Program =
	| RollupAstNode<estree.Program>
	| estreeRollup4_9.Program
	| oxc.Program;

export type ImportDeclaration =
	| estree.ImportDeclaration
	| estreeRollup4_9.ImportDeclaration
	| oxc.ImportDeclaration;

export type VariableDeclaration =
	| estree.VariableDeclaration
	| estreeRollup4_9.VariableDeclaration
	| oxc.VariableDeclaration;

export type Pattern =
	| estree.Pattern
	| estreeRollup4_9.Pattern
	| oxc.BindingPattern
	| oxc.BindingRestElement;

export type MaybeNamedClassDeclaration =
	| estree.MaybeNamedClassDeclaration
	| estreeRollup4_9.MaybeNamedClassDeclaration
	| oxc.Class;
