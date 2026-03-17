# Cloudflare Worker + GitHub Actions (Option 2) Setup

This guide is now aligned to your exact configuration:
- Worker name: `travel-planner-ai-storage-prod`
- KV binding: `KV_BINDING`
- KV id: `ea9af737d45f4bd4a0f750584725472d`
- workers.dev URL: `https://travel-planner-ai-storage-prod.simpsonts-lee.workers.dev`

## 5) Configure KV binding (required for shared account/trip data)

### 5.1 What binding name means
`binding` is the variable name exposed in Worker runtime `env`.
In this project, code supports both `KV_BINDING` (your current config) and `AI_STORAGE` (legacy fallback).

### 5.2 Exact `wrangler.toml`
```toml
name = "travel-planner-ai-storage-prod"
main = "worker-ai-storage.js"
compatibility_date = "2026-03-16"
workers_dev = true

[[kv_namespaces]]
binding = "KV_BINDING"
id = "ea9af737d45f4bd4a0f750584725472d"
```

### 5.3 Verify KV works
```bash
curl -sS -X POST 'https://travel-planner-ai-storage-prod.simpsonts-lee.workers.dev'   -H 'content-type: application/json'   --data '{"id":"1","action":"set","key":"kv-check","value":{"ok":true}}'

curl -sS -X POST 'https://travel-planner-ai-storage-prod.simpsonts-lee.workers.dev'   -H 'content-type: application/json'   --data '{"id":"2","action":"get","key":"kv-check"}'
```
Expected: second response includes `"exists":true`.

## 6) Entire frontend env setup

1. Create local env file:
```bash
cp .env.example .env.local
```

2. Confirm `.env.local` contains:
```dotenv
VITE_CLOUD_WORKER_ENDPOINT=https://travel-planner-ai-storage-prod.simpsonts-lee.workers.dev
```

3. Restart dev server after env changes:
```bash
npm run dev
```

4. For CI/production build, set the same env var in build environment:
- `VITE_CLOUD_WORKER_ENDPOINT=https://travel-planner-ai-storage-prod.simpsonts-lee.workers.dev`

5. Because you already stored keys in GitHub, just ensure build workflow exports this env variable before `npm run build`.

6. Clear stale endpoint on each device once:
```js
localStorage.removeItem('tp-cloud-worker-endpoint');
location.reload();
```

## 7) Preview URLs
Your preview pattern is:
- `*-travel-planner-ai-storage-prod.simpsonts-lee.workers.dev`

If you use preview deployment URLs for frontend, keep frontend and worker environment aligned (preview frontend should point to matching preview worker URL).

## 8) End-to-end cross-device check
1. Device A: login and create trip `sync-test-1`.
2. Device B: same app URL + same account.
3. Confirm `sync-test-1` appears.
4. Device B edits trip name.
5. Device A refresh and confirm update.
