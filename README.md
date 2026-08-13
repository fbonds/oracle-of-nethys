# Oracle of Nethys

A local, searchable copy of the Pathfinder Second Edition rules, and a
conversational oracle that answers questions from it — built for one person who
was tired of not knowing what to search for.

```
> As a level 3 fighter is Knight's Retaliation the best class feat to choose?

  Called nethys 8 times

  No, and it isn't available to you. Two problems:

  It's a level 8 feat, gated behind Knights of Lastwall access — your GM
  has to hand it to you. Even at 8 it's narrow: a reaction that only fires
  when an undead creature critically fails a Strike against you.

  You don't get a class feat at 3. Fighter feats come at 1st and every
  even level. Level 3 gives you Bravery, a general feat, and a skill
  increase. So there are really two questions under yours…
```

Three things happened there that a database cannot do: it refused the premise,
found a second reason to refuse it, and then noticed the question underneath the
question. It went on to warn off a trap feat and to point out that a general feat
the player might reasonably pick is made redundant by a class feature they gain
at that exact level.

## What this is, and what it isn't

**This is a thought experiment.** It started as a question — *what would it take
to build a rules assistant that doesn't make things up?* — and turned into a
working answer. It is built for my own use at my own table. It is not a product,
not a service, and not something I'm distributing or making money from. I'm
sharing the repository because the engineering was interesting, not because
anyone should depend on it.

**It contains no Pathfinder content — it fetches it for you, once.** What's
committed here is code. The first thing you run, `pnpm scrape`, pulls the rules
from Archives of Nethys and builds `archives.db` on your own machine. That takes
about three minutes and happens one time.

Every question after that reads the local database. A hard question can fire
twenty or thirty searches, and running those against your own disk takes
milliseconds instead of seconds — but the bigger reason is courtesy. Archives of
Nethys is a volunteer-run service, and hammering it a few dozen times to answer
one question about a fighter feat would be a poor way to treat it. `pnpm watch`
then checks in periodically, compares the archives against your copy, and tells
you when a new book or errata makes a re-scrape worthwhile.

The database that produces is a personal reference copy of Paizo's material, and
it's excluded from version control by design. Treat it that way — don't publish
it, don't redistribute it, don't build a service on it. See
[Rights and attribution](#rights-and-attribution) below.

**It will be wrong sometimes.** Retrieval reduces invention; it doesn't
eliminate it. Every answer cites the entry it came from precisely so you can
check it. Check it.

## The problem it solves

Archives of Nethys is an excellent database and a hard place to be a beginner.
It has a page for every feat, weapon, and spell in the game — and no page for
any of the questions a new player actually has.

*What's the best melee weapon for a level 3 fighter? Which ancestry feats are
worth taking as a dwarf? I'm playing a cleric, what do I do on my turn?*

None of those have an entry. Answering them means reading a dozen entries and
comparing them, which is the one thing a database can't do for you. It's also
the thing that keeps you flipping between twelve browser tabs while everyone
waits for you to take your turn.

A second, quieter problem: the questions that *are* lookups often can't be
looked up either, because you don't know the word yet. Knowing the vocabulary is
most of the skill, and it's precisely what you don't have on day one.

So the oracle does both jobs: it works out which rules govern your situation,
reads them, and explains them back with the jargon defined and every claim
citing the entry it came from.

## Three lenses, one eye

The Graeae of Greek myth were three sisters who shared a single eye, passing it
between them and pooling what each one saw. That's the design here, and the
constraint is the point: one source of truth, three ways of reading it, one
answer out.

The oracle works every question through three readings. They aren't
personalities and they never appear by name — they are three distinct ways of
being wrong, arranged to cancel each other out.

**The Archivist** reads what is actually written. Does this option exist, at this
level, with these prerequisites, at the action cost claimed? Every number comes
from a fetched entry, never from memory. It holds a veto — nothing is
recommended that can't be confirmed from the text — and it is explicitly barred
from having opinions about whether an option is any good.

**The Tactician** asks what actually works, given what's legal. Three actions per
turn is the game's central constraint, so an option that saves an action usually
beats one that adds a small bonus. It reasons about how pieces combine —
prerequisites, the multiple attack penalty, whether something is dead weight
until a later level — and it commits to a pick rather than presenting a menu.

**The Improviser** asks whether this is even the right question. Someone asking
for a better weapon may actually need to stop standing in the open; someone
asking which feat to take at 2 may be building a character they won't enjoy
playing.

A lookup gets the Archivist alone — "what does off-guard do" needs one accurate
paragraph, not a committee. Decisions get all three.

### Why you never see them

The deliberation is internal, and the output is a single voice. A lens surfaces
only when the three disagreed *and* it changes what you should do — an Archivist
veto on the obvious pick is worth showing; unanimous agreement is not. Answers
that read like committee minutes would be a failure of the design, not a
demonstration of it.

The honest limit: this is structured self-critique, not independent review. One
model wearing three hats catches real errors, but shares its own blind spots.
What actually guards against invention is that the Archivist's veto is tied to
fetched entries rather than to careful thinking.

### What it caught

The exchange at the top of this page is a real one. Checking each claim against
the database afterwards, across eight tool calls, nothing was invented:

- **Knight's Retaliation is Feat 8**, uncommon, and carries an explicit *"Knights
  of Lastwall have access to this feat"* line — so it's blocked twice over.
- **Fighters get no class feat at level 3**, which reframes the question entirely.
- **Vicious Swing** — the feat formerly called Power Attack — *"counts as two
  attacks when calculating your multiple attack penalty."* It reads like a
  damage boost and is roughly a wash. Every fact needed to know that is on the
  page; the conclusion is on no page at all.
- **Canny Acumen for Will saves is redundant at exactly level 3**, because
  Bravery — the fighter class feature gained at 3 — already raises Will to
  expert. That required connecting two entries and the character's level.

That last one is the whole argument for the project in a single line. No page
anywhere says "don't take Canny Acumen at 3."

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

Two more for working on it: `pnpm test` and `pnpm benchmark`.

Queries hit the local database in under 10ms with no network call. The live
archives are used only when `archives.db` is missing or older than 30 days —
and that path is deliberately noisy and capped. It warns on stderr the first
time it fires, and refuses after 25 requests with an instruction to re-scrape.
Otherwise the person least likely to notice a stale database would be the one
putting the most load on someone else's server, which is the opposite of the
intent.

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

Replacing a search engine that has had years of Pathfinder-specific tuning is
the risky part of going local, so it was measured rather than asserted:

```sh
pnpm benchmark
```

That runs the same probe queries against both indexes and prints them side by
side, with a note on each saying what a correct answer looks like. Currently
3 of 6 probes agree on the top hit — but read the lists rather than the number,
because some disagreements are local being *tighter*: "Evasion" returns three
precise matches where live returns those three plus two weak ones.

The real gap is long natural-language questions. "How does dying and recovery
work" surfaces *Recovery Checks* where live surfaces the *Dying* condition,
because "recovery" is the rarer token and wins on term-frequency weighting. That
one is marked KNOWN GAP in the harness so it isn't mistaken for a regression. It
was left in place deliberately: the oracle issues twenty or thirty searches on a
hard question and refines as it goes, so single-shot ranking matters much less
here than it would in a search box.

`pnpm test` covers the three functions that degrade quietly rather than throwing
— query tokenisation, the alias reconstruction, and the AND/OR fallback.

[NOTES.md](NOTES.md) has the development history: the scraper bugs this started
from, the two architectures thrown away, and the ranking experiments that
failed — including one that looked obviously right and made things worse.

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

The skill file is what makes it advise rather than retrieve — it carries the
[three lenses](#three-lenses-one-eye), the citation discipline, and the
instruction to say "the rules don't cover this" instead of inventing a ruling.
Without it you have a search tool with extra steps.

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
