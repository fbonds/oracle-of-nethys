export const config = {
  // These values tell the scraper how to reach the AON elastic instance.
  root: "https://elasticsearch.aonprd.com/",
  index: "aon",

  // Hits per request while scraping. The scraper pages until the index is
  // exhausted, so this only trades request count against response size.
  pageSize: 500,

  // How long each point-in-time snapshot stays open between pages.
  keepAlive: "2m",

  // Local database built by `pnpm scrape` and queried by the oracle.
  dbPath: "archives.db",

  // Past this age the local database is treated as untrustworthy and the
  // oracle falls back to querying the archives directly. `pnpm watch` reports
  // whether anything actually changed.
  maxAgeDays: 30,
};
