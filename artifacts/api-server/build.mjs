import { mkdir, copyFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const WORKSPACE_PREFIX = "@workspace/";
const seen = new Set();
const externalSet = new Set();

async function collectDeps(pkgPath) {
  if (seen.has(pkgPath)) return;
  seen.add(pkgPath);
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const name of deps) {
    if (name.startsWith(WORKSPACE_PREFIX)) {
      const rel = name.slice(WORKSPACE_PREFIX.length);
      // resolve workspace package: ../../lib/<rel>/package.json
      const wsPkg = resolve(dirname(pkgPath), "..", "..", "lib", rel, "package.json");
      await collectDeps(wsPkg);
    } else {
      externalSet.add(name);
    }
  }
}

await collectDeps(resolve("package.json"));
const external = Array.from(externalSet);

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
