# rolldown-plugin-concurrent-top-level-await

## 0.2.1

### Patch Changes

- [#46](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/46) [`a950854`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/a95085415262d2dbddd576300334f5a833c25888) Thanks [@zOadT](https://github.com/zOadT)! - fix default export for dynamically imported modules

## 0.2.0

### Minor Changes

- [#44](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/44) [`9fb4285`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/9fb4285b7c0fa97679e0b319fd877a5382ba8605) Thanks [@zOadT](https://github.com/zOadT)! - fix vite compatibility:
  - exclude `.html` files by default
  - do not require `experimental.nativeMagicString` to be enabled, since it can't be enabled in vite

### Patch Changes

- [#44](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/44) [`0119448`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/01194480edb1a63e372e1276c834586b7caac5e8) Thanks [@zOadT](https://github.com/zOadT)! - fix imports from excluded modules were not being awaited

## 0.1.0

### Minor Changes

- [#42](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/42) [`1a42420`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/1a42420a674ebe93560b02dbc79a940d2c71dbbe) Thanks [@zOadT](https://github.com/zOadT)! - add filter options and exclude node_modules by default

## 0.0.3

### Patch Changes

- [#40](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/40) [`3aa6026`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/3aa6026ce6d900c3a704e6a15cadbf9cc75d924c) Thanks [@zOadT](https://github.com/zOadT)! - remove unused @rolldown/pluginutils dependency

- [#40](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/40) [`92a10fc`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/92a10fc3c30ce14385fce4a0ca2437d5a9d2059f) Thanks [@zOadT](https://github.com/zOadT)! - declare package as rolldown 1.0 compatible

## 0.0.2

### Patch Changes

- [#38](https://github.com/zOadT/concurrent-top-level-await-plugins/pull/38) [`3931b1a`](https://github.com/zOadT/concurrent-top-level-await-plugins/commit/3931b1a40e5ecaf313ae68fcc7924bc0b088f5cb) Thanks [@zOadT](https://github.com/zOadT)! - add provenance
