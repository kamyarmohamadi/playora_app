import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPluginArtifactFile } from "./verify-plugin-artifact.mjs";

const folders = [];
async function fixture(bytes = "playora-plugin-artifact") {
  const folder = await mkdtemp(join(tmpdir(), "playora-plugin-verify-"));
  folders.push(folder);
  const artifact = join(folder, "index.html");
  await writeFile(artifact, bytes);
  return { folder, artifact, digest: createHash("sha256").update(bytes).digest("hex") };
}
afterEach(async () => {
  await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
});

describe("trusted plugin artifact verification", () => {
  it("returns the digest only when local artifact bytes match the trusted expected digest", async () => {
    const { artifact, digest } = await fixture();
    await expect(verifyPluginArtifactFile(artifact, digest)).resolves.toBe(digest);
  });
  it("rejects a digest mismatch", async () => {
    const { artifact } = await fixture();
    await expect(verifyPluginArtifactFile(artifact, "a".repeat(64))).rejects.toThrow("artifact_digest_mismatch");
  });
  it("rejects malformed digests and oversized files", async () => {
    const { artifact, digest } = await fixture("123456789");
    await expect(verifyPluginArtifactFile(artifact, "not-a-digest")).rejects.toThrow("invalid_expected_digest");
    await expect(verifyPluginArtifactFile(artifact, digest, { maxBytes: 4 })).rejects.toThrow("artifact_too_large");
  });
  it("rejects symlinks and missing files", async () => {
    const { folder, artifact, digest } = await fixture();
    const alias = join(folder, "alias.html");
    try {
      await symlink(artifact, alias);
      await expect(verifyPluginArtifactFile(alias, digest)).rejects.toThrow("artifact_unavailable_or_symlink");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") return;
      throw error;
    }
    await expect(verifyPluginArtifactFile(join(folder, "missing.html"), digest)).rejects.toThrow("artifact_unavailable_or_symlink");
  });
  it("rejects empty files", async () => {
    const { artifact, digest } = await fixture("");
    await expect(verifyPluginArtifactFile(artifact, digest)).rejects.toThrow("artifact_empty");
  });
});
