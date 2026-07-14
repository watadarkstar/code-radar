<p align="center">
  <img src="./assets/hero.svg" alt="Code Radar — package news for your codebase" width="100%" />
</p>

<h3 align="center">
  Code Radar
</h3>

<p align="center">
  Weekly package news for <em>your</em> stack — with source links.<br/>
  Scan <code>package.json</code>, detect your frameworks, get major release headlines that matter.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/code-radar">
    <img alt="npm version" src="https://badge.fury.io/js/code-radar.svg?icon=si%3Anpm"/>
  </a>
  <a title="License" href="https://github.com/watadarkstar/code-radar/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <a href="https://nodejs.org/">
    <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" />
  </a>
</p>

<p align="center">
  <a href="https://x.com/icookandcode" target="_blank">
    Need help building developer tools? Connect with Adrian on X
  </a>
</p>

---

```
🔍 Scanning your project...

Detected:

✓ React Native 0.82
✓ Expo SDK 54
✓ TypeScript 7
✓ Drizzle ORM

──────────────

🔥 5 things happened this week

1. TypeScript 7

You should care because:
Your project has 1,342 TypeScript files.
This release improves incremental builds.

Sources:
• Announcing TypeScript 7
  https://devblogs.microsoft.com/typescript/...

Recommendation:
Worth testing.

──────────────
```

## Features

- Detects your stack from `package.json` (TypeScript, Expo, React Native, Next.js, Drizzle, and more)
- Looks up latest versions on npm
- Uses OpenAI web search for **major** package/framework news
- Source links on every item (blogs, changelogs, GitHub Releases)
- Saves your OpenAI API key locally (`~/.code-radar/`) and protects project `.gitignore`

Code Radar focuses on major news — not security audits or CVE noise.

## Requirements

- **Node.js** 20 or later
- An **OpenAI API key** with access to the Responses API + web search

## Installation

Using npm:

```bash
npm install -g code-radar
```

Using yarn:

```bash
yarn global add code-radar
```

Or run once without installing:

```bash
npx code-radar
```

## Usage

From any Node project directory:

```bash
code-radar
```

First run prompts for your OpenAI API key (saved to `~/.code-radar/config.json`). You can also set `OPENAI_API_KEY` in the environment.

```bash
code-radar config          # save / update API key
code-radar config --show   # check if a key is configured
code-radar config --clear  # remove saved key
code-radar --help
```

### What happens on each run

1. **Scan** — nearest `package.json`, known frameworks, source file counts  
2. **Registry** — latest versions on npm for detected packages  
3. **News** — OpenAI web search for major announcements  
4. **Report** — why it matters, recommendation, and source URLs  
5. **Safety** — appends `.code-radar/` to the project `.gitignore` if missing  

### Config & environment

| Variable / path | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes* | Overrides the saved key when set. [Get a key](https://platform.openai.com/api-keys). |
| `OPENAI_MODEL` | No | Model name (default: `gpt-4.1-mini`). |
| `~/.code-radar/config.json` | — | Where the API key is stored after `code-radar config`. |

\*Required either as env var or via `code-radar config`.

## Local development

```bash
git clone https://github.com/watadarkstar/code-radar.git
cd code-radar
yarn install
yarn start          # run via tsx
yarn build          # emit dist/
yarn typecheck
```

| Script | Description |
| --- | --- |
| `yarn start` / `yarn radar` / `yarn dev` | Run the CLI from source |
| `yarn build` | Build with tsup → `dist/` |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn clean` | Remove `dist/` |
| `yarn release:dry` | Dry-run a release |
| `yarn release` | Version, tag, GitHub release, publish to npm |

## License

[MIT](LICENSE)

## Author

Feel free to ask me questions on Twitter [@icookandcode](https://www.twitter.com/icookandcode)!

## Contributors

Submit a PR to contribute :)

## Release

We use [`release-it`](https://github.com/release-it/release-it) to version, tag, create a GitHub release, and publish to npm.

Prerequisites:

1. Logged into npm: `npm login`
2. `GH_TOKEN` (or `GITHUB_TOKEN`) with repo access if you want GitHub releases
3. Clean git working tree on the default branch

Then:

```bash
yarn run release:dry
yarn run release
```

`release:dry` prints what would happen without publishing. `release` bumps the version, runs typecheck + build, commits/tags, creates a GitHub release, and publishes `code-radar` to the npm registry.

---

<div align="center">

**Stay ahead of your stack.**

⭐ **Star this repo** • 💬 **[Contact Adrian](https://x.com/icookandcode)**

_Built with ❤️ by [Adrian](https://x.com/icookandcode)_

</div>

---

**Keywords:** cli, code-radar, package news, dependencies, changelog, npm, openai, typescript, developer-tools
