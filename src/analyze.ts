import OpenAI from "openai";
import type { ProjectScan } from "./scan";
import type { LatestVersionInfo } from "./versions";

export type NewsSource = {
  title: string;
  url: string;
};

export type RadarItem = {
  emoji: string;
  title: string;
  summary: string;
  whyCare: string;
  recommendation: string;
  sources: NewsSource[];
};

export type RadarReport = {
  headline: string;
  items: RadarItem[];
};

/** Official / high-signal places to look when web search is unavailable */
const PACKAGE_NEWS_HOMES: Record<string, { label: string; url: string }> = {
  typescript: {
    label: "TypeScript blog",
    url: "https://devblogs.microsoft.com/typescript/",
  },
  "@typescript/native": {
    label: "TypeScript blog",
    url: "https://devblogs.microsoft.com/typescript/",
  },
  expo: {
    label: "Expo changelog",
    url: "https://expo.dev/changelog",
  },
  "react-native": {
    label: "React Native blog",
    url: "https://reactnative.dev/blog",
  },
  react: {
    label: "React blog",
    url: "https://react.dev/blog",
  },
  next: {
    label: "Next.js blog",
    url: "https://nextjs.org/blog",
  },
  vue: {
    label: "Vue blog",
    url: "https://blog.vuejs.org/",
  },
  svelte: {
    label: "Svelte blog",
    url: "https://svelte.dev/blog",
  },
  "drizzle-orm": {
    label: "Drizzle announcements",
    url: "https://orm.drizzle.team/docs/latest-releases",
  },
  "@prisma/client": {
    label: "Prisma blog",
    url: "https://www.prisma.io/blog",
  },
  vite: {
    label: "Vite blog",
    url: "https://vite.dev/blog/",
  },
  tailwindcss: {
    label: "Tailwind blog",
    url: "https://tailwindcss.com/blog",
  },
  openai: {
    label: "OpenAI changelog",
    url: "https://developers.openai.com/changelog",
  },
  express: {
    label: "Express releases",
    url: "https://github.com/expressjs/express/releases",
  },
  "@nestjs/core": {
    label: "NestJS releases",
    url: "https://github.com/nestjs/nest/releases",
  },
  hono: {
    label: "Hono releases",
    url: "https://github.com/honojs/hono/releases",
  },
  "@trpc/server": {
    label: "tRPC blog",
    url: "https://trpc.io/blog",
  },
  zod: {
    label: "Zod releases",
    url: "https://github.com/colinhacks/zod/releases",
  },
};

const SYSTEM_PROMPT = `You are Code Radar, a developer news briefing tool.

Given a scanned Node/JS/TS project, search the web for MAJOR recent package/framework NEWS that is relevant to the detected stack.

What counts as "major news":
- New major/minor releases of libraries they use
- Official blog posts, changelogs, RC/beta announcements
- Breaking-change notices, migration guides, platform roadmap updates
- Framework SDK releases (Expo, React Native, Next.js, TypeScript, etc.)

What to EXCLUDE:
- Security advisories, CVEs, vulnerability audits
- Minor patch-only noise unless it is unusually important
- Generic tips unrelated to recent public news
- Invented URLs — only cite real sources you found via web search

Rules:
- Only cover technologies present in the project.
- Prefer major releases and official announcements from the last ~1–4 weeks when possible; include slightly older major news if nothing fresher exists.
- 3–6 items max. Quality over quantity.
- Every item MUST include at least one real source URL (blog post, changelog, GitHub release, docs).
- "whyCare" should tie the news to THIS project (versions installed, file counts, package manager).
- "summary" is 1–2 sentences of what happened in the news.
- "recommendation" is one short sentence (e.g. "Worth testing", "Wait for stable", "Read the migration guide").
- headline like "5 things happened this week".
- Emojis: 🔥 📱 ⚡ 🧰 🧪 📦 🚀 etc. Never 🔒 for security.

Return ONLY valid JSON:
{
  "headline": string,
  "items": [
    {
      "emoji": string,
      "title": string,
      "summary": string,
      "whyCare": string,
      "recommendation": string,
      "sources": [{ "title": string, "url": string }]
    }
  ]
}`;

function buildUserPrompt(input: {
  scan: ProjectScan;
  versions: LatestVersionInfo[];
}): string {
  const { scan, versions } = input;

  const context = {
    project: {
      name: scan.packageJson.name ?? null,
      packageManager: scan.packageManager,
    },
    fileCounts: scan.fileCounts,
    detectedStack: scan.detected.map((d) => ({
      id: d.id,
      label: d.label,
      packageName: d.packageName,
      installedVersion: d.installedVersion,
      range: d.range,
    })),
    registryVersions: versions.map((v) => ({
      packageName: v.packageName,
      installedVersion: v.installedVersion,
      latestOnNpm: v.latestVersion,
      behindLatest: v.behind,
    })),
    knownOfficialHomes: scan.detected
      .map((d) => PACKAGE_NEWS_HOMES[d.packageName])
      .filter(Boolean),
    today: new Date().toISOString().slice(0, 10),
    searchHints: scan.detected.map(
      (d) =>
        `${d.label} release announcement OR changelog OR blog ${new Date().getFullYear()}`,
    ),
  };

  return `Search for major package news relevant to this project, then produce a Code Radar news briefing as JSON.

Project context:
${JSON.stringify(context, null, 2)}

Prefer sources like official blogs, GitHub Releases, framework changelogs, and reputable tech news (e.g. TypeScript blog for TS 7, Expo changelog for SDK releases).`;
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSources(raw: unknown): NewsSource[] {
  if (!Array.isArray(raw)) return [];
  const out: NewsSource[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const title = String((s as NewsSource).title ?? "").trim() || "Source";
    const url = String((s as NewsSource).url ?? "").trim();
    if (!isHttpUrl(url)) continue;
    out.push({ title, url });
  }
  return out;
}

function parseReport(content: string): RadarReport | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const data = JSON.parse(cleaned) as RadarReport;
    if (!data || !Array.isArray(data.items)) return null;

    const items = data.items
      .filter(
        (i) =>
          i &&
          i.title &&
          (i.whyCare || i.summary) &&
          i.recommendation,
      )
      .map((i) => ({
        emoji: i.emoji || "📰",
        title: i.title,
        summary: i.summary || i.whyCare,
        whyCare: i.whyCare || i.summary,
        recommendation: i.recommendation,
        sources: normalizeSources(i.sources),
      }))
      // Prefer items that have real links; keep a few without only if needed later
      .filter((i) => i.sources.length > 0);

    if (items.length === 0) return null;

    return {
      headline:
        data.headline || `${items.length} things happened this week`,
      items,
    };
  } catch {
    return null;
  }
}

function fallbackReport(input: {
  scan: ProjectScan;
  versions: LatestVersionInfo[];
}): RadarReport {
  const items: RadarItem[] = [];

  for (const v of input.versions) {
    if (!v.latestVersion) continue;
    const tech = input.scan.detected.find(
      (d) => d.packageName === v.packageName,
    );
    const home = PACKAGE_NEWS_HOMES[v.packageName];
    const name =
      tech?.label.replace(/\s+\d.*$/, "") ?? v.packageName;

    if (!v.behind && !home) continue;

    const sources: NewsSource[] = [];
    if (home) sources.push({ title: home.label, url: home.url });
    sources.push({
      title: `${v.packageName} on npm`,
      url: `https://www.npmjs.com/package/${v.packageName}`,
    });

    items.push({
      emoji: "📦",
      title: v.behind
        ? `${name} ${v.latestVersion}`
        : `${name} latest: ${v.latestVersion}`,
      summary: v.behind
        ? `npm latest is ${v.latestVersion}; this project is on ${v.installedVersion}.`
        : `You are on the current npm latest (${v.latestVersion}).`,
      whyCare: input.scan.fileCounts.typescript
        ? `Your project has ${input.scan.fileCounts.typescript.toLocaleString()} TypeScript files and depends on ${v.packageName}.`
        : `Your project depends on ${v.packageName}.`,
      recommendation: v.behind
        ? v.latestVersion.includes("rc") || v.latestVersion.includes("beta")
          ? "Wait for stable, then read the release notes."
          : "Skim the official release notes before upgrading."
        : "No action needed — check official channels next week.",
      sources,
    });
  }

  if (items.length === 0) {
    items.push({
      emoji: "📡",
      title: "No major package headlines found offline",
      summary:
        "Could not reach OpenAI web search. Showing official news homes for your stack.",
      whyCare: "Re-run with a valid OpenAI API key for a live news briefing.",
      recommendation: "Check official blogs for your main frameworks.",
      sources: input.scan.detected
        .map((d) => PACKAGE_NEWS_HOMES[d.packageName])
        .filter((h): h is { label: string; url: string } => Boolean(h))
        .map((h) => ({ title: h.label, url: h.url })),
    });
  }

  return {
    headline: `${Math.min(items.length, 6)} package news items for your stack`,
    items: items.slice(0, 6),
  };
}

function extractResponseText(response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (response.output_text?.trim()) return response.output_text.trim();

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message" || !item.content) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function generateReport(input: {
  apiKey: string;
  scan: ProjectScan;
  versions: LatestVersionInfo[];
  model?: string;
}): Promise<RadarReport> {
  const client = new OpenAI({ apiKey: input.apiKey });
  const model = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const userPrompt = buildUserPrompt({
    scan: input.scan,
    versions: input.versions,
  });

  try {
    // Prefer Responses API + web search so links are grounded in real sources
    const response = await client.responses.create({
      model,
      temperature: 0.3,
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ],
      tool_choice: "auto",
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
    });

    const content = extractResponseText(response);
    if (!content) throw new Error("Empty response from OpenAI");

    const parsed = parseReport(content);
    if (parsed && parsed.items.length > 0) return parsed;

    // Model sometimes wraps JSON in prose — try chat completion JSON fallback without search
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}

If you cannot verify URLs, use only well-known official homes (TypeScript blog, Expo changelog, React blog, npm package pages, GitHub releases). Never invent article paths.`,
        },
        { role: "user", content: userPrompt },
        {
          role: "user",
          content: `Previous draft (may be partial):\n${content}\n\nReturn corrected JSON only, with real source URLs.`,
        },
      ],
    });

    const retry = completion.choices[0]?.message?.content;
    if (retry) {
      const retried = parseReport(retry);
      if (retried && retried.items.length > 0) return retried;
    }

    return fallbackReport(input);
  } catch (err) {
    console.warn(
      `OpenAI news search failed (${err instanceof Error ? err.message : String(err)}). Using registry + official blogs only.\n`,
    );
    return fallbackReport(input);
  }
}
