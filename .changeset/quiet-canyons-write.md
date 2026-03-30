---
"rolldown-plugin-concurrent-top-level-await": minor
---

fix vite compatibility:

- exclude `.html` files by default
- do not require `experimental.nativeMagicString` to be enabled, since it can't be enabled in vite
