/**
 * Maps Electron packager platform/arch to @node-llama-cpp optional package folder names.
 * @see https://node-llama-cpp.withcat.ai/guide/electron
 */

/** @param {string} platform @param {string} arch */
export function expectedNodeLlamaPlatformPackage(platform, arch) {
  if (platform === "darwin") {
    if (arch === "arm64") return "mac-arm64-metal";
    if (arch === "x64") return "mac-x64";
  }
  if (platform === "win32" && arch === "x64") return "win-x64";
  if (platform === "linux") {
    if (arch === "x64") return "linux-x64";
    if (arch === "arm64") return "linux-arm64";
  }
  return null;
}
