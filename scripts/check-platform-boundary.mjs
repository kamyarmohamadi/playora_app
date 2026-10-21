import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);

function pathIsWithin(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

function isForbiddenGameSpecifier(specifier, sourceFile, sourceRoot) {
  if (/^(?:@\/|~\/)?games(?:\/|$)/.test(specifier)) return true;
  if (/(?:^|\/)src\/games(?:\/|$)/.test(specifier)) return true;

  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(sourceFile), specifier);
  return pathIsWithin(path.join(sourceRoot, "games"), resolved);
}

export function findForbiddenGameImports(sourceRoot) {
  const absoluteRoot = path.resolve(sourceRoot);
  if (!existsSync(absoluteRoot)) throw new Error("Source root does not exist: " + absoluteRoot);

  const findings = [];
  const pending = [absoluteRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        // Legacy game source is allowed to import its own engine code; host source is not.
        if (path.resolve(filePath) === path.join(absoluteRoot, "games")) continue;
        pending.push(filePath);
        continue;
      }
      if (!entry.isFile() || !SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;

      const source = readFileSync(filePath, "utf8");
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const specifiers = [];
        for (const match of line.matchAll(/\bfrom\s*["']([^"']+)["']/g)) specifiers.push(match[1]);
        for (const match of line.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(match[1]);
        for (const match of line.matchAll(/^\s*import\s*["']([^"']+)["']/g)) specifiers.push(match[1]);

        for (const specifier of new Set(specifiers)) {
          if (isForbiddenGameSpecifier(specifier, filePath, absoluteRoot)) {
            findings.push({ filePath, specifier, lineNumber: index + 1 });
          }
        }
      }
    }
  }

  return findings.sort((left, right) =>
    left.filePath.localeCompare(right.filePath) ||
    left.lineNumber - right.lineNumber ||
    left.specifier.localeCompare(right.specifier)
  );
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const sourceRoot = path.resolve(process.cwd(), "src");
  const findings = findForbiddenGameImports(sourceRoot);
  if (findings.length > 0) {
    console.error("Platform/game boundary violation: host source must not import a game implementation.");
    for (const finding of findings) {
      console.error(`- ${path.relative(process.cwd(), finding.filePath)}:${finding.lineNumber} imports "${finding.specifier}"`);
    }
    process.exitCode = 1;
  } else {
    console.log("Platform/game boundary check passed: no host imports of individual game source were found.");
  }
}
