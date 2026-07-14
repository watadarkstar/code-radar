export type LatestVersionInfo = {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  behind: boolean | null;
};

function parseSemverParts(
  version: string,
): [number, number, number] | null {
  const cleaned = version.replace(/^[\^~>=<\s]*/, "").replace(/-.*$/, "");
  const parts = cleaned.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 1 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isBehind(
  installed: string | null,
  latest: string | null,
): boolean | null {
  if (!installed || !latest) return null;
  const a = parseSemverParts(installed);
  const b = parseSemverParts(latest);
  if (!a || !b) return installed !== latest;
  for (let i = 0; i < 3; i++) {
    if (a[i]! < b[i]!) return true;
    if (a[i]! > b[i]!) return false;
  }
  return false;
}

export async function fetchLatestVersion(
  packageName: string,
): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function fetchLatestVersions(
  packages: Array<{ packageName: string; installedVersion: string | null }>,
): Promise<LatestVersionInfo[]> {
  const results = await Promise.all(
    packages.map(async ({ packageName, installedVersion }) => {
      const latestVersion = await fetchLatestVersion(packageName);
      return {
        packageName,
        installedVersion,
        latestVersion,
        behind: isBehind(installedVersion, latestVersion),
      };
    }),
  );
  return results;
}
