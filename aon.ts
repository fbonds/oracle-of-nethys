import { Client } from "@elastic/elasticsearch";
import { config } from "./config";
import { searchLocal, fetchLocal, readMeta } from "./db";

const client = new Client({ node: config.root });

// Entries store site-relative links like "/Spells.aspx?ID=119".
export const AON_SITE = "https://2e.aonprd.com";

// Enough to judge relevance without pulling 73MB of stat blocks into context.
const HIT_FIELDS = [
  "id",
  "name",
  "category",
  "type",
  "level",
  "rarity",
  "trait",
  "summary",
  "url",
  "primary_source",
  "remaster_id",
  "legacy_id",
];

// The longest entry is ~90k characters. Truncating keeps one sprawling
// creature from crowding out the rest of the conversation.
const MAX_ENTRY_CHARS = 12000;

// Cutting at an arbitrary character can end mid-row of a stat block table,
// leaving the model a fragment that reads like complete data. Back up to the
// last line break so the truncation lands somewhere legible, and say plainly
// that the rest was cut.
function clip(text: string, url?: string) {
  if (text.length <= MAX_ENTRY_CHARS) return text;
  const cut = text.slice(0, MAX_ENTRY_CHARS);
  const boundary = cut.lastIndexOf("\n");
  const kept = boundary > MAX_ENTRY_CHARS * 0.5 ? cut.slice(0, boundary) : cut;
  return `${kept}\n\n[Entry truncated here — read the rest at ${url ?? "Archives of Nethys"}]`;
}

export interface SearchParams {
  query: string;
  category?: string[];
  traits?: string[];
  level_min?: number;
  level_max?: number;
  include_legacy?: boolean;
  limit?: number;
}

const link = (url?: string) => (url ? `${AON_SITE}${url}` : undefined);

async function searchLive(params: SearchParams) {
  const filter: any[] = [];
  if (params.category?.length) filter.push({ terms: { category: params.category } });
  // Separate term filters so multiple traits are required together, not either/or.
  for (const trait of params.traits ?? []) filter.push({ term: { trait } });
  if (params.level_min != null || params.level_max != null) {
    filter.push({
      range: { level: { gte: params.level_min ?? -2, lte: params.level_max ?? 30 } },
    });
  }

  const response = await client.search({
    index: config.index,
    size: Math.min(params.limit ?? 12, 40),
    _source: HIT_FIELDS,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: params.query,
              fields: ["name^6", "summary^3", "trait^3", "search_markdown"],
              fuzziness: "AUTO",
            },
          },
        ],
        filter,
        // An entry carrying remaster_id IS the superseded pre-remaster version —
        // the id it points at is what replaced it. Excluding those is what keeps
        // the oracle from quoting rules that no longer apply.
        must_not: params.include_legacy ? [] : [{ exists: { field: "remaster_id" } }],
      },
    },
  });

  return response.hits.hits.map((hit) => {
    const entry: any = hit._source;
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      type: entry.type,
      level: entry.level,
      rarity: entry.rarity,
      traits: entry.trait,
      source: entry.primary_source,
      summary: entry.summary,
      url: link(entry.url),
      superseded: entry.remaster_id?.length ? entry.remaster_id : undefined,
      replaces: entry.legacy_id?.length ? entry.legacy_id : undefined,
    };
  });
}

async function fetchLive(ids: string[]) {
  const response = await client.search({
    index: config.index,
    size: Math.min(ids.length, 10),
    query: { terms: { "id.keyword": ids.slice(0, 10) } },
  });

  return response.hits.hits.map((hit) => {
    const entry: any = hit._source;
    const text: string = entry.markdown ?? entry.text ?? "";
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      source: entry.primary_source,
      url: link(entry.url),
      superseded: entry.remaster_id?.length ? entry.remaster_id : undefined,
      text: clip(text, link(entry.url)),
    };
  });
}

// Every entry, fields trimmed to what change detection needs. Used by the
// watcher; paginates the same way the scraper does so it has no 10,000 ceiling.
export async function* streamAllEntries(fields: string[]) {
  const pit = await client.openPointInTime({
    index: config.index,
    keep_alive: config.keepAlive,
  });

  try {
    let searchAfter;
    while (true) {
      const page = await client.search({
        pit: { id: pit.id, keep_alive: config.keepAlive },
        size: config.pageSize,
        sort: [{ "id.keyword": "asc" }],
        _source: fields,
        query: { match_all: {} },
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });

      if (page.hits.hits.length === 0) break;
      for (const hit of page.hits.hits) yield hit._source as any;
      searchAfter = page.hits.hits[page.hits.hits.length - 1].sort;
    }
  } finally {
    await client.closePointInTime({ id: pit.id });
  }
}

// The local database is the normal path; the live archives are the fallback for
// a database that is missing or old enough that its rules may have been errata'd.
// `reason` is surfaced to the model so an answer drawn from a stale snapshot is
// never presented as current.
//
// Meta cannot change within a process — the database is built by a separate
// `pnpm scrape` run — so resolve it once rather than on every tool call.
let cachedSource: { local: boolean; reason: string } | undefined;

export function retrievalSource() {
  if (cachedSource) return cachedSource;
  const meta = readMeta();
  if (!meta) {
    cachedSource = { local: false, reason: "no local database — run `pnpm scrape`" };
  } else if (meta.stale) {
    cachedSource = {
      local: false,
      reason: `local database is ${Math.floor(meta.ageDays)} days old — using live archives`,
    };
  } else {
    cachedSource = { local: true, reason: `local database, built ${meta.builtAt?.slice(0, 10)}` };
  }
  return cachedSource;
}

// Running on the fallback means every query leaves the machine. That is fine
// occasionally and rude at volume, so it is budgeted and noisy rather than
// silent — otherwise the user least likely to notice a stale database is the
// one putting the most load on someone else's server.
let liveCalls = 0;

class StaleDatabaseError extends Error {}

function chargeLiveCall() {
  const { reason } = retrievalSource();
  liveCalls++;
  if (liveCalls === 1) {
    process.stderr.write(
      `[nethys] ${reason}. Querying Archives of Nethys directly; ` +
        `run \`pnpm scrape\` to work from a local copy again.\n`
    );
  }
  if (liveCalls > config.liveCallBudget) {
    throw new StaleDatabaseError(
      `Stopped after ${config.liveCallBudget} live requests to Archives of Nethys. ` +
        `The local database is missing or out of date (${reason}), and answering ` +
        `from the live site at this volume is not a polite use of a volunteer-run ` +
        `service. Tell the user to run \`pnpm scrape\` — it takes about three ` +
        `minutes — then ask again.`
    );
  }
}

export async function searchArchives(params: SearchParams) {
  if (retrievalSource().local) return searchLocal(params);
  chargeLiveCall();
  return searchLive(params);
}

export async function fetchEntries(ids: string[]) {
  if (!retrievalSource().local) {
    chargeLiveCall();
    return fetchLive(ids);
  }
  return fetchLocal(ids).map((entry: any) => {
    const text: string = entry.markdown ?? "";
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      source: entry.source ?? undefined,
      url: link(entry.url),
      superseded: entry.superseded ? true : undefined,
      text: clip(text, link(entry.url)),
    };
  });
}
