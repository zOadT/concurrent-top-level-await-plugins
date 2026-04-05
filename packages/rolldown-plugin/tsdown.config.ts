import { defineConfig } from "tsdown";
import macros from "unplugin-macros/rolldown";

export default defineConfig({
	plugins: [macros()],
});
