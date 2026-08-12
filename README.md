# Oracle of Nethys

A local, searchable copy of the Pathfinder Second Edition rules, and a
conversational oracle that answers questions from it — built for one person who
was tired of not knowing what to search for.

```
> my rogue keeps getting hit by area spells, what are my options?

  ⌕ search_archives "reflex save area damage"
  ▤ fetch_entries Confident Evasion, Cover

  A few options, cheapest first…
```

## What this is, and what it isn't

**This is a thought experiment.** It started as a question — *what would it take
to build a rules assistant that doesn't make things up?* — and turned into a
working answer. It is built for my own use at my own table. It is not a product,
not a service, and not something I'm distributing or making money from. I'm
sharing the repository because the engineering was interesting, not because
anyone should depend on it.

**It contains no Pathfinder content.** What's committed here is code. The rules
database is built on your own machine by fetching from Archives of Nethys, and
it is deliberately excluded from version control. If you run it, the resulting
`archives.db` is a local copy of Paizo's material for your personal reference —
treat it that way, and don't redistribute it. See
[Rights and attribution](#rights-and-attribution) below.

**It will be wrong sometimes.** Retrieval reduces invention; it doesn't
eliminate it. Every answer cites the entry it came from precisely so you can
check it. Check it.

## The problem it solves

Archives of Nethys is an excellent database and a hard place to be a beginner.
It answers the question you typed, and a new player's difficulty is that they
don't know which question to type. "My rogue keeps getting hit by fireballs"
isn't a searchable term; *Reflex save*, *basic save*, *area effect*, *cover*,
and the evasion line are, and knowing that vocabulary is most of the skill.

So the oracle does the translation. You describe the situation; it works out
which rules govern it, reads them, and explains them back with citations and the
jargon defined.

## How it works

Three pieces, each doing one job.

**`pnpm scrape`** downloads every entry from Archives of Nethys and builds
`archives.db` — a SQLite database with a full-text index. 45,340 entries across
96 categories, about 160MB, roughly three minutes.

**`pnpm mcp`** runs an MCP server exposing two tools — `search_archives` and
`fetch_entries` — to Claude Code. Search returns summaries so a broad sweep
stays cheap; fetch returns full rules text before anything gets quoted.

**`pnpm watch`** hashes every entry's rules text and compares the live archives
against your database, so you know when a book or errata has landed and it's
worth re-scraping.

Queries hit the local database in under 10ms with no network call. The live
archives are used only when `archives.db` is missing or older than 30 days, and
the oracle is told which source answered so a stale result is never presented as
current.

### Two details that make the answers correct

**Remaster awareness.** Pathfinder 2e was remastered in 2023 and a great deal of
older material was superseded. Every entry that has been replaced carries a
pointer to its replacement, so superseded rules are excluded by default. Ask
about *Evasion* and you get *Confident Evasion*, not the seven retired versions.

**Legacy-name aliases.** Archives of Nethys maps old rule names onto their
replacements — searching "Power Attack" finds *Vicious Swing*, even though that
text appears nowhere in the entry. Their synonym list isn't readable over the
API, but the same mapping is recoverable from the legacy/remaster relationships
in the data. 12,475 entries are indexed under their pre-Remaster names, so the
advice you half-remember from a 2021 forum thread still finds the current rule.

### On search quality

The local index was measured against the live one rather than assumed to match
it. On name lookups it's equal or better. On long natural-language questions
it's still slightly behind — "how does dying and recovery work" surfaces
*Recovery Checks* where the live index surfaces the *Dying* condition, because
"recovery" is the rarer token and wins on term-frequency weighting. That gap was
left in place deliberately: the oracle issues twenty or thirty searches on a hard
question and refines as it goes, so single-shot ranking matters much less here
than it would in a search box.

## Setup

Requires Node 22+ and [Claude Code](https://claude.com/claude-code).

```sh
pnpm install
pnpm scrape                                                    # ~3 min
claude mcp add nethys --scope user -- pnpm --silent --dir "$PWD" mcp
cp -r skills/pf2e-rules ~/.claude/skills/
```

Verify with `claude mcp list` — `nethys` should report **Connected**. Then ask a
rules question in any Claude Code session.

> The `--silent` matters. Without it pnpm prints its script banner to stdout,
> which corrupts the JSON-RPC stream the MCP transport runs over.

The skill file is what makes it teach rather than just retrieve: cite
everything, define jargon on first use, distinguish written rules from table
convention, and say "the rules don't cover this" instead of inventing a ruling.

## Keeping it current

```sh
pnpm watch
```

Reports added, changed, and removed entries since your last scrape, writes a
dated digest, and tells you when it's worth re-scraping. Weekly, if you like:

```sh
# Mondays at 9am
0 9 * * 1 cd /path/to/oracle-of-nethys && /usr/bin/env pnpm watch
```

## Credit

This began as a fork of
[**archives-of-nethys-scraper** by Luke Parke](https://github.com/LukasParke/archives-of-nethys-scraper),
which is where the idea of pulling the whole database out of the Archives'
Elasticsearch endpoint comes from. His scraper worked out the hard part — how to
get at the data at all — and its unfinished `uploader.ts` pointed clearly at
where it was headed: get the archives into something you can actually query.
This is one answer to that. The original is MIT licensed and his copyright is
retained in [LICENSE](LICENSE).

Archives of Nethys is a labour of love that has served the Pathfinder community
for years. This project would be impossible without it. If you use this, be a
good guest on their infrastructure: scrape occasionally, not constantly.

## Rights and attribution

Oracle of Nethys uses trademarks and/or copyrights owned by Paizo Inc., used
under Paizo's Community Use Policy
([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We
are expressly prohibited from charging you to use or access this content. Oracle
of Nethys is not published, endorsed, or specifically approved by Paizo. For
more information about Paizo Inc. and Paizo products, visit
[paizo.com](https://paizo.com).

Pathfinder Second Edition rules content is published by Paizo — remastered
material under the [ORC License](https://paizo.com/orclicense) and legacy
material under the Open Game License. That content is Paizo's, not mine, and
nothing in this repository grants any rights to it.

To be explicit about what that means here:

- **No Paizo content is committed to this repository.** Only source code is.
- **`archives.db` is built on your machine and is gitignored.** It is a personal
  reference copy. Don't publish it, don't redistribute it, don't put it behind a
  paywall or in a product.
- **Nothing here is monetized**, and under the Community Use Policy nothing
  built on it may be. That's not a restriction I find burdensome — it was never
  the point.
- **This is not legal advice.** If you're doing something more ambitious than
  running a rules lookup for your own table, read the policies yourself.

## License

Source code is [MIT licensed](LICENSE), retaining Luke Parke's copyright from
the original work. The license covers this code only — not the Pathfinder rules
content it retrieves.
