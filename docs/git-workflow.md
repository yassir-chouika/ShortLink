# Git workflow

## Current checkpoint

Phase 0 is committed as `8c53ff4` on `main`, pushed to
`yassir-chouika/ShortLink`, and its GitHub CI run passed. The existing `origin`
uses SSH. The current local branch is `feat/database-foundation`; no Phase 1
commit or push has been performed. GitHub operations remain yours to perform.

## Phase 1 checkpoint

Review `prisma/`, both Prisma config files, `src/lib/`, database tests, Compose,
the CI workflow, environment example, package manifest and lockfile, and docs.
Include the SQL migration and migration lock; generated Prisma code and real
environment files must remain untracked.

After all local checks in the README and database guide pass:

```bash
git status --short --branch
git add .
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "feat: add PostgreSQL and Prisma database foundation"
git push -u origin feat/database-foundation
```

Open a PR with base `main` and compare `feat/database-foundation`. Opening the PR
runs both application quality and PostgreSQL integration jobs. If Vercel is
connected, the branch push creates a preview. Review the diff, both green CI jobs,
and any preview before merging. Merging into `main` triggers production when
Vercel is connected. This phase has no public database routes and needs no hosted
migration for the introduction page.

Do not add `origin` again, push Phase 1 directly to `main`, or tag a release yet.

## First push

This Phase 0 step is completed. The commands below are a reference for a new
repository; do not repeat them on the current feature branch. Inspect author
identity when setting up another computer:

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

The Phase 1 branch has already been created locally. For a future milestone,
start a new short-lived branch from updated `main` (this example is for Phase 2):

```bash
git switch main
git pull --ff-only
git switch -c feat/link-creation
```

Work in small, complete milestones, updating tests and documentation with each
feature. Commit after the related checks pass. Push the branch when its milestone
is ready for review:

```bash
git push -u origin feat/link-creation
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
