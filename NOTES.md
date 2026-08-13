# Development notes

The git history here starts at a working tool. Everything that led to it —
the fork it came from, the two architectures that got thrown away, and the
ranking experiments that mostly failed — happened before the first commit and
would otherwise be lost. This is a written account of that, not reconstructed
history; the commits are real, the story around them lives here.

Kept partly because the dead ends are the useful part. Anyone tempted to build
this differently will probably be tempted by the same three wrong turns.

## It began as a broken scraper

[archives-of-nethys-scraper](https://github.com/LukasParke/archives-of-nethys-scraper)
by Luke Parke works out the genuinely hard part: Archives of Nethys exposes an
Elasticsearch endpoint that answers anonymous queries, and you can page the
whole database out of it. Three years after its initial commit it had a
dependabot bump, an MIT license PR from a stranger, and no other development.

Three things were wrong with it, none obvious from reading it:

**It silently dropped 11% of every scrape.** Entries were written to
`sorted/<category>/<name>.json`, and entry names are nowhere near unique. The
action category alone holds 4,132 entries under 1,002 distinct names: `Cast a
Spell` appears 416 times, `Interact` 336 times, and bare trait annotations like
`(concentrate)` 485 times. Each collision overwrote the last, silently — 18,990
entries became 16,886 files with no error and no warning.

Across the full database the same scheme would lose 15,216 of 45,340 entries,
a third of everything, and the only symptom is a directory that looks fine.
Keying on the entry id fixed it.

**It was one release from silent truncation.** A single query with `size: 10000`
sits exactly on Elasticsearch's default result window. Equipment was at 9,061
entries and feats at 8,830; when either crossed 10,000 the query would have
returned the first 10,000 and reported success. Point-in-time plus `search_after`
paging removed the ceiling.

**It could not start at all on a current TypeScript.** With no `tsconfig.json`,
ts-node infers `module: node16` alongside `moduleResolution: node10`, which
TypeScript 5.x rejects outright. Transpile-only doesn't help — it's option
validation, before any code runs.

**And it scraped 21 of 96 categories.** The `targets` array was hand-listed from
the site navigation and never revisited, so the snapshot was missing every
`condition`, every `class-feature`, all 438 heritages. The fix wasn't to
enumerate 96 — that list grows with each published book. It was to drop the
allowlist and take `match_all`.

Its unfinished `uploader.ts` is the interesting artifact: it reads the scraped
files back off disk, loops every entry, and `console.log`s them. The
`@elastic/elasticsearch` dependency was already declared. The intent was clearly
scrape → load into something queryable, and the second half was never written.
This project is one answer to that.

## Two architectures thrown away

**An API-backed CLI.** The first working oracle was a standalone chat REPL
calling the Anthropic API with a tool-use loop. It worked, and it was the wrong
shape: it billed per question against an API key, when Claude Code was already
sitting right there covered by a subscription. Rewriting it as an MCP server
made the same tool calls free at the point of use and deleted the entire chat
loop — Claude Code already is one.

**Live-only retrieval.** The second version queried Archives of Nethys directly
on every search and used no local data at all. The reasoning was defensible —
always current, no staleness to manage — but it made the scraper decorative, and
a hard question fires twenty or thirty searches at someone else's server. The
local database is the point, not an optimisation.

## The ranking work

Replacing a tuned Elasticsearch index with hand-rolled SQLite FTS5 is the risky
part of going local, so it was measured rather than assumed. `pnpm benchmark` is
that harness, kept in the repo because the claim is otherwise unfalsifiable.

**The first build was clearly worse.** "Power Attack" missed *Vicious Swing*
entirely. "Evasion" buried the right answers at rank 4 and 5 behind
*Evasiveness*. Not close.

**Archives of Nethys uses synonym mapping, and the query explanation proved it.**
Asking Elasticsearch to explain its scoring for "Power Attack" returned
`weight(name:"vicious swing")` — the searched string appears nowhere in that
entry's text. Their analyzer maps legacy rule names onto replacements. The
synonym list isn't readable (the mappings endpoint is 403), but the same mapping
is recoverable: each remastered entry records the ids it replaced, so resolving
those to names and indexing them as aliases reconstructs it. 12,475 entries now
carry their pre-Remaster names. That single change fixed both "Power Attack" and
"Flat-Footed".

**Porter stemming was actively harmful here.** It conflates "Evasion" with
"Evasive" and "Evasiveness", so exact matches lost to near ones. Dropping to
plain `unicode61` made local match live's top three exactly. This corpus uses
precise terminology; stemming is the wrong default for it.

**Stopwords broke natural phrasing.** Requiring every term to match meant "how
does dying and recovery work" demanded "how" and "does" and "work". Stripping a
small stopword list first, with a fallback to the original words if that empties
the query, fixed it.

**An exact-name boost was tried and reverted.** Promoting entries whose name
exactly equals a query word looked obviously right and made things worse:
"flanking off-guard" tokenises to include "guard", so *Guard [background]*,
*Guard [creature]*, and *Guard [action]* flooded the top. It fixed nothing and
broke a case that already worked.

**What's still worse than live.** "How does dying and recovery work" surfaces
*Recovery Checks* where live surfaces the *Dying* condition — "recovery" is the
rarer token and wins on term-frequency weighting. Left in place deliberately:
the oracle issues twenty or thirty searches on a hard question and refines as it
goes, so single-shot ranking matters less here than it would in a search box.
`pnpm benchmark` prints this case with a KNOWN GAP note so it doesn't get
mistaken for a regression.

## The skill

The first version was roughly 80% anti-hallucination scaffolding — search first,
fetch before quoting, cite everything. It produced correct answers that were
functionally the archives with extra steps: accurate lists, no judgement.

Reorganising it around what makes advice good rather than what makes retrieval
safe was the fix, and the three-lens structure came out of that. The lenses
aren't decoration; they're three distinct failure modes — recommending something
illegal, something legal but weak, and something that answers a question nobody
asked — and one voice reliably catches none of them.

The failure mode that invites is theater. Three voices performing disagreement
in every answer would make a weapon question into a committee meeting, so the
deliberation is internal and a lens surfaces only when they disagreed and it
changes the answer.

## What the tests found

Written after the fact, against `queryWords`, the alias resolution, and the
AND/OR fallback — the three functions that degrade quietly rather than throwing.

Two failed on first run, and both were the tests being wrong rather than the
code. One was worth keeping: a single entry has a `legacy_id` pointing at an id
that isn't in the index at all, so its aliases are legitimately null. Upstream
carries dangling pointers. The test now asserts the real contract — aliases
resolve whenever the predecessor actually exists — rather than the one that
seemed obvious.

## Known gaps

- Natural-language ranking trails the live index, as above.
- `MAX_ENTRY_CHARS` truncates very long entries at 12,000 characters. It backs
  up to a line break so it doesn't cut a stat block mid-row, but a creature at
  the ceiling still arrives incomplete.
- The three lenses are structured self-critique, not independent review. One
  model wearing three hats shares its own blind spots; what actually guards
  against invention is that the Archivist's veto is tied to fetched entries.
- Ranking is tuned against six probe queries. That is enough to catch a
  regression and nowhere near enough to call it evaluated.
