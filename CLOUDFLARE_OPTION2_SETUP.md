# Cloudflare Worker + GitHub Actions (Option 2) Setup

This guide links your GitHub repo to Cloudflare Worker deployments using `wrangler` in GitHub Actions and configures the app to use a Worker endpoint from an environment file.

## What was added
- `wrangler.toml` (Worker config)
- `.github/workflows/deploy-worker.yml` (auto deploy workflow)
- `.env.example` (frontend Worker URL config template)

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

## 5) Configure KV binding (required for shared account/trip data)
1. Cloudflare Dashboard → **Storage & Databases** → **KV**.
2. Click **Create namespace** and create:
   - one production namespace (example: `travel-planner-ai-storage-prod`)
   - one preview namespace (recommended)
3. Copy namespace IDs.
4. In `wrangler.toml`, ensure `[[kv_namespaces]]` is configured and uses binding name `AI_STORAGE`.

Example:
```toml
[[kv_namespaces]]
binding = "AI_STORAGE"
id = "<PROD_NAMESPACE_ID>"
preview_id = "<PREVIEW_NAMESPACE_ID>"
```

> Important: if binding is not exactly `AI_STORAGE`, the Worker will not read/write shared trip data.

## 6) Configure frontend Worker URL using env file
This project now reads the Worker URL from Vite env var `VITE_CLOUD_WORKER_ENDPOINT`.

### Local development
1. Create local env file from template:
```bash
cp .env.example .env.local
```
2. Edit `.env.local` and set your deployed Worker URL:
```dotenv
VITE_CLOUD_WORKER_ENDPOINT=https://travel-planner-worker-ai-storage.<your-subdomain>.workers.dev
```
3. Start dev server:
```bash
npm run dev
```

### Production / CI builds
Set `VITE_CLOUD_WORKER_ENDPOINT` in the environment used for `npm run build`.

For GitHub Pages + Actions, add repository variable or secret and expose it to the build step.

## 7) Deploy worker and app
1. Commit your changes.
2. Push to deploy branch (`main` by default).
3. Wait for GitHub Action `Deploy Cloudflare Worker` to pass.
4. Deploy/update frontend so it includes the correct `VITE_CLOUD_WORKER_ENDPOINT` value.

## 8) Verify cross-device sync
1. Open app on device A and create/update account or trip.
2. Open the same deployed app on device B.
3. Sign in with same account; data should match.

Optional API test:
```bash
curl -sS -X POST 'https://YOUR-WORKER.workers.dev' \
  -H 'content-type: application/json' \
  --data '{"id":"1","action":"set","key":"kv-check","value":{"ok":true}}'

curl -sS -X POST 'https://YOUR-WORKER.workers.dev' \
  -H 'content-type: application/json' \
  --data '{"id":"2","action":"get","key":"kv-check"}'
```
Second response should include `"exists":true`.

## Troubleshooting
- **No shared data across devices**
  - Confirm frontend build contains correct `VITE_CLOUD_WORKER_ENDPOINT`.
  - Confirm Worker has KV binding named `AI_STORAGE`.
  - Confirm both devices open the same app deployment.
- **Deploy fails with TOML error**
  - Remove any merge markers (`<<<<<<<`, `=======`, `>>>>>>>`) from `wrangler.toml`.
- **Authentication failed in GitHub Action**
  - Recheck `CLOUDFLARE_API_TOKEN` permissions and secret value.
