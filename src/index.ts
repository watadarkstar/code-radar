import { generateReport } from "./analyze";
import {
  ensureGitignoreHasSecretsEntry,
  getConfigPath,
  loadConfig,
  resolveApiKey,
  saveConfig,
} from "./config";
import { printError, printReport, printScanHeader } from "./format";
import { findProjectRoot, scanProject } from "./scan";
import { fetchLatestVersions } from "./versions";

function printHelp(): void {
  console.log(`package-radar — package news for your codebase

Usage:
  package-radar                 Scan current project and print this week's news radar
  package-radar config          Prompt and save your OpenAI API key
  package-radar config --show   Show whether a key is configured (does not print the key)
  package-radar --help          Show this help

What it does:
  Detects your stack from package.json, looks up npm versions, then uses OpenAI
  web search for major package/framework news with source links.

Environment:
  OPENAI_API_KEY             Overrides saved key for this run
  OPENAI_MODEL               Model name (default: gpt-4.1-mini)

Config file:
  ${getConfigPath()}
`);
}

async function runConfig(args: string[]): Promise<void> {
  if (args.includes("--show") || args.includes("-s")) {
    const config = await loadConfig();
    const envSet = Boolean(process.env.OPENAI_API_KEY?.trim());
    const fileSet = Boolean(config.openaiApiKey?.trim());
    console.log(`Config: ${getConfigPath()}`);
    console.log(`Saved key: ${fileSet ? "yes" : "no"}`);
    console.log(`OPENAI_API_KEY env: ${envSet ? "set" : "not set"}`);
    return;
  }

  if (args.includes("--clear")) {
    const config = await loadConfig();
    delete config.openaiApiKey;
    await saveConfig(config);
    console.log(`Cleared saved API key at ${getConfigPath()}`);
    return;
  }

  await resolveApiKey({ forcePrompt: true });

  // Also protect the project you ran config from
  try {
    const root = await findProjectRoot();
    const gitignore = await ensureGitignoreHasSecretsEntry(root);
    if (gitignore.updated) {
      console.log(
        `Added .package-radar/ to ${gitignore.gitignorePath} so API keys are not committed.`,
      );
    }
  } catch {
    // Not inside a Node project — home config is still safe outside git
  }
}

async function runRadar(): Promise<void> {
  const apiKey = await resolveApiKey();

  const scan = await scanProject();

  const gitignore = await ensureGitignoreHasSecretsEntry(scan.projectRoot);
  if (gitignore.updated) {
    console.log(
      `Added .package-radar/ to ${gitignore.gitignorePath} so API keys are not committed.\n`,
    );
  }

  printScanHeader(scan);

  process.stdout.write("Checking npm for latest package versions...\n");
  const versions = await fetchLatestVersions(
    scan.detected.map((d) => ({
      packageName: d.packageName,
      installedVersion: d.installedVersion,
    })),
  );

  process.stdout.write(
    "Searching the web for major package news (OpenAI)...\n\n",
  );
  const report = await generateReport({
    apiKey,
    scan,
    versions,
  });

  printReport(report);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args[0] === "config") {
    await runConfig(args.slice(1));
    return;
  }

  if (args[0] === "help") {
    printHelp();
    return;
  }

  if (args.length > 0 && !args[0]!.startsWith("-")) {
    printError(`Unknown command: ${args[0]}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  await runRadar();
}

main().catch((err: unknown) => {
  printError(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
