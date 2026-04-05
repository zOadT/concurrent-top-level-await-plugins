import "estree";
import "estree_rollup4_9";

declare module "estree" {
	interface BaseNode {
		start: number;
		end: number;
	}
}

declare module "estree_rollup4_9" {
	interface BaseNode {
		start: number;
		end: number;
	}
}
