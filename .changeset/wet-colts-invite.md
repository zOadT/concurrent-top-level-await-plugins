---
"rollup-plugin-concurrent-top-level-await": minor
---

Update module evaluation order to better align with V8's behavior.

Results from [tla-fuzzer](https://github.com/evanw/tla-fuzzer):

| Variant                  | Rollup | Rollup with Plugin previously | Rollup with Plugin updated |
| ------------------------ | ------ | ----------------------------- | -------------------------- |
| Simple                   | 80%    | 100%                          | 99%                        |
| Trailing Promise         | 10%    | 94%                           | 99%                        |
| Cyclic                   | 69%    | 77%                           | 99%                        |
| Cyclic, Trailing Promise | 15%    | 64%                           | 99%                        |
