import { Client } from "@elastic/elasticsearch";
import { config } from "./config";
import { searchLocal, readMeta, dbExists } from "./db";

/**
 * Compares the local index against the live one on the same queries.
 *
 * The local index is a hand-built substitute for a search engine that has had
 * years of Pathfinder-specific tuning, so "close enough" is a claim that has to
 * be shown rather than asserted. Run this after changing anything in db.ts that
 * touches ranking — the tokenizer, the bm25 weights, the stopword list, or the
 * AND/OR strategy — and read the two columns against each other.
 *
 *   pnpm benchmark
 */

const client = new Client({ node: config.root });

interface Probe {
  query: string;
  /** What a correct answer looks like, so a regression is obvious. */
  expect: string;
}

const PROBES: Probe[] = [
  {
    query: "Evasion",
    expect: "the remaster replacements (Confident/Assured Evasion), not the retired entries",
  },
  {
    query: "Power Attack",
    expect: "Vicious Swing first — tests the reconstructed legacy-name aliases",
  },
  {
    query: "Flat-Footed",
    expect: "Off-Guard first — the same alias path, on a condition",
  },
  {
    query: "flanking off-guard",
    expect: "Flanking and Off-Guard both in the top few",
  },
  {
    query: "champion cause reaction",
    expect: "Champion's Reaction first",
  },
  {
    query: "how does dying and recovery work",
    expect:
      "the Dying condition. KNOWN GAP: local surfaces Recovery Checks instead, " +
      "because 'recovery' is the rarer token and wins on term-frequency weighting",
  },
];

async function live(query: string, limit: number) {
  const response = await client.search({
    index: config.index,
    size: limit,
    _source: ["name", "category"],
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["name^6", "summary^3", "trait^3", "search_markdown"],
              fuzziness: "AUTO",
            },
          },
        ],
        must_not: [{ exists: { field: "remaster_id" } }],
      },
    },
  });
  return response.hits.hits.map((hit: any) => `${hit._source.name} [${hit._source.category}]`);
}

async function main() {
  if (!dbExists()) {
    console.error("No local database. Run `pnpm scrape` first.");
    process.exit(1);
  }

  const meta = readMeta();
  const limit = 5;
  console.log(
    `Local database: ${meta?.entryCount} entries, built ${meta?.builtAt?.slice(0, 10)}.\n` +
      `Comparing against ${config.root}\n`
  );

  let agreements = 0;

  for (const probe of PROBES) {
    const localHits = searchLocal({ query: probe.query, limit }).map(
      (hit) => `${hit.name} [${hit.category}]`
    );
    const liveHits = await live(probe.query, limit);

    const topMatch = localHits[0] && localHits[0] === liveHits[0];
    if (topMatch) agreements++;

    console.log(`"${probe.query}"  ${topMatch ? "— same top hit" : "— top hits differ"}`);
    console.log(`  want: ${probe.expect}`);
    console.log(`  ${"LOCAL".padEnd(38)}| LIVE`);
    for (let i = 0; i < limit; i++) {
      if (!localHits[i] && !liveHits[i]) break;
      console.log(`  ${(localHits[i] ?? "—").padEnd(38)}| ${liveHits[i] ?? "—"}`);
    }
    console.log();
  }

  console.log(`${agreements}/${PROBES.length} probes agree on the top hit.`);
  console.log(
    "Agreement is a signal, not a target — local is sometimes deliberately\n" +
      "tighter than live, which pads results with weak matches. Read the lists."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
