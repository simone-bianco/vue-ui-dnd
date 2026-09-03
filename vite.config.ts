import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const sourceEntry = resolve(import.meta.dirname, "src/index.ts");
const externalPackages = ["vue"];

export default defineConfig(({ mode }) => {
  const isCjs = mode === "cjs";

  return {
    plugins: [
      vue(),
      ...(!isCjs
        ? [
            dts({
              entryRoot: "src",
              include: ["src/**/*.ts", "src/**/*.vue"],
              insertTypesEntry: true,
              aliasesExclude: [/^vue$/, /^@vue\//],
            }),
          ]
        : []),
    ],
    build: {
      cssMinify: false,
      lib: {
        entry: sourceEntry,
        formats: [isCjs ? "cjs" : "es"],
        fileName: () => `vue-ui-dnd.${isCjs ? "cjs" : "js"}`,
        cssFileName: "vue-ui-dnd",
      },
      emptyOutDir: !isCjs,
      rollupOptions: {
        external: (id) =>
          externalPackages.some(
            (packageName) => id === packageName || id.startsWith(`${packageName}/`),
          ),
      },
    },
  };
});