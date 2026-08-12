import { Client } from "@elastic/elasticsearch";
import { config } from "./config";
import { createBuilder, SOURCE_FIELDS, DB_PATH } from "./db";

const client = new Client({ node: config.root });

// No category allowlist. The database carried 96 categories at last count and
// gains more with each published book, so enumerating them guarantees the
// scrape silently falls behind. Take everything the index holds.
async function scrape() {
  const pit = await client.openPointInTime({
    index: config.index,
    keep_alive: config.keepAlive,
  });

  const builder = createBuilder();
  let count = 0;

  try {
    let searchAfter;
    while (true) {
      const page = await client.search({
        pit: { id: pit.id, keep_alive: config.keepAlive },
        size: config.pageSize,
        sort: [{ "id.keyword": "asc" }],
        _source: SOURCE_FIELDS,
        query: { match_all: {} },
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });

      if (page.hits.hits.length === 0) break;
      for (const hit of page.hits.hits) {
        builder.add(hit._source as any);
        if (++count % 5000 === 0) console.log(`  …${count} entries`);
      }
      searchAfter = page.hits.hits[page.hits.hits.length - 1].sort;
    }
  } finally {
    await client.closePointInTime({ id: pit.id });
  }

  return builder.finish(config.index);
}

async function main() {
  console.log("Scraping the archives…");
  const stored = await scrape();
  console.log(`\nBuilt ${DB_PATH}`);
  console.log(`${stored} entries indexed and searchable.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
