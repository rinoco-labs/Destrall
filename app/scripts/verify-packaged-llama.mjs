#!/usr/bin/env node
/**
 * Verifies node-llama-cpp is present in a packaged Electron Forge output.
 * Usage: node scripts/verify-packaged-llama.mjs [path-to-packaged-app-or-out-dir]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { expectedNodeLlamaPlatformPackage } from "./llama-platform-package.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function fail(message) {
  console.error(`verify-packaged-llama: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`verify-packaged-llama: ${message}`);
}

function findResourcesDirs(root) {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "Resources" && fs.existsSync(path.join(full, "app.asar"))) {
          found.push(full);
        } else if (entry.name === "resources" && fs.existsSync(path.join(full, "app.asar"))) {
          found.push(full);
        } else {
          stack.push(full);
        }
      }
    }
  }
  return found;
}

function listPackagerOutputDirs(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("Destrall-"))
    .map((e) => path.join(baseDir, e.name));
}

function resolveSearchRoots(arg) {
  const outDir = path.join(appRoot, "out");
  const resolved = arg ? path.resolve(arg) : outDir;

  if (!fs.existsSync(resolved)) {
    fail(`path does not exist: ${resolved}`);
  }

  /** Prefer Forge packager folders (out/Destrall-darwin-arm64, …), not stale zip trees. */
  const packagerDirs = listPackagerOutputDirs(resolved);
  if (packagerDirs.length > 0) {
    return packagerDirs;
  }

  if (resolved === outDir || arg === "out") {
    fail(
      `no out/Destrall-* packager output found. Run electron-forge make for this platform first.`,
    );
  }

  return [resolved];
}

function hasNodeLlamaCpp(dir) {
  if (!fs.existsSync(dir)) return false;
  const direct = path.join(dir, "node-llama-cpp");
  if (fs.existsSync(direct)) return true;
  const scoped = path.join(dir, "@node-llama-cpp");
  if (fs.existsSync(scoped) && fs.readdirSync(scoped).length > 0) return true;
  return false;
}

function findMainJsEntry(files) {
  const matchesMainBuild = (file) => {
    const normalized = file.replace(/\\/g, "/").replace(/^\//, "");
    return normalized === ".vite/build/main.js" || normalized.endsWith("/.vite/build/main.js");
  };
  const exact = files.find(matchesMainBuild);
  if (exact) {
    return exact;
  }
  const fallback = files.find((file) => {
    const normalized = file.replace(/\\/g, "/");
    return normalized.includes(".vite") && normalized.endsWith("/main.js");
  });
  return fallback ?? null;
}

function extractMainJsFromAsar(asar, asarPath, mainJsRel, files) {
  const candidates = new Set([mainJsRel]);
  const normalized = mainJsRel.replace(/\\/g, "/");
  candidates.add(normalized);
  candidates.add(normalized.replace(/^\//, ""));
  if (process.platform === "win32") {
    candidates.add(normalized.replace(/\//g, "\\"));
    candidates.add(`\\${normalized.replace(/^\//, "").replace(/\//g, "\\")}`);
  }

  for (const candidate of candidates) {
    try {
      return asar.extractFile(asarPath, candidate);
    } catch {
      /* try next candidate */
    }
  }

  for (const file of files) {
    const norm = file.replace(/\\/g, "/");
    if (norm.includes(".vite") && norm.endsWith("/main.js")) {
      try {
        return asar.extractFile(asarPath, file);
      } catch {
        /* try next */
      }
    }
  }

  return null;
}

function mainJsLooksExternalized(mainJsPath) {
  const text = fs.readFileSync(mainJsPath, "utf8");
  if (text.includes('from"node-llama-cpp"') || text.includes("from 'node-llama-cpp'")) {
    return false;
  }
  if (text.includes('import("node-llama-cpp")')) {
    return true;
  }
  return !text.includes("node-llama-cpp/dist/");
}

function inferPlatformArchFromPackagerDir(resourcesDir) {
  const parts = resourcesDir.split(path.sep);
  const folder = parts.find((p) => p.startsWith("Destrall-"));
  if (!folder) return null;
  const match = /^Destrall-(darwin|win32|linux)-(arm64|x64)$/.exec(folder);
  if (!match) return null;
  return { platform: match[1], arch: match[2] };
}

function verifyLlamaPlatformBinaries(unpackedModules, platform, arch) {
  const expected = expectedNodeLlamaPlatformPackage(platform, arch);
  if (!expected) return;

  const scoped = path.join(unpackedModules, "@node-llama-cpp");
  if (!fs.existsSync(scoped)) {
    fail(`missing ${scoped}`);
  }
  const installed = fs.readdirSync(scoped);
  if (!installed.includes(expected)) {
    fail(
      `expected @node-llama-cpp/${expected} for ${platform}/${arch}, found: ${installed.join(", ") || "(none)"}`,
    );
  }
  const foreign = installed.filter((name) => name !== expected);
  if (foreign.length > 0) {
    fail(
      `foreign @node-llama-cpp packages for ${platform}/${arch}: ${foreign.join(", ")} (expected only ${expected})`,
    );
  }
  ok(`@node-llama-cpp/${expected} matches target ${platform}/${arch}`);
}

function verifyResources(resourcesDir) {
  const asarPath = path.join(resourcesDir, "app.asar");
  const unpackedDir = path.join(resourcesDir, "app.asar.unpacked");

  if (!fs.existsSync(asarPath)) {
    fail(`missing app.asar under ${resourcesDir}`);
  }
  ok(`found ${asarPath}`);

  if (!fs.existsSync(unpackedDir)) {
    fail(`missing app.asar.unpacked under ${resourcesDir} (native LLM files must be unpacked)`);
  }
  ok(`found ${unpackedDir}`);

  const unpackedModules = path.join(unpackedDir, "node_modules");
  if (!hasNodeLlamaCpp(unpackedModules)) {
    fail(
      `node-llama-cpp not found under ${unpackedModules} (expected node-llama-cpp and/or @node-llama-cpp)`,
    );
  }
  ok(`node-llama-cpp present in ${unpackedModules}`);

  const target = inferPlatformArchFromPackagerDir(resourcesDir);
  if (target) {
    verifyLlamaPlatformBinaries(unpackedModules, target.platform, target.arch);
  }

  let asar;
  try {
    asar = require("@electron/asar");
  } catch {
    fail("install @electron/asar (devDependency) to inspect app.asar");
  }

  const files = asar.listPackage(asarPath, { isPack: false });
  const mainJsRel = findMainJsEntry(files);
  if (!mainJsRel) {
    fail("could not find main.js under .vite/build in app.asar");
  }
  const mainJs = extractMainJsFromAsar(asar, asarPath, mainJsRel, files);
  if (!mainJs) {
    fail(`could not read ${mainJsRel} from app.asar`);
  }
  const mainJsPath = path.join(resourcesDir, "_verify_main.js");
  fs.writeFileSync(mainJsPath, mainJs);
  if (!mainJsLooksExternalized(mainJsPath)) {
    fs.unlinkSync(mainJsPath);
    fail("main.js appears to bundle node-llama-cpp instead of using runtime import()");
  }
  fs.unlinkSync(mainJsPath);
  ok("main.js uses external node-llama-cpp imports");
}

const searchRoots = resolveSearchRoots(process.argv[2]);
const resourcesDirs = [];

for (const searchRoot of searchRoots) {
  resourcesDirs.push(...findResourcesDirs(searchRoot));
}

if (resourcesDirs.length === 0) {
  fail(`no app.asar found under ${searchRoots.join(", ")}`);
}

for (const resourcesDir of resourcesDirs) {
  verifyResources(resourcesDir);
}

ok(`verified ${resourcesDirs.length} packaged app bundle(s)`);
