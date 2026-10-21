import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findForbiddenGameImports } from "./check-platform-boundary.mjs";

const tempDirs: string[] = [];

function makeSourceTree() {
  const root = mkdtempSync(path.join(os.tmpdir(), "playora-boundary-"));
  tempDirs.push(root);
  const src = path.join(root, "src");
  mkdirSync(path.join(src, "platform"), { recursive: true });
  mkdirSync(path.join(src, "games"), { recursive: true });
  return { root, src };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("platform/game import boundary", () => {
  it("detects a direct engine import from the platform shell", () => {
    const { src } = makeSourceTree();
    const file = path.join(src, "App.tsx");
    writeFileSync(file, 'import { createState } from "./games/tictactoe";\nexport const shell = true;\n');
    writeFileSync(path.join(src, "games", "tictactoe.ts"), "export const createState = () => ({});\n");

    const findings = findForbiddenGameImports(src);

    expect(findings).toContainEqual({
      filePath: file,
      specifier: "./games/tictactoe",
      lineNumber: 1,
    });
  });

  it("detects a path-alias import that bypasses relative-path checks", () => {
    const { src } = makeSourceTree();
    const file = path.join(src, "platform", "launcher.ts");
    writeFileSync(file, 'import type { GameState } from "@/games/chess/types";\n');

    expect(findForbiddenGameImports(src)).toContainEqual({
      filePath: file,
      specifier: "@/games/chess/types",
      lineNumber: 1,
    });
  });

  it("allows platform contracts and preserves isolated legacy game tests", () => {
    const { src } = makeSourceTree();
    writeFileSync(path.join(src, "App.tsx"), 'import type { GameManifestV1 } from "../packages/game-sdk";\n');
    writeFileSync(path.join(src, "platform", "catalog.ts"), 'export { getGameAvailability } from "./gameAvailability";\n');
    writeFileSync(path.join(src, "games", "tictactoe.test.ts"), 'import { createState } from "./tictactoe";\n');

    expect(findForbiddenGameImports(src)).toEqual([]);
  });
});
