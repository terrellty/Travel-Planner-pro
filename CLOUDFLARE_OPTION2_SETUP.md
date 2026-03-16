# Cloudflare Worker + GitHub Actions (Option 2) Setup

This guide links your GitHub repo to Cloudflare Worker deployments using `wrangler` in GitHub Actions.

## What was added
- `wrangler.toml` (Worker config)
- `.github/workflows/deploy-worker.yml` (auto deploy workflow)

## 1) Confirm your default deploy branch
This workflow deploys when pushing to `main`.

If your branch is not `main`, edit `.github/workflows/deploy-worker.yml`:
```yaml
on:
  push:
    branches:
      - your-branch-name
```

## 2) Create a Cloudflare API Token
1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token**.
2. Use **Edit Cloudflare Workers** template (or custom token).
3. Minimum token permissions:
   - `Account` → `Cloudflare Workers Scripts` → `Edit`
   - `Account` → `Account Settings` → `Read`
4. Scope the token to your Cloudflare account.
5. Copy the token value.

## 3) Find your Cloudflare Account ID
- Dashboard right sidebar shows **Account ID**, or
- Workers & Pages account overview page.

## 4) Add GitHub repository secrets
GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
- `CLOUDFLARE_API_TOKEN` = (token from step 2)
- `CLOUDFLARE_ACCOUNT_ID` = (account id from step 3)

## 5) Push changes to trigger deploy
Push commits to the configured branch (`main` by default).

The workflow triggers only when these files change:
- `worker-ai-storage.js`
- `wrangler.toml`
- `.github/workflows/deploy-worker.yml`

You can also run it manually from GitHub Actions via **workflow_dispatch**.

## 6) Verify deployment
1. GitHub → **Actions** → open `Deploy Cloudflare Worker` run.
2. Ensure all steps pass.
3. Cloudflare Dashboard → Workers & Pages → verify script updates and test endpoint.

## 7) (Optional) Deploy to a custom domain route
In `wrangler.toml`, uncomment and edit the `routes` example:
```toml
routes = [{ pattern = "api.example.com/worker-ai-storage/*", zone_name = "example.com" }]
```
Then commit and push.

## Troubleshooting
- **Error: authentication failed**
  - Recheck `CLOUDFLARE_API_TOKEN` secret value and token permissions.
- **Error: account id missing/invalid**
  - Recheck `CLOUDFLARE_ACCOUNT_ID` secret value.
- **No workflow run on push**
  - Confirm push branch matches workflow branch.
  - Confirm at least one watched path changed.
- **Need deploy every push regardless of file path**
  - Remove the `paths:` block from workflow trigger.
