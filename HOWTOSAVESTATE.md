# How to save state

The standing instruction for ending a session in this repo, so a session starting cold,
with no conversation history, can resume without asking anything it could determine
itself. Run this when asked to save state, or before a pause.

## The instruction, as given

> Save state so a session starting cold in this repo, with no conversation history, can
> resume without asking me anything it could determine itself.
>
> **1. Record verified facts, not your recollection.** Anything external gets checked now
> and recorded with the date and the method. Anything you did not check, say so rather
> than omitting it.
>
> **2. Never point at this conversation.** If something only exists there, either write it
> out in full or record that it is lost. A cold session cannot read it.
>
> **3. State is not just what is left.** Record decisions and their reasons, what was ruled
> out and why, and anything I said not to do. A resumed session that knows only the
> remaining tasks will redo work I already rejected.
>
> **4. Say what is uncommitted, unpushed and unreleased, as three separate questions**,
> with what is in each.
>
> Then tell me what you wrote and what you could not verify.

**What rule 2 means, since the files outlive the chat that produced them.** "This
conversation" is the session transcript. It is not the files. A resumed session can read
every file in the repo and none of the chat, so:

- **Pointing at a file is good**, and preferred to repeating yourself: `NEXT.md`, a
  document under `docs/`, a commit hash, a tag. All readable later.
- **Pointing at the chat is worthless.** "As discussed", "per the earlier decision",
  "recover the list from the conversation" are dead ends.
- **If a fact exists only in the transcript**, write it out in full where it belongs, or
  record in plain words that it is lost. Do not leave a pointer standing in for it.

## The files, and how each session uses them

**1. `NEXT.md`, the working state.** What is true right now, with every external fact
carrying the date it was checked and the method. Read it first, treat its facts as dated,
update it whenever something ships, is verified, or is decided, and rewrite what went stale
rather than appending a correction underneath. The exception is the Decided section, where a
changed decision is added as a new entry and the old one stays, under the rule written there.
Remove finished items from In flight, as that section says.

**2. `HOWTOSAVESTATE.md`, this file.** The procedure for ending a session, and the index of
what every file here is for.

**3. `README.md`, the public documentation.** What the tool is, how it works, setup, and
rights. Written for someone deciding whether to install it. Current behaviour only: no
history and no working state.

**4. `NOTES.md`, the development history.** What happened before the first commit and why:
the fork, the discarded architectures, the ranking experiments, known gaps. Add to it when a
dead end is worth keeping. Not for current state, which goes in `NEXT.md`.

**5. `skills/pf2e-rules/SKILL.md`, the skill.** The source of truth for how the oracle
answers. Users copy it to `~/.claude/skills/`, so an edit here does not reach an installed
copy until it is copied again.

**6. Source.** `scraper.ts` builds `archives.db`. `db.ts` is the schema and search. `aon.ts`
is the live Archives of Nethys client. `mcp.ts` is the MCP server. `watcher.ts` writes change
digests to `.oracle/`. `benchmark.ts` compares local ranking with live. `config.ts` holds the
settings. Tests are in `test/`.

**7. Generated, never committed.** `archives.db` and `.oracle/`. Both are gitignored.
`archives.db` is a copy of Paizo's rules text, which this project does not redistribute.

## Step 1: check the external world, now

Nothing here is trusted from memory or from an earlier answer in the session. Record the
date with each fact, and say which checks could not run.

**The remotes and the local tree**, which is the one section every project has:

```sh
git ls-remote --heads --tags origin | tail -10
git rev-list --left-right --count origin/main...main   # left = behind, right = unpushed
git status -sb && git worktree list
```

**Whatever this project publishes or deploys.** Nothing goes to npm, and there is no deploy.
A push to `main` on GitHub is the release, so the release check is the unpushed count above,
read against the remote. To read what a user actually gets, read the file on the remote
rather than in the working tree:

    git fetch origin && git show origin/main:README.md | head
    gh repo view fbonds/oracle-of-nethys --json visibility

- **A check that cannot run here** (no credentials, a tool that will not start) is written
  down as not run, never quietly skipped.

**The test suite**, and anything that can make a green run lie: a stale build directory, a
runner that silently skips files, a fixture that regenerates what a test stripped.

## Step 2: write it into `NEXT.md`

What the file has to contain:

- **Every external fact with its date and how it was checked**, and an explicit list of
  what was not checked.
- **Decisions and their reasons**, in a section a resumed session reads before starting
  anything: what was settled, what was ruled out and why, and anything the owner said not
  to do. Without it, a resumed session redoes rejected work and argues for options already
  refused.
- **Uncommitted, unpushed and unreleased as three separate questions.** They have different
  answers. Do not write the unpushed answer as a list of commits: the owner pushes, so it
  goes stale with no commit here to record it. Write the command that answers it and a
  dated snapshot marked as not to be trusted. Record what was last released or deployed
  too, with its date and how it was checked.
- **Anything that exists only in the chat transcript, written out in full.** A long
  proposal goes in its own file under `docs/`, indexed wherever `docs/` is indexed. A
  pointer to a chat log is worth nothing to the session that reads this next.
- **Approved wording, verbatim.** Not a summary of it.
- **Traps**, in the section `NEXT.md` reserves for them: anything that cost time once and
  would cost it again. Add one the same session it bites, while the detail is still exact.
- **What not to start unprompted**, where that was said.

## Step 3: check stored memories against the repo

Stored memories load before any file is read, so a stale memory outranks a correct
`NEXT.md`. They are the one part of the system nothing else checks.

Read every stored memory for this project, compare each claim against the repo and the
checks above, and correct or delete what has drifted. A memory that names a file, a branch,
a flag or a version is checkable: check it rather than assuming it still holds. Memories
are for what the repo cannot say, such as how the owner wants to work and what is true
outside these directories; anything the files already answer belongs in the files, because
two copies of a fact drift apart and the wrong one is read first.

Then name, in the report, which memories were checked and which were changed.

## Step 4: commit, and report

Stage explicitly, by path, and confirm with `git diff --cached --stat` before committing.
Never `git commit -am`. Do not push: the owner pushes.

Then say, in the reply: what was written and where, what was verified with the date, and
**what could not be verified**, naming each thing rather than omitting it.
