import { defineConfig } from "tsup";
import { chmod, readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("./dist/index.js", import.meta.url);
const shebang = "#!/usr/bin/env node";

async function ensureExecutable(): Promise<void> {
  const source = await readFile(outputPath, "utf8");
  if (!source.startsWith(shebang)) {
    await writeFile(outputPath, `${shebang}\n${source}`);
  }

  if (process.platform !== "win32") {
    await chmod(outputPath, 0o755);
  }
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  external: ["better-sqlite3", "pino"],
  noExternal: ["@caelis/codex", "@caelis/shared"],
  esbuildOptions(options) {
    options.conditions = ["development"];
  },
  dts: true,
  sourcemap: true,
  clean: true,
  onSuccess: ensureExecutable
});
