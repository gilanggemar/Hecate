# Hecate — External Services Manual Rename Guide

> After completing the internal codebase rename from NERV.OS → Hecate, the following external
> services and configurations still reference the old name. This document explains **what** needs
> to change, **why**, and **what happens if you don't**.

---

## 1. GitHub Repository

| Item | Current | Target |
|---|---|---|
| Repo name | `NERV` (under `gilanggemar`) | `Hecate` |
| Default description | References NERV.OS | Update to Hecate |

**Why rename?**
- All Vercel deployments are linked to this repo name
- The `nerv_mcp` file still exists alongside the new `hecate_mcp` — delete `nerv_mcp` after verification
- The local folder `NERV.OS` should be renamed to `Hecate` to match

**What happens if you don't?**
- Functionally nothing breaks — Git doesn't care about repo names at the protocol level
- But every Vercel deployment, CI/CD pipeline, and collaborator URL will still show `NERV`
- The `tools/upload_vercel_env.js` hardcoded path will need updating after folder rename

**How to rename:**
1. Go to GitHub → Settings → Repository name → Change to `Hecate`
2. Update local remote: `git remote set-url origin https://github.com/gilanggemar/Hecate.git`
3. Rename local folder from `NERV.OS` to `Hecate`

---

## 2. Vercel Project

| Item | Current | Target |
|---|---|---|
| Project name | `nerv` | `hecate` |
| Production domain | `nerv-phi.vercel.app` | `hecate.vercel.app` (or custom domain) |
| Environment variables | `NERV_ENCRYPTION_KEY` | `HECATE_ENCRYPTION_KEY` |

**Why rename?**
- The codebase now reads `HECATE_ENCRYPTION_KEY` (not `NERV_ENCRYPTION_KEY`)
- If you don't add/rename the env var on Vercel, the app will fall back to the **insecure default key**
- Preview/production URLs will still say `nerv`

**What happens if you don't?**
- ⚠️ **CRITICAL**: If `NERV_ENCRYPTION_KEY` is set on Vercel but the code now reads `HECATE_ENCRYPTION_KEY`, the app will use the fallback key and **all encrypted data will be undecryptable**
- You MUST add `HECATE_ENCRYPTION_KEY` with the **same value** as the old `NERV_ENCRYPTION_KEY`
- After confirming the new var works, you can remove the old one

**How to rename:**
1. Go to Vercel → Project Settings → Environment Variables
2. Add `HECATE_ENCRYPTION_KEY` with the same value as `NERV_ENCRYPTION_KEY`
3. Optionally rename the project from `nerv` to `hecate` in General Settings
4. Redeploy to pick up the new env var

---

## 3. Supabase

### 3a. Project Name

| Item | Current | Target |
|---|---|---|
| Project display name | May reference NERV | Update to Hecate |

**Why rename?**
- Purely cosmetic — Supabase uses the project ID internally, not the display name
- Helps with organization in the Supabase dashboard

**What happens if you don't?**
- Nothing breaks. It's just a label.

### 3b. Storage Bucket

| Item | Current | Target |
|---|---|---|
| Bucket name | `nerv-images` | `hecate-images` |

**Why rename?**
- The codebase (`supabaseStorage.ts` and `api/storage/sync/route.ts`) now references `hecate-images`
- If the Supabase bucket is still named `nerv-images`, **all image uploads/downloads will fail (404)**

**What happens if you don't?**
- ❌ **BREAKING**: Image uploads and agent avatar syncing will fail
- You have two options:
  1. **Rename the bucket** on Supabase to `hecate-images`
  2. **Or** create a new `hecate-images` bucket and migrate existing files

**How to rename:**
1. Go to Supabase → Storage → Find `nerv-images` bucket
2. Supabase doesn't support direct bucket rename — you need to:
   - Create a new `hecate-images` bucket with the same policies
   - Copy all files from `nerv-images` to `hecate-images`
   - Delete the old bucket (optional)
3. Alternatively, update the RLS policies on the new bucket to match

### 3c. Environment Variable in MCP Server

| Item | Current | Target |
|---|---|---|
| MCP env var | `NERV_USER_ID` | `HECATE_USER_ID` |

**Why rename?**
- The `dashboard-mcp/src/config.ts` now reads `HECATE_USER_ID`
- This variable scopes all Supabase queries to the correct user

**What happens if you don't?**
- ❌ **BREAKING**: The MCP server will crash on startup with `"HECATE_USER_ID environment variable is required"`

**How to fix:**
1. In your MCP server environment (e.g., `.env` file or shell config), rename:
   ```
   NERV_USER_ID=your-uuid → HECATE_USER_ID=your-uuid
   ```

---

## 4. OpenClaw / Agent Zero Gateway

| Item | Current | Target |
|---|---|---|
| Client ID in gateway | `nerv-dashboard` | `hecate-dashboard` |
| User agent string | `nerv-dashboard/0.1.0` | `hecate-dashboard/0.1.0` |

**Why rename?**
- Already changed in code (`openclawGateway.ts`)
- The gateway server may have ACLs or logging keyed to the old client ID

**What happens if you don't?**
- If the gateway has hardcoded ACLs checking for `nerv-dashboard`, connections may be rejected
- If using open registration, nothing breaks — the new client ID will register automatically

**How to fix:**
1. Update any gateway-side ACLs/allowlists from `nerv-dashboard` to `hecate-dashboard`
2. Update any monitoring/logging filters accordingly

---

## 5. API Keys & Webhook Secrets

| Item | Current | Target |
|---|---|---|
| Webhook env var | `NERV_WEBHOOK_SECRET` | `HECATE_WEBHOOK_SECRET` |
| Encryption key | `NERV_ENCRYPTION_KEY` | `HECATE_ENCRYPTION_KEY` |

**Why rename?**
- Code now reads `HECATE_WEBHOOK_SECRET` as a fallback for `OPENCLAW_WEBHOOK_SECRET`
- Code now reads `HECATE_ENCRYPTION_KEY` for encryption

**What happens if you don't?**
- If only `NERV_WEBHOOK_SECRET` is set in your env, webhook validation will fail (unless `OPENCLAW_WEBHOOK_SECRET` is also set — that one takes priority)
- Encryption will fall back to the insecure default key

**How to fix:**
1. Add `HECATE_WEBHOOK_SECRET` and `HECATE_ENCRYPTION_KEY` to your environment
2. Use the **same values** as the old `NERV_*` equivalents
3. Remove old vars after confirming everything works

---

## 6. Local Files to Clean Up

| File | Action |
|---|---|
| `nerv_mcp` (root) | Delete after verifying `hecate_mcp` works |
| `NervSkeleton.tsx` | Delete after verifying `HecateSkeleton.tsx` works (currently unused by imports) |
| `RENAME_IMPACT_ANALYSIS.md` | Archive or delete — migration is complete |

---

## 7. Priority Order

> [!IMPORTANT]
> Complete these in order to avoid breaking the production app:

1. **Vercel env var** — Add `HECATE_ENCRYPTION_KEY` with same value as old key ⚡
2. **Supabase bucket** — Create `hecate-images` and migrate files 🗄️
3. **MCP server env** — Rename `NERV_USER_ID` → `HECATE_USER_ID` 🔧
4. **Vercel redeploy** — After env vars are set 🚀
5. **GitHub repo rename** — Cosmetic, lowest risk 📝
6. **Gateway ACLs** — If applicable 🔒
7. **Clean up old files** — `nerv_mcp`, `NervSkeleton.tsx` 🧹

---

## Summary

| Service | Risk if not renamed | Priority |
|---|---|---|
| Vercel env vars | ❌ **Data loss** (encryption fallback) | **CRITICAL** |
| Supabase bucket | ❌ **App broken** (image 404s) | **HIGH** |
| MCP server env | ❌ **Server crash** | **HIGH** |
| Gateway ACLs | ⚠️ Connection rejected (if ACLs exist) | MEDIUM |
| Webhook secret | ⚠️ Webhook validation fails | MEDIUM |
| GitHub repo name | ✅ Cosmetic only | LOW |
| Supabase project name | ✅ Cosmetic only | LOW |
| Vercel project name | ✅ Cosmetic only | LOW |
