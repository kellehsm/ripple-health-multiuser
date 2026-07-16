# Ripple Wellness — Frontend DEV (CLAUDE.md)

This is the **development** working copy of the frontend. All new feature work happens here first.

## Dev environment

| | Production | Dev (this directory) |
|---|---|---|
| Directory | `/root/wellness-fresh-multiuser` | `/root/wellness-fresh-multiuser-dev` |
| Git branch | `master` | `dev` |
| Backend URL | `https://app.kels.gg/api` | **`http://129.121.125.214:4002`** |
| Metro port | 8081 | **8082** (use `--port 8082` to avoid conflicts) |
| Test via | EAS APK | **Expo Go** (cleartext HTTP allowed in Expo Go) |

Both repos are git worktrees — same remote (`kellehsm/ripple-health-multiuser`), different branches.

The `BASE_URL` change is in `src/api/client.ts` line 3. Do not accidentally sync it to the production directory.

## Starting the dev Metro bundler

```bash
cd /root/wellness-fresh-multiuser-dev
npx expo start --port 8082
```

Scan the QR code in Expo Go. The app will talk to the dev backend at `http://129.121.125.214:4002`.

**Note:** The dev backend uses `wellness_multiuser_dev` (empty database) — you'll need to create a user via the admin endpoint before logging in:
```bash
curl -X POST http://localhost:4002/api/auth/create-user \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: ripple-admin-2026" \
  -d '{"email":"test@example.com","password":"testpassword"}'
```

## Promoting dev → production

When frontend changes are confirmed working in Expo Go:

1. **Commit and push on `dev` branch** (from this directory):
   ```bash
   git add -A && git commit -m "..." && git push origin dev
   ```

2. **Merge into production** — two options (ask the user which they prefer):
   - **Direct merge (no PR):** In `/root/wellness-fresh-multiuser`:
     ```bash
     git fetch origin && git merge origin/dev && git push origin master
     ```
   - **Pull request:** Open a PR from `dev` → `master` on GitHub for review before merging.

3. **If the change is JS-only:** The production app (installed APK) will NOT update automatically — a new EAS build is required if you want users to get the change. Discuss with user before triggering a build.

4. **EAS build policy:** NEVER run `eas build` without explicit user approval. Batch all native-touching changes together before asking.

## Inherited rules (apply here too)

- **Do NOT run `eas build` without explicit user approval.**
- App identity: Ripple Wellness, four-quadrant droplet icon, Bold Outline design language.
- Use `useFocusEffect` (not `useEffect`) for permission status checks.
- Correlation language: descriptive only, never diagnostic or causal.
- Check the database before assuming a feature is broken — "backend works, no UI" is a common shape.

## Git

Both worktrees share the same `.git` history. Dev branch diverges from master — commit freely here, merge to master only when confirmed working.
