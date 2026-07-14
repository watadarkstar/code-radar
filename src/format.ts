import type { ProjectScan } from "./scan";
import type { RadarReport } from "./analyze";

const DIVIDER = "──────────────";

export function printScanHeader(scan: ProjectScan): void {
  console.log("🔍 Scanning your project...\n");
  console.log("Detected:\n");
  for (const tech of scan.detected) {
    console.log(`✓ ${tech.label}`);
  }
  console.log(`\n${DIVIDER}\n`);
}

export function printReport(report: RadarReport): void {
  const count = report.items.length;
  const headline =
    report.headline ||
    `${count} thing${count === 1 ? "" : "s"} happened this week`;

  const withFire = headline.startsWith("🔥") ? headline : `🔥 ${headline}`;
  console.log(`${withFire}\n`);

  for (let i = 0; i < report.items.length; i++) {
    const item = report.items[i]!;
    const n = i + 1;

    // Match sample: numbered first items, emoji-led titles for the rest
    if (i === 0) {
      console.log(`${n}. ${item.title}\n`);
    } else {
      const title = item.title.startsWith(item.emoji)
        ? item.title
        : `${item.emoji} ${item.title}`;
      console.log(`${title}\n`);
    }

    if (item.summary && item.summary !== item.whyCare) {
      console.log(item.summary);
      console.log("");
    }

    console.log("You should care because:");
    console.log(item.whyCare);
    console.log("");

    if (item.sources.length > 0) {
      console.log("Sources:");
      for (const source of item.sources) {
        console.log(`• ${source.title}`);
        console.log(`  ${source.url}`);
      }
      console.log("");
    }

    console.log("Recommendation:");
    console.log(item.recommendation);
    console.log(`\n${DIVIDER}\n`);
  }
}

export function printError(message: string): void {
  console.error(`Error: ${message}`);
}
