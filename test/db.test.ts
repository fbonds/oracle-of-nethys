import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { queryWords, searchLocal, openDb, dbExists } from "../db";

/**
 * These cover the three places that fail quietly rather than loudly: query
 * tokenisation, the alias reconstruction, and the AND/OR fallback. None of
 * them throw when they go wrong — they just return subtly worse results, which
 * is exactly the kind of regression nobody notices until an answer is bad.
 *
 *   pnpm test
 *
 * The tokenisation tests are pure. The rest need a built database and skip
 * themselves without one, so the suite still passes on a fresh clone.
 */

describe("queryWords", () => {
  test("strips punctuation without producing FTS5 syntax errors", () => {
    // Bare punctuation is FTS5 syntax; "off-guard" unquoted is a parse error.
    assert.deepEqual(queryWords("off-guard"), ["off", "guard"]);
    assert.deepEqual(queryWords("Champion's Reaction"), ["Champion", "Reaction"]);
  });

  test("drops single characters that carry no signal", () => {
    assert.deepEqual(queryWords("a fireball"), ["fireball"]);
  });

  test("removes stopwords so natural phrasing does not over-constrain", () => {
    // Requiring "how"/"does"/"work" to match is what buried real answers.
    assert.deepEqual(queryWords("how does dying and recovery work"), ["dying", "recovery"]);
  });

  test("keeps the original words when every word is a stopword", () => {
    // Stripping to nothing would silently return zero results.
    const words = queryWords("what can you do");
    assert.ok(words.length > 0, "must not reduce a query to nothing");
  });

  test("returns empty only for input with no usable terms", () => {
    assert.deepEqual(queryWords("!!! ?"), []);
    assert.deepEqual(queryWords(""), []);
  });
});

const hasDb = dbExists();
const needsDb = { skip: hasDb ? false : "no archives.db — run `pnpm scrape`" };

describe("alias reconstruction", needsDb, () => {
  test("aliases resolve whenever the predecessor is actually in the index", () => {
    const db = openDb();
    const unresolved = db
      .prepare(
        "SELECT id, name, legacy_ids FROM entries WHERE legacy_ids IS NOT NULL AND aliases IS NULL"
      )
      .all() as any[];

    // A null alias is legitimate only when every predecessor it points at is
    // absent from the index — upstream carries a few dangling ids. Anything
    // else means resolveAliases dropped a name it could have indexed, which
    // costs the legacy-name search path silently.
    for (const row of unresolved) {
      const resolvable = (JSON.parse(row.legacy_ids) as string[]).filter((id) =>
        db.prepare("SELECT 1 FROM entries WHERE id = ?").get(id)
      );
      assert.equal(
        resolvable.length,
        0,
        `${row.name} (${row.id}) has predecessors in the index but no aliases`
      );
    }
  });

  test("a renamed rule is findable under its pre-Remaster name", () => {
    // The whole point of the alias column: "Power Attack" appears nowhere in
    // the text of Vicious Swing.
    const hits = searchLocal({ query: "Power Attack", limit: 3 });
    assert.equal(hits[0]?.name, "Vicious Swing");

    const condition = searchLocal({ query: "Flat-Footed", limit: 3 });
    assert.equal(condition[0]?.name, "Off-Guard");
  });
});

describe("search filtering", needsDb, () => {
  test("superseded entries are hidden unless asked for", () => {
    const current = searchLocal({ query: "Evasion", limit: 10 });
    assert.ok(current.length > 0);
    assert.ok(
      current.every((hit) => !hit.superseded),
      "default search must not return pre-Remaster entries"
    );

    const withLegacy = searchLocal({ query: "Evasion", limit: 10, include_legacy: true });
    assert.ok(
      withLegacy.some((hit) => hit.superseded),
      "include_legacy should surface the retired entries"
    );
  });

  test("category and level filters constrain results", () => {
    const hits = searchLocal({ query: "strike", category: ["feat"], level_max: 4, limit: 10 });
    assert.ok(hits.length > 0);
    assert.ok(hits.every((hit) => hit.category === "feat"));
    assert.ok(hits.every((hit) => hit.level == null || hit.level <= 4));
  });

  test("trait filters constrain results to entries carrying the trait", () => {
    const hits = searchLocal({ query: "dwarf ancestry", traits: ["Dwarf"], limit: 10 });
    assert.ok(hits.length > 0, "expected dwarf ancestry feats");
    assert.ok(
      hits.every((hit) => hit.traits?.includes("Dwarf")),
      "every result must carry the requested trait"
    );

    // And that it is doing something: the same query unfiltered admits entries
    // the filter rejects.
    const unfiltered = searchLocal({ query: "dwarf ancestry", limit: 10 });
    assert.ok(
      unfiltered.some((hit) => !hit.traits?.includes("Dwarf")),
      "unfiltered search should include non-Dwarf entries, or the filter proves nothing"
    );
  });
});

describe("AND/OR fallback", needsDb, () => {
  test("a multi-word query no single entry satisfies still returns results", () => {
    // Requiring all terms finds nothing here; the OR top-up has to fire, or
    // the user gets an empty page for a reasonable question.
    const hits = searchLocal({ query: "dwarf ancestry feat mountain stonecunning", limit: 5 });
    assert.ok(hits.length > 0, "OR fallback should fill in when AND is too narrow");
  });

  test("precise multi-word queries still lead with the precise hit", () => {
    // The fallback must not dilute a query that AND answers well.
    const hits = searchLocal({ query: "champion cause reaction", limit: 5 });
    assert.equal(hits[0]?.name, "Champion's Reaction");
  });

  test("results never exceed the requested limit", () => {
    // The top-up appends, so an off-by-one here would quietly inflate context.
    for (const limit of [1, 3, 7]) {
      const hits = searchLocal({ query: "dying recovery condition", limit });
      assert.ok(hits.length <= limit, `expected at most ${limit}, got ${hits.length}`);
    }
  });

  test("results are unique — the top-up must not duplicate AND hits", () => {
    const hits = searchLocal({ query: "shield block raise", limit: 10 });
    const ids = hits.map((hit) => hit.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate entries in results");
  });
});
