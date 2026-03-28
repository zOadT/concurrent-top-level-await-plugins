import * as estree from "estree";
import * as oxc from "@oxc-project/types";
import { RollupAstNode } from "rollup";

export type Node = estree.Node | oxc.Node;

export type Program = RollupAstNode<estree.Program> | oxc.Program;

export type ImportDeclaration =
	| estree.ImportDeclaration
	| oxc.ImportDeclaration;

export type VariableDeclaration =
	| estree.VariableDeclaration
	| oxc.VariableDeclaration;

export type Pattern =
	| estree.Pattern
	| oxc.BindingPattern
	| oxc.BindingRestElement;

export type MaybeNamedClassDeclaration =
	| estree.MaybeNamedClassDeclaration
	| oxc.Class;
