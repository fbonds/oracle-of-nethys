import crypto from "crypto";
import fs from "fs";
import path from "path";
import { streamAllEntries, AON_SITE } from "./aon";
import { openDb, dbExists, readMeta } from "./db";

const DIGESTS = path.join(__dirname, ".oracle", "digests");

// Cap the per-entry listing so a bulk reindex produces a readable digest rather
// than a 45,000-line wall. Anything dropped is stated in the digest, not hidden.
const MAX_LISTED = 150;

interface Entry {
  name: string;
  category: string;
  url?: string;
}
type Hashed = Entry & { hash: string };

const digest16 = (text: string) =>
  crypto.createHash("sha256").update(text ?? "").digest("hex").slice(0, 16);

/** Hash the local database's rules text, so the diff compares the archives
 *  against what the oracle is actually answering from — not a side manifest
 *  that could drift from it. */
function localHashes() {
  const db = openDb();
  try {
    const rows = db
      .prepare("SELECT id, name, category, url, markdown FROM entries")
      .all() as any[];
    return new Map<string, Hashed>(
      rows.map((row) => [
        row.id,
        {
          hash: digest16(row.markdown),
          name: row.name,
          category: row.category,
          url: row.url ?? undefined,
        },
      ])
    );
  } finally {
    db.close();
  }
}

async function liveHashes() {
  const entries = new Map<string, Hashed>();
  let count = 0;
  for await (const entry of streamAllEntries(["id", "name", "category", "markdown", "url"])) {
    if (!entry?.id || !entry.name || !entry.category) continue;
    entries.set(entry.id, {
      hash: digest16(entry.markdown),
      name: entry.name,
      category: entry.category,
      url: entry.url,
    });
    if (++count % 10000 === 0) console.log(`  …${count} entries`);
  }
  return entries;
}

function byCategory(entries: Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function renderSection(title: string, entries: Entry[]) {
  if (!entries.length) return "";
  let out = `\n## ${title} (${entries.length})\n`;
  let listed = 0;
  for (const [category, items] of byCategory(entries)) {
    out += `\n**${category}** — ${items.length}\n`;
    for (const item of items) {
      if (listed >= MAX_LISTED) continue;
      out += `- ${item.name}${item.url ? ` — ${AON_SITE}${item.url}` : ""}\n`;
      listed++;
    }
  }
  if (entries.length > listed) {
    out += `\n_(${entries.length - listed} more not listed.)_\n`;
  }
  return out;
}

async function main() {
  if (!dbExists()) {
    console.log("No local database yet — run `pnpm scrape` first.");
    return;
  }

  const meta = readMeta();
  console.log(
    `Local database: ${meta?.entryCount ?? 0} entries, built ${meta?.builtAt?.slice(0, 10)}.`
  );
  console.log("Checking the archives for changes…");

  const local = localHashes();
  const live = await liveHashes();

  const added: Entry[] = [];
  const changed: Entry[] = [];
  const removed: Entry[] = [];

  for (const [id, entry] of live) {
    const prior = local.get(id);
    if (!prior) added.push(entry);
    else if (prior.hash !== entry.hash) changed.push(entry);
  }
  for (const [id, entry] of local) {
    if (!live.has(id)) removed.push(entry);
  }

  const touched = added.length + changed.length + removed.length;
  console.log(
    `\n${live.size} entries live — ${added.length} added, ${changed.length} changed, ` +
      `${removed.length} removed since your last scrape.`
  );

  if (touched === 0) {
    console.log("Local database is current. Nothing to do.");
    return;
  }

  fs.mkdirSync(DIGESTS, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const report =
    `# Archives of Nethys — changes since your last scrape\n\n` +
    `Local database built ${meta?.builtAt?.slice(0, 10)} with ${meta?.entryCount} entries. ` +
    `The live index now holds ${live.size}: ${added.length} added, ${changed.length} changed, ` +
    `${removed.length} removed.\n` +
    renderSection("Added", added) +
    renderSection("Changed", changed) +
    renderSection("Removed", removed);

  const digestPath = path.join(DIGESTS, `${stamp}.md`);
  fs.writeFileSync(digestPath, report);

  console.log(`\nDigest: ${digestPath}`);
  console.log("Run `pnpm scrape` to bring the local database up to date.");
  console.log("Ask Claude Code to read the digest if you want it summarized.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
