# Working in this repo

**Read `NEXT.md` first, and say that you have.** It is the working state: what shipped, what
is in flight, what is decided, what is queued. Read it before proposing anything, then report
what is in flight and what is uncommitted before doing anything else.

**Treat its facts as dated, not current.** Every claim in it records what was true when it
was checked. Anything outside this repo moves without a commit here to show it. The block
at the top of `NEXT.md` has the commands that re-check the moving parts. Stored memories
load before any file is read and go stale the same way, so check those against the repo
too.

**The standards are written down.** `NEXT.md` has all ten under "Standards", each with its
reason. In this template the reason is the failure that produced it, except rule 4, which
carries two occasions it caught something, and rule 10, which says it has none.
`HOWTOSAVESTATE.md` has the procedure for verifying state and saving it at the end of a
session, plus what each file here is for. The five that come up constantly:

- **No check counts as verified until it has been shown failing** on deliberately broken
  input, and the report says what was broken.
- **Never verify through a path that can resolve to your own development copy.** A linked
  or global install, a symlink, a running dev server, a cached build: each will answer as
  though it were the artifact. Name the path, resolve it, prove it is the one you meant.
- **Check claims against the artifact**, not against a description of it: the published
  file, the fetched page, the built package. Not a commit message, a dashboard label, or
  `NEXT.md` itself.
- **Proposal before code, for anything with a surface**: a command, a flag, an API, a
  schema, a page. Show the surface and wait before implementing it.
- **Say what was not checked**, rather than leaving it out. An omission reads as a verified
  negative.

The other five: describe contents and order rather than counts and pagination; stage
explicitly; never point at the conversation, since a cold session reads files and not chat;
check stored memories against the repo, because they load first and a stale one outranks a
correct `NEXT.md`; and one item at a time.

**Report a check in this shape.** Each line holds the evidence in words. A yes or a tick in
place of it leaves the line unanswered. If the check was never shown failing, write that on
its line, and the result does not count as verified.

```
Result: what the output showed, pasted or quoted.
Shown failing: what was broken, and what the check then reported.
Path: the path used, resolved.
Artifact: the thing checked, and where it came from.
Not checked: each thing, named.
```

## Working rules

**How to work.** One item at a time: show the diff and wait for approval before applying
the next. Stage explicitly by path, confirm with `git diff --cached --stat`, and never
`git commit -am`. **Never push.** Fletcher pushes. This project has no npm package and no
deploy: a push to `main` on GitHub is the release.

**Confirm where you are before acting.** Say which working directory or repo you are in,
and challenge it if it looks like the wrong one for the work being asked for. Two repos with
similar names, or a sibling checkout, are easy to act in by mistake and expensive to undo.

**Do not guess.** Check. If something cannot be checked from here, say that, rather than
reasoning your way to a plausible answer and presenting it as one. "I could not verify this"
is a usable answer; a confident wrong one costs the rest of the session's trust.

**Do not start queued work unprompted.** `NEXT.md` names what is waiting and what was
deliberately rejected. Raise it rather than beginning it.

## Writing

Applies to user-facing prose and to how you write to Fletcher. **Delete this section
if this project has no prose anyone reads**, and keep it if it has a README, a site, release
notes or a store listing. It is the last section in the file so that deleting it means
deleting from this heading to the end, and nothing else here depends on it.

These are the patterns that read as machine-written. A site rewrite turned on them: the
first item alone appeared dozens of times across a handful of pages.

- **No "not X, it's Y" reframes.** State what it is.
- **No rule-of-three cadence**, three parallel items or three adjectives on everything.
- **No trailing participial clauses** that tack a conclusion onto a fact: "making it easier
  to X", "ensuring Y stays consistent".
- **No "that said" or "with that said" pivots.** Use "but".
- **No "here's the thing" or "the thing is" lead-ins.**
- **No rhetorical questions as transitions.**
- **No bolded mini-header on every bullet** where prose works.
- **No "not only... but also".** Use "and".
- **No summary sentence** restating what was just read.
- **No unprompted "think of it like" analogies.**
- **No "X is where Y matters" constructions.**
- **No emoji or checkmark decoration** in headers or lists.
- **Prefer short declaratives** over clause-heavy sentences.
- **No em dashes**, anywhere: chat, files, commit messages, product copy.
- **Say what a thing does** rather than performing it.
- **No preamble** summarising what you are about to say, and no restating the request
  before answering it.
