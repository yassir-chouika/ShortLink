# Git workflow

## Current checkpoint

The local repository is initialized on `main` with no commits. The public GitHub
repository `yassir-chouika/ShortLink` exists and is accessible. No local remote,
commit, or push has been performed. The lockfile has been generated, and all six
README verification commands passed locally under Node.js 24.22.1. The first
commit and push are ready for you to perform after reviewing the files.

The scaffold spans `src/app/`, `tests/`, the root tooling and environment examples,
`.github/workflows/ci.yml`, `README.md`, and `docs/`. Review those files together
as one foundation milestone; do not split it into unnecessary activity commits.

## First push

These are instructions to run after verification; they have not been executed.
From the project directory, inspect your author identity:

```bash
git branch --show-current
git config user.name
git config user.email
```

The branch should be `main`. If the author values are missing, configure them
locally with your own details. Use your GitHub-provided private commit email from
GitHub **Settings > Emails** if you do not want to publish a personal email:

```bash
git config --local user.name "YOUR NAME"
git config --local user.email "YOUR GITHUB COMMIT EMAIL"
```

After installation, formatting, and every check in the README succeeds:

```bash
git status --short
git add .
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Confirm `package-lock.json` is included and that `node_modules`, `.next`, local
environment files, and secrets are absent. Before this first commit, unstage an
unintended file with `git rm --cached -- PATH`; this keeps the file on disk.

```bash
git commit -m "chore: initialize ShortLink development foundation"
git remote add origin https://github.com/yassir-chouika/ShortLink.git
git remote -v
git push -u origin main
```

If `origin` is already present, inspect it instead of adding it again. For HTTPS
authentication, use GitHub's supported credential manager or an authenticated GitHub
CLI; account passwords cannot authenticate Git pushes. Never embed a token in a
remote URL or commit it. If Git rejects the push because the remote has changed,
fetch and inspect it; do not force-push over unknown history.

Open the repository's **Actions** tab and wait for the CI run to pass. No PR is
necessary for this initial verified baseline. Import it into Vercel Hobby when
ready, using [the deployment guide](deployment.md). This initial push triggers
GitHub Actions; it triggers Vercel production only if the project is already
connected with `main` as its production branch.

## Later milestones

Start Phase 1 only after the Phase 0 checkpoint is verified:

```bash
git switch main
git pull --ff-only
git switch -c feat/database-foundation
```

Work in small, complete milestones, updating tests and documentation with each
feature. Commit after the related checks pass. Push the branch when its milestone
is ready for review:

```bash
git push -u origin feat/database-foundation
```

Create a pull request into `main`. Once Vercel is connected this push creates a
preview, while opening the PR runs CI. Review the diff, green CI, and working
preview, then merge the PR. The merge triggers production deployment from `main`.
Do not merge unverified changes or run preview migrations against production.

## Continue from another computer

First publish the latest committed work from the first computer. On a new machine:

```bash
git clone https://github.com/yassir-chouika/ShortLink.git
cd ShortLink
git switch --track origin/feat/database-foundation
nvm install
nvm use
npm ci
npx playwright install chromium
```

If the checkout already exists and the feature branch already exists locally:

```bash
git fetch origin
git switch feat/database-foundation
git pull --ff-only
npm ci
```

Use the branch relevant to the current milestone; for the Phase 0 baseline, remain
on `main`. Recreate ignored environment files securely when they are needed.
Uncommitted files and local secrets are not transferred by Git.
