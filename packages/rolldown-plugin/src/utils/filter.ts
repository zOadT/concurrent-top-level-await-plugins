export type Filter = {
	include?: RegExp | RegExp[];
	exclude?: RegExp | RegExp[];
	includes(id: string): boolean;
};

function matchesPattern(id: string, pattern: RegExp | RegExp[]) {
	if (Array.isArray(pattern)) {
		return pattern.some((p) => p.test(id));
	}
	return pattern.test(id);
}

export function createFilter(
	include?: RegExp | RegExp[],
	exclude?: RegExp | RegExp[],
): Filter {
	return {
		include,
		exclude,
		includes(id: string) {
			if (exclude && matchesPattern(id, exclude)) {
				return false;
			}
			if (include) {
				return matchesPattern(id, include);
			}
			return true;
		},
	};
}

function ensureArray<T>(item: T | T[] | null | undefined): T[] {
	if (item == null) {
		return [];
	}
	return Array.isArray(item) ? item : [item];
}

export function withExclude(filter: Filter, exclude: RegExp) {
	return createFilter(filter.include, [
		...ensureArray(filter.exclude),
		exclude,
	]);
}

// implementation from @rolldown/pluginutils
export function prefixRegex(str: string, flags?: string): RegExp {
	return new RegExp(`^${escapeRegex(str)}`, flags);
}

const escapeRegexRE = /[-/\\^$*+?.()|[\]{}]/g;
function escapeRegex(str: string): string {
	return str.replace(escapeRegexRE, "\\$&");
}
