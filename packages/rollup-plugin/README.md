# rollup-plugin-concurrent-top-level-await

Rollup (and therefore also Vite) will change the behavior of modules containing top level await (TLA):
they run sequentially instead of concurrently, as described in
[the Rolldown docs](https://github.com/rolldown/rolldown/blob/main/docs/in-depth/tla-in-rolldown.md).
This Vite-compatible plugin enables concurrent execution of TLA modules.

Note that this plugin requires TLA support at runtime; it does _not_ provide a TLA polyfill.
For that, check out [vite-plugin-top-level-await](https://www.npmjs.com/package/vite-plugin-top-level-await).

## Installation

Using npm:

```bash
npm install rollup-plugin-concurrent-top-level-await --save-dev
```

## Usage

```ts
import concurrentTopLevelAwait from "rollup-plugin-concurrent-top-level-await";

export default {
	plugins: [
		concurrentTopLevelAwait({
			include: "**/*.ts",
		}),
	],
};
```

## Known Limitations

### Execution Order

We currently prioritize minimizing the required code transformations over complete compliance with the standard.
As a result, the execution order of TLA modules may differ from the standard behavior in certain cases, as can be seen
by the results for [tla-fuzzer](https://github.com/evanw/tla-fuzzer):

| Variant                  | Rollup | Rollup with Plugin |
| ------------------------ | ------ | ------------------ |
| Simple                   | 80%    | 100%               |
| Trailing Promise         | 10%    | 94%                |
| Cyclic                   | 69%    | 77%                |
| Cyclic, Trailing Promise | 15%    | 64%                |

Please do not rely on a specific execution order when using this plugin.

We might adapt Webpack's approach in the future to improve correctness.

### Build Performance

To transform a module, the plugin needs to check if any of its dependencies is async. Hence, the transformation is
postponed until the subgraph is analyzed. This may lead to slower builds.

If you notice significant performance degradation, please open an issue.

### Changing Variable Types

In the process of transforming the code, top level `const` declarations may get replaced with `let` declarations. This
can lead to `const` variables being assignable at runtime instead of throwing an invalid assignment error.

Additionally, variable declarations may be hoisted, which removes temporal dead zone (TDZ) checks.

### Exporting var

The plugin only checks the very top level of a module for potentially exported variables. This means that if a `var`
variable is declared inside a block but exported, the variable might not get handled correctly.

```js
if (something) {
	var myValue = 42;
}
export default myValue;
```

### Class Decorators

Class declarations still get evaluated before any top level await expressions. This means that if a class decorator
relies on a top level await expression, it may not work as expected.
