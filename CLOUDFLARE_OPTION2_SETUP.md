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


## 8) Enable persistent cross-device account data (required)
Your app now supports shared cloud storage for accounts/trips **only when two things are configured**:

1. Cloudflare Worker has KV binding `AI_STORAGE` in `wrangler.toml` (or `KV_BINDING` for older deployments).
2. The deployed app points to the correct Worker URL once at build/deploy time.

### 8.1 Configure KV binding
1. Cloudflare Dashboard → Storage & Databases → KV → create namespace.
2. Copy namespace IDs.
3. In `wrangler.toml`, uncomment and fill:
```toml
[[kv_namespaces]]
binding = "AI_STORAGE"
id = "<your_kv_namespace_id>"
preview_id = "<your_kv_preview_namespace_id>"
```
4. Commit and push so GitHub Actions redeploys.

> Important: `AI_STORAGE` is the preferred binding name in this repo. The Worker also accepts `KV_BINDING` for compatibility with older deployments. If neither is bound, the Worker falls back to temporary in-memory storage and cross-device sync will stop working after reloads or across devices.



### 8.1.1 KV namespace step-by-step (exact clicks)
1. Open Cloudflare dashboard and choose your account.
2. Go to **Storage & Databases** → **KV**.
3. Click **Create namespace**.
4. Create one namespace for production (example: `travel-planner-ai-storage-prod`).
5. (Optional but recommended) Create another for preview/dev (example: `travel-planner-ai-storage-preview`).
6. Open each namespace and copy the namespace ID.

### 8.1.2 Update `wrangler.toml`
Uncomment and fill this block using the IDs:
```toml
[[kv_namespaces]]
binding = "AI_STORAGE"
id = "<PROD_NAMESPACE_ID>"
preview_id = "<PREVIEW_NAMESPACE_ID>"
```

### 8.1.3 Commit and deploy
1. Commit `wrangler.toml`.
2. Push to your deploy branch (`main` in current workflow).
3. Wait for GitHub Action `Deploy Cloudflare Worker` to pass.

### 8.1.4 Verify KV is actually used
Use your Worker URL and run the repo verifier first:
```bash
npm run verify:cloudflare -- 'https://travel-planner-ai-storage.simpsonlee71.workers.dev'
```

If you prefer raw `curl`, use:
```bash
curl -sS -X POST 'https://travel-planner-ai-storage.simpsonlee71.workers.dev'   -H 'content-type: application/json'   --data '{"id":"1","action":"set","key":"kv-check","value":{"ok":true}}'

curl -sS -X POST 'https://travel-planner-ai-storage.simpsonlee71.workers.dev'   -H 'content-type: application/json'   --data '{"id":"2","action":"get","key":"kv-check"}'
```
You should see `"exists":true` on the second response.

If `curl` fails with a proxy error such as `CONNECT tunnel failed, response 403`, the issue is usually your shell/network proxy rather than the Worker itself. In that case:

```bash
NO_PROXY=.workers.dev,workers.dev curl --noproxy '*' -4 -sS -X POST 'https://travel-planner-ai-storage.simpsonlee71.workers.dev' -H 'content-type: application/json' --data '{"id":"1","action":"set","key":"kv-check","value":{"ok":true}}'
```

Or use the browser console:

```js
fetch('https://travel-planner-ai-storage.simpsonlee71.workers.dev', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: '1', action: 'set', key: 'kv-check', value: { ok: true } })
}).then(r => r.json()).then(console.log);
```

### 8.1.5 Common failure fixes
- If deploy fails with `Invalid TOML document`, open `wrangler.toml` and remove any merge markers like:
  - `<<<<<<<`
  - `=======`
  - `>>>>>>>`
- If deploy succeeds but cross-device data still not shared:
  - Ensure `AI_STORAGE` is bound in deployed Worker.
  - Ensure both devices open the same app URL and same Worker endpoint.
  - Ensure browser extensions/privacy mode are not blocking storage/network.

### 8.2 Configure app endpoint once for all devices
The app now uses the deployed Worker endpoint automatically. You do **not** need to open devtools on every device.

For GitHub Pages, set repository variable `CLOUDFLARE_WORKER_ENDPOINT` to your Worker URL:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. Open the **Variables** tab.
3. Add or update:
   - Name: `CLOUDFLARE_WORKER_ENDPOINT`
   - Value: `https://travel-planner-ai-storage.simpsonlee71.workers.dev`
4. Re-run the **Deploy to GitHub Pages** workflow or push a commit.

After the site redeploys, every device that opens the same app URL will automatically use the new Worker endpoint.

### 8.2.1 Optional per-device override
Only use this for temporary troubleshooting. It is no longer the primary setup path:

```js
localStorage.setItem('tp-cloud-worker-endpoint', 'https://YOUR-WORKER.workers.dev');
location.reload();
```

## 8.3 Automatic synchronization behavior
The app now performs automatic sync for shared data in these cases:
- on first app load
- every 15 seconds while the app is open
- when the tab regains focus
- when the tab becomes visible again
- when the browser comes back online
- when another tab on the same device updates local storage

This means the latest shared profiles, trips, admin password, and site settings will refresh automatically on the same or different devices as long as they open the same deployed app, which now supplies the Worker endpoint automatically.


## 9) GitHub Pages app is now preconfigured for your worker URL
The GitHub Pages workflow now injects the Worker endpoint for the whole deployment using repository variable `CLOUDFLARE_WORKER_ENDPOINT` (falling back to the current default if the variable is unset). The current default endpoint is:
- `https://travel-planner-ai-storage.simpsonlee71.workers.dev`

So opening `https://simpson2002-hke.github.io/Travel-Planner-pro/` should automatically attempt cloud sync with no per-device console setup.

### If you ever need to change the worker URL
Preferred method: update GitHub Actions variable `CLOUDFLARE_WORKER_ENDPOINT` and redeploy GitHub Pages once.

Only if you need a temporary device-specific override, run in browser console:

```js
localStorage.setItem('tp-cloud-worker-endpoint', 'https://YOUR-WORKER.workers.dev');
location.reload();
```
