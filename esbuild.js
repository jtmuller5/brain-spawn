const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");

function copyCodiconAssets() {
  const src = path.join(__dirname, "node_modules", "@vscode", "codicons", "dist");
  const dest = path.join(__dirname, "media", "webview");
  fs.copyFileSync(path.join(src, "codicon.css"), path.join(dest, "codicon.css"));
  fs.copyFileSync(path.join(src, "codicon.ttf"), path.join(dest, "codicon.ttf"));
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !watch,
};

async function main() {
  copyCodiconAssets();
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
    console.log("Build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
