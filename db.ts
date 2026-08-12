import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { config } from "./config";

export const DB_PATH = path.join(__dirname, config.dbPath);

// A hit on the entry's name, or on a legacy name it replaced, outranks one
// buried in its rules text.
const BM25_WEIGHTS = "15.0, 12.0, 3.0, 3.0, 1.0";

const SCHEMA = `
CREATE TABLE entries (
  rowid        INTEGER PRIMARY KEY,
  id           TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  type         TEXT,
  level        INTEGER,
  rarity       TEXT,
  traits       TEXT,
  traits_text  TEXT,
  source       TEXT,
  summary      TEXT,
  url          TEXT,
  body         TEXT,
  markdown     TEXT,
  legacy_ids   TEXT,
  aliases      TEXT,
  superseded   INTEGER NOT NULL DEFAULT 0,
  release_date TEXT
);
CREATE INDEX idx_category ON entries(category);
CREATE INDEX idx_level ON entries(level);

-- Trait filters need AND semantics across several traits, which a single
-- delimited column can't express cleanly.
CREATE TABLE entry_traits (
  entry_rowid INTEGER NOT NULL,
  trait       TEXT NOT NULL
);
CREATE INDEX idx_trait ON entry_traits(trait, entry_rowid);

-- No porter stemming: this corpus uses precise terminology, and stemming
-- conflates "Evasion" with "Evasive"/"Evasiveness", burying exact matches.
CREATE VIRTUAL TABLE fts USING fts5(
  name, aliases, summary, traits_text, body,
  content='entries', content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

export interface RawEntry {
  id: string;
  name?: string;
  category?: string;
  type?: string;
  level?: number;
  rarity?: string;
  trait?: string[];
  primary_source?: string;
  summary?: string;
  url?: string;
  search_markdown?: string;
  markdown?: string;
  text?: string;
  remaster_id?: string[];
  legacy_id?: string[];
  release_date?: string;
}

export const SOURCE_FIELDS = [
  "id",
  "name",
  "category",
  "type",
  "level",
  "rarity",
  "trait",
  "primary_source",
  "summary",
  "url",
  "search_markdown",
  "markdown",
  "release_date",
  "remaster_id",
  "legacy_id",
];

export function openDb(readonly = true) {
  return new DatabaseSync(DB_PATH, readonly ? { readOnly: true } : {});
}

export function dbExists() {
  return fs.existsSync(DB_PATH);
}

/** Build a fresh database from scraped entries. Writes to a temp file and
 *  swaps on success, so an interrupted build never leaves a half-written DB
 *  in place of a working one. */
export function createBuilder() {
  const tmp = `${DB_PATH}.building`;
  fs.rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = OFF");
  db.exec(SCHEMA);

  const insertEntry = db.prepare(`
    INSERT INTO entries (id, name, category, type, level, rarity, traits,
                         traits_text, source, summary, url, body, markdown,
                         superseded, release_date, legacy_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTrait = db.prepare(
    "INSERT INTO entry_traits (entry_rowid, trait) VALUES (?, ?)"
  );

  let count = 0;
  db.exec("BEGIN");

  return {
    add(entry: RawEntry) {
      if (!entry?.id || !entry.name || !entry.category) return;
      const traits = entry.trait ?? [];
      const result = insertEntry.run(
        entry.id,
        entry.name,
        entry.category,
        entry.type ?? null,
        entry.level ?? null,
        entry.rarity ?? null,
        JSON.stringify(traits),
        traits.join(" "),
        entry.primary_source ?? null,
        entry.summary ?? null,
        entry.url ?? null,
        entry.search_markdown ?? entry.summary ?? "",
        entry.markdown ?? entry.text ?? "",
        entry.remaster_id?.length ? 1 : 0,
        entry.release_date ?? null,
        entry.legacy_id?.length ? JSON.stringify(entry.legacy_id) : null
      );
      const rowid = Number(result.lastInsertRowid);
      for (const trait of traits) insertTrait.run(rowid, trait);
      count++;
      // Periodic commits keep the transaction from growing unbounded.
      if (count % 5000 === 0) {
        db.exec("COMMIT");
        db.exec("BEGIN");
      }
    },
    finish(indexName: string) {
      db.exec("COMMIT");
      resolveAliases(db);
      db.exec("INSERT INTO fts(fts) VALUES('rebuild')");
      const setMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
      setMeta.run("built_at", new Date().toISOString());
      setMeta.run("entry_count", String(count));
      setMeta.run("source_index", indexName);
      db.exec("PRAGMA journal_mode = DELETE");
      db.exec("VACUUM");
      db.close();
      fs.renameSync(tmp, DB_PATH);
      return count;
    },
  };
}

// AoN's own index maps legacy rule names onto their replacements, which is how
// a search for "Power Attack" finds Vicious Swing even though that text appears
// nowhere in the entry. Their synonym list isn't readable, but the same mapping
// is recoverable: each remastered entry names the legacy entries it replaced, so
// index those old names as aliases.
function resolveAliases(db: DatabaseSync) {
  const names = new Map<string, string>();
  for (const row of db.prepare("SELECT id, name FROM entries").all() as any[]) {
    names.set(row.id, row.name);
  }
  const update = db.prepare("UPDATE entries SET aliases = ? WHERE rowid = ?");
  const rows = db
    .prepare("SELECT rowid, legacy_ids FROM entries WHERE legacy_ids IS NOT NULL")
    .all() as any[];

  db.exec("BEGIN");
  let linked = 0;
  for (const row of rows) {
    const aliases = (JSON.parse(row.legacy_ids) as string[])
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name));
    if (!aliases.length) continue;
    update.run([...new Set(aliases)].join(" "), row.rowid);
    linked++;
  }
  db.exec("COMMIT");
  console.log(`  linked ${linked} entries to their pre-Remaster names`);
}

export function readMeta() {
  if (!dbExists()) return null;
  try {
    const db = openDb();
    const rows = db.prepare("SELECT key, value FROM meta").all() as any[];
    db.close();
    const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const builtAt = meta.built_at ? new Date(meta.built_at) : null;
    const ageDays = builtAt ? (Date.now() - builtAt.getTime()) / 86400000 : Infinity;
    return {
      builtAt: meta.built_at as string | undefined,
      entryCount: Number(meta.entry_count ?? 0),
      ageDays,
      stale: ageDays > config.maxAgeDays,
    };
  } catch {
    return null;
  }
}

// Questions arrive phrased naturally ("how does dying work"), and requiring
// every word to match buries the entry the reader actually wants.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "does", "did", "how", "what", "when", "why",
  "who", "which", "are", "can", "you", "your", "work", "works", "get", "got",
  "use", "using", "about", "from", "into", "that", "this", "have", "has", "was",
  "were", "there", "them", "they", "its", "some", "any", "all", "one", "two",
]);

// FTS5 treats bare punctuation as syntax. Quoting each term makes any user
// phrase safe to pass through — "off-guard" would otherwise be a parse error.
function queryWords(query: string) {
  const words = query.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  const meaningful = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  return meaningful.length ? meaningful : words;
}

export interface LocalSearchParams {
  query: string;
  category?: string[];
  traits?: string[];
  level_min?: number;
  level_max?: number;
  include_legacy?: boolean;
  limit?: number;
}

export function searchLocal(params: LocalSearchParams) {
  const words = queryWords(params.query);
  if (!words.length) return [];
  const terms = words.map((word) => `"${word}"`);

  const where: string[] = ["fts MATCH ?"];
  const args: any[] = [];

  if (!params.include_legacy) where.push("e.superseded = 0");
  if (params.category?.length) {
    where.push(`e.category IN (${params.category.map(() => "?").join(",")})`);
    args.push(...params.category);
  }
  for (const trait of params.traits ?? []) {
    where.push(
      "EXISTS (SELECT 1 FROM entry_traits t WHERE t.entry_rowid = e.rowid AND t.trait = ?)"
    );
    args.push(trait);
  }
  if (params.level_min != null) {
    where.push("e.level >= ?");
    args.push(params.level_min);
  }
  if (params.level_max != null) {
    where.push("e.level <= ?");
    args.push(params.level_max);
  }

  const limit = Math.min(params.limit ?? 12, 40);
  const sql = `SELECT e.id, e.name, e.category, e.type, e.level, e.rarity, e.traits,
                      e.source, e.summary, e.url, e.superseded,
                      bm25(fts, ${BM25_WEIGHTS}) AS rank
               FROM fts JOIN entries e ON e.rowid = fts.rowid
               WHERE ${where.join(" AND ")}
               ORDER BY rank
               LIMIT ?`;

  const db = openDb();
  try {
    const statement = db.prepare(sql);
    const run = (expression: string) =>
      statement.all(expression, ...args, limit) as any[];

    // Require every term first — an OR over "power"/"attack" matches thousands
    // of entries containing "attack" and drowns the one that matters. Then top
    // up from a looser OR pass, so precise hits lead and recall still fills the
    // page when no single entry carries every term.
    const rows = terms.length > 1 ? run(terms.join(" AND ")) : run(terms[0]);
    if (rows.length < limit && terms.length > 1) {
      const seen = new Set(rows.map((row) => row.id));
      for (const row of run(terms.join(" OR "))) {
        if (rows.length >= limit) break;
        if (!seen.has(row.id)) {
          seen.add(row.id);
          rows.push(row);
        }
      }
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      type: row.type ?? undefined,
      level: row.level ?? undefined,
      rarity: row.rarity ?? undefined,
      traits: row.traits ? JSON.parse(row.traits) : undefined,
      source: row.source ?? undefined,
      summary: row.summary ?? undefined,
      url: row.url ?? undefined,
      superseded: row.superseded ? true : undefined,
    }));
  } finally {
    db.close();
  }
}

export function fetchLocal(ids: string[]) {
  if (!ids.length) return [];
  const capped = ids.slice(0, 10);
  const db = openDb();
  try {
    return db
      .prepare(
        `SELECT id, name, category, source, url, markdown, superseded
         FROM entries WHERE id IN (${capped.map(() => "?").join(",")})`
      )
      .all(...capped) as any[];
  } finally {
    db.close();
  }
}
