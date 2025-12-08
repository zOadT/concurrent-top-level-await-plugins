# Concurrent Top Level Await Plugins

Most bundlers (except Webpack) will change the behavior of modules containing
top level await (TLA): they run sequentially instead of concurrently, as
described in [the Rolldown docs](https://github.com/rolldown/rolldown/blob/main/docs/in-depth/tla-in-rolldown.md).
The plugins in this repository enable concurrent execution of TLA modules.

Note that the plugins require TLA support at runtime; they do *not* provide a TLA polyfill.
