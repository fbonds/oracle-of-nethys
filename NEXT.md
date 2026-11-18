# Where we are

> **Read this before acting on anything below.** Every fact in this file is dated and may
> be stale. It records what was true when it was checked, not what is true now. Anything
> outside this repo moves without a commit here to show it, so re-check it first:
>
> ```sh
> git ls-remote --heads --tags origin | tail -5   # what the remote actually has
> git rev-list --left-right --count origin/main...main   # left = behind, right = unpushed
> git status -sb
> git show origin/main:README.md | head -3              # what users actually get
> ls -l archives.db                                     # over 30 days old = live fallback
> ```
>
> The rest of the checks, and the procedure for updating this file at the end of a session,
> are in `HOWTOSAVESTATE.md`. Stored memories load before any file and go stale the same
> way: check them against the repo rather than trusting them.

Updated 2026-11-17. Working state for Oracle of Nethys. `README.md` is the public
documentation, `NOTES.md` is the development history, and there is no separate design or
roadmap document. This file is neither of those.

## Standards

How work is done here, and why. Each one carries its reason, or it reads as taste and gets
dropped under time pressure. In this template the reason is the failure that produced it,
except rule 4, which carries two occasions it caught something before it was built, and rule
10, which says plainly that no failure sits behind it.

The examples below come from the project this kit was built in. **Replace each with your own
the first time this project produces one**, since a local failure argues better than a
borrowed one. Do not delete an example and leave a bare rule behind.

**1. No check counts as verified until it has been shown failing on deliberately broken
input, and the report says what was broken.** A check that cannot fail is not evidence, and
it is indistinguishable from a passing one in the report. Three checks were once reported as
verification when none of them could fail, and a guard test written to catch a drifted
dependency tree was invalid because the build regenerated what had been stripped to break
it.

**2. Never verify through a path that can resolve to your own development copy.** The
failure is not that the check was wrong; it is that the check never looked at the thing
being shipped. A linked or globally installed copy, a symlinked directory, a dev server
still running, a mounted volume, a cached build, a tool that falls back to a local default:
each of these will answer as though it were the artifact. Name the path explicitly, resolve
it, and prove the resolved path is the one you meant, inside the location you meant. A
release once shipped a broken binary through four separate checks, every one of which
silently resolved to the working copy rather than to what users would download.

**3. Check claims against the artifact, not the description of it.** The published file, the
fetched page, the built package. Not a commit message, a changelog, a dashboard label, or
this file. A published page told readers that a shipped file had five entries. It had eight.
The page was correct when written and was falsified by a build change nobody re-read it
against.

**4. Proposal before code, for anything with a surface.** A command, a flag, an API, a
schema, a page, a public string. Show the surface and wait for approval before writing the
implementation. It is cheaper to reject a design than a branch, and it has already caught a
feature that should not have existed and a scope that would have overpromised, both before
anything was built.

**5. Stage explicitly.** Never `git commit -am`, `git add -A` or `git add .`. Run `git add`
with the paths, confirm with `git diff --cached --stat`, then commit. Check first whether the
tree already holds approved but uncommitted work from an earlier step. One commit swept an
unrelated file rewrite in under a message that described neither change, and it took a diff
of the wrong file to notice.

**6. Describe contents and order, not counts and pagination.** A count derived from another
file, or a reference to a page number, goes stale silently when something else changes. Three
sentences describing a document's pagination broke at once when a single table row was added
to a page ahead of them, and one of them sent a reviewer backwards past the thing it cited.

**7. Say what was not checked**, rather than leaving it out, and say where a fact came from.
An omission reads as a verified negative. A disclosure was read off a public listing page
rather than off the form that produces it, and because the source went unstated it produced a
full analysis of a conflict that did not exist.

**8. Never point at the conversation.** A cold session can read every file here and none of
the chat. "As discussed", "per the earlier decision", "recover it from the conversation" are
dead ends. A saved note once told a future session that four agreed items "were agreed but
not restated; recover them from the original list", and the original list was a chat log. The
four were nearly lost and had to be rebuilt from the README, the changelog and the git log.
Write it out where it belongs, or record in plain words that it is lost.

**9. Check stored memories against the repo.** They load before any file is read, so a stale
memory outranks a correct `NEXT.md`. Anything a memory asserts about a file, a branch, a flag
or a version is checkable; check it rather than assuming it still holds. Two were wrong
within one week: one described a branch rebase that had never been done, and the other a tool
setup that had been replaced months earlier.

**10. One item at a time: show the diff, wait for approval.** Commit only when asked, and
never push: the owner pushes. **No failure sits behind this one.** It is a working agreement
rather than a scar: it keeps a wrong direction visible while it is still cheap to change, and
batching removes that moment.

<!-- Add project-specific standards here as they are earned, with the reason. -->

## Traps

Things that cost time once and would cost it again: a tool that lies, a check that cannot
fail, an environment that behaves differently here. Add one the same session it bites,
with enough detail to recognise it, not just to remember it happened.

Start with these questions. Answer each for this project. An answer of "none" is a claim like
any other fact in this file, so it carries the date and how it was checked. Write "not known
yet" if you cannot tell. Do not delete one. Specific traps go below them.

- Which dashboard or console here lags, and by how much? Not known yet.
- Which listing shows the published state and hides the pending one? Not known yet.
- Which registry reports metadata that differs from the artifact? None. Nothing is
  published to a registry. Checked 2026-11-17: `npm view oracle-of-nethys` returned 404.
- Which cache can serve an old copy? `archives.db`, which is a snapshot of the archives and
  goes stale as books and errata land (`pnpm watch` reports drift). The installed skill too:
  see below.

**The `nethys` MCP server runs from this working copy.** `claude mcp get nethys` shows
`pnpm --silent --dir /Users/fletcher/code/oracle-of-nethys mcp` (checked 2026-11-17). Any
test through the `nethys` tools tests uncommitted local code, not `origin/main`. Rule 2.

**The installed skill is a copy, not a link.** `~/.claude/skills/pf2e-rules` was made with
`cp -r`. It matched `skills/pf2e-rules` under `diff -r` on 2026-11-17. After any edit to the
repo's skill, it goes stale silently until copied again.

**GitHub Pages publishes every file it is not told to skip.** Pages builds `main` with
Jekyll: every `.md` becomes a page and every other file is copied as is. Before
`_config.yml` existed, `/NOTES.html` returned 200 (checked 2026-11-17). The `exclude` list
in `_config.yml` names each file by hand, so a new top-level file is published unless it is
added there. Wildcards were not used because it was not confirmed that Jekyll 3.10 accepts
them in `exclude`.

## Decided, do not redo

What was settled and why, what was ruled out and why, and anything the owner said not to
do. A resumed session that sees only the remaining tasks will rebuild something already
rejected, or argue for an option already refused.

An entry here is not rewritten. To change a decision, get the owner's approval, then add a
new entry with its date, its reasoning and the entry it replaces. The only edit to the old
entry is one added line saying what replaced it and when.

**2026-11-17: No npm package. A push to `main` is the release.** `archives.db` cannot be
shipped because the project does not redistribute Paizo content, so every user has to clone
and scrape regardless. A package would add a build, a `bin` and a release check that could
resolve to the dev copy (rule 2) without saving anyone a step. Ruled out: npm publishing.
Lighter option if release points are wanted later: git tags.

**2026-11-17: project-kit adopted without `.claude/settings.json`.** Fletcher judged the
deny rules and the SessionStart hook unnecessary for this project. The rules against pushing
and broad staging rest on `CLAUDE.md` alone.

**2026-11-17: The website is `README.md` alone, styled as parchment and ember.** Pages
deploys from `main`, root, with the Primer theme. `_config.yml` excludes everything else.
`_layouts/default.html` is Primer v0.6.0's layout with its title line replaced by a "Get it
on GitHub" bar. The style is light only: parchment surfaces, crimson structure, gold for
decoration and hover and never for text, espresso text. Fonts are Cinzel Decorative (hero),
Cinzel (subheads), Montserrat (labels), Lora (body). Ruled out: a separate landing page,
because it would be a second copy of the README's claims; MedievalSharp and Uncial Antiqua,
because they are hard to read beyond a few words; and anything resembling Paizo's trade
dress (a Pathfinder-style logotype, an edition badge, Paizo art), because the README says
the project is not endorsed by Paizo. README links to `NOTES.md` and `LICENSE` are absolute
GitHub URLs so they work on the site, where those files are excluded.

**2026-11-17: Framed links open in a new tab.** The page is embedded in the projects section
of fletcherbonds.com. When framed, links to other hosts get `target="_blank"`, as in
project-kit. Ruled out: `_top`, because it replaces the embedding page.

## In flight

What is being worked on now, and what state it is in. Remove an item when it is finished,
because the git log holds it. Before removing it, move what the git log cannot hold: a
release or deploy goes to the Committed, pushed, released section, with its date and how it
was checked, and anything else, such as a change made on a hosted service, goes to the
section it belongs in.

## Queued, unscheduled, and not to be started unprompted

What is agreed but waiting, with a pointer to wherever the full proposal is written out.

**Optional "ember" dark variant of the website.** Fletcher chose light only for now on
2026-11-17 and asked to keep a dark variant as an option if the project goes that way. No
design exists yet.

## Committed, pushed, released: three separate questions

As of 2026-11-17, when this was written.

**Uncommitted.** Nothing, after the commit that added the website on 2026-11-17.

**Unpushed.** Answer with `git rev-list --left-right --count origin/main...main`. Snapshot,
not to be trusted: on 2026-11-17 two commits were unpushed, the kit files and the website.
After the push, check the live site: `/` shows the styled page, and `/NOTES.html`,
`/NEXT.html`, `/CLAUDE.md` and `/db.ts` return 404. Not yet checked.

**Unreleased or undeployed.** A push to `main` is the release, so unreleased equals
unpushed. Last release: `f0e0e66` "Correct the collision statistic", 2026-08-13, which was
`origin/main` on 2026-11-17 by `git fetch` and the count above.

## Open, not blocking

- `archives.db` is from 2026-08-12, 97 days old on 2026-11-17. The README says the server
  falls back to the live archives past 30 days. A re-scrape (`pnpm scrape`) would clear it.
  Not checked in code whether the fallback is firing.
- The writing rules ban em dashes. Existing files predate them and still use them (counted
  2026-11-17): README.md 35, NOTES.md 16, SKILL.md 10, and comments in five .ts files.
  Not to be fixed unprompted.
