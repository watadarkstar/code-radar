import fs from "node:fs/promises";
import path from "node:path";

export type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  packageManager?: string;
};

export type DetectedTech = {
  id: string;
  label: string;
  packageName: string;
  installedVersion: string | null;
  range: string | null;
};

export type ProjectScan = {
  projectRoot: string;
  packageJson: PackageJson;
  packageManager: "yarn" | "npm" | "pnpm" | "bun" | "unknown";
  allDependencies: Record<string, string>;
  detected: DetectedTech[];
  fileCounts: {
    typescript: number;
    javascript: number;
    totalSource: number;
  };
};

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".expo",
  "coverage",
  ".turbo",
  ".cache",
  "ios",
  "android",
  "vendor",
  ".yarn",
]);

/** Known packages → human labels for radar output */
const TECH_CATALOG: Array<{
  id: string;
  packageName: string;
  label: (version: string | null) => string;
}> = [
  {
    id: "react-native",
    packageName: "react-native",
    label: (v) => (v ? `React Native ${v}` : "React Native"),
  },
  {
    id: "expo",
    packageName: "expo",
    label: (v) => (v ? `Expo SDK ${major(v)}` : "Expo"),
  },
  {
    id: "typescript",
    packageName: "typescript",
    label: (v) => (v ? `TypeScript ${v}` : "TypeScript"),
  },
  {
    // Some projects install TS 7 under this alias while keeping TS 6 as `typescript` for tooling
    id: "typescript-native",
    packageName: "@typescript/native",
    label: (v) => (v ? `TypeScript ${v}` : "TypeScript (native)"),
  },
  {
    id: "drizzle",
    packageName: "drizzle-orm",
    label: () => "Drizzle ORM",
  },
  {
    id: "prisma",
    packageName: "@prisma/client",
    label: () => "Prisma",
  },
  {
    id: "next",
    packageName: "next",
    label: (v) => (v ? `Next.js ${v}` : "Next.js"),
  },
  {
    id: "react",
    packageName: "react",
    label: (v) => (v ? `React ${v}` : "React"),
  },
  {
    id: "vue",
    packageName: "vue",
    label: (v) => (v ? `Vue ${v}` : "Vue"),
  },
  {
    id: "svelte",
    packageName: "svelte",
    label: (v) => (v ? `Svelte ${v}` : "Svelte"),
  },
  {
    id: "express",
    packageName: "express",
    label: (v) => (v ? `Express ${v}` : "Express"),
  },
  {
    id: "nestjs",
    packageName: "@nestjs/core",
    label: () => "NestJS",
  },
  {
    id: "fastify",
    packageName: "fastify",
    label: (v) => (v ? `Fastify ${v}` : "Fastify"),
  },
  {
    id: "hono",
    packageName: "hono",
    label: (v) => (v ? `Hono ${v}` : "Hono"),
  },
  {
    id: "zod",
    packageName: "zod",
    label: (v) => (v ? `Zod ${v}` : "Zod"),
  },
  {
    id: "tailwind",
    packageName: "tailwindcss",
    label: (v) => (v ? `Tailwind CSS ${v}` : "Tailwind CSS"),
  },
  {
    id: "vite",
    packageName: "vite",
    label: (v) => (v ? `Vite ${v}` : "Vite"),
  },
  {
    id: "vitest",
    packageName: "vitest",
    label: () => "Vitest",
  },
  {
    id: "jest",
    packageName: "jest",
    label: () => "Jest",
  },
  {
    id: "openai",
    packageName: "openai",
    label: () => "OpenAI SDK",
  },
  {
    id: "trpc",
    packageName: "@trpc/server",
    label: () => "tRPC",
  },
];

function major(version: string): string {
  const cleaned = version.replace(/^[\^~>=<\s]*/, "");
  return cleaned.split(".")[0] ?? cleaned;
}

function stripRange(range: string): string {
  return range.replace(/^[\^~>=<\s]*/, "").split(" ")[0] ?? range;
}

export function mergeDependencies(
  pkg: PackageJson,
): Record<string, string> {
  return {
    ...pkg.optionalDependencies,
    ...pkg.peerDependencies,
    ...pkg.devDependencies,
    ...pkg.dependencies,
  };
}

export async function findProjectRoot(
  startDir: string = process.cwd(),
): Promise<string> {
  let dir = path.resolve(startDir);
  for (;;) {
    try {
      await fs.access(path.join(dir, "package.json"));
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) {
        throw new Error(
          "No package.json found. Run code-radar from inside a Node project.",
        );
      }
      dir = parent;
    }
  }
}

export async function detectPackageManager(
  projectRoot: string,
  pkg: PackageJson,
): Promise<ProjectScan["packageManager"]> {
  if (pkg.packageManager?.startsWith("pnpm")) return "pnpm";
  if (pkg.packageManager?.startsWith("yarn")) return "yarn";
  if (pkg.packageManager?.startsWith("bun")) return "bun";
  if (pkg.packageManager?.startsWith("npm")) return "npm";

  const checks: Array<[string, ProjectScan["packageManager"]]> = [
    ["yarn.lock", "yarn"],
    ["pnpm-lock.yaml", "pnpm"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];

  for (const [file, pm] of checks) {
    try {
      await fs.access(path.join(projectRoot, file));
      return pm;
    } catch {
      // continue
    }
  }

  return "unknown";
}

async function readInstalledVersion(
  projectRoot: string,
  packageName: string,
): Promise<string | null> {
  const pkgPath = path.join(
    projectRoot,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const json = JSON.parse(raw) as { version?: string };
    return json.version ?? null;
  } catch {
    return null;
  }
}

export async function countSourceFiles(
  projectRoot: string,
): Promise<ProjectScan["fileCounts"]> {
  let typescript = 0;
  let javascript = 0;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (entry.isDirectory()) continue;
      }
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts") {
        typescript += 1;
      } else if (
        ext === ".js" ||
        ext === ".jsx" ||
        ext === ".mjs" ||
        ext === ".cjs"
      ) {
        javascript += 1;
      }
    }
  }

  await walk(projectRoot);

  return {
    typescript,
    javascript,
    totalSource: typescript + javascript,
  };
}

export async function scanProject(
  cwd: string = process.cwd(),
): Promise<ProjectScan> {
  const projectRoot = await findProjectRoot(cwd);
  const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
  const packageJson = JSON.parse(raw) as PackageJson;
  const allDependencies = mergeDependencies(packageJson);
  const packageManager = await detectPackageManager(projectRoot, packageJson);

  const detected: DetectedTech[] = [];

  for (const tech of TECH_CATALOG) {
    const range = allDependencies[tech.packageName];
    if (!range) continue;

    // Avoid double-counting React when React Native is present (still useful though)
    const installedVersion =
      (await readInstalledVersion(projectRoot, tech.packageName)) ??
      stripRange(range);

    detected.push({
      id: tech.id,
      label: tech.label(installedVersion),
      packageName: tech.packageName,
      installedVersion,
      range,
    });
  }

  // If nothing matched, surface a few top-level deps so the model still has context
  if (detected.length === 0) {
    const top = Object.entries(allDependencies).slice(0, 8);
    for (const [name, range] of top) {
      const installedVersion =
        (await readInstalledVersion(projectRoot, name)) ?? stripRange(range);
      detected.push({
        id: name,
        label: `${name}@${installedVersion}`,
        packageName: name,
        installedVersion,
        range,
      });
    }
  }

  const fileCounts = await countSourceFiles(projectRoot);

  return {
    projectRoot,
    packageJson,
    packageManager,
    allDependencies,
    detected,
    fileCounts,
  };
}
