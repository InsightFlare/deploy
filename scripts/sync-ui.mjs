/**
 * Prepare a reproducible @insightflare/ui package snapshot for this standalone
 * repository. Run only when updating the UI dependency deliberately.
 *
 * pnpm ui:sync [--source ../InsightFlare/packages/ui]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = process.argv.indexOf("--source");
if (index >= 0 && !process.argv[index + 1]) throw new Error("Missing --source path");
const source = resolve(root, index >= 0 ? process.argv[index + 1] : "../InsightFlare/packages/ui");
if (!existsSync(resolve(source, "package.json"))) throw new Error("UI package directory not found: " + source);
const ui = JSON.parse(readFileSync(resolve(source, "package.json"), "utf8"));
if (ui.name !== "@insightflare/ui") throw new Error("Not an InsightFlare UI package");
const repo = resolve(source, "../..");
const allowDirty = process.argv.includes("--allow-dirty");
const sourceState = execFileSync("git", ["status", "--porcelain", "--", "packages/ui"], { cwd: repo, encoding: "utf8" }).trim();
if (sourceState && !allowDirty) throw new Error("InsightFlare UI has uncommitted changes. Commit them first or explicitly pass --allow-dirty.");
const folder = resolve(root, "vendor");
mkdirSync(folder, { recursive: true });

execFileSync("pnpm", ["run", "build"], { cwd: source, stdio: "inherit", shell: process.platform === "win32" });
execFileSync("pnpm", ["pack", "--pack-destination", folder], { cwd: source, stdio: "inherit", shell: process.platform === "win32" });

const filename = "insightflare-ui-" + ui.version + ".tgz";
if (!existsSync(resolve(folder, filename))) throw new Error("Expected UI package tarball not found");
const packageFile = resolve(root, "package.json");
const project = JSON.parse(readFileSync(packageFile, "utf8"));
project.dependencies["@insightflare/ui"] = "file:./vendor/" + filename;
writeFileSync(packageFile, JSON.stringify(project, null, 2) + "\n");

let sourceCommit = "unknown";
let dirty = true;
try {
  sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  dirty = Boolean(execFileSync("git", ["status", "--porcelain", "--", "packages/ui"], { cwd: repo, encoding: "utf8" }).trim());
} catch { /* Local checkout may have no Git metadata. */ }
writeFileSync(resolve(folder, "source.json"), JSON.stringify({
  package: ui.name,
  version: ui.version,
  sourceRepository: "https://github.com/RavelloH/InsightFlare",
  sourcePath: "packages/ui",
  sourceCommit,
  dirty,
  integration: "vendored-pnpm-tarball"
}, null, 2) + "\n");

console.log("UI snapshot ready from " + sourceCommit + (dirty ? " (uncommitted UI changes)" : ""));
console.log("Run pnpm install, pnpm check and commit the vendor tarball plus lockfile.");
