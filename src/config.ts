import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type CodeRadarConfig = {
  openaiApiKey?: string;
};

const CONFIG_DIR = path.join(os.homedir(), ".code-radar");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

/** Entry appended to a project's .gitignore so local key/config never gets committed */
export const GITIGNORE_SECRETS_ENTRY = ".code-radar/";

const GITIGNORE_SECRETS_COMMENT =
  "# OpenAI / code-radar secrets — never commit API keys";

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function gitignoreAlreadyIgnoresCodeRadar(content: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (
      trimmed === ".code-radar" ||
      trimmed === ".code-radar/" ||
      trimmed === ".code-radar/**" ||
      trimmed === "**/.code-radar" ||
      trimmed === "**/.code-radar/" ||
      trimmed === "**/.code-radar/**"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Ensures the project's `.gitignore` ignores `.code-radar/` (local API key / config).
 * Appends the entry at the end if missing. Creates `.gitignore` when needed.
 */
export async function ensureGitignoreHasSecretsEntry(
  projectRoot: string,
): Promise<{ updated: boolean; gitignorePath: string }> {
  const gitignorePath = path.join(projectRoot, ".gitignore");

  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code !== "ENOENT") throw err;
  }

  if (gitignoreAlreadyIgnoresCodeRadar(content)) {
    return { updated: false, gitignorePath };
  }

  let next = content;
  if (next.length > 0 && !next.endsWith("\n")) {
    next += "\n";
  }
  if (next.length > 0) {
    next += "\n";
  }
  next += `${GITIGNORE_SECRETS_COMMENT}\n${GITIGNORE_SECRETS_ENTRY}\n`;

  await fs.writeFile(gitignorePath, next, "utf8");
  return { updated: true, gitignorePath };
}

export async function loadConfig(): Promise<CodeRadarConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as CodeRadarConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: CodeRadarConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export async function resolveApiKey(options?: {
  forcePrompt?: boolean;
}): Promise<string> {
  if (!options?.forcePrompt) {
    const fromEnv = process.env.OPENAI_API_KEY?.trim();
    if (fromEnv) return fromEnv;

    const config = await loadConfig();
    if (config.openaiApiKey?.trim()) return config.openaiApiKey.trim();
  }

  const rl = readline.createInterface({ input, output });
  try {
    const key = (
      await rl.question(
        "Enter your OpenAI API key (saved to ~/.code-radar/config.json): ",
      )
    ).trim();

    if (!key) {
      throw new Error("OpenAI API key is required.");
    }

    if (!key.startsWith("sk-")) {
      console.warn(
        "Warning: key does not look like a typical OpenAI key (sk-...). Continuing anyway.",
      );
    }

    const config = await loadConfig();
    config.openaiApiKey = key;
    await saveConfig(config);
    console.log(`Saved API key to ${CONFIG_PATH}\n`);
    return key;
  } finally {
    rl.close();
  }
}
