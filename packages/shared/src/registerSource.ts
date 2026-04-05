import { readFileSync } from "node:fs" with { type: "macro" };
import { transformSync } from "rolldown/utils" with { type: "macro" };

// Kudos to evanw for figuring out the registry strategy in https://github.com/evanw/tla-fuzzer
export default transformSync(
	"./register.ts",
	// we can't use import.meta.url here because this file is transformed by unplugin-parcel-macros
	readFileSync(
		process.env.TEST
			? "./packages/shared/src/assets/register.ts"
			: "../shared/src/assets/register.ts",
		"utf-8",
	),
	{
		// fix to first version with top-level-await support
		target: "es2022",
	},
).code;
