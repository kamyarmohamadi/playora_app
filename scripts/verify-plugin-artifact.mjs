import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export async function verifyPluginArtifactFile(filePath, expectedSha256, options = {}) {
  if (typeof filePath !== "string" || filePath.trim() === "") throw new Error("artifact_path_required");
  if (typeof expectedSha256 !== "string" || !SHA256_PATTERN.test(expectedSha256)) throw new Error("invalid_expected_digest");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("invalid_max_bytes");

  let file;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    file = await open(resolve(filePath), constants.O_RDONLY | noFollow);
  } catch {
    throw new Error("artifact_unavailable_or_symlink");
  }

  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("artifact_not_regular_file");
    if (stat.size < 1) throw new Error("artifact_empty");
    if (stat.size > maxBytes) throw new Error("artifact_too_large");

    const hash = createHash("sha256");
    let bytesRead = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      bytesRead += chunk.byteLength;
      if (bytesRead > maxBytes) throw new Error("artifact_too_large");
      hash.update(chunk);
    }
    if (bytesRead < 1) throw new Error("artifact_empty");

    const actual = hash.digest();
    const expected = Buffer.from(expectedSha256.toLowerCase(), "hex");
    if (!timingSafeEqual(actual, expected)) throw new Error("artifact_digest_mismatch");
    return actual.toString("hex");
  } finally {
    await file.close();
  }
}

function readArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!["--artifact", "--expected-sha256", "--max-bytes"].includes(flag)) throw new Error("unknown_argument");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("argument_value_required");
    values.set(flag, value);
    index += 1;
  }
  const artifact = values.get("--artifact");
  const expectedSha256 = values.get("--expected-sha256");
  const maxBytesText = values.get("--max-bytes");
  const maxBytes = maxBytesText === undefined ? DEFAULT_MAX_BYTES : Number(maxBytesText);
  if (!artifact || !expectedSha256) throw new Error("usage: --artifact <local-file> --expected-sha256 <trusted-64-hex-digest> [--max-bytes <positive-integer>]");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("invalid_max_bytes");
  return { artifact, expectedSha256, maxBytes };
}

async function main() {
  try {
    const args = readArguments(process.argv.slice(2));
    const digest = await verifyPluginArtifactFile(args.artifact, args.expectedSha256, { maxBytes: args.maxBytes });
    process.stdout.write("PLUGIN_ARTIFACT_VERIFIED sha256=" + digest + "\n");
  } catch (error) {
    const code = error instanceof Error ? error.message : "artifact_verification_failed";
    process.stderr.write("PLUGIN_ARTIFACT_REJECTED reason=" + code + "\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
