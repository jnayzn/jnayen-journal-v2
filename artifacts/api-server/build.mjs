import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  packages: "external",
  sourcemap: true,
  banner: {
    js: "import { createRequire as _cr } from 'module'; const require = _cr(import.meta.url);",
  },
});

console.log("api-server build complete");
