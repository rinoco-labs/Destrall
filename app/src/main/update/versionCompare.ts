/** Strip a leading "v" and compare semver-like numeric segments. */
export function normalizeReleaseVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareReleaseVersions(current: string, latest: string): number {
  const parse = (value: string) =>
    normalizeReleaseVersion(value)
      .split(/[.-]/)
      .map((part) => {
        const digits = part.match(/^\d+/);
        return digits ? Number.parseInt(digits[0], 10) : 0;
      });

  const left = parse(current);
  const right = parse(latest);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

export function isNewerRelease(current: string, latest: string): boolean {
  return compareReleaseVersions(current, latest) < 0;
}
