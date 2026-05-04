import { mkdir, copyFile, readFile } from "node:fs/promises";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const external = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => !name.startsWith("@workspace/"),
);

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  external,
  sourcemap: true,
  banner: {
    js: "import { createRequire as _cr } from 'module'; const require = _cr(import.meta.url);",
  },
});

await mkdir("dist/bridge", { recursive: true });
await copyFile("src/bridge/tradj_bridge.py", "dist/bridge/tradj_bridge.py");

console.log("api-server build complete");
